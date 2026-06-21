// Quote/invoice document template registry. The premium "Cream & Copper"
// template ships as the flagship/default; more styles can be registered here
// and picked per-org in Branding & Quotes, then themed to that business's logo,
// brand colour and details automatically.

export interface QuoteTemplateMeta {
  id: string;
  name: string;
  blurb: string;
  // Tiny preview tokens for the picker card (purely decorative).
  paper: string;
  accentSample: string;
}

export const QUOTE_TEMPLATES: QuoteTemplateMeta[] = [
  {
    id: "premium",
    name: "Premium — Cream & Copper",
    blurb:
      "Warm cream paper with a script wordmark, a flowing ribbon motif, staged scope sections and a progress-payment schedule. Themes to your brand colour and details.",
    paper: "#FCFAF5",
    accentSample: "#A86A45",
  },
];

export const DEFAULT_TEMPLATE = "premium";

export function templateMeta(id: string | undefined): QuoteTemplateMeta {
  return QUOTE_TEMPLATES.find((t) => t.id === id) || QUOTE_TEMPLATES[0];
}
