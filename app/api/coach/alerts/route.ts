import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { buildSnapshot } from "@/lib/coach/snapshot";
import { computeSignals, prioritise } from "@/lib/coach/signals";
import { fetchActiveDismissals, toAlert } from "@/lib/coach/alerts";

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
    const visible = prioritise(signals).filter((s) => !dismissed.has(s.id));
    return NextResponse.json({
      alerts: visible.slice(0, 8).map(toAlert),
      total: visible.length,
      confidence: snapshot.confidence,
    });
  } catch (e: any) {
    console.error("[coach/alerts] failed:", e?.message || e);
    return NextResponse.json({ alerts: [], total: 0, confidence: "early" });
  }
}
