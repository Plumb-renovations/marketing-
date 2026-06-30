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
  acceptBlockPrintOnly = false,
}: {
  quote: Quote;
  brand: BrandSettings;
  businessName: string;
  // Forwarded to the template: on the interactive client view the decorative
  // accept/sign block becomes print-only (the wired Accept action lives outside
  // the document), so there's no dead duplicate on screen.
  acceptBlockPrintOnly?: boolean;
}) {
  switch (brand.quoteTemplate) {
    case "premium":
    default:
      return <PremiumQuoteTemplate quote={quote} brand={brand} businessName={businessName} acceptBlockPrintOnly={acceptBlockPrintOnly} />;
  }
}
