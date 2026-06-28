import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ai/ratelimit";
import { getOrgId } from "@/lib/data/org";
import { getBusinessProfile } from "@/lib/business/profileServer";
import { getEngagementItem } from "@/lib/engagement/store";
import { draftReplyForItem } from "@/lib/engagement/draft";

// (Re)draft Hazel's suggested reply for one comment/review. Never posts. Auth +
// rate-limited.
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
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const orgId = await getOrgId(supabase);
  const item = await getEngagementItem(supabase, orgId, id);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const profile = await getBusinessProfile(orgId);
    const result = await draftReplyForItem(supabase, orgId, profile, item);
    if (!result) return NextResponse.json({ error: "ai_unavailable", message: "No draft returned" }, { status: 502 });
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[engagement/draft] failed:", e?.message || e);
    return NextResponse.json({ error: "ai_unavailable", message: e?.message || "Couldn't draft a reply" }, { status: 502 });
  }
}
