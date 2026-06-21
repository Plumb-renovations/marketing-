import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getMetaConfig, getMetaIntegrationRow, saveMetaIntegration, markMetaExpired } from "@/lib/integrations/meta/config";
import { metaClient, MetaAuthError } from "@/lib/integrations/meta/client";
import { subscribePageLeadgen, getPageLeadgenSubscription } from "@/lib/integrations/meta/subscribe";

// Subscribe (POST) the connected Page to the leadgen webhook, or check (GET)
// whether it's already subscribed. This is what makes lead notifications flow.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolve(supabase: Awaited<ReturnType<typeof createClient>>) {
  const orgId = await getOrgId(supabase);
  const config = await getMetaConfig(orgId);
  return { orgId, config };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orgId, config } = await resolve(supabase);
  if (!config?.pageId) return NextResponse.json({ connected: false, pageId: null });

  try {
    const { subscribed } = await getPageLeadgenSubscription(metaClient(config), config.pageId);
    return NextResponse.json({ connected: true, pageId: config.pageId, subscribed });
  } catch (e) {
    if (e instanceof MetaAuthError) {
      await markMetaExpired(orgId);
      return NextResponse.json({ error: "reconnect_required" }, { status: 412 });
    }
    return NextResponse.json({ connected: true, pageId: config.pageId, error: (e as Error).message }, { status: 502 });
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orgId, config } = await resolve(supabase);
  if (!config) {
    return NextResponse.json({ error: "meta_not_connected", message: "Connect Meta first." }, { status: 412 });
  }
  if (!config.pageId) {
    return NextResponse.json({ error: "no_page", message: "No Page is selected for this connection." }, { status: 412 });
  }

  try {
    await subscribePageLeadgen(metaClient(config), config.pageId);
    // Record the result on the org's own row (the env/system-user org has no row).
    const row = await getMetaIntegrationRow(orgId);
    if (row) {
      await saveMetaIntegration(orgId, {
        details: { ...(row.details || {}), webhook_subscribed: true, webhook_subscribed_at: new Date().toISOString() },
      });
    }
    return NextResponse.json({ ok: true, pageId: config.pageId });
  } catch (e) {
    if (e instanceof MetaAuthError) {
      await markMetaExpired(orgId);
      return NextResponse.json({ error: "reconnect_required" }, { status: 412 });
    }
    return NextResponse.json({ error: "subscribe_failed", message: (e as Error).message }, { status: 502 });
  }
}
