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
  // Grouped fixtures: options sharing an allowanceGroup are alternatives (e.g.
  // three tapware sets); the client picks ONE. allowanceSelected marks the chosen
  // option for its group (build-time default + the client's pick on accept) — and
  // ONLY the selected option counts toward the allowance total.
  allowanceGroup?: string | null;
  allowanceSelected?: boolean;
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
  acceptedTier: TierKey | null; // which tier the client accepted
  tierNames: Record<TierKey, string>; // editable display labels per tier
  allowanceNote: string; // framing text atop the Tile & Fixture Allowance section
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

// ---- Good/Better/Best tiers -----------------------------------------------
// The items that make up a tier: every SHARED line (tier == null) PLUS the lines
// tagged for that tier. So each tier = the shared base build + its own finishes.
export function itemsForTier(items: QuoteItem[], tier: TierKey): QuoteItem[] {
  return items.filter((it) => !it.tier || it.tier === tier);
}

export interface Totals { subtotal: number; gstAmount: number; total: number }

// ---- Grouped fixture allowance --------------------------------------------
// One counted allowance option per group: ungrouped items are included as-is;
// each group counts ONLY its selected option (the flagged one, else the first) —
// never the sum of the alternatives. This is what fixes the wrong-total bug.
export function selectedAllowanceItems(items: QuoteItem[]): QuoteItem[] {
  const out: QuoteItem[] = [];
  const byGroup = new Map<string, QuoteItem[]>();
  for (const it of items) {
    if (!it.allowance) continue;
    const g = (it.allowanceGroup || "").trim();
    if (!g) { out.push(it); continue; }
    (byGroup.get(g.toLowerCase()) ?? byGroup.set(g.toLowerCase(), []).get(g.toLowerCase())!).push(it);
  }
  for (const opts of byGroup.values()) out.push(opts.find((o) => o.allowanceSelected) || opts[0]);
  return out;
}

// The items that actually count toward the price for a tier (or the whole quote
// when tier is null): the build scope (shared + that tier's finishes) PLUS the
// SELECTED allowance option per group. Non-selected alternatives never count.
export function priceableItems(items: QuoteItem[], tier: TierKey | null): QuoteItem[] {
  const build = items.filter((i) => !i.allowance);
  const buildPart = tier ? build.filter((i) => !i.tier || i.tier === tier) : build;
  return [...buildPart, ...selectedAllowanceItems(items)];
}

// Grouped view of the allowance for rendering (builder + client). Ungrouped
// items become their own one-option group.
export interface AllowanceGroup { key: string; name: string; options: QuoteItem[]; selectedId: string }
export function allowanceGroups(items: QuoteItem[]): AllowanceGroup[] {
  const order: string[] = [];
  const map = new Map<string, QuoteItem[]>();
  for (const it of items) {
    if (!it.allowance) continue;
    const g = (it.allowanceGroup || "").trim();
    const key = g ? "g:" + g.toLowerCase() : "i:" + it.id;
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(it);
  }
  return order.map((key) => {
    const options = map.get(key)!;
    const name = (options[0].allowanceGroup || "").trim() || (options[0].description || "").split(/\r?\n/)[0].trim() || "Item";
    const sel = options.find((o) => o.allowanceSelected) || options[0];
    return { key, name, options, selectedId: sel.id };
  });
}

// Totals for each tier (build for that tier + the selected allowance), GST-correct.
export function tierTotals(items: QuoteItem[], gstRegistered: boolean, gstInclusive: boolean): Record<TierKey, Totals> {
  const out = {} as Record<TierKey, Totals>;
  for (const { key } of TIERS) out[key] = computeTotals(priceableItems(items, key), gstRegistered, gstInclusive);
  return out;
}

// The total that drives the stored headline + the deposit: the accepted tier if
// chosen, otherwise the middle ("better") option as the representative figure.
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
    allowanceNote: "",
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
