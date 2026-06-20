import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getMetaIntegrationRow, getMetaConfig } from "@/lib/integrations/meta/config";

// Redacted Meta connection status for the Settings → Integrations UI. Never
// returns the access token. Reports:
//   - 'connected' / 'pending' / 'expired' / 'disconnected' for an org's own
//     OAuth connection (source 'org'), or
//   - 'connected' via 'system_user' for the default org's env fallback (Plumb).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const row = await getMetaIntegrationRow(orgId);

  if (row?.access_token) {
    const expired = !!row.token_expires_at && new Date(row.token_expires_at).getTime() < Date.now();
    return NextResponse.json({
      provider: "meta",
      source: "org",
      status: expired ? "expired" : row.status,
      adAccountId: row.ad_account_id,
      pageId: row.page_id,
      adAccountName: row.details?.adAccountName ?? null,
      pageName: row.details?.pageName ?? null,
      userName: row.details?.userName ?? null,
      scopes: row.scopes || [],
      expiresAt: row.token_expires_at,
    });
  }

  // No org connection → the default (Plumb) org still works via the env System User.
  const envCfg = await getMetaConfig(orgId);
  if (envCfg?.source === "env") {
    return NextResponse.json({
      provider: "meta",
      source: "system_user",
      status: "connected",
      adAccountId: envCfg.adAccountId ?? null,
      pageId: envCfg.pageId ?? null,
    });
  }

  return NextResponse.json({ provider: "meta", source: "none", status: "disconnected" });
}
