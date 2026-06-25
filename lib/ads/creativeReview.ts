import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMetaConfig } from "@/lib/integrations/meta/config";
import { fetchAdTree } from "@/lib/integrations/meta/insights";

// The creative-reviewer's learning loop. Predictions are stored per image
// (fingerprinted by sha256 of the downscaled bytes); actuals are joined back
// from real Meta performance via the existing ads / published_ads / insights
// data and aggregated by image. The learned summary turns the rows that have
// actuals into this-account-specific guidance for future verdicts.

export interface PredictionInput {
  sha: string;
  thumb?: string | null;
  verdict?: string | null;
  score?: number | null;
  style?: string | null;
  mediaType?: "image" | "video";
  review: any;
}

// Stable content fingerprint: hash the base64 payload so identical image bytes
// (same upload, re-reviewed) map to the same row regardless of data-URL prefix.
export function imageSha256(dataUrl: string): string {
  const base64 = (dataUrl || "").replace(/^data:[^;]+;base64,/, "");
  return createHash("sha256").update(base64).digest("hex");
}

const round = (n: number, dp = 2) => {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

// Persist one prediction per image (upsert by org + sha). Never throws to the
// caller — a failed write must not block the verdict the user is waiting on.
export async function upsertPredictions(
  supabase: SupabaseClient,
  orgId: string,
  model: string,
  items: PredictionInput[],
): Promise<void> {
  if (!items.length) return;
  const rows = items.map((it) => ({
    org_id: orgId,
    image_sha256: it.sha,
    verdict: it.verdict ?? null,
    score: it.score ?? null,
    style: it.style ?? null,
    media_type: it.mediaType ?? "image",
    review: it.review ?? {},
    model,
    thumb: it.thumb ?? null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("ad_image_reviews")
    .upsert(rows, { onConflict: "org_id,image_sha256" });
  if (error) console.error("[creative-review] upsertPredictions failed:", error.message);
}

// Fetch existing rows (prediction + any actuals) for a set of fingerprints, so
// the reviewer can show "predicted vs actual" for images that have already run.
export async function getReviewsForShas(
  supabase: SupabaseClient,
  orgId: string,
  shas: string[],
): Promise<Record<string, any>> {
  if (!shas.length) return {};
  const { data, error } = await supabase
    .from("ad_image_reviews")
    .select("*")
    .eq("org_id", orgId)
    .in("image_sha256", shas);
  if (error) {
    console.error("[creative-review] getReviewsForShas failed:", error.message);
    return {};
  }
  const out: Record<string, any> = {};
  for (const r of data || []) out[r.image_sha256] = r;
  return out;
}

// Turn the rows that have real results into a short, plain-English summary of
// which STYLES actually perform for this account. Returns "" until there's
// enough signal, so early verdicts stay on generic best-practice.
export async function buildLearnedSummary(supabase: SupabaseClient, orgId: string): Promise<string> {
  const { data, error } = await supabase
    .from("ad_image_reviews")
    .select("style, impressions, clicks, leads, spend, ctr, cost_per_lead, results_updated_at")
    .eq("org_id", orgId)
    .not("results_updated_at", "is", null);
  if (error || !data || !data.length) return "";

  // Aggregate by style, ignoring tiny-volume rows that aren't meaningful yet.
  const byStyle = new Map<string, { impr: number; clicks: number; leads: number; spend: number; n: number }>();
  for (const r of data) {
    const impr = Number(r.impressions) || 0;
    if (!r.style || impr < 200) continue;
    const cur = byStyle.get(r.style) || { impr: 0, clicks: 0, leads: 0, spend: 0, n: 0 };
    cur.impr += impr;
    cur.clicks += Number(r.clicks) || 0;
    cur.leads += Number(r.leads) || 0;
    cur.spend += Number(r.spend) || 0;
    cur.n += 1;
    byStyle.set(r.style, cur);
  }
  if (!byStyle.size) return "";

  const styles = Array.from(byStyle.entries()).map(([style, v]) => ({
    style,
    n: v.n,
    ctr: v.impr > 0 ? round((v.clicks / v.impr) * 100, 2) : 0,
    cpl: v.leads > 0 ? round(v.spend / v.leads, 0) : null,
  }));
  styles.sort((a, b) => b.ctr - a.ctr);

  const fmt = (s: (typeof styles)[number]) =>
    `${s.style} (${s.ctr}% CTR${s.cpl != null ? `, ~$${s.cpl}/lead` : ""}, ${s.n} image${s.n !== 1 ? "s" : ""})`;

  const best = styles[0];
  const worst = styles[styles.length - 1];
  if (styles.length === 1) {
    return `So far your ${fmt(best)} have run. Lean into what's working and keep testing other styles.`;
  }
  return `Real performance on this account: best so far is ${fmt(best)}; weakest is ${fmt(worst)}. Favour ${best.style} and be tougher on ${worst.style}.`;
}

// Pull this org's real Meta results and write per-image actuals. Reuses the
// existing join: ad_image_reviews.sha ↔ ads.photo ↔ published_ads.external_ad_id
// ↔ live Meta ad-level insights. Returns a small status for the UI.
export async function syncPerformance(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ updated: number; ok: boolean; reason?: string }> {
  // 1. Live Meta connection (org's own or env System User).
  const config = await getMetaConfig(orgId);
  if (!config) return { updated: 0, ok: false, reason: "meta_not_connected" };

  // 2. Published ads → their external Meta ad ids.
  let published: any[] = [];
  try {
    const { data } = await supabase
      .from("published_ads")
      .select("ad_id, external_ad_id")
      .eq("org_id", orgId)
      .not("external_ad_id", "is", null);
    published = data || [];
  } catch {
    return { updated: 0, ok: false, reason: "no_published_ads" };
  }
  if (!published.length) return { updated: 0, ok: true, reason: "no_published_ads" };

  // 3. Local ad drafts → their photos (to fingerprint).
  const adIds = Array.from(new Set(published.map((p) => p.ad_id).filter(Boolean)));
  const { data: ads } = await supabase.from("ads").select("id, photo").in("id", adIds);
  const photoByAdId = new Map<string, string>();
  for (const a of ads || []) if (a.photo) photoByAdId.set(a.id, a.photo);

  // externalAdId → image sha
  const shaByExternalAd = new Map<string, string>();
  for (const p of published) {
    const photo = photoByAdId.get(p.ad_id);
    if (photo) shaByExternalAd.set(String(p.external_ad_id), imageSha256(photo));
  }
  if (!shaByExternalAd.size) return { updated: 0, ok: true, reason: "no_image_ads" };

  // 4. Live per-ad metrics from Meta.
  let tree;
  try {
    tree = await fetchAdTree(config);
  } catch (e) {
    return { updated: 0, ok: false, reason: "meta_fetch_failed: " + (e as Error).message };
  }
  const adMetrics = new Map<string, { impressions: number; clicks: number; spend: number; leads: number }>();
  for (const c of tree.campaigns)
    for (const s of c.adsets)
      for (const ad of s.ads)
        adMetrics.set(ad.id, { impressions: ad.impressions, clicks: ad.clicks, spend: ad.spend, leads: ad.leads });

  // 5. Aggregate metrics by image fingerprint.
  const agg = new Map<string, { impressions: number; clicks: number; spend: number; leads: number; ads: number }>();
  for (const [externalAdId, sha] of shaByExternalAd) {
    const m = adMetrics.get(externalAdId);
    if (!m) continue;
    const cur = agg.get(sha) || { impressions: 0, clicks: 0, spend: 0, leads: 0, ads: 0 };
    cur.impressions += m.impressions;
    cur.clicks += m.clicks;
    cur.spend += m.spend;
    cur.leads += m.leads;
    cur.ads += 1;
    agg.set(sha, cur);
  }
  if (!agg.size) return { updated: 0, ok: true, reason: "no_results_yet" };

  // 6. Write actuals onto the matching image rows (upsert so an image that ran
  //    without an upload-time review still records its results).
  const now = new Date().toISOString();
  const rows = Array.from(agg.entries()).map(([sha, v]) => ({
    org_id: orgId,
    image_sha256: sha,
    ads_count: v.ads,
    impressions: v.impressions,
    clicks: v.clicks,
    spend: round(v.spend, 2),
    leads: v.leads,
    ctr: v.impressions > 0 ? round((v.clicks / v.impressions) * 100, 2) : 0,
    cost_per_lead: v.leads > 0 ? round(v.spend / v.leads, 2) : null,
    results_updated_at: now,
    updated_at: now,
  }));
  const { error } = await supabase
    .from("ad_image_reviews")
    .upsert(rows, { onConflict: "org_id,image_sha256" });
  if (error) return { updated: 0, ok: false, reason: error.message };
  return { updated: rows.length, ok: true };
}
