"use client";

import type { Quote } from "@/lib/quotes/model";
import type { BrandSettings } from "@/lib/business/brand";
import PremiumQuoteTemplate, { type QuoteConfiguratorConfig } from "@/components/quotes/templates/PremiumQuoteTemplate";

// The client-facing quote document. Picks the org's chosen template (premium is
// the flagship/default) and themes it from the Branding & Quotes settings. LIGHT
// and print-friendly — never Kennel dark, never the internal cost/margin.
export default function QuoteDocument({
  quote,
  brand,
  businessName,
  acceptBlockPrintOnly = false,
  config,
}: {
  quote: Quote;
  brand: BrandSettings;
  businessName: string;
  // Forwarded to the template: on the interactive client view the decorative
  // accept/sign block becomes print-only (the wired Accept action lives outside
  // the document), so there's no dead duplicate on screen.
  acceptBlockPrintOnly?: boolean;
  // Inline-selection configurator wiring (public client view only).
  config?: QuoteConfiguratorConfig;
}) {
  switch (brand.quoteTemplate) {
    case "premium":
    default:
      return <PremiumQuoteTemplate quote={quote} brand={brand} businessName={businessName} acceptBlockPrintOnly={acceptBlockPrintOnly} config={config} />;
  }
}
