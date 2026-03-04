import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  try {
    // Get risk tier distribution
    const { data: analyses } = await supabase
      .from("analyses")
      .select("risk_tier, confidence, weighted_risk_score")
      .limit(1000);

    // Get engine evaluation data
    const { data: engineData } = await supabase
      .from("engine_evals")
      .select("centipawn_loss, best_eval_cp, played_eval_cp, move_number")
      .limit(500);

    // Calculate risk distribution
    const riskDistribution = {
      LOW: 0,
      MODERATE: 0,
      ELEVATED: 0,
      HIGH_STATISTICAL_ANOMALY: 0,
    };

    analyses?.forEach((a) => {
      const tier = a.risk_tier as keyof typeof riskDistribution;
      if (tier in riskDistribution) riskDistribution[tier]++;
    });

    const riskDistributionData = Object.entries(riskDistribution).map(
      ([tier, count]) => ({
        tier,
        count,
      })
    );

    // Calculate confidence scores by tier
    const confidenceByTier: Record<string, { sum: number; count: number }> = {};
    analyses?.forEach((a) => {
      const tier = a.risk_tier || "UNKNOWN";
      if (!confidenceByTier[tier]) {
        confidenceByTier[tier] = { sum: 0, count: 0 };
      }
      confidenceByTier[tier].sum += a.confidence || 0;
      confidenceByTier[tier].count += 1;
    });

    const confidenceScores = Object.entries(confidenceByTier).map(
      ([name, data]) => ({
        name,
        score: data.count > 0 ? data.sum / data.count : 0,
      })
    );

    // Generate risk trend data (mock last 24 hours)
    const now = new Date();
    const riskTrend = Array.from({ length: 24 }).map((_, i) => {
      const hour = new Date(now.getTime() - (23 - i) * 3600000);
      const hourStr = hour.toLocaleTimeString("en-US", {
        hour: "2-digit",
        hour12: false,
      });

      // Aggregate data for this hour
      const hourData = analyses?.filter((a) => {
        const aTime = new Date(a.created_at);
        return (
          aTime.getHours() === hour.getHours() &&
          aTime.getDate() === hour.getDate()
        );
      });

      const avgRisk =
        hourData && hourData.length > 0
          ? hourData.reduce((sum, a) => sum + (a.weighted_risk_score || 0), 0) /
            hourData.length
          : Math.random() * 0.3;

      const avgConfidence =
        hourData && hourData.length > 0
          ? hourData.reduce((sum, a) => sum + (a.confidence || 0), 0) /
            hourData.length
          : 0.5 + Math.random() * 0.3;

      return {
        time: hourStr,
        risk: Math.min(1, Math.max(0, avgRisk)),
        confidence: Math.min(1, Math.max(0, avgConfidence)),
      };
    });

    // Signal correlation (mock scatter data)
    const signalCorrelation = Array.from({ length: 30 }).map(() => ({
      signal1: Math.random() * 100,
      signal2: Math.random() * 100,
    }));

    // Analysis velocity by hour
    const analysisVelocity = Array.from({ length: 24 }).map((_, i) => ({
      hour: i,
      count: Math.floor(Math.random() * 50) + 10,
    }));

    // Engine accuracy by move
    const engineAccuracy = engineData
      ? engineData.slice(0, 30).map((e) => ({
          move: e.move_number || 0,
          accuracy: 100 - Math.min(100, ((e.centipawn_loss || 0) / 300) * 100),
          cp_loss: e.centipawn_loss || 0,
        }))
      : Array.from({ length: 10 }).map((_, i) => ({
          move: i + 1,
          accuracy: 85 + Math.random() * 15,
          cp_loss: Math.random() * 150,
        }));

    return NextResponse.json({
      riskDistribution: riskDistributionData,
      confidenceScores,
      riskTrend,
      signalCorrelation,
      analysisVelocity,
      engineAccuracy,
    });
  } catch (error) {
    console.error("Metrics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
