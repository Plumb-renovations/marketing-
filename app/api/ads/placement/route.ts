import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getMetaConfig } from "@/lib/integrations/meta/config";
import { fetchAdTree } from "@/lib/integrations/meta/insights";
import { fetchLeadForms, leadFormOfAdSet } from "@/lib/integrations/meta/leadForms";

// Placement picker data for the Ad Creator: the user's existing campaigns + ad
// sets (so they can drop the ad into one instead of always making a new ad set)
// and their Instant Forms (so the new ad uses the SAME lead form — leads keep
// flowing into Hazel). Reuses the ad-tree fetch + page lead-form edge. Auth-gated.
export const runtime = "nodejs";
export const maxDuration = 60;

const active = (s?: string | null) => !s || /ACTIVE/i.test(s);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const config = await getMetaConfig(orgId);
  if (!config) return NextResponse.json({ connected: false, campaigns: [], leadForms: [], defaultLeadFormId: null });

  const [tree, leadForms] = await Promise.all([
    fetchAdTree(config).catch(() => null),
    fetchLeadForms(config).catch(() => []),
  ]);

  const campaigns = (tree?.campaigns || []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    adsets: c.adsets.map((s) => ({ id: s.id, name: s.name, status: s.status, campaignId: c.id })),
  }));

  // Default to the form the current ads actually use (read from the first active
  // ad set), falling back to the first active form on the Page.
  let defaultLeadFormId: string | null = leadForms.find((f) => f.status === "ACTIVE")?.id || leadForms[0]?.id || null;
  const firstActiveAdset = campaigns.flatMap((c) => c.adsets).find((s) => active(s.status));
  if (firstActiveAdset) {
    try {
      const used = await leadFormOfAdSet(config, firstActiveAdset.id);
      if (used) defaultLeadFormId = used;
    } catch {
      /* keep fallback */
    }
  }

  return NextResponse.json({ connected: true, campaigns, leadForms, defaultLeadFormId });
}
