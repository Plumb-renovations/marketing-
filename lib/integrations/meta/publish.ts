import { graphPost, adAccountPath } from "./client";
import { meta } from "../env";
import type { LaunchConfig, PublishResult } from "../types";

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

export async function publishMetaAd(cfg: LaunchConfig, creative: CreativeInput): Promise<PublishResult> {
  try {
    const status = cfg.mode === "launch" ? "ACTIVE" : "PAUSED";
    const link = cfg.link || cfg.finalUrl || "https://waterplumb.com.au";
    const pageId = cfg.pageId || meta.pageId;

    // a. Upload the image (if supplied) and grab its hash. The adimages
    //    response keys by an arbitrary name, so take the first entry.
    let imageHash: string | undefined;
    if (creative.imageDataUrl) {
      const base64 = creative.imageDataUrl.replace(/^data:[^;]+;base64,/, "");
      const imgRes: any = await graphPost(`${adAccountPath()}/adimages`, { bytes: base64 });
      const images = imgRes?.images || {};
      const firstKey = Object.keys(images)[0];
      imageHash = firstKey ? images[firstKey]?.hash : undefined;
    }

    // b. Campaign.
    const campaign: any = await graphPost(`${adAccountPath()}/campaigns`, {
      name: cfg.campaignName,
      objective: "OUTCOME_LEADS",
      status,
      special_ad_categories: "[]",
    });
    const externalCampaignId = String(campaign?.id);

    // c. Ad set.
    // TODO: precise Gold Coast geo-radius targeting needs lat/lng custom_locations
    // (geo_locations.custom_locations: [{ latitude, longitude, radius, distance_unit }]).
    // countries:["AU"] is a safe, valid default for dev testing.
    const adset: any = await graphPost(`${adAccountPath()}/adsets`, {
      name: `${cfg.campaignName} — Ad Set`,
      campaign_id: externalCampaignId,
      daily_budget: String(Math.round(cfg.dailyBudgetAud * 100)),
      billing_event: "IMPRESSIONS",
      optimization_goal: "LEAD_GENERATION",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      start_time: cfg.startTime,
      end_time: cfg.endTime,
      status,
      targeting: {
        geo_locations: { countries: ["AU"] },
        age_min: cfg.ageMin ?? 30,
        age_max: cfg.ageMax ?? 65,
        publisher_platforms: ["facebook", "instagram"],
      },
      promoted_object: { page_id: pageId },
    });
    const externalAdsetId = String(adset?.id);

    // d. Creative.
    const adcreative: any = await graphPost(`${adAccountPath()}/adcreatives`, {
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
    const ad: any = await graphPost(`${adAccountPath()}/ads`, {
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
