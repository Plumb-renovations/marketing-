import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ai/ratelimit";
import { getOrgId } from "@/lib/data/org";
import { getBusinessProfile } from "@/lib/business/profileServer";
import { askMetaAdsCoach } from "@/lib/coach/metaAds";

// The Meta Ads Coach: expert, framework-driven answers from the org's REAL ad
// data (fetchAdTree + per-creative analysis). Auth-gated + rate-limited. The
// orchestrator is timeout-safe (abort deadline + deterministic fallback), so
// this never runs into the function limit.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = rateLimit(user.id);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }
  const question = String(body?.question || "").trim();
  if (!question) return NextResponse.json({ error: "no_question" }, { status: 400 });
  const history = Array.isArray(body?.history) ? body.history.slice(-4).map((h: any) => ({ q: String(h?.q || ""), a: String(h?.a || "") })) : [];

  try {
    const orgId = await getOrgId(supabase);
    const profile = await getBusinessProfile(orgId);
    const answer = await askMetaAdsCoach(supabase, orgId, profile, question, history);
    return NextResponse.json(answer);
  } catch (e: any) {
    console.error("[meta-coach] failed:", e?.message || e);
    return NextResponse.json({ error: "coach_failed", message: e?.message || "Couldn't answer right now" }, { status: 502 });
  }
}
