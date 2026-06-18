import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ORG_ID } from "@/lib/domain/seed";
import { meta } from "@/lib/integrations/env";
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
  if (!meta.configured) {
    return NextResponse.json({ error: "meta_not_configured" }, { status: 412 });
  }

  // Load the local draft (RLS scopes to the member's org).
  const { data: ad, error: adErr } = await supabase.from("ads").select("*").eq("id", cfg.adId).maybeSingle();
  if (adErr || !ad) return NextResponse.json({ error: "ad draft not found" }, { status: 404 });
  if (ad.kind !== "meta") {
    return NextResponse.json({ error: "ad draft is not a Meta ad" }, { status: 400 });
  }

  let result: PublishResult;
  try {
    const v = ad.content?.variations?.[0] || {};
    const { publishMetaAd } = await import("@/lib/integrations/meta/publish");
    result = await publishMetaAd(cfg, {
      primaryText: v.primaryText || ad.content?.primaryText || "",
      headline: v.headline || "",
      description: v.description || "",
      cta: v.cta || "Learn More",
      imageDataUrl: ad.photo || null,
    });
  } catch (e: any) {
    result = { ok: false, platform: "meta", status: "failed", error: e?.message || "publish failed" };
  }

  // Best-effort audit record (no-op if the published_ads table isn't there yet).
  try {
    await supabase.from("published_ads").insert({
      org_id: ORG_ID,
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
