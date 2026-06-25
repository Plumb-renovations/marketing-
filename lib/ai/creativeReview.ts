// Client-side calls for the AI creative reviewer. Posts uploaded ad photos to
// our server route (which runs the vision model + the learning loop) and pulls
// real Meta performance into the per-image history. No key reaches the browser;
// a failed verdict surfaces its reason rather than a fabricated judgement.

export interface ReasonItem {
  factor: string;
  rating: "good" | "weak";
  note: string;
}
export interface CreativeVerdictImage {
  index: number;
  verdict: "strong" | "ok" | "weak";
  score: number;
  style: string;
  gut: string;
  reasons: ReasonItem[];
  fixes: string[];
  wow: string;
  confidence: "high" | "medium" | "low";
}
export interface ActualStats {
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  costPerLead: number | null;
  adsCount: number;
  predictedVerdict: string | null;
  predictedScore: number | null;
  resultsUpdatedAt: string;
}
export interface CreativeReview {
  images: CreativeVerdictImage[];
  ranking: number[];
  leadWith: { index: number; why: string };
  note: string;
  learned: string;
  actuals: Record<number, ActualStats>;
}

export async function reviewCreatives(images: string[]): Promise<CreativeReview> {
  const res = await fetch("/api/ads/creative-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const e = await res.json();
      detail = e?.message || e?.error || "";
    } catch {}
    throw new Error(`Creative review failed (${res.status})${detail ? ": " + detail : ""}`);
  }
  const j = await res.json();
  return {
    images: Array.isArray(j.images) ? j.images : [],
    ranking: Array.isArray(j.ranking) ? j.ranking : [],
    leadWith: j.leadWith || { index: 0, why: "" },
    note: j.note || "",
    learned: j.learned || "",
    actuals: j.actuals || {},
  };
}

export async function refreshCreativePerformance(): Promise<{ ok: boolean; updated: number; reason?: string }> {
  const res = await fetch("/api/ads/creative-review/sync", { method: "POST" });
  try {
    return await res.json();
  } catch {
    return { ok: false, updated: 0, reason: "sync failed" };
  }
}
