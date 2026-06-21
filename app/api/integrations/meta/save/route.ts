import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getMetaIntegrationRow, saveMetaIntegration } from "@/lib/integrations/meta/config";
import { metaClient } from "@/lib/integrations/meta/client";
import { subscribePageLeadgen } from "@/lib/integrations/meta/subscribe";

// Saves the user's chosen ad account + Page, completing the connection. From
// here, every Meta call for this org uses this org's token/account/page.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const adAccountId = String(body?.adAccountId || "").replace(/^act_/, "").trim();
  const pageId = String(body?.pageId || "").trim();
  if (!adAccountId || !pageId) {
    return NextResponse.json({ error: "ad account and Page are required" }, { status: 400 });
  }

  const orgId = await getOrgId(supabase);
  const row = await getMetaIntegrationRow(orgId);
  if (!row?.access_token) {
    return NextResponse.json({ error: "not_connected" }, { status: 412 });
  }

  // Subscribe the Page to the leadgen webhook so leads actually flow in. Meta
  // doesn't deliver lead notifications until the app is in the Page's
  // subscribed_apps — best-effort, surfaced so the UI can prompt a retry.
  let webhookSubscribed = false;
  let webhookError: string | null = null;
  try {
    await subscribePageLeadgen(metaClient({ token: row.access_token, pageId }), pageId);
    webhookSubscribed = true;
  } catch (e) {
    webhookError = (e as Error).message;
    console.error("[meta-save] leadgen subscribe failed:", webhookError);
  }

  await saveMetaIntegration(orgId, {
    status: "connected",
    ad_account_id: adAccountId,
    page_id: pageId,
    ig_user_id: body?.igUserId ? String(body.igUserId) : null,
    details: {
      ...(row.details || {}),
      adAccountName: body?.adAccountName ?? null,
      pageName: body?.pageName ?? null,
      webhook_subscribed: webhookSubscribed,
      ...(webhookSubscribed ? { webhook_subscribed_at: new Date().toISOString() } : {}),
    },
  });

  return NextResponse.json({ ok: true, webhookSubscribed, webhookError });
}
