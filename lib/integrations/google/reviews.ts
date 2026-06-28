import type { GoogleBusinessConfig } from "./config";

// Read + reply to Google Business Profile reviews. Only usable once Google is
// connected + a location chosen (getGoogleBusinessConfig != null). Until then
// the engagement UI shows a "pending Google connection" state.

export interface RawReview {
  externalId: string;
  author: string | null;
  text: string;
  rating: number | null;
  itemAt: string | null;
  permalink: string | null;
}

const STAR: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
const base = "https://mybusiness.googleapis.com/v4";

export async function fetchGoogleReviews(cfg: GoogleBusinessConfig, limit = 25): Promise<RawReview[]> {
  if (!cfg.accountName || !cfg.locationName) return [];
  const url = `${base}/${cfg.accountName}/${cfg.locationName}/reviews?pageSize=${limit}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.accessToken}` } });
  if (!res.ok) return [];
  const j: any = await res.json().catch(() => ({}));
  return (j?.reviews || []).map((r: any) => ({
    externalId: String(r?.reviewId || ""),
    author: r?.reviewer?.displayName || null,
    text: String(r?.comment || ""),
    rating: STAR[String(r?.starRating)] ?? null,
    itemAt: r?.createTime || null,
    permalink: cfg.reviewUri || null,
  }));
}

// Reply to a review: PUT /v4/{account}/{location}/reviews/{id}/reply { comment }.
export async function replyToGoogleReview(cfg: GoogleBusinessConfig, reviewId: string, comment: string): Promise<{ ok: boolean }> {
  if (!cfg.accountName || !cfg.locationName) return { ok: false };
  const url = `${base}/${cfg.accountName}/${cfg.locationName}/reviews/${reviewId}/reply`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  });
  return { ok: res.ok };
}
