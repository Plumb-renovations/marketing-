import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ai/ratelimit";
import { getOrgId } from "@/lib/data/org";
import {
  getJourney, logUpdate, setJourneyStage, setOutcome, advanceFollowup, generateBrief, markLost, generateMessage,
  bookVisit, cancelVisit,
} from "@/lib/leadJourney/data";

// Lead Journey Sales Coach — per-lead capture + coaching. GET returns the
// journey detail; POST dispatches an action (log/brief/stage/lost/message/
// followup). Auth-gated; AI actions are rate-limited. Channel-agnostic.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const journey = await getJourney(supabase, orgId, id);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(journey);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }
  const action = String(body?.action || "");

  // The AI-spending actions are rate-limited; cheap state changes aren't.
  // (book_visit prepares the pre-quote briefing on first booking → AI.)
  if (["log", "brief", "lost", "message", "outcome", "book_visit"].includes(action)) {
    const limit = rateLimit(user.id);
    if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  try {
    const orgId = await getOrgId(supabase);
    switch (action) {
      case "log": {
        const text = String(body?.text || "").trim();
        if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
        const r = await logUpdate(supabase, orgId, id, text, body?.source === "voice" ? "voice" : "typed");
        const journey = await getJourney(supabase, orgId, id);
        return NextResponse.json({ ...r, journey });
      }
      case "outcome":
        return NextResponse.json(await setOutcome(supabase, orgId, id, body?.outcome, String(body?.detail || "")));
      case "stage":
        await setJourneyStage(supabase, orgId, id, body?.stage);
        return NextResponse.json({ ok: true, journey: await getJourney(supabase, orgId, id) });
      case "followup":
        await advanceFollowup(supabase, orgId, id, String(body?.channel || "text"));
        return NextResponse.json({ ok: true, journey: await getJourney(supabase, orgId, id) });
      case "book_visit": {
        const visitAt = String(body?.visitAt || "");
        if (!visitAt) return NextResponse.json({ error: "missing_visit" }, { status: 400 });
        return NextResponse.json(await bookVisit(supabase, orgId, id, visitAt, String(body?.notes || "")));
      }
      case "cancel_visit":
        return NextResponse.json(await cancelVisit(supabase, orgId, id));
      case "brief":
        return NextResponse.json({ briefing: await generateBrief(supabase, orgId, id) });
      case "lost":
        return NextResponse.json(await markLost(supabase, orgId, id, String(body?.reason || "other"), String(body?.detail || "")));
      case "message":
        return NextResponse.json(await generateMessage(supabase, orgId, id, String(body?.channel || "text"), String(body?.tone || "follow-up")));
      default:
        return NextResponse.json({ error: "unknown_action" }, { status: 400 });
    }
  } catch (e: any) {
    console.error(`[journey/${action}] failed:`, e?.message || e);
    return NextResponse.json({ error: "journey_failed", message: e?.message || "Action failed" }, { status: 502 });
  }
}
