import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getMetaConfig } from "@/lib/integrations/meta/config";
import { getGoogleBusinessConfig } from "@/lib/integrations/google/config";
import { checkCommentAccess } from "@/lib/engagement/access";
import { fetchEngagementItems } from "@/lib/engagement/store";

// Engagement inbox: FB/IG comments + Google reviews with Hazel's drafted replies.
// Reports honest, LIVE status for each channel so the UI never shows pending
// channels as live. Auth-gated.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const metaConfig = await getMetaConfig(orgId);
  const access = metaConfig ? await checkCommentAccess(metaConfig).catch(() => null) : null;
  const gconfig = await getGoogleBusinessConfig(orgId).catch(() => null);
  const items = await fetchEngagementItems(supabase);

  return NextResponse.json({
    items,
    meta: { connected: !!metaConfig, access },
    google: { connected: !!gconfig },
  });
}
