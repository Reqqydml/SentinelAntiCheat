from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib import error, request


@dataclass
class SupabaseConfig:
    url: str
    service_role_key: str
    schema: str = "public"


class SupabaseRepository:
    def __init__(self, cfg: SupabaseConfig) -> None:
        self.cfg = cfg

    def _headers(self, prefer: str | None = None) -> dict[str, str]:
        h = {
            "apikey": self.cfg.service_role_key,
            "Authorization": f"Bearer {self.cfg.service_role_key}",
            "Content-Type": "application/json",
            "Accept-Profile": self.cfg.schema,
            "Content-Profile": self.cfg.schema,
        }
        if prefer:
            h["Prefer"] = prefer
        return h

    def _post(self, path: str, payload: list[dict], prefer: str | None = None) -> None:
        endpoint = f"{self.cfg.url.rstrip('/')}/rest/v1/{path}"
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(endpoint, data=body, method="POST", headers=self._headers(prefer))
        with request.urlopen(req, timeout=15):
            return

    def persist_analysis(
        self,
        *,
        player_id: str,
        event_id: str,
        event_type: str,
        audit_id: str,
        weighted_risk_score: float,
        regan_threshold_used: float,
        natural_occurrence_statement: str,
        natural_occurrence_probability: float | None,
        model_version: str,
        feature_schema_version: str,
        report_schema_version: str,
        legal_disclaimer_text: str,
        human_review_required: bool,
        response_payload: dict,
        request_payload: dict,
    ) -> None:
        self._post(
            "players?on_conflict=id",
            [{"id": player_id}],
            prefer="resolution=merge-duplicates,return=minimal",
        )
        self._post(
            "events?on_conflict=id",
            [{"id": event_id, "event_type": event_type}],
            prefer="resolution=merge-duplicates,return=minimal",
        )
        self._post(
            "analyses",
            [
                {
                    "player_id": player_id,
                    "event_id": event_id,
                    "external_audit_id": audit_id,
                    "risk_tier": response_payload["risk_tier"],
                    "confidence": response_payload["confidence"],
                    "analyzed_move_count": response_payload["analyzed_move_count"],
                    "triggered_signals": response_payload["triggered_signals"],
                    "weighted_risk_score": weighted_risk_score,
                    "event_type": event_type,
                    "regan_threshold_used": regan_threshold_used,
                    "natural_occurrence_statement": natural_occurrence_statement,
                    "natural_occurrence_probability": natural_occurrence_probability,
                    "model_version": model_version,
                    "feature_schema_version": feature_schema_version,
                    "report_schema_version": report_schema_version,
                    "report_version": 1,
                    "report_locked": False,
                    "legal_disclaimer_text": legal_disclaimer_text,
                    "human_review_required": human_review_required,
                    "input_hash": audit_id,
                    "explanation": response_payload["explanation"],
                    "signals": response_payload["signals"],
                    "raw_request": request_payload,
                    "raw_response": response_payload,
                }
            ],
            prefer="return=minimal",
        )

    def persist_pgn_details(
        self,
        *,
        event_id: str,
        player_id: str,
        opponent_player_id: str,
        player_color: str,
        pgn_text: str,
        parsed_games: list[dict[str, Any]],
    ) -> None:
        # Ensure player/opponent/event identities exist for FK constraints.
        self._post(
            "players?on_conflict=id",
            [{"id": player_id}, {"id": opponent_player_id}],
            prefer="resolution=merge-duplicates,return=minimal",
        )
        self._post(
            "events?on_conflict=id",
            [{"id": event_id}],
            prefer="resolution=merge-duplicates,return=minimal",
        )

        white_id = player_id if player_color == "white" else opponent_player_id
        black_id = opponent_player_id if player_color == "white" else player_id

        game_rows: list[dict[str, Any]] = []
        move_feature_rows: list[dict[str, Any]] = []
        engine_eval_rows: list[dict[str, Any]] = []

        for g in parsed_games:
            game_id = g["game_id"]
            game_rows.append(
                {
                    "id": game_id,
                    "event_id": event_id,
                    "white_player_id": white_id,
                    "black_player_id": black_id,
                    "pgn": pgn_text,
                }
            )
            for m in g.get("moves", []):
                ply = int(m["ply"])
                move_feature_rows.append(
                    {
                        "game_id": game_id,
                        "ply": ply,
                        "cp_loss": m.get("cp_loss"),
                        "complexity_score": m.get("complexity_score"),
                        "is_opening_book": m.get("is_opening_book", False),
                        "is_tablebase": m.get("is_tablebase", False),
                        "is_forced": m.get("is_forced", False),
                        "time_spent_seconds": m.get("time_spent_seconds"),
                    }
                )
                engine_eval_rows.append(
                    {
                        "game_id": game_id,
                        "move_number": int((ply + 1) // 2),
                        "top1": m.get("engine_best"),
                        "top3": [m.get("engine_best")] if m.get("engine_best") else None,
                        "centipawn_loss": m.get("cp_loss"),
                        "best_eval_cp": 0,
                        "played_eval_cp": -float(m.get("cp_loss") or 0),
                        "think_time": m.get("time_spent_seconds"),
                    }
                )

        if game_rows:
            self._post(
                "games?on_conflict=id",
                game_rows,
                prefer="resolution=merge-duplicates,return=minimal",
            )
        if move_feature_rows:
            self._post("move_features", move_feature_rows, prefer="return=minimal")
        if engine_eval_rows:
            self._post("engine_evals", engine_eval_rows, prefer="return=minimal")

    @staticmethod
    def error_text(exc: Exception) -> str:
        if isinstance(exc, error.HTTPError):
            try:
                return exc.read().decode("utf-8", errors="ignore")
            except Exception:
                return str(exc)
        return str(exc)
