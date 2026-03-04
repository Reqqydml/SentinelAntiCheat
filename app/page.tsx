import type { Metadata } from "next";
import { ArbiterDashboard } from "../components/arbiter-dashboard";

export const metadata: Metadata = {
  title: "Arbiter Dashboard",
  description: "Sentinel monitoring and arbitration interface",
};

// Revalidate every 30 seconds so the health status stays fresh
// without blocking every page load
export const revalidate = 30;

type ApiHealth = "healthy" | "degraded" | "offline";

interface SystemStatus {
  health: ApiHealth;
  latencyMs: number | null;
  checkedAt: string;
}

async function getSystemStatus(apiBase: string): Promise<SystemStatus> {
  const start = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    const res = await fetch(`${apiBase}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000), // 5 s hard timeout
      headers: { Accept: "application/json" },
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      return { health: "degraded", latencyMs, checkedAt };
    }

    const data = (await res.json()) as { status?: string };

    const health: ApiHealth =
      data.status === "healthy"
        ? "healthy"
        : data.status === "degraded"
          ? "degraded"
          : "offline";

    return { health, latencyMs, checkedAt };
  } catch {
    return { health: "offline", latencyMs: null, checkedAt };
  }
}

function getEnvConfig() {
  const apiBase =
    process.env.NEXT_PUBLIC_SENTINEL_API?.replace(/\/$/, "") ??
    "http://localhost:8000";

  const supabaseReady = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const missingEnvVars: string[] = [];
  if (!process.env.NEXT_PUBLIC_SENTINEL_API) missingEnvVars.push("NEXT_PUBLIC_SENTINEL_API");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missingEnvVars.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missingEnvVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return { apiBase, supabaseReady, missingEnvVars };
}

export default async function HomePage() {
  const { apiBase, supabaseReady, missingEnvVars } = getEnvConfig();
  const status = await getSystemStatus(apiBase);

  return (
    <ArbiterDashboard
      apiBase={apiBase}
      apiHealth={status.health}
      apiLatencyMs={status.latencyMs}
      apiCheckedAt={status.checkedAt}
      supabaseReady={supabaseReady}
      missingEnvVars={missingEnvVars}
    />
  );
}
