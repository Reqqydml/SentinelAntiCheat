from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "dev"
    db_path: str = "./sentinel.db"
    model_version: str = "v0.2"
    feature_schema_version: str = "v1"
    report_schema_version: str = "v1"
    legal_disclaimer_text: str = (
        "Statistical anomaly assessment only. This report is not a final cheating determination "
        "and requires qualified human review before any action."
    )
    fide_floor_z_otb: float = 5.0
    fide_floor_z_online: float = 4.25
    federation_threshold_z_otb: float = 5.0
    federation_threshold_z_online: float = 4.25
    calibration_profile_path: str | None = None
    risk_baseline_z: float = 4.0
    min_elevated_triggers: int = 3
    forced_move_gap_cp: int = 50
    stockfish_path: str | None = None
    analysis_depth: int = 22
    multipv: int = 3
    maia_model_version: str = "maia-placeholder-v0"
    polyglot_book_path: str | None = None
    syzygy_path: str | None = None
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    supabase_schema: str = "public"
    persistence_fail_hard: bool = False
    redis_url: str | None = None
    redis_password: str | None = None
    redis_prefix: str = "sentinel:"
    cors_allow_origins: str = "http://localhost:3000,http://127.0.0.1:3000"


settings = Settings()
