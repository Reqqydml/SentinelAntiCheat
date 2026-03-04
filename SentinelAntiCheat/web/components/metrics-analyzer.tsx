"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from "recharts";

interface MetricsData {
  riskDistribution: Array<{ tier: string; count: number }>;
  confidenceScores: Array<{ name: string; score: number }>;
  riskTrend: Array<{ time: string; risk: number; confidence: number }>;
  signalCorrelation: Array<{ signal1: number; signal2: number }>;
  analysisVelocity: Array<{ hour: number; count: number }>;
  engineAccuracy: Array<{ move: number; accuracy: number; cp_loss: number }>;
}

const COLORS = ["#1a7a3c", "#c8960c", "#d4691a", "#c0392b"];

export function MetricsAnalyzer() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch metrics from API
    const fetchMetrics = async () => {
      try {
        const response = await fetch("/api/metrics/dashboard", {
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading || !metrics) {
    return (
      <div className="metricsLoading">
        <div className="muted">Loading metrics...</div>
      </div>
    );
  }

  return (
    <div className="metricsGrid">
      {/* Risk Tier Distribution */}
      <div className="panel chartCard">
        <div className="panelHead">
          <h3>Risk Tier Distribution</h3>
          <span className="muted">Total analyzed</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={metrics.riskDistribution}
              dataKey="count"
              nameKey="tier"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {metrics.riskDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Confidence Score Trends */}
      <div className="panel chartCard">
        <div className="panelHead">
          <h3>Confidence Scores</h3>
          <span className="muted">Average by tier</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={metrics.confidenceScores}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
            <XAxis dataKey="name" stroke="#8a9bb0" />
            <YAxis stroke="#8a9bb0" />
            <Tooltip
              contentStyle={{
                background: "#0f1f35",
                border: "1px solid #1a3a5c",
              }}
            />
            <Bar dataKey="score" fill="#1e6fdb" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Risk Score Trend */}
      <div className="panel chartCard" style={{ gridColumn: "1 / -1" }}>
        <div className="panelHead">
          <h3>Risk & Confidence Trends</h3>
          <span className="muted">Over time analysis</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={metrics.riskTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
            <XAxis dataKey="time" stroke="#8a9bb0" />
            <YAxis stroke="#8a9bb0" />
            <Tooltip
              contentStyle={{
                background: "#0f1f35",
                border: "1px solid #1a3a5c",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="risk"
              stroke="#c0392b"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="confidence"
              stroke="#1e6fdb"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Signal Correlation */}
      <div className="panel chartCard">
        <div className="panelHead">
          <h3>Signal Correlation</h3>
          <span className="muted">Multi-dimensional</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
            <XAxis dataKey="signal1" stroke="#8a9bb0" />
            <YAxis dataKey="signal2" stroke="#8a9bb0" />
            <Tooltip
              contentStyle={{
                background: "#0f1f35",
                border: "1px solid #1a3a5c",
              }}
            />
            <Scatter data={metrics.signalCorrelation} fill="#00d4ff" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Analysis Velocity */}
      <div className="panel chartCard">
        <div className="panelHead">
          <h3>Analysis Velocity</h3>
          <span className="muted">Hourly processing</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={metrics.analysisVelocity}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
            <XAxis dataKey="hour" stroke="#8a9bb0" />
            <YAxis stroke="#8a9bb0" />
            <Tooltip
              contentStyle={{
                background: "#0f1f35",
                border: "1px solid #1a3a5c",
              }}
            />
            <Bar dataKey="count" fill="#00d4ff" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Engine Accuracy Analysis */}
      <div className="panel chartCard">
        <div className="panelHead">
          <h3>Engine Accuracy</h3>
          <span className="muted">CP Loss by move</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={metrics.engineAccuracy}>
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
            <Line
              type="monotone"
              dataKey="accuracy"
              stroke="#1a7a3c"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="cp_loss"
              stroke="#d4691a"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
