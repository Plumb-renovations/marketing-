// Shared shapes for the ad/lead integrations.

export type Platform = "meta" | "google";

// What the Ad Creator's launch panel sends to /api/ads/publish.
export interface LaunchConfig {
  adId: string; // local ads.id draft
  platform: Platform;
  mode: "launch" | "paused"; // launch live, or create paused for review
  campaignName: string;
  dailyBudgetAud: number;
  startTime?: string; // ISO
  endTime?: string; // ISO
  // Targeting (platform-mapped server-side)
  locations?: string[]; // legacy label(s)
  // Meta location: hard geo constraint — radius around a lat/lng (custom_locations).
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  ageMin?: number;
  ageMax?: number;
  // Meta audience: detailed-targeting interest names, resolved to ids and passed
  // as Advantage+ audience suggestions (soft, not hard constraints).
  interests?: string[];
  advantageAudience?: boolean; // default true
  // Meta creative
  pageId?: string;
  link?: string; // destination URL / lead form
  // Google
  finalUrl?: string;
  keywords?: string[];
}

export interface PublishResult {
  ok: boolean;
  platform: Platform;
  status: "paused" | "active" | "failed";
  externalCampaignId?: string;
  externalAdsetId?: string;
  externalAdId?: string;
  externalCreativeId?: string;
  error?: string;
  raw?: unknown;
}

// Normalised daily spend row written to ad_spend_daily.
export interface SpendRow {
  channel: "google_ads" | "meta_ads";
  spendDate: string; // YYYY-MM-DD
  amountAud: number;
  amountOrig?: number;
  currencyOrig?: string;
  fxRate?: number;
  campaignExternalId?: string;
  raw?: unknown;
}

// A lead pulled from the Meta leadgen webhook, mapped to the Leads board shape.
export interface InboundLead {
  externalId: string; // leadgen_id
  name: string;
  suburb: string;
  project: string;
  source: "meta_ads";
  raw: unknown;
}
