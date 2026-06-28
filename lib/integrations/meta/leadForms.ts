import { metaClient, type MetaClient } from "./client";
import { getPageClient } from "./page";
import type { MetaConfig } from "./config";

// Meta Instant Form (lead form) helpers. Leads only reach Hazel when an ad uses
// a lead form whose submissions fire the leadgen webhook — so new ads MUST carry
// the same form id. These let the Ad Creator list the page's forms and inherit
// an existing ad set's form so continuity is guaranteed.

export interface LeadForm {
  id: string;
  name: string;
  status?: string;
}

// All Instant Forms on the connected Page (active first). Page edge → page token.
export async function fetchLeadForms(config: MetaConfig): Promise<LeadForm[]> {
  if (!config.pageId) return [];
  const page = await getPageClient(config);
  const res: any = await page.get(`${config.pageId}/leadgen_forms`, { fields: "id,name,status", limit: 200 });
  const forms: LeadForm[] = (res?.data || []).map((f: any) => ({ id: String(f.id), name: f.name || `Form ${f.id}`, status: f.status }));
  // Active forms first, then by name.
  return forms.sort((a, b) => {
    const aa = a.status === "ACTIVE" ? 0 : 1;
    const bb = b.status === "ACTIVE" ? 0 : 1;
    return aa - bb || a.name.localeCompare(b.name);
  });
}

// The lead_gen_form_id an existing ad uses (so we can match an ad set's form).
async function leadFormOfAd(client: MetaClient, adId: string): Promise<string | null> {
  try {
    const res: any = await client.get(`${adId}`, { fields: "creative{object_story_spec}" });
    const cta = res?.creative?.object_story_spec?.link_data?.call_to_action
      || res?.creative?.object_story_spec?.video_data?.call_to_action;
    const id = cta?.value?.lead_gen_form_id;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

// The lead form an existing AD SET's ads use — so a new ad joining it inherits
// the same form (and its leads keep flowing through the existing pipeline).
export async function leadFormOfAdSet(config: MetaConfig, adsetId: string): Promise<string | null> {
  try {
    const client = metaClient(config);
    const res: any = await client.get(`${adsetId}/ads`, { fields: "id", limit: 10 });
    for (const a of res?.data || []) {
      const form = await leadFormOfAd(client, String(a.id));
      if (form) return form;
    }
  } catch {
    /* best-effort */
  }
  return null;
}
