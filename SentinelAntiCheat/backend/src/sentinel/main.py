from __future__ import annotations

from datetime import UTC, datetime
from typing import Union

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from sentinel.config import settings
from sentinel.repositories.audit import AuditRepository
from sentinel.repositories.supabase import SupabaseConfig, SupabaseRepository
from sentinel.schemas import AnalyzePgnRequest, AnalyzeRequest, AnalyzeResponse, TournamentSummaryResponse
from sentinel.services.feature_pipeline import compute_features
from sentinel.services.pgn_engine_pipeline import create_engine_context, game_to_inputs, parse_pgn_games
from sentinel.services.policy import natural_occurrence_probability, natural_occurrence_statement
from sentinel.services.risk_engine import classify
from sentinel.services.signal_layers import evaluate_all_layers

app = FastAPI(title="Sentinel Anti-Cheat API", version="0.1.0")
audit_repo = AuditRepository(settings.db_path)
supabase_repo: SupabaseRepository | None = None
if settings.supabase_url and settings.supabase_service_role_key:
    supabase_repo = SupabaseRepository(
        SupabaseConfig(
            url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
            schema=settings.supabase_schema,
        )
    )
allowed_origins = [o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _risk_rank(tier: str) -> int:
    order = {
        "HIGH_STATISTICAL_ANOMALY": 4,
        "ELEVATED": 3,
        "MODERATE": 2,
        "LOW": 1,
    }
    return order.get(tier, 0)


@app.get("/v1/dashboard-feed")
def dashboard_feed(limit: int = 200, event_id: str | None = None) -> dict:
    rows = audit_repo.recent(limit=limit, event_id=event_id)
    game_map: dict[tuple[str, str], dict] = {}
    alerts: list[dict] = []

    for row in rows:
        req = row.get("request", {})
        resp = row.get("response", {})
        player_id = str(req.get("player_id") or resp.get("player_id") or "unknown")
        event_val = str(req.get("event_id") or resp.get("event_id") or "unknown")
        key = (event_val, player_id)
        weighted = float(resp.get("weighted_risk_score") or 0.0)
        risk_tier = str(resp.get("risk_tier") or "LOW")
        confidence = float(resp.get("confidence") or 0.0)
        created_at = str(row.get("created_at") or "")
        moves_count = int(resp.get("analyzed_move_count") or 0)
        req_elo = int(req.get("official_elo") or 0)

        # Keep newest row per player+event as game-card snapshot.
        existing = game_map.get(key)
        if existing is None:
            base = max(0.05, min(0.98, weighted))
            spark = [
                round(max(0.0, min(1.0, base * f)), 3)
                for f in (0.62, 0.67, 0.71, 0.76, 0.79, 0.84, 0.88, 0.93, 0.97, 1.0)
            ]
            game_map[key] = {
                "game_id": f"{event_val}:{player_id}",
                "event_id": event_val,
                "player_id": player_id,
                "official_elo": req_elo,
                "move_number": moves_count,
                "risk_tier": risk_tier,
                "confidence": confidence,
                "weighted_risk_score": weighted,
                "sparkline": spark,
                "audit_id": row["id"],
                "created_at": created_at,
            }

        for sig in resp.get("signals", []):
            if not sig.get("triggered"):
                continue
            alerts.append(
                {
                    "id": f"{row['id']}:{sig.get('name')}",
                    "timestamp": created_at,
                    "event_id": event_val,
                    "player_id": player_id,
                    "layer": str(sig.get("name") or "signal"),
                    "score": float(sig.get("score") or 0.0),
                    "threshold": float(sig.get("threshold") or 0.0),
                    "description": (sig.get("reasons") or ["Signal threshold exceeded"])[0],
                    "audit_id": row["id"],
                }
            )

    games = list(game_map.values())
    games.sort(key=lambda x: (-float(x["weighted_risk_score"]), -_risk_rank(x["risk_tier"]), x["created_at"]), reverse=False)
    alerts.sort(key=lambda x: x["timestamp"], reverse=True)

    elevated_count = len([g for g in games if _risk_rank(g["risk_tier"]) >= 3])
    avg_regan = 0.0
    if rows:
        regans = [float((r.get("response", {}) or {}).get("regan_z_score") or 0.0) for r in rows]
        avg_regan = sum(regans) / len(regans) if regans else 0.0

    return {
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "games": games,
        "alerts": alerts[:300],
        "summary": {
            "total_games_analyzed_today": len(rows),
            "games_elevated_or_above": elevated_count,
            "awaiting_review_count": len(alerts),
            "average_regan_z_score": round(avg_regan, 4),
        },
    }


def _run_analysis(
    req: AnalyzeRequest,
    *,
    pgn_text: str | None = None,
    parsed_games: list[dict] | None = None,
    player_color: str | None = None,
    opponent_player_id: str | None = None,
) -> AnalyzeResponse:
    features = compute_features(req)
    if req.high_stakes_event and not features.timing_available:
        raise HTTPException(
            status_code=400,
            detail="High-stakes event requires clock data (%clk) in PGN/move inputs",
        )

    layers = evaluate_all_layers(features)
    tier, conf, explanation, weighted_score = classify(features, layers)

    if features.analyzed_move_count == 0:
        explanation.append("No non-trivial positions after opening/endgame/forced filtering")

    explanation.extend(r for l in layers for r in l.reasons)

    response_payload = {
        "player_id": req.player_id,
        "event_id": req.event_id,
        "risk_tier": tier.value,
        "confidence": conf,
        "analyzed_move_count": features.analyzed_move_count,
        "triggered_signals": len([l for l in layers if l.triggered]),
        "weighted_risk_score": weighted_score,
        "signals": [
            {
                "name": l.name,
                "triggered": l.triggered,
                "score": round(float(l.score), 4),
                "threshold": round(float(l.threshold), 4),
                "reasons": l.reasons,
            }
            for l in layers
        ],
        "explanation": explanation,
        "model_version": settings.model_version,
        "feature_schema_version": settings.feature_schema_version,
        "report_schema_version": settings.report_schema_version,
        "natural_occurrence_statement": natural_occurrence_statement(features.regan_z_score, features.regan_threshold),
        "natural_occurrence_probability": natural_occurrence_probability(features.regan_z_score, features.regan_threshold),
        "regan_z_score": features.regan_z_score,
        "regan_threshold": features.regan_threshold,
        "pep_score": features.pep_score,
        "superhuman_move_rate": features.superhuman_move_rate,
        "rating_adjusted_move_probability": features.rating_adjusted_move_probability,
        "opening_familiarity_index": features.opening_familiarity_index,
        "opponent_strength_correlation": features.opponent_strength_correlation,
        "round_anomaly_clustering_score": features.round_anomaly_clustering_score,
        "complex_blunder_rate": features.complex_blunder_rate,
        "zero_blunder_in_complex_games_flag": features.zero_blunder_in_complex_games_flag,
        "move_quality_uniformity_score": features.move_quality_uniformity_score,
        "stockfish_maia_divergence": features.stockfish_maia_divergence,
        "maia_humanness_score": features.maia_humanness_score,
        "maia_personalization_confidence": features.maia_personalization_confidence,
        "maia_model_version": features.maia_model_version,
        "confidence_intervals": {
            k: ([float(v[0]), float(v[1])] if v is not None else None) for k, v in features.confidence_intervals.items()
        },
    }

    request_payload = req.model_dump()
    audit_id = audit_repo.write({"request": request_payload, "response": response_payload}, model_version=settings.model_version)
    persisted_to_supabase = False
    if supabase_repo is not None:
        try:
            supabase_repo.persist_analysis(
                player_id=req.player_id,
                event_id=req.event_id,
                audit_id=audit_id,
                weighted_risk_score=weighted_score,
                model_version=settings.model_version,
                feature_schema_version=settings.feature_schema_version,
                report_schema_version=settings.report_schema_version,
                legal_disclaimer_text=settings.legal_disclaimer_text,
                human_review_required=(tier.value == "HIGH_STATISTICAL_ANOMALY"),
                event_type=req.event_type,
                regan_threshold_used=features.regan_threshold,
                natural_occurrence_statement=response_payload["natural_occurrence_statement"],
                natural_occurrence_probability=response_payload["natural_occurrence_probability"],
                response_payload=response_payload,
                request_payload=request_payload,
            )
            if pgn_text is not None and parsed_games and player_color and opponent_player_id:
                supabase_repo.persist_pgn_details(
                    event_id=req.event_id,
                    player_id=req.player_id,
                    opponent_player_id=opponent_player_id,
                    player_color=player_color,
                    pgn_text=pgn_text,
                    parsed_games=parsed_games,
                )
            persisted_to_supabase = True
        except Exception as exc:
            if settings.persistence_fail_hard:
                raise HTTPException(
                    status_code=500,
                    detail=f"Supabase persistence failed: {supabase_repo.error_text(exc)}",
                ) from exc
            explanation.append(f"Supabase persistence warning: {supabase_repo.error_text(exc)}")

    return AnalyzeResponse(**response_payload, audit_id=audit_id, persisted_to_supabase=persisted_to_supabase)


@app.post("/v1/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    return _run_analysis(req)


@app.post("/v1/analyze-pgn", response_model=AnalyzeResponse)
def analyze_pgn(req: AnalyzePgnRequest) -> AnalyzeResponse:
    games = parse_pgn_games(req.pgn_text)
    if not games:
        raise HTTPException(status_code=400, detail="No PGN games parsed from pgn_text")

    try:
        ctx = create_engine_context()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        parsed_games = [
            game_to_inputs(
                game=g,
                game_id=f"{req.event_id}:{req.player_id}:pgn-{idx+1}",
                player_color=req.player_color,
                ctx=ctx,
            )
            for idx, g in enumerate(games)
        ]
    finally:
        ctx.close()

    normalized = AnalyzeRequest(
        player_id=req.player_id,
        event_id=req.event_id,
        event_type=req.event_type,
        official_elo=req.official_elo,
        high_stakes_event=req.high_stakes_event,
        performance_rating_this_event=req.performance_rating_this_event,
        games=parsed_games,
        historical=req.historical,
    )
    return _run_analysis(
        normalized,
        pgn_text=req.pgn_text,
        parsed_games=[g.model_dump() for g in parsed_games],
        player_color=req.player_color,
        opponent_player_id=req.opponent_player_id,
    )


@app.post("/v1/tournament-summary", response_model=TournamentSummaryResponse)
def tournament_summary(req: Union[AnalyzeRequest, AnalyzePgnRequest]) -> TournamentSummaryResponse:
    if isinstance(req, AnalyzePgnRequest):
        games = parse_pgn_games(req.pgn_text)
        if not games:
            raise HTTPException(status_code=400, detail="No PGN games parsed from pgn_text")

        try:
            ctx = create_engine_context()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        try:
            parsed_games = [
                game_to_inputs(
                    game=g,
                    game_id=f"{req.event_id}:{req.player_id}:pgn-{idx+1}",
                    player_color=req.player_color,
                    ctx=ctx,
                )
                for idx, g in enumerate(games)
            ]
        finally:
            ctx.close()

        req = AnalyzeRequest(
            player_id=req.player_id,
            event_id=req.event_id,
            event_type=req.event_type,
            official_elo=req.official_elo,
            high_stakes_event=req.high_stakes_event,
            performance_rating_this_event=req.performance_rating_this_event,
            games=parsed_games,
            historical=req.historical,
        )

    overall = compute_features(req)
    per_game = []
    for g in req.games:
        one = AnalyzeRequest(
            player_id=req.player_id,
            event_id=req.event_id,
            event_type=req.event_type,
            official_elo=req.official_elo,
            high_stakes_event=req.high_stakes_event,
            performance_rating_this_event=req.performance_rating_this_event,
            games=[g],
            historical=req.historical,
        )
        fg = compute_features(one)
        per_game.append(
            {
                "game_id": g.game_id,
                "analyzed_move_count": fg.analyzed_move_count,
                "ipr_estimate": fg.ipr_estimate,
                "pep_score": fg.pep_score,
                "regan_z_score": fg.regan_z_score,
                "regan_threshold": fg.regan_threshold,
            }
        )

    return TournamentSummaryResponse(
        player_id=req.player_id,
        event_id=req.event_id,
        event_type=req.event_type,
        games_count=len(req.games),
        analyzed_move_count=overall.analyzed_move_count,
        ipr_estimate=overall.ipr_estimate,
        pep_score=overall.pep_score,
        regan_z_score=overall.regan_z_score,
        regan_threshold=overall.regan_threshold,
        confidence_intervals={
            k: ([float(v[0]), float(v[1])] if v is not None else None) for k, v in overall.confidence_intervals.items()
        },
        per_game=per_game,
    )
