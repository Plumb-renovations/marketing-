import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ai/ratelimit";
import { getOrgId } from "@/lib/data/org";
import { getBusinessProfile } from "@/lib/business/profileServer";
import { buildStrategyBrief } from "@/lib/coach/strategy";
import { runGenerator } from "@/lib/ai/server";

// "Write ads from Hazel's recommendations": build the coach's strategy + angles,
// then write a ready-to-load draft ad per angle — grounded in the attached
// creative's description/key points when a photo/video is in play. One click →
// on-strategy drafts. Auth-gated + rate-limited.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = rateLimit(user.id);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  let body: any = {};
  try { body = await req.json(); } catch { /* optional body */ }
  const photoDataUrl = typeof body?.photoDataUrl === "string" ? body.photoDataUrl : null;
  const imageDescription = typeof body?.imageDescription === "string" ? body.imageDescription : undefined;
  const imageKeyPoints = Array.isArray(body?.imageKeyPoints) ? body.imageKeyPoints.map(String) : undefined;

  try {
    const orgId = await getOrgId(supabase);
    const profile = await getBusinessProfile(orgId);
    const strategy = await buildStrategyBrief(supabase, orgId, profile);

    const result: any = await runGenerator(
      "strategy-ads",
      { strategy: strategy.brief, angles: strategy.angles, imageDescription, imageKeyPoints, photoDataUrl },
      profile,
    );
    const drafts = Array.isArray(result?.drafts) ? result.drafts.slice(0, 6) : [];
    if (!drafts.length) return NextResponse.json({ error: "ai_unavailable", message: "No drafts returned" }, { status: 502 });
    return NextResponse.json({ drafts, angles: strategy.angles, brief: strategy.brief });
  } catch (e: any) {
    console.error("[ads/from-strategy] failed:", e?.message || e);
    return NextResponse.json({ error: "ai_unavailable", message: e?.message || "Couldn't write ads" }, { status: 502 });
  }
}
