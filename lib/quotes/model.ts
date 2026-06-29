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
// The CLIENT-facing view: collapse the individual components into ONE line per
// trade — trade name + an optional short combined description + the combined
// total (sum of its components). Components keep their order of first
// appearance. A line with NO trade stays its own single line (sensible
// fallback), keyed by its id so it never merges with anything else. Pure — the
// client document, PDF and public link all render from this.
export interface TradeLine {
  key: string;
  trade: string | null; // null = an untagged single item
  label: string; // trade name, or the item's own description when untagged
  description: string; // optional combined description (component descriptions)
  total: number;
  count: number;
}

const summariseDescriptions = (descs: string[]): string => {
  const seen = new Set<string>();
  const uniq = descs.map((d) => d.trim()).filter((d) => d && !seen.has(d.toLowerCase()) && seen.add(d.toLowerCase()));
  const joined = uniq.join(" · ");
  return joined.length > 160 ? joined.slice(0, 157).trimEnd() + "…" : joined;
};

export function consolidateByTrade(items: QuoteItem[]): TradeLine[] {
  const order: string[] = [];
  const map = new Map<string, { trade: string | null; label: string; descs: string[]; total: number; count: number }>();
  for (const it of items) {
    const amt = lineAmount(it);
    const trade = (it.trade || "").trim();
    if (trade) {
      const key = "trade:" + trade.toLowerCase();
      let g = map.get(key);
      if (!g) { g = { trade, label: trade, descs: [], total: 0, count: 0 }; map.set(key, g); order.push(key); }
      g.total += amt;
      g.count += 1;
      if (it.description?.trim()) g.descs.push(it.description.trim());
    } else {
      const key = "item:" + it.id;
      map.set(key, { trade: null, label: it.description?.trim() || "Item", descs: it.detail?.trim() ? [it.detail.trim()] : [], total: amt, count: 1 });
      order.push(key);
    }
  }
  return order.map((key) => {
    const g = map.get(key)!;
    return {
      key,
      trade: g.trade,
      label: g.label,
      description: g.trade ? summariseDescriptions(g.descs) : (g.descs[0] || ""),
      total: round2(g.total),
      count: g.count,
    };
  });
}
