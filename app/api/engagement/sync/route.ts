import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId } from "@/lib/data/org";
import { getBusinessProfile } from "@/lib/business/profileServer";
import { getMetaConfig } from "@/lib/integrations/meta/config";
import { getGoogleBusinessConfig } from "@/lib/integrations/google/config";
import { checkCommentAccess } from "@/lib/engagement/access";
import { fetchPageComments, fetchIgComments } from "@/lib/integrations/meta/comments";
import { fetchGoogleReviews } from "@/lib/integrations/google/reviews";
import { storeComments, storeReviews } from "@/lib/engagement/store";
import { draftReplyForItem } from "@/lib/engagement/draft";

// Pull recent FB/IG comments + Google reviews (only where the connection allows
// — honest, never faked), then auto-draft Hazel's suggested replies for the new
// ones so they're ready for the owner to approve. Auth-gated.
export const runtime = "nodejs";
export const maxDuration = 60;

const DRAFT_CAP = 12;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const admin = createAdminClient();
  const counts = { facebook: 0, instagram: 0, google: 0, drafted: 0 };

  // ---- Meta comments (gated on live permission) ----
  const metaConfig = await getMetaConfig(orgId);
  const access = metaConfig ? await checkCommentAccess(metaConfig).catch(() => null) : null;
  if (metaConfig && access?.canReadFb) {
    try { counts.facebook = await storeComments(admin, orgId, await fetchPageComments(metaConfig)); }
    catch (e) { console.error("[engagement] fb fetch failed:", (e as Error).message); }
  }
  if (metaConfig && access?.canReadIg) {
    try { counts.instagram = await storeComments(admin, orgId, await fetchIgComments(metaConfig)); }
    catch (e) { console.error("[engagement] ig fetch failed:", (e as Error).message); }
  }

  // ---- Google reviews (only when connected) ----
  const gconfig = await getGoogleBusinessConfig(orgId).catch(() => null);
  if (gconfig) {
    try { counts.google = await storeReviews(admin, orgId, await fetchGoogleReviews(gconfig)); }
    catch (e) { console.error("[engagement] google fetch failed:", (e as Error).message); }
  }

  // ---- Auto-draft the new items so they're ready to approve ----
  try {
    const { data: fresh } = await admin
      .from("engagement_items")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "new")
      .order("item_at", { ascending: false })
      .limit(DRAFT_CAP);
    if (fresh?.length) {
      const profile = await getBusinessProfile(orgId);
      for (const row of fresh) {
        const item = {
          id: row.id, channel: row.channel, kind: row.kind, externalId: row.external_id,
          parentRef: row.parent_ref, permalink: row.permalink, author: row.author_name,
          text: row.text || "", rating: row.rating ?? null, sentiment: null, status: "new",
          draftReply: null, flagged: false, flagReason: null, itemAt: row.item_at,
        };
        try { if (await draftReplyForItem(admin, orgId, profile, item as any)) counts.drafted++; }
        catch { /* skip this one */ }
      }
    }
  } catch (e) {
    console.error("[engagement] auto-draft failed:", (e as Error).message);
  }

  return NextResponse.json({
    ok: true,
    counts,
    meta: { connected: !!metaConfig, access },
    google: { connected: !!gconfig },
  });
}
