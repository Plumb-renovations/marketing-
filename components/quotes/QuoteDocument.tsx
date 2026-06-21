"use client";

import type { Quote } from "@/lib/quotes/model";
import type { BrandSettings } from "@/lib/business/brand";
import PremiumQuoteTemplate from "@/components/quotes/templates/PremiumQuoteTemplate";

// The client-facing quote document. Picks the org's chosen template (premium is
// the flagship/default) and themes it from the Branding & Quotes settings. LIGHT
// and print-friendly — never Kennel dark, never the internal cost/margin.
export default function QuoteDocument({
  quote,
  brand,
  businessName,
}: {
  quote: Quote;
  brand: BrandSettings;
  businessName: string;
}) {
  switch (brand.quoteTemplate) {
    case "premium":
    default:
      return <PremiumQuoteTemplate quote={quote} brand={brand} businessName={businessName} />;
  }
}
