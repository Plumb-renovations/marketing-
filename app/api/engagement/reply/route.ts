import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getMetaConfig } from "@/lib/integrations/meta/config";
import { getGoogleBusinessConfig } from "@/lib/integrations/google/config";
import { MetaAuthError } from "@/lib/integrations/meta/client";
import { checkCommentAccess } from "@/lib/engagement/access";
import { replyToComment } from "@/lib/integrations/meta/comments";
import { replyToGoogleReview } from "@/lib/integrations/google/reviews";
import { getEngagementItem } from "@/lib/engagement/store";

// Post an APPROVED reply (the user clicked approve — nothing auto-posts). GATED
// on the live channel permission / connection; otherwise returns a clear pending
// state so the UI stays read-only-with-draft.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }
  const id = String(body?.id || "");
  const text = String(body?.text || "").trim();
  if (!id || !text) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const orgId = await getOrgId(supabase);
  const item = await getEngagementItem(supabase, orgId, id);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    if (item.channel === "google") {
      const gconfig = await getGoogleBusinessConfig(orgId);
      if (!gconfig) return NextResponse.json({ error: "google_not_connected", message: "Connect Google Business Profile first to reply to reviews." }, { status: 412 });
      const r = await replyToGoogleReview(gconfig, item.externalId, text);
      if (!r.ok) return NextResponse.json({ error: "send_failed", message: "Google rejected the reply." }, { status: 502 });
    } else {
      const metaConfig = await getMetaConfig(orgId);
      if (!metaConfig) return NextResponse.json({ error: "meta_not_connected", message: "Connect Meta first." }, { status: 412 });
      const access = await checkCommentAccess(metaConfig);
      const can = item.channel === "instagram" ? access.canReplyIg : access.canReplyFb;
      if (!can) return NextResponse.json({ error: "not_approved", message: access.note }, { status: 403 });
      await replyToComment(metaConfig, item.channel as "facebook" | "instagram", item.externalId, text);
    }

    await supabase.from("engagement_items").update({ status: "replied", draft_reply: text, replied_at: new Date().toISOString() }).eq("org_id", orgId).eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MetaAuthError) return NextResponse.json({ error: "reconnect", message: "Meta connection expired — reconnect in Settings → Integrations." }, { status: 401 });
    console.error("[engagement/reply] failed:", (e as Error).message);
    return NextResponse.json({ error: "send_failed", message: (e as Error).message }, { status: 502 });
  }
}
