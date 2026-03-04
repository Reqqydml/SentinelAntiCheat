"use client";

import { useEffect, useMemo, useState } from "react";
import { AnalysisConsole } from "./analysis-console";
import { KPICards } from "./kpi-cards";
import { MetricsAnalyzer } from "./metrics-analyzer";
import { GameAnalysisDeepDive } from "./game-analysis-deep-dive";
import { PlayerProfileAnalysis } from "./player-profile-analysis";

type DashboardPage = "command" | "deep-dive" | "player" | "report" | "admin";
type RiskTier = "LOW" | "MODERATE" | "ELEVATED" | "HIGH_STATISTICAL_ANOMALY";

type FeedGame = {
  game_id: string;
  event_id: string;
  player_id: string;
  official_elo: number;
  move_number: number;
  risk_tier: string;
  confidence: number;
  weighted_risk_score: number;
  sparkline: number[];
  audit_id: string;
  created_at: string;
};

type FeedAlert = {
  id: string;
  timestamp: string;
  event_id: string;
  player_id: string;
  layer: string;
  score: number;
  threshold: number;
  description: string;
  audit_id: string;
};

type FeedSummary = {
  total_games_analyzed_today: number;
  games_elevated_or_above: number;
  awaiting_review_count: number;
  average_regan_z_score: number;
};

type DashboardFeedResponse = {
  generated_at_utc: string;
  games: FeedGame[];
  alerts: FeedAlert[];
  summary: FeedSummary;
};

type Props = {
  apiBase: string;
  apiHealth: "healthy" | "degraded" | "offline" | string;
  apiLatencyMs: number | null;
  apiCheckedAt: string;
  supabaseReady: boolean;
  missingEnvVars: string[];
};

const RISK_CLASS: Record<RiskTier, string> = {
  LOW: "risk-low",
  MODERATE: "risk-moderate",
  ELEVATED: "risk-elevated",
  HIGH_STATISTICAL_ANOMALY: "risk-high",
};

function normalizeRiskTier(value: string): RiskTier | null {
  if (["LOW", "MODERATE", "ELEVATED", "HIGH_STATISTICAL_ANOMALY"].includes(value)) {
    return value as RiskTier;
  }
  return null;
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * 100;
      const y = 100 - Math.max(0, Math.min(100, v * 100));
      return `${x},${y}`;
    })
    .join(" ");
  return <svg viewBox="0 0 100 100" className="sparkline" aria-hidden="true"><polyline points={points} /></svg>;
}

function RiskBadge({ tier }: { tier: RiskTier | null }) {
  if (!tier) return <span className={`risk-badge risk-none`}>NO DATA</span>;
  return <span className={`risk-badge ${RISK_CLASS[tier]}`}>{tier.replaceAll("_", " ")}</span>;
}

function formatClock(now: Date | null): string {
  return now ? now.toLocaleTimeString() : "--:--:--";
}

export function ArbiterDashboard({ apiBase, apiHealth, apiLatencyMs, apiCheckedAt, supabaseReady, missingEnvVars }: Props) {
  const [page, setPage] = useState<DashboardPage>("command");
  const [feedGames, setFeedGames] = useState<FeedGame[]>([]);
  const [feedAlerts, setFeedAlerts] = useState<FeedAlert[]>([]);
  const [feedSummary, setFeedSummary] = useState<FeedSummary | null>(null);
  const [reviewedAlerts, setReviewedAlerts] = useState<Record<string, boolean>>({});
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshFeed() {
      try {
        const res = await fetch(`${apiBase}/v1/dashboard-feed?limit=200`, { cache: "no-store" });
        if (!res.ok) return;
        const feed = (await res.json()) as DashboardFeedResponse;
        if (cancelled) return;

        const games = Array.isArray(feed.games) ? feed.games : [];
        const alerts = Array.isArray(feed.alerts) ? feed.alerts : [];

        setFeedGames(games);
        setFeedAlerts(alerts);
        setFeedSummary(feed.summary ?? null);
        setSelectedGameId((prev) => (prev && games.some((g) => g.game_id === prev) ? prev : games[0]?.game_id ?? null));
      } catch {
        // Keep current state on error
      }
    }

    refreshFeed();
    const poll = setInterval(refreshFeed, 20000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [apiBase]);

  const games = useMemo(
    () => [...feedGames].sort((a, b) => b.weighted_risk_score - a.weighted_risk_score),
    [feedGames]
  );
  const selectedGame = games.find((g) => g.game_id === selectedGameId) ?? null;
  const awaitingReview = feedAlerts.filter((a) => !reviewedAlerts[a.id]).length;

  const navItems: Array<{ id: DashboardPage; label: string; icon: string }> = [
    { id: "command", label: "Command Center", icon: "📊" },
    { id: "deep-dive", label: "Game Deep Dive", icon: "🔍" },
    { id: "player", label: "Player Profile", icon: "👤" },
    { id: "report", label: "Report", icon: "📄" },
    { id: "admin", label: "Settings", icon: "⚙️" },
  ];

  const apiHealthColor = apiHealth === "healthy" ? "text-success" : apiHealth === "degraded" ? "text-warning" : "text-danger";

  return (
    <div className="dashboard-container">
      {/* Top Navigation Bar */}
      <nav className="nav-bar">
        <div className="nav-brand">
          <div className="nav-logo">🛡️</div>
          <div className="nav-title">
            <h1>Sentinel</h1>
            <p>Anti-Cheat Arbiter</p>
          </div>
        </div>

        <div className="nav-center">
          <div className="nav-time">{formatClock(now)}</div>
          <div className={`nav-status ${apiHealthColor}`}>
            <span className="status-dot"></span>
            {apiHealth === "healthy" ? "System Healthy" : apiHealth === "degraded" ? "Degraded" : "Offline"}
          </div>
        </div>

        <div className="nav-end">
          {missingEnvVars.length > 0 && <span className="text-warning">⚠️ Config Issue</span>}
          {!supabaseReady && <span className="text-danger">🔴 DB Offline</span>}
        </div>
      </nav>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.id === "command" && awaitingReview > 0 && (
                <span className="badge">{awaitingReview}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Summary Card */}
        {feedSummary && (
          <div className="sidebar-summary">
            <h3>Today's Summary</h3>
            <div className="summary-stat">
              <span className="stat-label">Games Analyzed</span>
              <span className="stat-value">{feedSummary.total_games_analyzed_today}</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Flagged</span>
              <span className="stat-value text-warning">{feedSummary.games_elevated_or_above}</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Awaiting Review</span>
              <span className="stat-value text-danger">{feedSummary.awaiting_review_count}</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {page === "command" && (
          <section className="page-command">
            <div className="page-header">
              <h2>Command Center</h2>
              <p>Real-time game analysis and monitoring</p>
            </div>

            {/* KPI Cards */}
            <div className="kpi-section">
              <KPICards />
            </div>

            {/* Charts and Analysis */}
            <div className="charts-section">
              <MetricsAnalyzer />
            </div>

            {/* Game Feed */}
            <div className="game-feed-section">
              <h3>Recent Games</h3>
              <div className="game-feed">
                {games.slice(0, 10).map((game) => (
                  <div
                    key={game.game_id}
                    className={`game-card ${game.risk_tier.toLowerCase()}`}
                    onClick={() => {
                      setPage("deep-dive");
                      setSelectedGameId(game.game_id);
                    }}
                  >
                    <div className="game-header">
                      <div className="game-info">
                        <span className="game-id">Game {game.game_id.slice(0, 8)}</span>
                        <span className="game-player">Player {game.player_id}</span>
                      </div>
                      <RiskBadge tier={normalizeRiskTier(game.risk_tier)} />
                    </div>
                    <div className="game-metrics">
                      <div className="metric">
                        <span className="label">Confidence</span>
                        <span className="value">{(game.confidence * 100).toFixed(1)}%</span>
                      </div>
                      <div className="metric">
                        <span className="label">Risk Score</span>
                        <span className="value">{game.weighted_risk_score.toFixed(2)}</span>
                      </div>
                      <div className="metric sparkline-container">
                        <span className="label">Trend</span>
                        <Sparkline values={game.sparkline} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts Console */}
            <div className="alerts-section">
              <AnalysisConsole />
            </div>
          </section>
        )}

        {page === "deep-dive" && (
          <section className="page-deep-dive">
            <div className="page-header">
              <button className="back-btn" onClick={() => setPage("command")}>← Back to Command</button>
              <h2>Game Deep Dive Analysis</h2>
            </div>
            {selectedGame ? (
              <GameAnalysisDeepDive gameId={selectedGame.game_id} />
            ) : (
              <div className="empty-state">
                <p>Select a game to analyze</p>
              </div>
            )}
          </section>
        )}

        {page === "player" && (
          <section className="page-player">
            <div className="page-header">
              <button className="back-btn" onClick={() => setPage("command")}>← Back to Command</button>
              <h2>Player Profile</h2>
            </div>
            {selectedGame?.player_id ? (
              <PlayerProfileAnalysis playerId={selectedGame.player_id} />
            ) : (
              <div className="empty-state">
                <p>Select a game to view player profile</p>
              </div>
            )}
          </section>
        )}

        {page === "report" && (
          <section className="page-report">
            <div className="page-header">
              <h2>Report Composer</h2>
              <p>Generate arbiter reports</p>
            </div>
            <div className="coming-soon">📝 Report composition coming soon</div>
          </section>
        )}

        {page === "admin" && (
          <section className="page-admin">
            <div className="page-header">
              <h2>System Settings</h2>
              <p>Configuration and maintenance</p>
            </div>
            <div className="settings-grid">
              <div className="setting-card">
                <h4>API Status</h4>
                <p className={apiHealthColor}>{apiHealth.toUpperCase()}</p>
                {apiLatencyMs !== null && <small>Latency: {apiLatencyMs}ms</small>}
              </div>
              <div className="setting-card">
                <h4>Database</h4>
                <p className={supabaseReady ? "text-success" : "text-danger"}>
                  {supabaseReady ? "Connected" : "Offline"}
                </p>
              </div>
              {missingEnvVars.length > 0 && (
                <div className="setting-card alert">
                  <h4>Missing Configuration</h4>
                  <ul>
                    {missingEnvVars.map((v) => <li key={v}>{v}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
