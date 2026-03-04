import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET(
  req: Request,
  { params }: { params: { playerId: string } }
) {
  try {
    const playerId = params.playerId;

    // Fetch all analyses for this player
    const { data: analyses } = await supabase
      .from("analyses")
      .select("*")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!analyses || analyses.length === 0) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    const total = analyses.length;
    const flagged = analyses.filter(
      (a) => a.risk_tier !== "LOW"
    ).length;

    const highRisk = analyses.filter(
      (a) => a.risk_tier === "HIGH_STATISTICAL_ANOMALY"
    ).length;

    const elevatedRisk = analyses.filter(
      (a) => a.risk_tier === "ELEVATED"
    ).length;

    const moderateRisk = analyses.filter(
      (a) => a.risk_tier === "MODERATE"
    ).length;

    const lowRisk = analyses.filter(
      (a) => a.risk_tier === "LOW"
    ).length;

    const avgConfidence =
      total > 0
        ? analyses.reduce((sum, a) => sum + (a.confidence || 0), 0) / total
        : 0;

    // Risk distribution
    const riskDistribution = [
      { risk_tier: "LOW", count: lowRisk },
      { risk_tier: "MODERATE", count: moderateRisk },
      { risk_tier: "ELEVATED", count: elevatedRisk },
      { risk_tier: "HIGH", count: highRisk },
    ];

    // Confidence history (last 20)
    const confidenceHistory = analyses
      .slice(0, 20)
      .reverse()
      .map((a, idx) => ({
        game: idx + 1,
        confidence: a.confidence || 0,
      }));

    // Flag rate trend (mock last 4 periods)
    const flagRateTrend = [
      { period: "Week 1", rate: 10 },
      { period: "Week 2", rate: 15 },
      { period: "Week 3", rate: 20 },
      { period: "Week 4", rate: 25 },
    ];

    return NextResponse.json({
      player_id: playerId,
      total_games: total,
      flagged_games: flagged,
      average_confidence: avgConfidence,
      high_risk_games: highRisk,
      elevated_risk_games: elevatedRisk,
      risk_distribution: riskDistribution,
      confidence_history: confidenceHistory,
      flag_rate_trend: flagRateTrend,
      average_rating: 2000, // Mock value - would come from actual data
    });
  } catch (error) {
    console.error("Player analysis API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch player analysis" },
      { status: 500 }
    );
  }
}
