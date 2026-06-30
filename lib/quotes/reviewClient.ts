import type { PricingFlag, KeywordFlag, ReviewQuote } from "@/lib/quotes/review";

// Client call for "Review with Hazel". Sends the CURRENT builder state (incl.
// unsaved edits + internal cost) so the review reflects exactly what's on screen.
// A wording suggestion mapped to the exact thing it rewrites, so it can be
// one-click applied: field "description" + lineId targets that line item;
// field "scope" targets the overall scope description; field null = advisory.
export interface WordingSuggestion {
  lineId: string | null;
  field: "description" | "scope" | null;
  target: string; // the current line/section text, for display
  suggestion: string; // the drop-in replacement wording
  why: string;
}

export interface QuoteReviewResult {
  headline: string;
  wording: WordingSuggestion[];
  closeTips: string[];
  pricing: PricingFlag[];
  keywords: KeywordFlag[];
  aiAvailable: boolean;
  note?: string; // set when the AI wording timed out (partial result returned)
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
