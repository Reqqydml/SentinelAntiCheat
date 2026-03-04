import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET(
  req: Request,
  { params }: { params: { gameId: string } }
) {
  try {
    const gameId = params.gameId;

    // Fetch game analysis
    const { data: analysis } = await supabase
      .from("analyses")
      .select("*")
      .eq("event_id", gameId)
      .single();

    // Fetch engine evaluations for this game
    const { data: engineData } = await supabase
      .from("engine_evals")
      .select("*")
      .eq("game_id", gameId)
      .order("move_number", { ascending: true });

    // Fetch move features for detailed analysis
    const { data: moveFeatures } = await supabase
      .from("move_features")
      .select("*")
      .eq("game_id", gameId)
      .order("ply", { ascending: true });

    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    // Build accuracy trend
    const accuracyTrend = engineData
      ? engineData.map((e) => ({
          move: e.move_number || 0,
          accuracy: 100 - Math.min(100, ((e.centipawn_loss || 0) / 300) * 100),
        }))
      : [];

    // Build CP loss analysis
    const cpLossAnalysis = engineData
      ? engineData.map((e) => ({
          move: e.move_number || 0,
          cp_loss: e.centipawn_loss || 0,
          threshold: 100, // Mock threshold
        }))
      : [];

    // Build time analysis from move features
    const timeAnalysis = moveFeatures
      ? moveFeatures.slice(0, 100).map((f) => ({
          move: Math.ceil((f.ply || 0) / 2),
          time_seconds: f.time_spent_seconds || 0,
        }))
      : [];

    // Parse signals from the analysis
    const signals = analysis.signals as Record<string, unknown> | null;
    const triggeredSignals = analysis.triggered_signals || 0;

    const signalBreakdown = signals
      ? Object.entries(signals)
          .slice(0, 10)
          .map(([name, value]) => ({
            signal: name,
            weight: typeof value === "number" ? value : 0.5,
            triggered: triggeredSignals > 0,
          }))
      : [];

    return NextResponse.json({
      game_id: gameId,
      player_id: analysis.player_id || "Unknown",
      event_id: analysis.event_id || "Unknown",
      risk_tier: analysis.risk_tier || "LOW",
      confidence: analysis.confidence || 0,
      weighted_risk_score: analysis.weighted_risk_score || 0,
      triggered_signals: triggeredSignals,
      move_count: engineData?.length || moveFeatures?.length || 0,
      accuracy_trend: accuracyTrend,
      signal_breakdown: signalBreakdown,
      cp_loss_analysis: cpLossAnalysis,
      time_analysis: timeAnalysis,
    });
  } catch (error) {
    console.error("Game analysis API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch game analysis" },
      { status: 500 }
    );
  }
}
