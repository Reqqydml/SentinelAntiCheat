"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface PlayerData {
  player_id: string;
  total_games: number;
  flagged_games: number;
  average_confidence: number;
  high_risk_games: number;
  elevated_risk_games: number;
  risk_distribution: Array<{ risk_tier: string; count: number }>;
  confidence_history: Array<{ game: number; confidence: number }>;
  flag_rate_trend: Array<{ period: string; rate: number }>;
  average_rating: number;
}

interface Props {
  playerId?: string;
}

export function PlayerProfileAnalysis({ playerId }: Props) {
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) {
      setLoading(false);
      return;
    }

    const fetchPlayerData = async () => {
      try {
        const response = await fetch(
          `/api/analysis/player/${playerId}`,
          { cache: "no-store" }
        );
        if (response.ok) {
          const data = await response.json();
          setPlayerData(data);
        }
      } catch (error) {
        console.error("Failed to fetch player data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, [playerId]);

  if (!playerId) {
    return (
      <div className="panel">
        <div className="panelHead">
          <h2>Player Profile</h2>
        </div>
        <div className="muted">Select or enter a player ID to view profile</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel">
        <div className="muted">Loading player profile...</div>
      </div>
    );
  }

  if (!playerData) {
    return (
      <div className="panel">
        <div className="muted">Player profile not found</div>
      </div>
    );
  }

  const flagPercentage =
    playerData.total_games > 0
      ? ((playerData.flagged_games / playerData.total_games) * 100).toFixed(1)
      : "0";

  const riskLevel =
    playerData.flagged_games > 3
      ? "HIGH_RISK"
      : playerData.flagged_games > 1
        ? "ELEVATED"
        : "LOW_RISK";

  return (
    <div className="playerProfileContainer">
      {/* Header */}
      <div className="panel">
        <div className="panelHead">
          <div>
            <h2>Player Profile: {playerData.player_id}</h2>
            <div className="muted">FIDE Rating: {playerData.average_rating}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className={`riskPill riskPill${riskLevel}`}>
              {riskLevel.replaceAll("_", " ")}
            </div>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="playerStatsGrid">
        <div className="playerStatCard">
          <div className="statLabel">Total Games</div>
          <div className="statValue">{playerData.total_games}</div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Analyzed
          </div>
        </div>
        <div className="playerStatCard">
          <div className="statLabel">Flagged Games</div>
          <div className="statValue">{playerData.flagged_games}</div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            {flagPercentage}% rate
          </div>
        </div>
        <div className="playerStatCard">
          <div className="statLabel">Avg Confidence</div>
          <div className="statValue">
            {playerData.average_confidence.toFixed(3)}
          </div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Analysis score
          </div>
        </div>
        <div className="playerStatCard">
          <div className="statLabel">High Risk Games</div>
          <div className="statValue">{playerData.high_risk_games}</div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Immediate action
          </div>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="chartsRow">
        <div className="panel chartCard">
          <div className="panelHead">
            <h3>Risk Distribution</h3>
            <span className="muted">Across all games</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={playerData.risk_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
              <XAxis dataKey="risk_tier" stroke="#8a9bb0" />
              <YAxis stroke="#8a9bb0" />
              <Tooltip
                contentStyle={{
                  background: "#0f1f35",
                  border: "1px solid #1a3a5c",
                }}
              />
              <Bar dataKey="count" fill="#1e6fdb" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Confidence History */}
        <div className="panel chartCard">
          <div className="panelHead">
            <h3>Confidence History</h3>
            <span className="muted">Last 20 games</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={playerData.confidence_history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
              <XAxis dataKey="game" stroke="#8a9bb0" />
              <YAxis stroke="#8a9bb0" domain={[0, 1]} />
              <Tooltip
                contentStyle={{
                  background: "#0f1f35",
                  border: "1px solid #1a3a5c",
                }}
              />
              <Line
                type="monotone"
                dataKey="confidence"
                stroke="#1a7a3c"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Flag Rate Trend */}
      <div className="panel chartCard">
        <div className="panelHead">
          <h3>Flag Rate Trend</h3>
          <span className="muted">Over time periods</span>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={playerData.flag_rate_trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
            <XAxis dataKey="period" stroke="#8a9bb0" />
            <YAxis stroke="#8a9bb0" />
            <Tooltip
              contentStyle={{
                background: "#0f1f35",
                border: "1px solid #1a3a5c",
              }}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#d4691a"
              strokeWidth={2}
              dot={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Actions */}
      <div className="panel">
        <div className="panelHead">
          <h2>Actions</h2>
        </div>
        <div className="actionButtonsGrid">
          <button className="primaryBtn">Generate Report</button>
          <button className="primaryBtn">Export Data</button>
          <button className="primaryBtn">Schedule Review</button>
          <button className="warnBtn">Flag for Investigation</button>
        </div>
      </div>
    </div>
  );
}
