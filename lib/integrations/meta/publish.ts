import type { MetaClient } from "./client";
import type { LaunchConfig, PublishResult } from "../types";

// Service-area default: a radius centred on the Gold Coast / Tweed Heads border
// (Coolangatta), covering the Gold Coast QLD down through Tweed/Byron/Ballina NSW.
export const DEFAULT_GEO = { latitude: -28.17, longitude: 153.54, radiusKm: 50 };

// Default detailed-targeting preset for renovation buyers — interest *names*,
// resolved to Meta ids at publish time (no brittle hard-coded ids).
export const DEFAULT_INTERESTS = [
  "Home improvement",
  "Home Ownership",
  "Renovation",
  "Interior design",
  "Bathroom",
];

// Resolve interest names → {id,name} via the Targeting Search API. Best-effort:
// unresolved/failed terms are skipped so a bad term never blocks the launch.
async function resolveInterests(client: MetaClient, names: string[]): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  for (const q of names) {
    if (!q?.trim()) continue;
    try {
      const res: any = await client.get("search", { type: "adinterest", q: q.trim(), limit: 1 });
      const hit = res?.data?.[0];
      if (hit?.id) out.push({ id: String(hit.id), name: hit.name || q.trim() });
    } catch {
      // ignore a single failed lookup
    }
  }
  return out;
}

// Builds the full Meta ad hierarchy (image → campaign → ad set → creative → ad)
// from a single LaunchConfig + creative payload. Everything runs server-side
// with the System User token.

interface CreativeInput {
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  imageDataUrl?: string | null;
}

/** Map a friendly CTA label to a Meta call_to_action type. */
export function mapCta(cta: string): string {
  switch (cta) {
    case "Book Now":
      return "BOOK_NOW";
    case "Get Quote":
      return "GET_QUOTE";
    case "Learn More":
      return "LEARN_MORE";
    case "Contact Us":
      return "CONTACT_US";
    case "Send Message":
      return "MESSAGE_PAGE";
    case "Sign Up":
      return "SIGN_UP";
    default:
      return "LEARN_MORE";
  }
}

export async function publishMetaAd(
  client: MetaClient,
  cfg: LaunchConfig,
  creative: CreativeInput,
): Promise<PublishResult> {
  try {
    const status = cfg.mode === "launch" ? "ACTIVE" : "PAUSED";
    const link = cfg.link || cfg.finalUrl || "https://waterplumb.com.au";
    const pageId = cfg.pageId || client.pageId;

    // a. Upload the image (if supplied) and grab its hash. The adimages
    //    response keys by an arbitrary name, so take the first entry.
    let imageHash: string | undefined;
    if (creative.imageDataUrl) {
      const base64 = creative.imageDataUrl.replace(/^data:[^;]+;base64,/, "");
      const imgRes: any = await client.post(`${client.adAccountPath()}/adimages`, { bytes: base64 });
      const images = imgRes?.images || {};
      const firstKey = Object.keys(images)[0];
      imageHash = firstKey ? images[firstKey]?.hash : undefined;
    }

    // b. Campaign. special_ad_categories is REQUIRED by the Marketing API
    //    (empty array = none). Passed as a real array; the Graph client
    //    JSON-encodes it. OUTCOME_LEADS is the current ODAX leads objective.
    //    is_adset_budget_sharing_enabled must be explicitly set when the budget
    //    lives at the ad-set level (no campaign budget) — false = ad-set budgets.
    const campaign: any = await client.post(`${client.adAccountPath()}/campaigns`, {
      name: cfg.campaignName,
      objective: "OUTCOME_LEADS",
      status,
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    });
    const externalCampaignId = String(campaign?.id);

    // c. Ad set.
    // LOCATION (hard constraint): a radius around lat/lng — defaults to the
    // Gold Coast / Tweed service area, capped at Meta's 80km custom-location max.
    const lat = cfg.latitude ?? DEFAULT_GEO.latitude;
    const lng = cfg.longitude ?? DEFAULT_GEO.longitude;
    const radiusKm = Math.min(80, Math.max(1, cfg.radiusKm ?? DEFAULT_GEO.radiusKm));
    // AUDIENCE (soft suggestions): resolve interest names → ids, pass via
    // flexible_spec with Advantage+ audience so Meta can expand beyond them.
    const interests = await resolveInterests(client, cfg.interests?.length ? cfg.interests : DEFAULT_INTERESTS);
    const advantage = cfg.advantageAudience !== false;

    const targeting: any = {
      geo_locations: {
        custom_locations: [{ latitude: lat, longitude: lng, radius: radiusKm, distance_unit: "kilometer" }],
      },
      age_min: cfg.ageMin ?? 30,
      age_max: cfg.ageMax ?? 65,
      publisher_platforms: ["facebook", "instagram"],
    };
    if (interests.length) targeting.flexible_spec = [{ interests }];
    if (advantage) targeting.targeting_automation = { advantage_audience: 1 };

    // SCHEDULE (optional): only send start/end when they're a real future
    // window — as Unix seconds. Blank/past/equal → omit entirely so the ad set
    // runs continuously. (Passing undefined would serialize to the literal
    // "undefined", which Meta rejects.)
    const nowSec = Math.floor(Date.now() / 1000);
    const toFutureSec = (iso?: string) => {
      if (!iso) return undefined;
      const t = Date.parse(iso);
      if (Number.isNaN(t)) return undefined;
      const sec = Math.floor(t / 1000);
      return sec > nowSec + 60 ? sec : undefined; // must be in the future
    };
    const startSec = toFutureSec(cfg.startTime);
    let endSec = toFutureSec(cfg.endTime);
    // End must be after start; otherwise drop it (treat as continuous).
    if (endSec && startSec && endSec <= startSec) endSec = undefined;

    const adsetParams: any = {
      name: `${cfg.campaignName} — Ad Set`,
      campaign_id: externalCampaignId,
      daily_budget: String(Math.round(cfg.dailyBudgetAud * 100)),
      billing_event: "IMPRESSIONS",
      optimization_goal: "LEAD_GENERATION",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      status,
      targeting,
      promoted_object: { page_id: pageId },
    };
    if (startSec) adsetParams.start_time = startSec;
    if (endSec) adsetParams.end_time = endSec;

    const adset: any = await client.post(`${client.adAccountPath()}/adsets`, adsetParams);
    const externalAdsetId = String(adset?.id);

    // d. Creative.
    const adcreative: any = await client.post(`${client.adAccountPath()}/adcreatives`, {
      name: `${cfg.campaignName} — Creative`,
      object_story_spec: {
        page_id: pageId,
        link_data: {
          message: creative.primaryText,
          link,
          name: creative.headline,
          description: creative.description,
          ...(imageHash ? { image_hash: imageHash } : {}),
          call_to_action: {
            type: mapCta(creative.cta),
            value: { link },
          },
        },
      },
    });
    const externalCreativeId = String(adcreative?.id);

    // e. Ad.
    const ad: any = await client.post(`${client.adAccountPath()}/ads`, {
      name: `${cfg.campaignName} — Ad`,
      adset_id: externalAdsetId,
      creative: { creative_id: externalCreativeId },
      status,
    });
    const externalAdId = String(ad?.id);

    return {
      ok: true,
      platform: "meta",
      status: cfg.mode === "launch" ? "active" : "paused",
      externalCampaignId,
      externalAdsetId,
      externalAdId,
      externalCreativeId,
      raw: { image: imageHash, campaign, adset, adcreative, ad },
    };
  } catch (e) {
    return { ok: false, platform: "meta", status: "failed", error: String(e) };
  }
}
