import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getBusinessProfile } from "@/lib/business/profileServer";
import { buildCoachReport } from "@/lib/coach/coach";

// The Marketing Coach: proactive, prioritised advice from HIS real account data
// + Hazel's media-buying brain. Auth-gated. Reads live Meta insights, so allow
// time. Falls back to deterministic signals if the AI is unavailable.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const orgId = await getOrgId(supabase);
    const profile = await getBusinessProfile(orgId);
    const report = await buildCoachReport(supabase, orgId, profile);
    return NextResponse.json(report);
  } catch (e: any) {
    console.error("[coach] failed:", e?.message || e);
    return NextResponse.json({ error: "coach_failed", message: e?.message || "Coach failed" }, { status: 502 });
  }
}
