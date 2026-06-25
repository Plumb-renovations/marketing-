import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getMetaConfig, markMetaExpired } from "@/lib/integrations/meta/config";
import { metaClient, MetaAuthError } from "@/lib/integrations/meta/client";
import { getBusinessProfile } from "@/lib/business/profileServer";
import type { LaunchConfig, PublishResult } from "@/lib/integrations/types";

// Launch a saved Ad Creator draft to Meta — live, or as a PAUSED draft to review
// in Ads Manager first. Auth-gated (org members). All Graph API calls happen
// server-side with the System User token from env.
//
// This is the focused Meta-only build: Google publishing is intentionally not
// included here. The published_ads audit insert is best-effort, so this route
// works whether or not the 0002 migration has been applied in prod.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let cfg: LaunchConfig;
  try {
    cfg = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (cfg.platform !== "meta") {
    return NextResponse.json(
      { error: "unsupported_platform", message: "This deployment supports Meta ad creation only." },
      { status: 400 },
    );
  }
  if (!cfg.adId || !cfg.campaignName || !(cfg.dailyBudgetAud > 0)) {
    return NextResponse.json({ error: "missing adId, campaignName or dailyBudgetAud" }, { status: 400 });
  }

  // Resolve this org's Meta connection (its own connected account, or the env
  // System-User values for the default Plumb org). No usable connection → 412.
  const orgId = await getOrgId(supabase);
  const metaConfig = await getMetaConfig(orgId);
  if (!metaConfig) {
    return NextResponse.json(
      { error: "meta_not_connected", message: "Connect a Meta account in Settings → Integrations first." },
      { status: 412 },
    );
  }

  // Fill targeting defaults from the org's Business Profile when the request
  // didn't specify them (location centre/radius + audience interests), so the
  // defaults are per-org instead of hardcoded renovation values.
  const profile = await getBusinessProfile(orgId);
  if (cfg.latitude == null && profile.serviceAreaLat != null) cfg.latitude = profile.serviceAreaLat;
  if (cfg.longitude == null && profile.serviceAreaLng != null) cfg.longitude = profile.serviceAreaLng;
  if (cfg.radiusKm == null && profile.serviceRadiusKm) cfg.radiusKm = profile.serviceRadiusKm;
  if ((!cfg.interests || !cfg.interests.length) && profile.audienceInterests.length) cfg.interests = profile.audienceInterests;

  // Load the local draft (RLS scopes to the member's org).
  const { data: ad, error: adErr } = await supabase.from("ads").select("*").eq("id", cfg.adId).maybeSingle();
  if (adErr || !ad) return NextResponse.json({ error: "ad draft not found" }, { status: 404 });
  if (ad.kind !== "meta") {
    return NextResponse.json({ error: "ad draft is not a Meta ad" }, { status: 400 });
  }

  // ---- Video ad: campaign+adset+advideo now, creative+ad once processed ----
  // Meta transcodes the uploaded video asynchronously, so we kick it off, store
  // a media job, and let the client poll /api/media-jobs/{id} to completion.
  // Keeps the same paused-draft default + confirm-before-live as image ads.
  if (ad.media_type === "video") {
    if (!ad.video_url) {
      return NextResponse.json({ error: "missing_video", message: "This video ad has no uploaded video." }, { status: 400 });
    }
    try {
      const v = ad.content?.variations?.[0] || {};
      const { startMetaVideoAd } = await import("@/lib/integrations/meta/publish");
      const { createJob } = await import("@/lib/media/jobs");
      const client = metaClient(metaConfig);
      const ctx = await startMetaVideoAd(
        client,
        cfg,
        {
          primaryText: v.primaryText || ad.content?.primaryText || "",
          headline: v.headline || "",
          description: v.description || "",
          cta: v.cta || "Learn More",
          imageDataUrl: ad.photo || null, // poster / first-frame = the required thumbnail
        },
        ad.video_url,
      );
      const job = await createJob(supabase, orgId, {
        kind: "ad",
        video_id: ctx.videoId,
        config: { ...ctx, localAdId: cfg.adId },
      });
      return NextResponse.json({ ok: true, status: "processing", jobId: job.id, mode: cfg.mode });
    } catch (e: any) {
      if (e instanceof MetaAuthError) {
        await markMetaExpired(orgId);
        return NextResponse.json(
          { error: "meta_reconnect_required", message: "Your Meta connection has expired. Reconnect it in Settings → Integrations." },
          { status: 412 },
        );
      }
      console.error(`[ads/publish] video ad kick failed org=${orgId} ad=${cfg.adId}: ${e?.message || e}`);
      return NextResponse.json({ ok: false, status: "failed", error: e?.message || "publish failed" }, { status: 502 });
    }
  }

  let result: PublishResult;
  try {
    const v = ad.content?.variations?.[0] || {};
    const { publishMetaAd } = await import("@/lib/integrations/meta/publish");
    const client = metaClient(metaConfig);
    result = await publishMetaAd(client, cfg, {
      primaryText: v.primaryText || ad.content?.primaryText || "",
      headline: v.headline || "",
      description: v.description || "",
      cta: v.cta || "Learn More",
      imageDataUrl: ad.photo || null,
    });
  } catch (e: any) {
    // A rejected token (expired/revoked) → flag the org for reconnect.
    if (e instanceof MetaAuthError) {
      await markMetaExpired(orgId);
      return NextResponse.json(
        { error: "meta_reconnect_required", message: "Your Meta connection has expired. Reconnect it in Settings → Integrations." },
        { status: 412 },
      );
    }
    result = { ok: false, platform: "meta", status: "failed", error: e?.message || "publish failed" };
  }

  // Best-effort audit record (no-op if the published_ads table isn't there yet).
  try {
    await supabase.from("published_ads").insert({
      org_id: orgId,
      ad_id: cfg.adId,
      platform: "meta",
      external_campaign_id: result.externalCampaignId ?? null,
      external_adset_id: result.externalAdsetId ?? null,
      external_ad_id: result.externalAdId ?? null,
      external_creative_id: result.externalCreativeId ?? null,
      status: result.status,
      budget_daily_aud: cfg.dailyBudgetAud,
      start_time: cfg.startTime ?? null,
      end_time: cfg.endTime ?? null,
      request: { campaignName: cfg.campaignName, mode: cfg.mode, ageMin: cfg.ageMin, ageMax: cfg.ageMax },
      response: result.error ? { error: result.error } : { ids: result },
      launched_by: user.id,
    });
  } catch {
    // published_ads not migrated in this environment — fine.
  }

  if (result.ok && result.status === "active") {
    await supabase.from("ads").update({ status: "live" }).eq("id", cfg.adId);
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
