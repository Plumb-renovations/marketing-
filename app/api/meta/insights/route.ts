import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId } from "@/lib/data/org";
import { getMetaConfig } from "@/lib/integrations/meta/config";
import { MetaAuthError } from "@/lib/integrations/meta/client";
import { fetchAdTree } from "@/lib/integrations/meta/insights";

// Live Meta ad tree (campaign → ad set → ad) for the manager view. Reads via the
// org's token; attaches cost-per-won-job per campaign from the leads table;
// upserts a snapshot to meta_entities/meta_insights (best-effort). Auth-gated.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const config = await getMetaConfig(orgId);
  if (!config) return NextResponse.json({ configured: false });

  let tree;
  try {
    tree = await fetchAdTree(config);
  } catch (e) {
    if (e instanceof MetaAuthError) {
      return NextResponse.json({ configured: true, error: "reconnect", message: e.message });
    }
    console.error(`[meta] insights fetch failed org=${orgId}: ${(e as Error).message}`);
    return NextResponse.json({ configured: true, error: "fetch_failed", message: (e as Error).message }, { status: 502 });
  }

  const admin = createAdminClient();

  // Won-job attribution per campaign (Meta leads marked won, not archived).
  const wonByCampaign = new Map<string, number>();
  let accountWon = 0;
  try {
    const { data: wonLeads } = await admin
      .from("leads")
      .select("ad_campaign_id")
      .eq("org_id", orgId)
      .eq("ad_platform", "meta")
      .eq("stage", "won")
      .is("archived_at", null);
    for (const l of wonLeads || []) {
      const cid = String((l as any).ad_campaign_id || "");
      if (!cid) continue;
      wonByCampaign.set(cid, (wonByCampaign.get(cid) || 0) + 1);
      accountWon++;
    }
  } catch {
    // leads.ad_campaign_id may not exist yet — fall back to CPL everywhere.
  }

  // Attach won + costPerWon onto campaigns.
  for (const c of tree.campaigns) {
    const won = wonByCampaign.get(c.id) || 0;
    (c as any).wonJobs = won;
    (c as any).costPerWon = won > 0 ? c.spend / won : null;
  }
  const accountCostPerWon = accountWon > 0 ? tree.account.spend / accountWon : null;

  // Snapshot upsert (best-effort; missing tables never break the view).
  try {
    const ents: any[] = [];
    const ins: any[] = [];
    const push = (level: string, node: any, parentId: string | null, campaignId: string | null) => {
      ents.push({
        org_id: orgId, id: node.id, level, parent_id: parentId, campaign_id: campaignId,
        name: node.name, status: node.status, daily_budget: node.dailyBudgetMinor ?? null,
        lifetime_budget: node.lifetimeBudgetMinor ?? null, updated_time: node.updatedTime || null, synced_at: new Date().toISOString(),
      });
      ins.push({
        org_id: orgId, level, object_id: node.id, spend: node.spend, impressions: node.impressions,
        clicks: node.clicks, ctr: node.ctr, reach: node.reach, frequency: node.frequency, leads: node.leads,
        synced_at: new Date().toISOString(),
      });
    };
    for (const c of tree.campaigns) {
      push("campaign", c, null, c.id);
      for (const s of c.adsets) {
        push("adset", s, c.id, c.id);
        for (const a of s.ads) push("ad", a, s.id, c.id);
      }
    }
    if (ents.length) await admin.from("meta_entities").upsert(ents, { onConflict: "org_id,id" });
    if (ins.length) await admin.from("meta_insights").upsert(ins, { onConflict: "org_id,object_id" });
  } catch (e) {
    console.warn(`[meta] snapshot upsert skipped org=${orgId}: ${(e as Error).message}`);
  }

  console.log(`[meta] insights org=${orgId} campaigns=${tree.campaigns.length} accountSpend=${tree.account.spend} accountWon=${accountWon}`);
  return NextResponse.json({ configured: true, tree, accountCostPerWon, accountWon });
}
