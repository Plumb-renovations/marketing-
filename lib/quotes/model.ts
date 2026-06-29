// Pure quote model + totals — shared by the builder, the branded document and
// the server. The client-facing document NEVER reads unitCost.

export type QuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired";
export type TradeType = "in_house" | "sub_trade";

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
    sections: [],
    items: [],
    stages: [],
  };
}

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
