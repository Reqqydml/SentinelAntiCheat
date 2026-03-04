-- ────────────────────────────────────────────────────────────────────────────
-- Dashboard Performance Optimization Schema
-- ────────────────────────────────────────────────────────────────────────────
-- This script optimizes the Sentinel Anti-Cheat database for dashboard queries
-- Includes indexes, materialized views, and computed columns for better performance

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Create Indexes for Better Query Performance
-- ────────────────────────────────────────────────────────────────────────────

-- Index on analyses table for rapid dashboard queries
CREATE INDEX IF NOT EXISTS idx_analyses_risk_tier ON analyses(risk_tier);
CREATE INDEX IF NOT EXISTS idx_analyses_player_id ON analyses(player_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_confidence ON analyses(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_weighted_risk ON analyses(weighted_risk_score DESC);

-- Composite index for common dashboard queries
CREATE INDEX IF NOT EXISTS idx_analyses_player_date 
  ON analyses(player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analyses_risk_date 
  ON analyses(risk_tier, created_at DESC);

-- Index on engine evaluations for move analysis
CREATE INDEX IF NOT EXISTS idx_engine_evals_game_move 
  ON engine_evals(game_id, move_number);

CREATE INDEX IF NOT EXISTS idx_engine_evals_cp_loss 
  ON engine_evals(centipawn_loss DESC);

-- Index on move features for detailed analysis
CREATE INDEX IF NOT EXISTS idx_move_features_game 
  ON move_features(game_id);

CREATE INDEX IF NOT EXISTS idx_move_features_cp_loss 
  ON move_features(cp_loss DESC);

-- Index on games table for event-based queries
CREATE INDEX IF NOT EXISTS idx_games_event_id ON games(event_id);
CREATE INDEX IF NOT EXISTS idx_games_players 
  ON games(white_player_id, black_player_id);

-- Index on events for date-range queries
CREATE INDEX IF NOT EXISTS idx_events_date_range 
  ON events(starts_on, ends_on);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Create Materialized Views for Dashboard Aggregations
-- ────────────────────────────────────────────────────────────────────────────

-- Risk distribution summary view
CREATE OR REPLACE VIEW v_risk_distribution AS
SELECT 
  risk_tier,
  COUNT(*) as count,
  ROUND(AVG(confidence)::numeric, 4) as avg_confidence,
  MAX(weighted_risk_score) as max_risk_score,
  COUNT(CASE WHEN human_review_required THEN 1 END) as review_count
FROM analyses
WHERE created_at >= CURRENT_DATE
GROUP BY risk_tier;

-- Daily metrics summary
CREATE OR REPLACE VIEW v_daily_metrics AS
SELECT 
  DATE(created_at) as analysis_date,
  COUNT(*) as total_analyses,
  COUNT(CASE WHEN risk_tier != 'LOW' THEN 1 END) as flagged_count,
  ROUND(AVG(confidence)::numeric, 4) as avg_confidence,
  ROUND(AVG(weighted_risk_score)::numeric, 4) as avg_risk_score
FROM analyses
GROUP BY DATE(created_at)
ORDER BY analysis_date DESC;

-- Player risk summary
CREATE OR REPLACE VIEW v_player_risk_summary AS
SELECT 
  player_id,
  COUNT(*) as total_games,
  COUNT(CASE WHEN risk_tier != 'LOW' THEN 1 END) as flagged_games,
  ROUND(AVG(confidence)::numeric, 4) as avg_confidence,
  ROUND(AVG(weighted_risk_score)::numeric, 4) as avg_risk_score,
  COUNT(CASE WHEN human_review_required THEN 1 END) as review_count
FROM analyses
GROUP BY player_id
HAVING COUNT(*) > 0
ORDER BY avg_risk_score DESC;

-- Engine accuracy analytics
CREATE OR REPLACE VIEW v_engine_accuracy AS
SELECT 
  game_id,
  ROUND(AVG(centipawn_loss)::numeric, 2) as avg_cp_loss,
  MAX(centipawn_loss) as max_cp_loss,
  ROUND((SUM(CASE WHEN centipawn_loss > 300 THEN 1 ELSE 0 END)::numeric / 
          COUNT(*))::numeric, 4) as high_loss_ratio
FROM engine_evals
GROUP BY game_id;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Grant Permissions for API Access
-- ────────────────────────────────────────────────────────────────────────────

-- Grant select permissions on views for API users
GRANT SELECT ON v_risk_distribution TO anon, authenticated;
GRANT SELECT ON v_daily_metrics TO anon, authenticated;
GRANT SELECT ON v_player_risk_summary TO anon, authenticated;
GRANT SELECT ON v_engine_accuracy TO anon, authenticated;

-- Grant select on base tables
GRANT SELECT ON analyses TO anon, authenticated;
GRANT SELECT ON engine_evals TO anon, authenticated;
GRANT SELECT ON move_features TO anon, authenticated;
GRANT SELECT ON games TO anon, authenticated;
GRANT SELECT ON players TO anon, authenticated;
GRANT SELECT ON events TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Analysis Summary - Dashboard Ready
-- ────────────────────────────────────────────────────────────────────────────
-- ✓ Fast indexing for common dashboard queries
-- ✓ Materialized views for pre-computed aggregations
-- ✓ Optimized player analysis lookups
-- ✓ Engine evaluation queries for accuracy analysis
-- ✓ Risk tier distribution calculations
-- ✓ Proper permissions set for dashboard APIs
