from __future__ import annotations

from sentinel.domain.models import AggregatedFeatures, SignalResult


def layer_1_ipr(f: AggregatedFeatures) -> SignalResult:
    reasons = []
    threshold = f.regan_threshold
    triggered = f.regan_z_score >= threshold
    if triggered:
        reasons.append(f"Regan-compatible Z exceeds threshold for {f.event_type} play")
    if f.top3_match_pct > 0.85:
        reasons.append("Top-3 engine match unusually high")
    return SignalResult(
        name="Layer1_IPR_MoveQuality",
        triggered=triggered,
        score=f.regan_z_score,
        threshold=threshold,
        reasons=reasons,
    )


def layer_2_complexity(f: AggregatedFeatures) -> SignalResult:
    score = max(
        f.complexity_accuracy_ratio,
        f.rating_adjusted_move_probability,
        1.0 + (f.round_anomaly_clustering_score * 2.0),
        1.0 + (f.stockfish_maia_divergence * 2.0),
    )
    triggered = (
        (f.complexity_accuracy_ratio > 1.0 and f.accuracy_in_complex_positions > 0.7)
        or f.superhuman_move_rate >= 0.2
        or f.rating_adjusted_move_probability >= 1.35
        or f.round_anomaly_clustering_score >= 0.18
        or f.stockfish_maia_divergence >= 0.16
    )
    reasons = []
    if f.complexity_accuracy_ratio > 1.0:
        reasons.append("Accuracy in complex positions exceeds simple positions")
    if f.critical_moment_accuracy > 0.75:
        reasons.append("Critical moment accuracy is elevated")
    if f.superhuman_move_rate >= 0.2:
        reasons.append("High rate of low-CPL play in high-complexity positions")
    if f.rating_adjusted_move_probability >= 1.35:
        reasons.append("Engine-match level materially exceeds rating-adjusted expectation")
    if f.opponent_strength_correlation is not None and f.opponent_strength_correlation < -0.2:
        reasons.append("Stronger-anomaly pattern against weaker opposition detected")
    if f.round_anomaly_clustering_score >= 0.18:
        reasons.append("Round-by-round anomaly clustering observed")
    if f.stockfish_maia_divergence >= 0.16:
        reasons.append("Stockfish-vs-Maia divergence indicates atypical human likeness profile")
    return SignalResult(
        name="Layer2_ComplexityAdjusted",
        triggered=triggered,
        score=score,
        threshold=1.0,
        reasons=reasons,
    )


def layer_3_timing(f: AggregatedFeatures) -> SignalResult:
    if not f.timing_available:
        return SignalResult(
            name="Layer3_TimeComplexity",
            triggered=False,
            score=0.0,
            threshold=0.3,
            reasons=["Clock data absent; layer excluded"],
        )

    corr = f.time_complexity_correlation if f.time_complexity_correlation is not None else 0.0
    fast = f.fast_engine_move_rate if f.fast_engine_move_rate is not None else 0.0
    ratio = f.avg_time_complex_vs_simple if f.avg_time_complex_vs_simple is not None else 0.0

    triggered = corr < 0.1 or fast > 0.6 or ratio < 1.4
    reasons = []
    if corr < 0.1:
        reasons.append("Weak time-vs-complexity correlation")
    if fast > 0.6:
        reasons.append("High rate of fast engine-like moves in complex positions")
    if ratio < 1.4:
        reasons.append("Complex positions not receiving expected extra think time")

    return SignalResult(
        name="Layer3_TimeComplexity",
        triggered=triggered,
        score=1.0 - corr,
        threshold=0.7,
        reasons=reasons,
    )


def layer_4_historical(f: AggregatedFeatures) -> SignalResult:
    score = max(
        abs(f.acl_z_score_vs_self or 0.0),
        abs(f.ipr_z_score_vs_self or 0.0),
        abs(f.performance_spike_z_score or 0.0),
    )
    triggered = score >= 3.0
    reasons = []
    if f.cold_start:
        reasons.append("Cold start profile (<10 games); historical confidence reduced")
    if triggered:
        reasons.append("Performance significantly deviates from player baseline")

    return SignalResult(
        name="Layer4_HistoricalBaseline",
        triggered=triggered,
        score=score,
        threshold=3.0,
        reasons=reasons,
    )


def layer_5_behavioral(f: AggregatedFeatures) -> SignalResult:
    score = (1.0 - f.blunder_rate) + (1.0 - f.inaccuracy_rate) + (1.0 if f.zero_blunder_in_complex_games_flag else 0.0)
    triggered = (
        (f.blunder_rate < 0.01 and f.inaccuracy_rate < 0.08 and f.move_quality_clustering < 0.2)
        or f.zero_blunder_in_complex_games_flag
        or (f.move_quality_uniformity_score >= 0.85 and f.avg_centipawn_loss <= 22)
        or (f.maia_humanness_score <= 0.35 and f.maia_personalization_confidence >= 0.4)
    )
    reasons = []
    if triggered:
        reasons.append("Near-zero blunder/inaccuracy profile in analyzed complex window")
    if f.zero_blunder_in_complex_games_flag:
        reasons.append("Zero blunders in complex positions despite broad analysis window")
    if f.move_quality_uniformity_score >= 0.85 and f.avg_centipawn_loss <= 22:
        reasons.append("Move-quality distribution appears unusually uniform for achieved accuracy")
    if f.maia_humanness_score <= 0.35:
        reasons.append("Low Maia humanness score under personalized profile")

    return SignalResult(
        name="Layer5_BehavioralConsistency",
        triggered=triggered,
        score=score,
        threshold=1.8,
        reasons=reasons,
    )


def evaluate_all_layers(f: AggregatedFeatures) -> list[SignalResult]:
    return [
        layer_1_ipr(f),
        layer_2_complexity(f),
        layer_3_timing(f),
        layer_4_historical(f),
        layer_5_behavioral(f),
    ]
