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
  LOW: "riskLow",
  MODERATE: "riskModerate",
  ELEVATED: "riskElevated",
  HIGH_STATISTICAL_ANOMALY: "riskHigh",
};

function normalizeRiskTier(value: string): RiskTier | null {
  if (value === "LOW" || value === "MODERATE" || value === "ELEVATED" || value === "HIGH_STATISTICAL_ANOMALY") {
    return value;
  }
  return null;
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) {
    return <div className="muted">None</div>;
  }
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * 100;
      const y = 100 - Math.max(0, Math.min(100, v * 100));
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="sparkline" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function RiskPill({ tier }: { tier: RiskTier | null }) {
  if (!tier) {
    return <span className="riskPill">NONE</span>;
  }
  return <span className={`riskPill ${RISK_CLASS[tier]}`}>{tier.replaceAll("_", " ")}</span>;
}

function formatClock(now: Date | null): string {
  if (!now) return "--:--:--";
  return now.toLocaleTimeString();
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
        // Keep current state on network/server error.
      }
    }

    refreshFeed();
    const poll = setInterval(refreshFeed, 20000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [apiBase]);

  const games = useMemo(() => [...feedGames].sort((a, b) => b.weighted_risk_score - a.weighted_risk_score), [feedGames]);
  const selectedGame = games.find((g) => g.game_id === selectedGameId) ?? null;
  const awaitingReview = Math.max(0, feedAlerts.filter((a) => !reviewedAlerts[a.id]).length);

  const navItems: Array<{ id: DashboardPage; label: string }> = [
    { id: "command", label: "Command Center" },
    { id: "deep-dive", label: "Game Deep Dive" },
    { id: "player", label: "Player Profile" },
    { id: "report", label: "Report Composer" },
    { id: "admin", label: "System Config" },
  ];

  const apiDotClass = apiHealth === "healthy" ? "ok" : apiHealth === "degraded" ? "warn" : "bad";

  return (
    <section className="dashRoot" role="main">
      <header className="topBar">
        <div>
          <div className="wordmark">Hamduk Labs Sentinel</div>
          <div className="muted">Forensic Arbiter Assistant</div>
        </div>
        <div className="topCenter">
          <div className="tourney">Sentinel Tournament - Live</div>
          <div className="monoData">
            {formatClock(now)} | Round remaining: None
          </div>
        </div>
        <div className="topRight">
          <div className="statusRow">
            <span className={`statusDot ${apiDotClass}`}>API</span>
            <span className={`statusDot ${supabaseReady ? "ok" : "bad"}`}>Supabase</span>
            <span className="statusDot ok">Stockfish</span>
            <span className="statusDot warn">DGT Feed</span>
          </div>
          <div className="arbiterMeta">
            <span className="monoData">Latency: {apiLatencyMs ?? "None"} ms</span>
            <span className="roleBadge">Checked {apiCheckedAt ? new Date(apiCheckedAt).toLocaleTimeString() : "None"}</span>
            <button className="escalateBtn" type="button">Emergency Escalation</button>
          </div>
        </div>
      </header>

      <nav className="dashNav">
        {navItems.map((item) => (
          <button key={item.id} className={page === item.id ? "navBtn active" : "navBtn"} onClick={() => setPage(item.id)} type="button">
            {item.label}
          </button>
        ))}
      </nav>

      {page === "command" ? (
        <section className="stacked">
          {/* KPI Metrics Section */}
          <div className="panel">
            <div className="panelHead">
              <h2>Key Performance Indicators</h2>
              <div className="muted">Real-time analytics overview</div>
            </div>
            <KPICards />
          </div>

          {/* Detailed Charts Section */}
          <div>
            <div className="panelHead" style={{ paddingLeft: "0.85rem", marginBottom: "0.8rem" }}>
              <h2>Metrics & Analysis</h2>
              <div className="muted">Comprehensive performance dashboard</div>
            </div>
            <MetricsAnalyzer />
          </div>

          <section className="panel panelMain">
            <div className="panelHead">
              <h2>Live Game Feed</h2>
              <div className="muted">Sorted by weighted risk score</div>
            </div>
            {games.length === 0 ? (
              <div className="muted">None</div>
            ) : (
              <div className="gameGrid">
                {games.map((g, idx) => {
                  const tier = normalizeRiskTier(g.risk_tier);
                  return (
                    <article key={g.game_id} className="gameCard" onClick={() => { setSelectedGameId(g.game_id); setPage("deep-dive"); }}>
                      <div className="cardRow">
                        <div>
                          <strong>{g.player_id || "None"}</strong>
                          <div className="muted">FIDE {g.player_id || "None"} | {g.official_elo || "None"}</div>
                        </div>
                        <RiskPill tier={tier} />
                      </div>
                      <div className="muted">Event {g.event_id || "None"} | Move {g.move_number || "None"}</div>
                      <Sparkline values={g.sparkline || []} />
                      <div className="riskBar"><span style={{ width: `${Math.round((g.weighted_risk_score || 0) * 100)}%` }} /></div>
                      <div className="monoData">Weighted Risk: {Number.isFinite(g.weighted_risk_score) ? g.weighted_risk_score.toFixed(3) : "None"}</div>
                      <div className="muted">Board: {idx + 1} | Audit: {g.audit_id || "None"}</div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="panel panelSide">
            <div className="panelHead">
              <h2>Alert Queue</h2>
              <div className="muted">Chronological triggered signals</div>
            </div>
            {feedAlerts.length === 0 ? (
              <div className="muted">None</div>
            ) : (
              <div className="alertList">
                {feedAlerts.map((a) => (
                  <article className="alertItem" key={a.id}>
                    <div className="cardRow">
                      <strong>{a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : "None"}</strong>
                      <span className={reviewedAlerts[a.id] ? "miniBadge reviewed" : "miniBadge pending"}>
                        {reviewedAlerts[a.id] ? "Reviewed" : "Pending"}
                      </span>
                    </div>
                    <div>{a.player_id || "None"}</div>
                    <div className="muted">{a.layer || "None"}: {(a.score ?? 0).toFixed(2)} / {(a.threshold ?? 0).toFixed(2)}</div>
                    <div>{a.description || "None"}</div>
                    <div className="buttonRow">
                      <button type="button" className="ghostBtn" onClick={() => setReviewedAlerts((prev) => ({ ...prev, [a.id]: true }))}>Mark Reviewed</button>
                      <button type="button" className="warnBtn">Escalate</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="statsRow">
              <div><span className="monoData">{feedSummary?.total_games_analyzed_today ?? "None"}</span><div className="muted">Games Today</div></div>
              <div><span className="monoData">{feedSummary?.games_elevated_or_above ?? "None"}</span><div className="muted">Elevated+</div></div>
              <div><span className="monoData">{feedSummary ? awaitingReview : "None"}</span><div className="muted">Awaiting Review</div></div>
              <div><span className="monoData">{feedSummary ? feedSummary.average_regan_z_score.toFixed(3) : "None"}</span><div className="muted">Avg Regan Z</div></div>
            </div>
          </aside>
          </section>

          <section className="panel pgnWorkbench">
            <div className="panelHead">
              <h2>PGN Analysis Workbench</h2>
              <div className="muted">Run direct PGN analysis from the dashboard</div>
            </div>
            <AnalysisConsole apiBase={apiBase} />
          </section>
        </section>
      ) : null}

      {page === "deep-dive" ? (
        <section className="stacked">
          <GameAnalysisDeepDive gameId={selectedGameId} />
        </section>
      ) : null}

      {page === "player" ? (
        <section className="stacked">
          <PlayerProfileAnalysis playerId={selectedGame?.player_id} />
        </section>
      ) : null}

      {page === "report" ? (
        <section className="stacked">
          <article className="panel"><h2>Report Composer</h2><div className="muted">None</div></article>
        </section>
      ) : null}

      {page === "admin" ? (
        <section className="stacked">
          <article className="panel">
            <h2>System Config</h2>
            <div className="muted">Missing env: {missingEnvVars.length ? missingEnvVars.join(", ") : "None"}</div>
          </article>
        </section>
      ) : null}

      <footer className="stickyDisclaimer">
        Statistical analysis only. All findings require human adjudication. This system does not determine guilt.
      </footer>
    </section>
  );
}
