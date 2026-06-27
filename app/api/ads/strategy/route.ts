import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getBusinessProfile } from "@/lib/business/profileServer";
import { buildStrategyBrief } from "@/lib/coach/strategy";

// The coach's current strategy brief + recommended angles, for the Ad Creator
// to ground copy in (and for the "write ads from recommendations" action).
// Deterministic (reuses the brain), so it's a fast single fetch. Auth-gated.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const orgId = await getOrgId(supabase);
    const profile = await getBusinessProfile(orgId);
    const strategy = await buildStrategyBrief(supabase, orgId, profile);
    return NextResponse.json(strategy);
  } catch (e: any) {
    console.error("[ads/strategy] failed:", e?.message || e);
    return NextResponse.json({ error: "strategy_failed", message: e?.message || "Couldn't build strategy" }, { status: 502 });
  }
}
