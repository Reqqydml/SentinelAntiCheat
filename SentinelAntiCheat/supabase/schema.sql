-- Sentinel Anti-Cheat logical schema for Supabase/Postgres

create table if not exists players (
  id text primary key,
  fide_id text,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id text primary key,
  name text,
  event_type text not null default 'online' check (event_type in ('online', 'otb')),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

alter table events add column if not exists event_type text;

create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references players(id),
  event_id text not null references events(id),
  external_audit_id text unique,
  risk_tier text not null,
  confidence numeric not null,
  analyzed_move_count int not null,
  triggered_signals int not null,
  weighted_risk_score numeric,
  event_type text not null default 'online',
  regan_threshold_used numeric,
  natural_occurrence_statement text,
  natural_occurrence_probability numeric,
  model_version text not null,
  feature_schema_version text,
  report_schema_version text,
  report_version int not null default 1,
  report_locked boolean not null default false,
  legal_disclaimer_text text,
  human_review_required boolean not null default false,
  input_hash text not null,
  explanation jsonb not null,
  signals jsonb not null,
  raw_request jsonb,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

alter table analyses add column if not exists external_audit_id text;
alter table analyses add column if not exists weighted_risk_score numeric;
alter table analyses add column if not exists event_type text;
alter table analyses add column if not exists regan_threshold_used numeric;
alter table analyses add column if not exists natural_occurrence_statement text;
alter table analyses add column if not exists natural_occurrence_probability numeric;
alter table analyses add column if not exists feature_schema_version text;
alter table analyses add column if not exists report_schema_version text;
alter table analyses add column if not exists report_version int not null default 1;
alter table analyses add column if not exists report_locked boolean not null default false;
alter table analyses add column if not exists legal_disclaimer_text text;
alter table analyses add column if not exists human_review_required boolean not null default false;
alter table analyses add column if not exists raw_request jsonb;
alter table analyses add column if not exists raw_response jsonb;

create table if not exists games (
  id text primary key,
  event_id text not null references events(id),
  white_player_id text not null references players(id),
  black_player_id text not null references players(id),
  pgn text,
  created_at timestamptz not null default now()
);

create table if not exists move_features (
  id bigserial primary key,
  game_id text not null references games(id),
  ply int not null,
  cp_loss numeric,
  complexity_score int,
  is_opening_book boolean not null default false,
  is_tablebase boolean not null default false,
  is_forced boolean not null default false,
  time_spent_seconds numeric,
  created_at timestamptz not null default now()
);

create table if not exists engine_evals (
  id bigserial primary key,
  game_id text not null references games(id),
  move_number int not null,
  top1 text,
  top3 jsonb,
  centipawn_loss numeric,
  best_eval_cp numeric,
  played_eval_cp numeric,
  think_time numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_analyses_player_event on analyses(player_id, event_id, created_at desc);
create index if not exists idx_move_features_game_ply on move_features(game_id, ply);
create index if not exists idx_engine_evals_game_move on engine_evals(game_id, move_number);
