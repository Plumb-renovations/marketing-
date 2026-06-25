import type { MetaClient } from "./client";
import type { LaunchConfig, PublishResult } from "../types";
import { uploadAdVideo, uploadAdImageDataUrl, getAdVideoThumbnail } from "./video";

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

// Create the campaign + ad set (everything up to the creative). Shared by the
// image and video ad flows so targeting/budget/schedule behave identically.
async function createCampaignAndAdset(
  client: MetaClient,
  cfg: LaunchConfig,
  status: "ACTIVE" | "PAUSED",
): Promise<{ externalCampaignId: string; externalAdsetId: string; pageId?: string }> {
  const pageId = cfg.pageId || client.pageId;

  // Campaign. special_ad_categories is REQUIRED (empty array = none).
  const campaign: any = await client.post(`${client.adAccountPath()}/campaigns`, {
    name: cfg.campaignName,
    objective: cfg.objective || "OUTCOME_LEADS",
    status,
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  });
  const externalCampaignId = String(campaign?.id);

  // LOCATION: a radius around lat/lng — defaults to the Gold Coast / Tweed
  // service area, capped at Meta's 80km custom-location max.
  const lat = cfg.latitude ?? DEFAULT_GEO.latitude;
  const lng = cfg.longitude ?? DEFAULT_GEO.longitude;
  const radiusKm = Math.min(80, Math.max(1, cfg.radiusKm ?? DEFAULT_GEO.radiusKm));
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

  // SCHEDULE (optional): only send start/end when they're a real future window.
  const nowSec = Math.floor(Date.now() / 1000);
  const toFutureSec = (iso?: string) => {
    if (!iso) return undefined;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return undefined;
    const sec = Math.floor(t / 1000);
    return sec > nowSec + 60 ? sec : undefined;
  };
  const startSec = toFutureSec(cfg.startTime);
  let endSec = toFutureSec(cfg.endTime);
  if (endSec && startSec && endSec <= startSec) endSec = undefined;

  const adsetParams: any = {
    name: cfg.adSetName?.trim() || `${cfg.campaignName} — Ad Set`,
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
  return { externalCampaignId, externalAdsetId: String(adset?.id), pageId };
}

// Builds the full Meta IMAGE ad (image → campaign → ad set → creative → ad).
export async function publishMetaAd(
  client: MetaClient,
  cfg: LaunchConfig,
  creative: CreativeInput,
): Promise<PublishResult> {
  try {
    const status = cfg.mode === "launch" ? "ACTIVE" : "PAUSED";
    const link = cfg.link || cfg.finalUrl || "https://waterplumb.com.au";

    // a. Upload the image (if supplied) and grab its hash.
    let imageHash: string | undefined;
    if (creative.imageDataUrl) imageHash = await uploadAdImageDataUrl(client, creative.imageDataUrl);

    // b+c. Campaign + ad set.
    const { externalCampaignId, externalAdsetId, pageId } = await createCampaignAndAdset(client, cfg, status);

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
          call_to_action: { type: mapCta(creative.cta), value: { link } },
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

    return {
      ok: true,
      platform: "meta",
      status: cfg.mode === "launch" ? "active" : "paused",
      externalCampaignId,
      externalAdsetId,
      externalAdId: String(ad?.id),
      externalCreativeId,
      raw: { image: imageHash, adsetId: externalAdsetId, adcreative, ad },
    };
  } catch (e) {
    return { ok: false, platform: "meta", status: "failed", error: String(e) };
  }
}

// Context a video-ad job stores so it can finish (create creative + ad) once the
// uploaded video has finished processing at Meta.
export interface VideoAdContext {
  campaignName: string;
  externalCampaignId: string;
  externalAdsetId: string;
  pageId?: string;
  videoId: string;
  imageHash?: string; // poster/first-frame uploaded as the required thumbnail
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  link: string;
  mode: "launch" | "paused";
}

// Kick off a VIDEO ad: campaign + ad set + advideo upload. The creative + ad are
// created later (finishMetaVideoAd) once the video reports "ready", because
// processing is asynchronous. Returns the context the job needs to finish.
export async function startMetaVideoAd(
  client: MetaClient,
  cfg: LaunchConfig,
  creative: CreativeInput,
  videoUrl: string,
): Promise<VideoAdContext> {
  const status = cfg.mode === "launch" ? "ACTIVE" : "PAUSED";
  const link = cfg.link || cfg.finalUrl || "https://waterplumb.com.au";

  const videoId = await uploadAdVideo(client, videoUrl, `${cfg.campaignName} — Video`);
  const imageHash = creative.imageDataUrl ? await uploadAdImageDataUrl(client, creative.imageDataUrl) : undefined;
  const { externalCampaignId, externalAdsetId, pageId } = await createCampaignAndAdset(client, cfg, status);

  return {
    campaignName: cfg.campaignName,
    externalCampaignId,
    externalAdsetId,
    pageId,
    videoId,
    imageHash,
    primaryText: creative.primaryText,
    headline: creative.headline,
    description: creative.description,
    cta: creative.cta,
    link,
    mode: cfg.mode,
  };
}

// Finish a VIDEO ad once the video is ready: video creative + ad. Returns the
// created ids (used to flip the draft live + write the audit row).
export async function finishMetaVideoAd(
  client: MetaClient,
  ctx: VideoAdContext,
): Promise<{ externalAdId: string; externalCreativeId: string }> {
  const status = ctx.mode === "launch" ? "ACTIVE" : "PAUSED";

  // A thumbnail is required for a video creative. Prefer the poster we uploaded;
  // otherwise fall back to the frame Meta generated for the processed video.
  let imageHash = ctx.imageHash;
  let thumbUrl: string | undefined;
  if (!imageHash) thumbUrl = await getAdVideoThumbnail(client, ctx.videoId);

  const videoData: any = {
    video_id: ctx.videoId,
    message: ctx.primaryText,
    title: ctx.headline,
    link_description: ctx.description,
    call_to_action: { type: mapCta(ctx.cta), value: { link: ctx.link } },
  };
  if (imageHash) videoData.image_hash = imageHash;
  else if (thumbUrl) videoData.image_url = thumbUrl;

  const adcreative: any = await client.post(`${client.adAccountPath()}/adcreatives`, {
    name: `${ctx.campaignName} — Creative`,
    object_story_spec: { page_id: ctx.pageId, video_data: videoData },
  });
  const externalCreativeId = String(adcreative?.id);

  const ad: any = await client.post(`${client.adAccountPath()}/ads`, {
    name: `${ctx.campaignName} — Ad`,
    adset_id: ctx.externalAdsetId,
    creative: { creative_id: externalCreativeId },
    status,
  });
  return { externalAdId: String(ad?.id), externalCreativeId };
}
