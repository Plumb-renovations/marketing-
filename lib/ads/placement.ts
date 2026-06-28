// Client helper: the Ad Creator's placement options — existing campaigns / ad
// sets to drop a new ad into, and the lead forms it can use.

export interface PlacementAdset {
  id: string;
  name: string;
  status: string | null;
  campaignId: string;
}
export interface PlacementCampaign {
  id: string;
  name: string;
  status: string | null;
  adsets: PlacementAdset[];
}
export interface LeadFormOption {
  id: string;
  name: string;
  status?: string;
}
export interface PlacementOptions {
  connected: boolean;
  campaigns: PlacementCampaign[];
  leadForms: LeadFormOption[];
  defaultLeadFormId: string | null;
}

export async function fetchPlacementOptions(): Promise<PlacementOptions> {
  try {
    const res = await fetch("/api/ads/placement", { cache: "no-store" });
    if (!res.ok) return { connected: false, campaigns: [], leadForms: [], defaultLeadFormId: null };
    return await res.json();
  } catch {
    return { connected: false, campaigns: [], leadForms: [], defaultLeadFormId: null };
  }
}
