from __future__ import annotations

from pydantic import BaseModel, Field


class MoveInput(BaseModel):
    ply: int
    engine_best: str
    player_move: str
    cp_loss: float = Field(ge=0)
    top3_match: bool = False
    complexity_score: int = Field(ge=0)
    candidate_moves_within_50cp: int = Field(ge=1)
    best_second_gap_cp: float = Field(default=0, ge=0)
    eval_swing_cp: float = Field(default=0, ge=0)
    best_eval_cp: float = 0
    played_eval_cp: float = 0
    is_opening_book: bool = False
    is_tablebase: bool = False
    is_forced: bool = False
    time_spent_seconds: float | None = Field(default=None, ge=0)


class GameInput(BaseModel):
    game_id: str
    opponent_official_elo: int | None = None
    moves: list[MoveInput]


class HistoricalProfile(BaseModel):
    games_count: int = 0
    avg_acl: float | None = None
    std_acl: float | None = None
    avg_ipr: float | None = None
    std_ipr: float | None = None
    avg_perf: float | None = None
    std_perf: float | None = None


class AnalyzeRequest(BaseModel):
    player_id: str
    event_id: str
    event_type: str = Field(default="online", pattern="^(online|otb)$")
    official_elo: int
    high_stakes_event: bool = False
    performance_rating_this_event: float | None = None
    games: list[GameInput]
    historical: HistoricalProfile = Field(default_factory=HistoricalProfile)


class AnalyzePgnRequest(BaseModel):
    player_id: str
    event_id: str
    event_type: str = Field(default="online", pattern="^(online|otb)$")
    opponent_player_id: str = "opponent-unknown"
    official_elo: int
    player_color: str = Field(default="white", pattern="^(white|black)$")
    high_stakes_event: bool = False
    pgn_text: str
    performance_rating_this_event: float | None = None
    historical: HistoricalProfile = Field(default_factory=HistoricalProfile)


class SignalOut(BaseModel):
    name: str
    triggered: bool
    score: float
    threshold: float
    reasons: list[str]


class AnalyzeResponse(BaseModel):
    player_id: str
    event_id: str
    risk_tier: str
    confidence: float
    analyzed_move_count: int
    triggered_signals: int
    weighted_risk_score: float
    signals: list[SignalOut]
    explanation: list[str]
    audit_id: str
    persisted_to_supabase: bool = False
    model_version: str | None = None
    feature_schema_version: str | None = None
    report_schema_version: str | None = None
    natural_occurrence_statement: str | None = None
    natural_occurrence_probability: float | None = None
    regan_z_score: float | None = None
    regan_threshold: float | None = None
    pep_score: float | None = None
    superhuman_move_rate: float | None = None
    rating_adjusted_move_probability: float | None = None
    opening_familiarity_index: float | None = None
    opponent_strength_correlation: float | None = None
    round_anomaly_clustering_score: float | None = None
    complex_blunder_rate: float | None = None
    zero_blunder_in_complex_games_flag: bool | None = None
    move_quality_uniformity_score: float | None = None
    stockfish_maia_divergence: float | None = None
    maia_humanness_score: float | None = None
    maia_personalization_confidence: float | None = None
    maia_model_version: str | None = None
    confidence_intervals: dict[str, list[float] | None] = Field(default_factory=dict)


class TournamentGameSummary(BaseModel):
    game_id: str
    analyzed_move_count: int
    ipr_estimate: float
    pep_score: float
    regan_z_score: float
    regan_threshold: float


class TournamentSummaryResponse(BaseModel):
    player_id: str
    event_id: str
    event_type: str
    games_count: int
    analyzed_move_count: int
    ipr_estimate: float
    pep_score: float
    regan_z_score: float
    regan_threshold: float
    confidence_intervals: dict[str, list[float] | None] = Field(default_factory=dict)
    per_game: list[TournamentGameSummary] = Field(default_factory=list)
