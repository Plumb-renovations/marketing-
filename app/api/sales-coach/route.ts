import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { fetchJourneyLeads } from "@/lib/leadJourney/data";
import { needsCallNow, isCold, nextActionFor, speedToContactMinutes, analysePatterns, effectiveStage } from "@/lib/leadJourney/coach";

// The Sales Coach queue: leads to call NOW (speed-to-contact) + deals going cold
// (cadence due) + win/loss patterns. Deterministic (no AI) so it's fast.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const leads = await fetchJourneyLeads(supabase, orgId);
  const open = leads.filter((l) => !["won", "lost"].includes(effectiveStage(l)));

  const callNow = open.filter(needsCallNow).map((l) => ({
    id: l.id, name: l.name, project: l.project, action: nextActionFor(l), waitingMin: speedToContactMinutes(l),
  }));
  const cold = open
    .filter((l) => isCold(l))
    .map((l) => ({ id: l.id, name: l.name, project: l.project, action: nextActionFor(l), step: l.followupStep ?? 0 }));

  const patterns = analysePatterns(leads);
  return NextResponse.json({ callNow, cold, patterns, openCount: open.length });
}
