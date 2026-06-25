import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { syncPerformance } from "@/lib/ads/creativeReview";

// Refresh per-image actuals from this org's real Meta results, then the learning
// loop can tell predicted vs actual. Auth-gated; reuses the live Meta ad tree.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const orgId = await getOrgId(supabase);
    const res = await syncPerformance(supabase, orgId);
    return NextResponse.json(res, { status: res.ok ? 200 : 200 });
  } catch (e: any) {
    console.error("[ads/creative-review/sync] failed:", e?.message || e);
    return NextResponse.json({ ok: false, updated: 0, reason: e?.message || "sync failed" }, { status: 200 });
  }
}
