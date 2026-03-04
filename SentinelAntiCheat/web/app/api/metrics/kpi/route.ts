import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  try {
    // Get all analyses from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: analyses } = await supabase
      .from("analyses")
      .select("*")
      .gte("created_at", today.toISOString());

    if (!analyses) {
      return NextResponse.json({
        total_games_analyzed: 0,
        games_flagged: 0,
        average_confidence: 0,
        high_risk_count: 0,
        elevated_risk_count: 0,
        moderate_risk_count: 0,
        low_risk_count: 0,
        average_regan_z_score: 0,
        analysis_success_rate: 1,
        human_review_pending: 0,
        flag_rate_percentage: 0,
        confidence_trend: "stable",
      });
    }

    // Calculate metrics
    const total = analyses.length;
    const highRisk = analyses.filter((a) => a.risk_tier === "HIGH_STATISTICAL_ANOMALY").length;
    const elevatedRisk = analyses.filter((a) => a.risk_tier === "ELEVATED").length;
    const moderateRisk = analyses.filter((a) => a.risk_tier === "MODERATE").length;
    const lowRisk = analyses.filter((a) => a.risk_tier === "LOW").length;
    const flagged = highRisk + elevatedRisk + moderateRisk;

    const avgConfidence =
      total > 0
        ? analyses.reduce((sum, a) => sum + (a.confidence || 0), 0) / total
        : 0;

    const avgReganZScore =
      total > 0
        ? analyses.reduce(
            (sum, a) =>
              sum +
              (a.natural_occurrence_probability
                ? Math.abs(Math.log(a.natural_occurrence_probability))
                : 0),
            0
          ) / total
        : 0;

    const awaitingReview = analyses.filter(
      (a) => a.human_review_required === true
    ).length;

    return NextResponse.json({
      total_games_analyzed: total,
      games_flagged: flagged,
      average_confidence: avgConfidence,
      high_risk_count: highRisk,
      elevated_risk_count: elevatedRisk,
      moderate_risk_count: moderateRisk,
      low_risk_count: lowRisk,
      average_regan_z_score: avgReganZScore,
      analysis_success_rate: 0.98, // Mock value - would be calculated from processing logs
      human_review_pending: awaitingReview,
      flag_rate_percentage: total > 0 ? (flagged / total) * 100 : 0,
      confidence_trend: "up", // Mock value - would be calculated from trend
    });
  } catch (error) {
    console.error("KPI API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch KPI metrics" },
      { status: 500 }
    );
  }
}
