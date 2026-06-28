import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { buildSnapshot } from "@/lib/coach/snapshot";
import { computeSignals, prioritise } from "@/lib/coach/signals";
import { fetchActiveDismissals, toAlert } from "@/lib/coach/alerts";
import { journeyAlerts } from "@/lib/leadJourney/alerts";

// Hazel's proactive "needs your attention" alerts — the prioritised coach
// signals (deterministic, no AI = fast/cheap for the persistent strip), minus
// what the user has snoozed. Auth-gated.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const orgId = await getOrgId(supabase);
    const [snapshot, dismissed] = await Promise.all([
      buildSnapshot(supabase, orgId),
      fetchActiveDismissals(supabase, orgId),
    ]);
    const signals = computeSignals(snapshot);
    const signalAlerts = prioritise(signals).filter((s) => !dismissed.has(s.id)).map(toAlert);
    // Merge in the Lead Journey sales alerts (call-now / deals going cold).
    const sales = (await journeyAlerts(supabase, orgId)).filter((a) => !dismissed.has(a.key));
    const rank = { high: 0, medium: 1, low: 2 } as const;
    const all = [...sales, ...signalAlerts].sort((a, b) => rank[a.severity] - rank[b.severity]);
    return NextResponse.json({
      alerts: all.slice(0, 8),
      total: all.length,
      confidence: snapshot.confidence,
    });
  } catch (e: any) {
    console.error("[coach/alerts] failed:", e?.message || e);
    return NextResponse.json({ alerts: [], total: 0, confidence: "early" });
  }
}
