import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runGenerator } from "@/lib/ai/server";
import { rateLimit } from "@/lib/ai/ratelimit";
import { getOrgId } from "@/lib/data/org";
import { getBusinessProfile } from "@/lib/business/profileServer";
import {
  imageSha256,
  getReviewsForShas,
  buildLearnedSummary,
  upsertPredictions,
} from "@/lib/ads/creativeReview";

// AI creative reviewer — judges the actual uploaded ad photo(s) like a creative
// director BEFORE money is spent, and feeds the verdict into the learning loop.
// Auth-gated + rate-limited (vision tokens cost). The verdict is real or it
// fails loudly — we never fabricate a creative judgement.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = rateLimit(user.id);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const images: string[] = (body?.images || []).filter((u: any) => typeof u === "string" && u.startsWith("data:")).slice(0, 6);
  if (!images.length) return NextResponse.json({ error: "no_images" }, { status: 400 });
  // Video: `images` are SAMPLED FRAMES of one clip. We fingerprint by the poster
  // (frame 0) so the row matches the ad's stored poster (ads.photo) for the
  // learning loop, and mark it media_type='video'.
  const isVideo = body?.media === "video";
  const frameTimes: number[] = Array.isArray(body?.frameTimes) ? body.frameTimes.map(Number) : [];
  const durationSec = Number(body?.durationSec) || 0;

  try {
    const orgId = await getOrgId(supabase);
    const profile = await getBusinessProfile(orgId);
    const shas = images.map(imageSha256);

    // Capture prior actuals BEFORE we overwrite the prediction, so the client can
    // show "predicted vs actual" for images that have already run.
    const [existing, learned] = await Promise.all([
      getReviewsForShas(supabase, orgId, shas),
      buildLearnedSummary(supabase, orgId),
    ]);

    const result: any = await runGenerator(
      "creative-review",
      { images, learned, media: isVideo ? "video" : "image", frameTimes, durationSec },
      profile,
    );
    if (!result || !Array.isArray(result.images)) {
      return NextResponse.json({ error: "ai_unavailable", message: "No verdict returned" }, { status: 502 });
    }

    // Persist one prediction per item (best-effort; doesn't block the response).
    const model = process.env.ANTHROPIC_MODEL || "";
    const predictions = result.images.map((img: any) => {
      const idx = Number(img?.index) || 0;
      return {
        sha: shas[idx] ?? shas[0],
        thumb: images[idx] ?? images[0],
        verdict: img?.verdict ?? null,
        score: Number.isFinite(Number(img?.score)) ? Number(img.score) : null,
        style: img?.style ?? null,
        mediaType: (isVideo ? "video" : "image") as "image" | "video",
        review: img,
      };
    });
    await upsertPredictions(supabase, orgId, model, predictions);

    // Map any known actuals back to image index for the client.
    const actuals: Record<number, any> = {};
    shas.forEach((sha, i) => {
      const row = existing[sha];
      if (row && row.results_updated_at) {
        actuals[i] = {
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: row.ctr,
          leads: row.leads,
          costPerLead: row.cost_per_lead,
          adsCount: row.ads_count,
          predictedVerdict: row.verdict,
          predictedScore: row.score,
          resultsUpdatedAt: row.results_updated_at,
        };
      }
    });

    return NextResponse.json({ ...result, learned, actuals });
  } catch (e: any) {
    console.error("[ads/creative-review] failed:", e?.message || e);
    return NextResponse.json(
      { error: "ai_unavailable", message: e?.message || "Creative review failed" },
      { status: 502 },
    );
  }
}
