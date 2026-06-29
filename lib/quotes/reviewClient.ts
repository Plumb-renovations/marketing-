import type { PricingFlag, KeywordFlag, ReviewQuote } from "@/lib/quotes/review";

// Client call for "Review with Hazel". Sends the CURRENT builder state (incl.
// unsaved edits + internal cost) so the review reflects exactly what's on screen.
export interface QuoteReviewResult {
  headline: string;
  wording: { target: string; suggestion: string; why: string }[];
  closeTips: string[];
  pricing: PricingFlag[];
  keywords: KeywordFlag[];
  aiAvailable: boolean;
}

export async function reviewQuote(quote: ReviewQuote, total: number): Promise<QuoteReviewResult> {
  const res = await fetch("/api/quotes/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quote, total }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.message || j?.error || `Review failed (${res.status})`);
  return j as QuoteReviewResult;
}
