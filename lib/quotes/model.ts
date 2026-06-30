// Pure quote model + totals — shared by the builder, the branded document and
// the server. The client-facing document NEVER reads unitCost.

export type QuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired";
export type TradeType = "in_house" | "sub_trade";
export type TierKey = "good" | "better" | "best";

export const TIERS: { key: TierKey; label: string }[] = [
  { key: "good", label: "Good" },
  { key: "better", label: "Better" },
  { key: "best", label: "Best" },
];

// The three tiers keep their internal identity (good/better/best), but the
// DISPLAY name is editable per quote. New tiered quotes start with these.
export const DEFAULT_TIER_NAMES: Record<TierKey, string> = {
  good: "Essential",
  better: "Premium",
  best: "Luxury",
};

// The label to SHOW for a tier — the quote's custom name, falling back to the
// default. Use everywhere a tier is shown so the internal key never leaks.
export function tierName(names: Partial<Record<TierKey, string>> | null | undefined, key: TierKey): string {
  return (names?.[key] || "").trim() || DEFAULT_TIER_NAMES[key];
}

// PC-items tiers reuse the same internal keys (good/better/best) but default to
// Standard / Premium / Luxury, editable per quote.
export const DEFAULT_PC_TIER_NAMES: Record<TierKey, string> = {
  good: "Standard",
  better: "Premium",
  best: "Luxury",
};
export function pcTierName(names: Partial<Record<TierKey, string>> | null | undefined, key: TierKey): string {
  return (names?.[key] || "").trim() || DEFAULT_PC_TIER_NAMES[key];
}

// The intro framing message shown at the top of the client-facing quote
// configurator — frames the quote as something the client TAILORS (picks their
// construction level + fixtures level and watches the live total) rather than a
// fixed price to compare. Editable per quote; the org saves its own default.
export const DEFAULT_CONFIGURATOR_INTRO =
  "Your quote, your way.\n" +
  "We've built this quote with options so you can tailor your renovation to exactly what you want — and what suits your budget. Choose your construction level and your fixtures and tiles below, and watch your price update as you go. There's no one-size-fits-all here; this is your bathroom, designed around you.";

// The gentle reassurance shown UNDER the client's combined total — gives them
// permission to quietly adjust their selections to suit their budget, so a high
// price feels adjustable rather than a reason to go quiet. Editable per quote;
// the org saves its own default.
export const DEFAULT_COMFORT_QUESTION =
  "Does this suit your needs and budget? If not, you can adjust your selections above to find the right fit for you — there's no pressure, and no wrong choice.";

// The visible journey/process roadmap shown on the client quote.
export interface JourneyStage { label: string; note?: string }
export const DEFAULT_JOURNEY: JourneyStage[] = [
  { label: "Quote accepted", note: "We confirm your selections and lock in your spot." },
  { label: "Deposit & booking", note: "Your deposit secures your start date." },
  { label: "Design & selections", note: "Finalise fixtures, tiles and finishes together." },
  { label: "Demolition & strip-out", note: "" },
  { label: "Rough-in — plumbing & electrical", note: "" },
  { label: "Waterproofing", note: "Inspected and certified to AS 3740." },
  { label: "Tiling", note: "" },
  { label: "Fit-off & finishing", note: "Fixtures installed, painting, detailing." },
  { label: "Final clean & handover", note: "Walk-through and warranty." },
];

export interface QuoteItem {
  id: string;
  sectionId: string | null;
  description: string;
  detail: string;
  qty: number;
  unit: string;
  unitPrice: number;
  unitCost: number | null; // INTERNAL only
  sortOrder: number;
  // Quote-by-trade: the trade this component belongs to (the client sees ONE
  // consolidated line per trade) and whether it's done in-house or sub-contracted
  // (a flag for the later back-costing feature). Both optional/null when unset.
  trade?: string | null;
  tradeType?: TradeType | null;
  // Good/Better/Best: null = SHARED across all tiers (the base build); else this
  // component belongs only to that tier's finishes. Ignored unless quote.tiered.
  tier?: TierKey | null;
  // Tile & Fixture Allowance: when true this line is a fixture/tile allowance
  // item — shown in its own allowance section, NOT in the build scope, and never
  // locked to a build tier. sourcePriceItemId links it back to the price-list
  // item it was toggled on from (so the PC selector knows what's included).
  allowance?: boolean;
  sourcePriceItemId?: string | null;
  // PC-items tier (Standard/Premium/Luxury) — the PARALLEL fixture choice. On an
  // allowance line: null = shared across all PC tiers; else good/better/best =
  // the PC level this fixture belongs to. Mirrors `tier` for the build.
  pcTier?: TierKey | null;
}

export interface QuoteSection {
  id: string;
  name: string;
  sortOrder: number;
}

export interface QuoteStage {
  id: string;
  label: string;
  milestoneNote: string;
  percent: number | null; // percent OR fixedAmount
  fixedAmount: number | null;
  amount: number;
  status: string;
  sortOrder: number;
}

export interface Quote {
  id: string;
  leadId: string | null;
  quoteNumber: string | null;
  reference: string;
  status: QuoteStatus;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  projectName: string;
  siteAddress: string;
  quoteDate: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  scopeDescription: string;
  introNote: string;
  terms: string;
  inclusions: string;
  exclusions: string;
  gstInclusive: boolean;
  subtotal: number;
  gstAmount: number;
  total: number;
  sentAt: string | null;
  viewedAt: string | null;
  viewCount: number;
  acceptedAt: string | null;
  publicToken: string | null;
  tiered: boolean; // Good/Better/Best mode (off = normal single-price quote)
  acceptedTier: TierKey | null; // which CONSTRUCTION tier the client accepted
  tierNames: Record<TierKey, string>; // editable construction-tier labels
  pcTiered: boolean; // offer the Standard/Premium/Luxury PC-items choice
  acceptedPcTier: TierKey | null; // which PC tier the client accepted
  pcTierNames: Record<TierKey, string>; // editable PC-tier labels
  allowanceNote: string; // framing text atop the Tile & Fixture Allowance section
  configuratorIntro: string; // framing message atop the client configurator
  comfortQuestion: string; // reassurance shown under the combined total
  journey: JourneyStage[]; // the process roadmap shown on the quote
  sections: QuoteSection[];
  items: QuoteItem[];
  stages: QuoteStage[];
}

export const GST_RATE = 0.1;
export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const lineAmount = (it: { qty: number; unitPrice: number }) => round2((Number(it.qty) || 0) * (Number(it.unitPrice) || 0));

// Subtotal/GST/total. When GST is exclusive, GST is added on top; when inclusive,
// the entered prices already include GST and we back it out for display.
export function computeTotals(items: { qty: number; unitPrice: number }[], gstRegistered: boolean, gstInclusive: boolean) {
  const lineSum = round2(items.reduce((a, it) => a + lineAmount(it), 0));
  if (!gstRegistered) return { subtotal: lineSum, gstAmount: 0, total: lineSum };
  if (gstInclusive) {
    const total = lineSum;
    const subtotal = round2(total / (1 + GST_RATE));
    return { subtotal, gstAmount: round2(total - subtotal), total };
  }
  const gstAmount = round2(lineSum * GST_RATE);
  return { subtotal: lineSum, gstAmount, total: round2(lineSum + gstAmount) };
}

// ---- Two parallel tier axes: construction (build) + PC items (fixtures) ----
export interface Totals { subtotal: number; gstAmount: number; total: number }

// BUILD scope for a construction tier (shared base + that tier's finishes), or
// all build when tier is null. EXCLUDES allowance/fixture lines — those are the
// separate PC-items layer.
export function buildItemsForTier(items: QuoteItem[], tier: TierKey | null): QuoteItem[] {
  return items.filter((i) => !i.allowance && (tier == null || !i.tier || i.tier === tier));
}

// The FIXTURE allowance for a PC tier: the shared PC lines (pcTier null) + that
// tier's fixtures. When pcTier is null (not PC-tiered) → all allowance lines.
export function pcAllowanceItems(items: QuoteItem[], pcTier: TierKey | null): QuoteItem[] {
  const allowance = items.filter((i) => i.allowance);
  if (!pcTier) return allowance;
  return allowance.filter((i) => !i.pcTier || i.pcTier === pcTier);
}

// Everything that counts toward the price for a (construction tier, PC tier)
// pair: the build for the construction tier PLUS the allowance for the PC tier.
export function priceableItems(items: QuoteItem[], tier: TierKey | null, pcTier: TierKey | null): QuoteItem[] {
  return [...buildItemsForTier(items, tier), ...pcAllowanceItems(items, pcTier)];
}

// Construction-tier prices — BUILD ONLY (the PC allowance is its own parallel
// choice, priced separately).
export function tierTotals(items: QuoteItem[], gstRegistered: boolean, gstInclusive: boolean): Record<TierKey, Totals> {
  const out = {} as Record<TierKey, Totals>;
  for (const { key } of TIERS) out[key] = computeTotals(buildItemsForTier(items, key), gstRegistered, gstInclusive);
  return out;
}

// PC-tier prices — the fixture/tile allowance for each PC level.
export function pcTierTotals(items: QuoteItem[], gstRegistered: boolean, gstInclusive: boolean): Record<TierKey, Totals> {
  const out = {} as Record<TierKey, Totals>;
  for (const { key } of TIERS) out[key] = computeTotals(pcAllowanceItems(items, key), gstRegistered, gstInclusive);
  return out;
}

// The representative tier for the stored headline/deposit: the accepted choice,
// else the middle ("better") option.
export function representativeTier(acceptedTier: TierKey | null): TierKey {
  return acceptedTier ?? "better";
}

// Resolve each payment stage's $ from percent (of total) or a fixed amount.
export function computeStageAmounts(stages: QuoteStage[], total: number): QuoteStage[] {
  return stages.map((s) => ({
    ...s,
    amount: s.fixedAmount != null ? round2(s.fixedAmount) : s.percent != null ? round2((Number(s.percent) || 0) / 100 * total) : 0,
  }));
}

export const stagePercentSum = (stages: QuoteStage[]) =>
  stages.reduce((a, s) => a + (s.percent != null ? Number(s.percent) || 0 : 0), 0);

export function emptyQuote(id: string): Quote {
  const today = new Date().toISOString().slice(0, 10);
  const valid = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  return {
    id,
    leadId: null,
    quoteNumber: null,
    reference: "",
    status: "draft",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    projectName: "",
    siteAddress: "",
    quoteDate: today,
    validUntil: valid,
    scopeDescription: "",
    introNote: "",
    terms: "",
    inclusions: "",
    exclusions: "",
    gstInclusive: false,
    subtotal: 0,
    gstAmount: 0,
    total: 0,
    sentAt: null,
    viewedAt: null,
    viewCount: 0,
    acceptedAt: null,
    publicToken: null,
    tiered: false,
    acceptedTier: null,
    tierNames: { ...DEFAULT_TIER_NAMES },
    pcTiered: false,
    acceptedPcTier: null,
    pcTierNames: { ...DEFAULT_PC_TIER_NAMES },
    allowanceNote: "",
    configuratorIntro: "",
    comfortQuestion: "",
    journey: [],
    sections: [],
    items: [],
    stages: [],
  };
}

// Default framing text for the Tile & Fixture Allowance section. The org can
// save its own default (business_profiles.default_allowance_note); a new quote
// auto-fills from that, falling back to this.
export const DEFAULT_ALLOWANCE_NOTE =
  "This allowance is based on higher-end selections to provide a realistic estimate of overall project cost. Selections can be adjusted to suit your budget, with any variations confirmed prior to ordering.";

// Split a quote's items into the build scope vs the fixture/tile allowance.
export const buildItemsOf = (items: QuoteItem[]): QuoteItem[] => items.filter((i) => !i.allowance);
export const allowanceItemsOf = (items: QuoteItem[]): QuoteItem[] => items.filter((i) => i.allowance);

export function money(n: number, currency = "AUD") {
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(Number(n) || 0);
  } catch {
    return "$" + (Number(n) || 0).toFixed(2);
  }
}

// ---- Quote-by-trade consolidation -----------------------------------------
// The CLIENT-facing view: group the components BY TRADE under one heading with
// ONE combined total per trade — but show the FULL scope detail, every
// component's description rendered as its own dot point (folded together, never
// truncated or summarised). Internal per-unit rates / quantities / per-component
// prices are NOT included here — only the descriptive bullets + the trade total.
// Components keep their order of first appearance. A line with NO trade stays
// its own single line (sensible fallback), keyed by its id. Pure — the client
// document, PDF and public link all render from this.
export interface TradeLine {
  key: string;
  trade: string | null; // null = an untagged single item
  label: string; // trade name, or the item's own first line when untagged
  bullets: string[]; // the FULL combined dot-point scope for this trade
  total: number;
  count: number;
}

// Split a description/detail into clean dot points: one per non-empty line, with
// any leading bullet glyph the user typed stripped so we render our own. A
// single-line description simply yields one bullet.
const toBullets = (text?: string | null): string[] =>
  (text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*·–—]\s*/, "").trim())
    .filter(Boolean);

export function consolidateByTrade(items: QuoteItem[]): TradeLine[] {
  const order: string[] = [];
  const map = new Map<string, { trade: string | null; label: string; bullets: string[]; total: number; count: number }>();
  for (const it of items) {
    const amt = lineAmount(it);
    const trade = (it.trade || "").trim();
    const lines = [...toBullets(it.description), ...toBullets(it.detail)];
    if (trade) {
      const key = "trade:" + trade.toLowerCase();
      let g = map.get(key);
      if (!g) { g = { trade, label: trade, bullets: [], total: 0, count: 0 }; map.set(key, g); order.push(key); }
      g.total += amt;
      g.count += 1;
      g.bullets.push(...lines); // fold this component's full detail into the trade
    } else {
      // Untagged → its own line: first line becomes the heading, the rest (and
      // any detail) become its bullets, so nothing is hidden.
      const key = "item:" + it.id;
      map.set(key, { trade: null, label: lines[0] || "Item", bullets: lines.slice(1), total: amt, count: 1 });
      order.push(key);
    }
  }
  return order.map((key) => {
    const g = map.get(key)!;
    return { key, trade: g.trade, label: g.label, bullets: g.bullets, total: round2(g.total), count: g.count };
  });
}
