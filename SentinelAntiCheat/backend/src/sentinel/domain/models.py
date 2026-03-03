from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class RiskTier(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    ELEVATED = "ELEVATED"
    HIGH_STATISTICAL_ANOMALY = "HIGH_STATISTICAL_ANOMALY"


@dataclass
class SignalResult:
    name: str
    triggered: bool
    score: float
    threshold: float
    reasons: list[str] = field(default_factory=list)
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class AggregatedFeatures:
    analyzed_move_count: int
    engine_match_pct: float
    top3_match_pct: float
    avg_centipawn_loss: float
    median_centipawn_loss: float
    cpl_variance: float
    ipr_estimate: float
    ipr_vs_official_elo_delta: float
    ipr_z_score: float
    regan_z_score: float
    regan_threshold: float
    regan_expected_acl: float
    regan_acl_std: float
    pep_score: float
    pep_positions_count: int
    event_type: str
    accuracy_in_complex_positions: float
    accuracy_in_simple_positions: float
    complexity_accuracy_ratio: float
    critical_moment_accuracy: float
    avg_candidate_moves_in_window: float
    time_complexity_correlation: float | None
    fast_engine_move_rate: float | None
    think_then_engine_rate: float | None
    avg_time_complex_vs_simple: float | None
    acl_z_score_vs_self: float | None
    ipr_z_score_vs_self: float | None
    performance_spike_z_score: float | None
    move_quality_clustering: float
    blunder_rate: float
    inaccuracy_rate: float
    superhuman_move_rate: float
    rating_adjusted_move_probability: float
    opening_familiarity_index: float
    opponent_strength_correlation: float | None
    round_anomaly_clustering_score: float
    complex_blunder_rate: float
    zero_blunder_in_complex_games_flag: bool
    move_quality_uniformity_score: float
    stockfish_maia_divergence: float
    maia_humanness_score: float
    maia_personalization_confidence: float
    maia_model_version: str
    games_count_history: int
    timing_available: bool
    cold_start: bool
    confidence_intervals: dict[str, tuple[float, float] | None]
