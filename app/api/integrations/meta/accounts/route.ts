import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getMetaIntegrationRow, markMetaExpired } from "@/lib/integrations/meta/config";
import { metaClient, MetaAuthError } from "@/lib/integrations/meta/client";

// Lists the connected user's ad accounts + Pages so they can pick which to use.
// Reads the stored token server-side; the token never reaches the browser.
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
  if (!row?.access_token) {
    return NextResponse.json({ error: "not_connected" }, { status: 412 });
  }

  try {
    const client = metaClient({ token: row.access_token });
    const [accts, pages] = await Promise.all([
      client.get("me/adaccounts", { fields: "account_id,name,currency,account_status", limit: 200 }),
      client.get("me/accounts", { fields: "id,name,instagram_business_account{id,username}", limit: 200 }),
    ]);
    return NextResponse.json({
      adAccounts: (accts?.data || []).map((a: any) => ({
        id: String(a.account_id),
        name: a.name || `act_${a.account_id}`,
        currency: a.currency || null,
        active: Number(a.account_status) === 1,
      })),
      pages: (pages?.data || []).map((p: any) => ({
        id: String(p.id),
        name: p.name || p.id,
        igUserId: p.instagram_business_account?.id || null,
        igUsername: p.instagram_business_account?.username || null,
      })),
    });
  } catch (e) {
    if (e instanceof MetaAuthError) {
      await markMetaExpired(orgId);
      return NextResponse.json({ error: "reconnect_required" }, { status: 412 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
