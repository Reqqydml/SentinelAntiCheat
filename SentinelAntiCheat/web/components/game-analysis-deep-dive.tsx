"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface GameAnalysisData {
  game_id: string;
  player_id: string;
  event_id: string;
  risk_tier: string;
  confidence: number;
  weighted_risk_score: number;
  triggered_signals: number;
  move_count: number;
  accuracy_trend: Array<{ move: number; accuracy: number }>;
  signal_breakdown: Array<{ signal: string; weight: number; triggered: boolean }>;
  cp_loss_analysis: Array<{
    move: number;
    cp_loss: number;
    threshold: number;
  }>;
  time_analysis: Array<{ move: number; time_seconds: number }>;
}

interface Props {
  gameId: string | null;
}

export function GameAnalysisDeepDive({ gameId }: Props) {
  const [analysis, setAnalysis] = useState<GameAnalysisData | null>(null);
  const [loading, setLoading] = useState(!gameId);

  useEffect(() => {
    if (!gameId) return;

    const fetchAnalysis = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/analysis/game/${gameId}`,
          { cache: "no-store" }
        );
        if (response.ok) {
          const data = await response.json();
          setAnalysis(data);
        }
      } catch (error) {
        console.error("Failed to fetch game analysis:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [gameId]);

  if (!gameId) {
    return (
      <div className="panel">
        <div className="panelHead">
          <h2>Game Deep Dive</h2>
          <div className="muted">Select a game to analyze</div>
        </div>
        <div className="muted">No game selected</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel">
        <div className="muted">Loading analysis...</div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="panel">
        <div className="muted">Failed to load analysis data</div>
      </div>
    );
  }

  return (
    <div className="deepDiveContainer">
      {/* Header */}
      <div className="panel">
        <div className="panelHead">
          <div>
            <h2>Game Analysis: {analysis.game_id}</h2>
            <div className="muted">
              Player: {analysis.player_id} | Event: {analysis.event_id}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className={`riskPill riskPill${analysis.risk_tier}`}>
              {analysis.risk_tier.replaceAll("_", " ")}
            </div>
            <div className="muted" style={{ marginTop: "0.3rem", fontSize: "0.85rem" }}>
              Confidence: {analysis.confidence.toFixed(3)}
            </div>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="statsGrid">
        <div className="statCard">
          <div className="statLabel">Weighted Risk Score</div>
          <div className="statValue">{analysis.weighted_risk_score.toFixed(3)}</div>
        </div>
        <div className="statCard">
          <div className="statLabel">Triggered Signals</div>
          <div className="statValue">{analysis.triggered_signals}</div>
        </div>
        <div className="statCard">
          <div className="statLabel">Total Moves</div>
          <div className="statValue">{analysis.move_count}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="chartsGrid">
        {/* Accuracy Trend */}
        <div className="panel chartCard">
          <div className="panelHead">
            <h3>Accuracy Trend</h3>
            <span className="muted">Move-by-move analysis</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={analysis.accuracy_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
              <XAxis dataKey="move" stroke="#8a9bb0" />
              <YAxis stroke="#8a9bb0" />
              <Tooltip
                contentStyle={{
                  background: "#0f1f35",
                  border: "1px solid #1a3a5c",
                }}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#1e6fdb"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Centipawn Loss Analysis */}
        <div className="panel chartCard">
          <div className="panelHead">
            <h3>Centipawn Loss Analysis</h3>
            <span className="muted">vs threshold</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analysis.cp_loss_analysis}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
              <XAxis dataKey="move" stroke="#8a9bb0" />
              <YAxis stroke="#8a9bb0" />
              <Tooltip
                contentStyle={{
                  background: "#0f1f35",
                  border: "1px solid #1a3a5c",
                }}
              />
              <Legend />
              <Bar dataKey="cp_loss" fill="#d4691a" name="CP Loss" />
              <Bar dataKey="threshold" fill="#1e6fdb" name="Threshold" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Time Analysis */}
        <div className="panel chartCard">
          <div className="panelHead">
            <h3>Think Time Analysis</h3>
            <span className="muted">Per move (seconds)</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={analysis.time_analysis}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
              <XAxis dataKey="move" stroke="#8a9bb0" />
              <YAxis stroke="#8a9bb0" />
              <Tooltip
                contentStyle={{
                  background: "#0f1f35",
                  border: "1px solid #1a3a5c",
                }}
              />
              <Line
                type="monotone"
                dataKey="time_seconds"
                stroke="#00d4ff"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Signal Breakdown */}
      <div className="panel">
        <div className="panelHead">
          <h2>Signal Breakdown</h2>
          <div className="muted">Triggered detection signals</div>
        </div>
        <div className="signalBreakdownGrid">
          {analysis.signal_breakdown.map((signal, idx) => (
            <div
              key={idx}
              className={`signalItem ${signal.triggered ? "triggered" : ""}`}
            >
              <div className="signalName">{signal.signal}</div>
              <div className="signalWeight">Weight: {signal.weight.toFixed(3)}</div>
              <div
                className={`signalStatus ${
                  signal.triggered ? "triggered" : "idle"
                }`}
              >
                {signal.triggered ? "🔴 Triggered" : "⚪ Not Triggered"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes Section */}
      <div className="panel">
        <div className="panelHead">
          <h2>Arbiter Notes</h2>
          <div className="muted">Add comments and findings</div>
        </div>
        <textarea
          placeholder="Enter your analysis notes here..."
          className="notesTextarea"
          rows={5}
        />
        <button className="primaryBtn" style={{ marginTop: "0.7rem" }}>
          Save Notes
        </button>
      </div>
    </div>
  );
}
