import type { SupabaseClient } from "@supabase/supabase-js";

// Reads the org's "Why they're winning" snapshot (written by the refresh /
// weekly cron). Org-scoped by RLS. Resilient — returns empty defaults if the
// table/migration isn't there yet.
export interface CompetitorInsight {
  id: string;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  address: string;
  whyAhead: string;
  howToBeat: string;
  rank: number;
}

export interface CompetitorReport {
  marketSummary: string;
  status: string;
  message: string;
  generatedAt: string | null;
}

export interface CompetitorReviewsData {
  insights: CompetitorInsight[];
  report: CompetitorReport | null;
}

export async function fetchCompetitorInsights(supabase: SupabaseClient): Promise<CompetitorReviewsData> {
  try {
    const [{ data: rows }, { data: rep }] = await Promise.all([
      supabase.from("competitor_insights").select("*").order("rank", { ascending: true }),
      supabase.from("competitor_reports").select("*").maybeSingle(),
    ]);
    const insights: CompetitorInsight[] = (rows || []).map((r: any) => ({
      id: r.id,
      name: r.name ?? "",
      rating: r.rating != null ? Number(r.rating) : null,
      reviewCount: r.review_count != null ? Number(r.review_count) : null,
      address: r.address ?? "",
      whyAhead: r.why_ahead ?? "",
      howToBeat: r.how_to_beat ?? "",
      rank: r.rank ?? 0,
    }));
    const report: CompetitorReport | null = rep
      ? { marketSummary: rep.market_summary ?? "", status: rep.status ?? "ok", message: rep.message ?? "", generatedAt: rep.generated_at ?? null }
      : null;
    return { insights, report };
  } catch (e) {
    console.error("[competitors] fetch insights:", (e as Error).message);
    return { insights: [], report: null };
  }
}
