"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

interface KPIData {
  total_games_analyzed: number;
  games_flagged: number;
  average_confidence: number;
  high_risk_count: number;
  elevated_risk_count: number;
  moderate_risk_count: number;
  low_risk_count: number;
  average_regan_z_score: number;
  analysis_success_rate: number;
  human_review_pending: number;
  flag_rate_percentage: number;
  confidence_trend: "up" | "down" | "stable";
}

export function KPICards() {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPI = async () => {
      try {
        const response = await fetch("/api/metrics/kpi", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          setKpiData(data);
        }
      } catch (error) {
        console.error("Failed to fetch KPI data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchKPI();
    const interval = setInterval(fetchKPI, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading || !kpiData) {
    return (
      <div className="kpiGrid">
        <div className="muted">Loading KPI data...</div>
      </div>
    );
  }

  const kpis = [
    {
      label: "Games Analyzed",
      value: kpiData.total_games_analyzed,
      subtext: `${kpiData.flag_rate_percentage.toFixed(1)}% flagged`,
      icon: "📊",
      color: "accent",
    },
    {
      label: "Flagged Games",
      value: kpiData.games_flagged,
      subtext: `${kpiData.average_confidence.toFixed(3)} avg confidence`,
      icon: "⚠️",
      color: "elevated",
    },
    {
      label: "High Risk",
      value: kpiData.high_risk_count,
      subtext: `Immediate attention required`,
      icon: "🔴",
      color: "high",
    },
    {
      label: "Elevated Risk",
      value: kpiData.elevated_risk_count,
      subtext: `Under observation`,
      icon: "🟠",
      color: "elevated",
    },
    {
      label: "Moderate Risk",
      value: kpiData.moderate_risk_count,
      subtext: `Monitor closely`,
      icon: "🟡",
      color: "moderate",
    },
    {
      label: "Low Risk",
      value: kpiData.low_risk_count,
      subtext: `Cleared for play`,
      icon: "🟢",
      color: "safe",
    },
    {
      label: "Avg Regan Z-Score",
      value: kpiData.average_regan_z_score.toFixed(3),
      subtext: "Statistical deviation",
      icon: "📈",
      color: "accent",
    },
    {
      label: "Analysis Success Rate",
      value: `${(kpiData.analysis_success_rate * 100).toFixed(1)}%`,
      subtext: "Processing reliability",
      icon: "✓",
      color: "safe",
    },
    {
      label: "Pending Review",
      value: kpiData.human_review_pending,
      subtext: "Awaiting arbiter action",
      icon: "👤",
      color: "moderate",
    },
  ];

  return (
    <div className="kpiGrid">
      {kpis.map((kpi, idx) => (
        <div key={idx} className={`kpiCard kpiCard-${kpi.color}`}>
          <div className="kpiContent">
            <div className="kpiLabel">{kpi.label}</div>
            <div className="kpiValue">{kpi.value}</div>
            <div className="kpiSubtext">{kpi.subtext}</div>
          </div>
          <div className="kpiIcon">{kpi.icon}</div>
        </div>
      ))}
    </div>
  );
}
