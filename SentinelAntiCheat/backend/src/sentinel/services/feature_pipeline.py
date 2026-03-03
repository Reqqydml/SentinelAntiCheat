from __future__ import annotations

from statistics import mean, median

import numpy as np

from sentinel.config import settings
from sentinel.domain.models import AggregatedFeatures
from sentinel.schemas import AnalyzeRequest, MoveInput
from sentinel.services.calibration import regan_acl_params_for_elo
from sentinel.services.phase_filter import split_analysis_window, timing_available
from sentinel.services.policy import regan_threshold_for_event


def _safe_ratio(a: float, b: float) -> float:
    return a / b if b != 0 else 0.0


def _z(value: float | None, avg: float | None, std: float | None) -> float | None:
    if value is None or avg is None or std is None or std == 0:
        return None
    return (value - avg) / std


def _ipr_from_acl(avg_acl: float) -> float:
    # Calibrated monotonic proxy: lower ACL -> higher IPR, bounded to human range.
    return max(100.0, min(3600.0, 3300.0 - (28.0 * avg_acl)))


def _clip(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _wilson_ci(successes: int, n: int, z: float = 1.96) -> tuple[float, float] | None:
    if n <= 0:
        return None
    p = successes / n
    denom = 1.0 + (z * z) / n
    center = (p + (z * z) / (2.0 * n)) / denom
    margin = (z / denom) * np.sqrt((p * (1.0 - p) / n) + ((z * z) / (4.0 * n * n)))
    return float(max(0.0, center - margin)), float(min(1.0, center + margin))


def _mean_ci(values: list[float], z: float = 1.96) -> tuple[float, float] | None:
    n = len(values)
    if n == 0:
        return None
    mu = float(mean(values))
    if n == 1:
        return mu, mu
    std = float(np.std(np.array(values, dtype=float), ddof=1))
    se = std / np.sqrt(n)
    return mu - z * se, mu + z * se


def compute_features(req: AnalyzeRequest) -> AggregatedFeatures:
    all_moves: list[MoveInput] = [m for g in req.games for m in g.moves]
    window, analyzed = split_analysis_window(all_moves)
    if analyzed == 0:
        regan_threshold = regan_threshold_for_event(req.event_type)  # type: ignore[arg-type]
        regan_expected_acl, regan_acl_std = regan_acl_params_for_elo(req.official_elo)
        return AggregatedFeatures(
            analyzed_move_count=0,
            engine_match_pct=0,
            top3_match_pct=0,
            avg_centipawn_loss=0,
            median_centipawn_loss=0,
            cpl_variance=0,
            ipr_estimate=req.official_elo,
            ipr_vs_official_elo_delta=0,
            ipr_z_score=0,
            regan_z_score=0,
            regan_threshold=regan_threshold,
            regan_expected_acl=regan_expected_acl,
            regan_acl_std=regan_acl_std,
            pep_score=0,
            pep_positions_count=0,
            event_type=req.event_type,
            accuracy_in_complex_positions=0,
            accuracy_in_simple_positions=0,
            complexity_accuracy_ratio=0,
            critical_moment_accuracy=0,
            avg_candidate_moves_in_window=0,
            time_complexity_correlation=None,
            fast_engine_move_rate=None,
            think_then_engine_rate=None,
            avg_time_complex_vs_simple=None,
            acl_z_score_vs_self=None,
            ipr_z_score_vs_self=None,
            performance_spike_z_score=None,
            move_quality_clustering=0,
            blunder_rate=0,
            inaccuracy_rate=0,
            superhuman_move_rate=0,
            rating_adjusted_move_probability=0,
            opening_familiarity_index=0,
            opponent_strength_correlation=None,
            round_anomaly_clustering_score=0,
            complex_blunder_rate=0,
            zero_blunder_in_complex_games_flag=False,
            move_quality_uniformity_score=0,
            stockfish_maia_divergence=0,
            maia_humanness_score=0,
            maia_personalization_confidence=0,
            maia_model_version=settings.maia_model_version,
            games_count_history=req.historical.games_count,
            timing_available=False,
            cold_start=req.historical.games_count < 10,
            confidence_intervals={},
        )

    engine_best_match = [1 if m.player_move == m.engine_best else 0 for m in window]
    top3_match = [1 if (m.top3_match or m.player_move == m.engine_best) else 0 for m in window]
    cpl = [m.cp_loss for m in window]
    complex_moves = [m for m in window if m.complexity_score >= 3]
    simple_moves = [m for m in window if m.complexity_score <= 1]
    critical = [m for m in window if m.eval_swing_cp >= 100]

    complex_acc = mean([1 if m.player_move == m.engine_best else 0 for m in complex_moves]) if complex_moves else 0.0
    simple_acc = mean([1 if m.player_move == m.engine_best else 0 for m in simple_moves]) if simple_moves else 0.0

    avg_acl = float(mean(cpl))
    ipr = _ipr_from_acl(avg_acl)
    ipr_delta = ipr - req.official_elo
    ipr_z = ipr_delta / 100.0
    regan_expected_acl, regan_acl_std = regan_acl_params_for_elo(req.official_elo)
    regan_z = float((regan_expected_acl - avg_acl) / regan_acl_std)
    regan_threshold = regan_threshold_for_event(req.event_type)  # type: ignore[arg-type]
    equal_positions = [m for m in window if abs(m.best_eval_cp) <= 100.0]
    pep_score = float(mean([m.cp_loss / 100.0 for m in equal_positions])) if equal_positions else float(avg_acl / 100.0)
    # Phase 2: superhuman-like precision in hard positions.
    superhuman_hits = [m for m in window if m.cp_loss <= 8 and m.complexity_score >= 5]
    superhuman_move_rate = float(len(superhuman_hits) / analyzed) if analyzed > 0 else 0.0
    # Phase 2: observed engine-match relative to rating-expected baseline.
    expected_match = _clip(0.22 + (req.official_elo / 4000.0) * 0.48, 0.2, 0.75)
    observed_match = float(mean(engine_best_match))
    rating_adjusted_move_probability = float(_clip(observed_match / max(0.05, expected_match), 0.0, 3.0))
    opening_total = len([m for m in all_moves if m.is_opening_book])
    opening_familiarity_index = float(opening_total / max(1, len(all_moves)))
    complex_blunders = [m for m in complex_moves if m.cp_loss >= 120]
    complex_blunder_rate = float(len(complex_blunders) / max(1, len(complex_moves))) if complex_moves else 0.0
    zero_blunder_in_complex_games_flag = bool(
        len(complex_moves) >= 12 and len(complex_blunders) == 0 and complex_acc >= 0.78
    )

    has_time = timing_available(window)
    time_corr = None
    fast_engine_rate = None
    think_then_engine = None
    time_complex_simple = None

    if has_time:
        pairs = [(m.time_spent_seconds, m.complexity_score) for m in window if m.time_spent_seconds is not None]
        if len(pairs) >= 2:
            times = np.array([p[0] for p in pairs], dtype=float)
            comps = np.array([p[1] for p in pairs], dtype=float)
            time_corr = float(np.corrcoef(times, comps)[0, 1]) if np.std(times) > 0 and np.std(comps) > 0 else 0.0

        fast_complex = [m for m in complex_moves if m.time_spent_seconds is not None and m.time_spent_seconds < 10]
        if complex_moves:
            fast_engine_rate = float(mean([1 if m.player_move == m.engine_best else 0 for m in fast_complex])) if fast_complex else 0.0
            think_then = [m for m in complex_moves if m.time_spent_seconds is not None and m.time_spent_seconds > 90]
            think_then_engine = float(mean([1 if m.player_move == m.engine_best else 0 for m in think_then])) if think_then else 0.0

        complex_times = [m.time_spent_seconds for m in complex_moves if m.time_spent_seconds is not None]
        simple_times = [m.time_spent_seconds for m in simple_moves if m.time_spent_seconds is not None]
        if complex_times and simple_times and mean(simple_times) > 0:
            time_complex_simple = float(mean(complex_times) / mean(simple_times))

    perf_spike = _z(req.performance_rating_this_event, req.historical.avg_perf, req.historical.std_perf)
    opponent_strength_correlation = None
    opp_elo_with_match: list[tuple[float, float]] = []
    for g in req.games:
        if g.opponent_official_elo is None:
            continue
        gw = [m for m in g.moves if not (m.is_opening_book or m.is_tablebase or m.is_forced)]
        if not gw:
            continue
        gmatch = mean([1 if m.player_move == m.engine_best else 0 for m in gw])
        opp_elo_with_match.append((float(g.opponent_official_elo), float(gmatch)))
    if len(opp_elo_with_match) >= 2:
        xs = np.array([x[0] for x in opp_elo_with_match], dtype=float)
        ys = np.array([x[1] for x in opp_elo_with_match], dtype=float)
        if np.std(xs) > 0 and np.std(ys) > 0:
            opponent_strength_correlation = float(np.corrcoef(xs, ys)[0, 1])
        else:
            opponent_strength_correlation = 0.0

    # Phase 2: round-by-round anomaly clustering proxy via per-game anomaly volatility.
    game_anomaly_scores: list[float] = []
    for g in req.games:
        gw = [m for m in g.moves if not (m.is_opening_book or m.is_tablebase or m.is_forced)]
        if not gw:
            continue
        g_acl = mean([m.cp_loss for m in gw])
        g_match = mean([1 if m.player_move == m.engine_best else 0 for m in gw])
        anomaly = (0.55 * g_match) + (0.45 * _clip(1.0 - (g_acl / 120.0), 0.0, 1.0))
        game_anomaly_scores.append(float(anomaly))
    round_anomaly_clustering_score = 0.0
    if len(game_anomaly_scores) >= 2:
        round_anomaly_clustering_score = float(np.std(np.array(game_anomaly_scores, dtype=float), ddof=1))
    # Phase 2 remaining: move-quality distribution uniformity score.
    cpl_std = float(np.std(np.array(cpl, dtype=float), ddof=1)) if len(cpl) > 1 else 0.0
    move_quality_uniformity_score = float(_clip(1.0 - (cpl_std / max(1.0, avg_acl)), 0.0, 1.0))
    # Phase 3 scaffold: Maia-like humanness stack (placeholder until real Maia model integration).
    expected_human_match = _clip(0.18 + (req.official_elo / 4000.0) * 0.42, 0.18, 0.65)
    stockfish_maia_divergence = float(abs(observed_match - expected_human_match))
    maia_humanness_score = float(
        _clip(
            1.0
            - (0.55 * stockfish_maia_divergence)
            - (0.25 * superhuman_move_rate)
            - (0.20 * _clip(round_anomaly_clustering_score / 0.4, 0.0, 1.0)),
            0.0,
            1.0,
        )
    )
    maia_personalization_confidence = float(_clip(req.historical.games_count / 80.0, 0.05, 1.0))

    engine_wins = sum(engine_best_match)
    top3_wins = sum(top3_match)
    acl_ci = _mean_ci(cpl)
    pep_samples = [m.cp_loss / 100.0 for m in equal_positions] if equal_positions else []
    pep_ci = _mean_ci(pep_samples) if pep_samples else None
    regan_ci = None
    if acl_ci is not None:
        acl_low, acl_high = acl_ci
        regan_ci = (
            float((regan_expected_acl - acl_high) / regan_acl_std),
            float((regan_expected_acl - acl_low) / regan_acl_std),
        )
    ci_map: dict[str, tuple[float, float] | None] = {
        "engine_match_pct": _wilson_ci(engine_wins, analyzed),
        "top3_match_pct": _wilson_ci(top3_wins, analyzed),
        "avg_centipawn_loss": acl_ci,
        "pep_score": pep_ci,
        "regan_z_score": regan_ci,
    }

    return AggregatedFeatures(
        analyzed_move_count=analyzed,
        engine_match_pct=float(mean(engine_best_match)),
        top3_match_pct=float(mean(top3_match)),
        avg_centipawn_loss=avg_acl,
        median_centipawn_loss=float(median(cpl)),
        cpl_variance=float(np.var(cpl)),
        ipr_estimate=ipr,
        ipr_vs_official_elo_delta=ipr_delta,
        ipr_z_score=ipr_z,
        regan_z_score=regan_z,
        regan_threshold=regan_threshold,
        regan_expected_acl=regan_expected_acl,
        regan_acl_std=regan_acl_std,
        pep_score=pep_score,
        pep_positions_count=len(equal_positions),
        event_type=req.event_type,
        accuracy_in_complex_positions=float(complex_acc),
        accuracy_in_simple_positions=float(simple_acc),
        complexity_accuracy_ratio=float(_safe_ratio(complex_acc, simple_acc if simple_acc > 0 else 0.0001)),
        critical_moment_accuracy=float(mean([1 if m.player_move == m.engine_best else 0 for m in critical])) if critical else 0.0,
        avg_candidate_moves_in_window=float(mean([m.candidate_moves_within_50cp for m in window])),
        time_complexity_correlation=time_corr,
        fast_engine_move_rate=fast_engine_rate,
        think_then_engine_rate=think_then_engine,
        avg_time_complex_vs_simple=time_complex_simple,
        acl_z_score_vs_self=_z(avg_acl, req.historical.avg_acl, req.historical.std_acl),
        ipr_z_score_vs_self=_z(ipr, req.historical.avg_ipr, req.historical.std_ipr),
        performance_spike_z_score=perf_spike,
        move_quality_clustering=float(np.var(cpl) / (avg_acl + 1.0)),
        blunder_rate=float(mean([1 if x >= 120 else 0 for x in cpl])),
        inaccuracy_rate=float(mean([1 if x >= 50 else 0 for x in cpl])),
        superhuman_move_rate=superhuman_move_rate,
        rating_adjusted_move_probability=rating_adjusted_move_probability,
        opening_familiarity_index=opening_familiarity_index,
        opponent_strength_correlation=opponent_strength_correlation,
        round_anomaly_clustering_score=round_anomaly_clustering_score,
        complex_blunder_rate=complex_blunder_rate,
        zero_blunder_in_complex_games_flag=zero_blunder_in_complex_games_flag,
        move_quality_uniformity_score=move_quality_uniformity_score,
        stockfish_maia_divergence=stockfish_maia_divergence,
        maia_humanness_score=maia_humanness_score,
        maia_personalization_confidence=maia_personalization_confidence,
        maia_model_version=settings.maia_model_version,
        games_count_history=req.historical.games_count,
        timing_available=has_time,
        cold_start=req.historical.games_count < 10,
        confidence_intervals=ci_map,
    )
