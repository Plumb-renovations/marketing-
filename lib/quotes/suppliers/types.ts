// Supplier-aware bulk import framework. Each supplier provides its own config
// (column mapping, category rule, pricing rule, messy-data handling) by
// implementing SupplierConfig.parse(); the generic layer below turns the parsed
// products into priced rows (sell/cost/margin/flags) and the UI previews +
// commits them. Adding a new supplier = a new config file + a registry entry —
// the core import flow never changes.
//
// PRIVACY: `sell` is the ONLY price the client ever sees. `cost`, `rrpEx` and
// margin are INTERNAL — for the owner's reference and back-costing.

export const GST_RATE = 0.1;
export const MARGIN_FLOOR_PCT = 30; // below this → red flag

export type MarginFlag = "push" | "ok" | "thin" | "below";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// A single product as parsed from a supplier sheet (before pricing maths).
export interface ParsedProduct {
  code: string; // supplier SKU (also used to match on re-import)
  category: string; // PC category (Basins, Toilets, Vanities, …)
  kind: "pc" | "kitchen"; // 'kitchen' = not part of the bathroom catalogue
  excluded: boolean; // default-skip on import (e.g. kitchen lines)
  description: string;
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
  rrpInc: number; // supplier RRP, GST-INCLUSIVE — the sell basis
  costEx: number | null; // supplier-provided trade/cost (ex-GST) if the file has one; else null → derive
  tier?: string | null; // for multi-tier suppliers: which cost tier this row's costEx belongs to (e.g. "46")
}

// A parsed product with the pricing maths resolved.
export interface PricedProduct extends ParsedProduct {
  rrpEx: number; // RRP ÷ (1+GST)
  sell: number; // = rrpInc — the client-facing price
  cost: number; // resolved internal cost (ex-GST): derived or supplier-provided
  marginPct: number; // (rrpEx − cost) / rrpEx × 100
  flag: MarginFlag;
  provisional: boolean; // true when cost is DERIVED from a placeholder trade discount
}

export interface SupplierConfig {
  id: string; // 'naga'
  name: string; // 'Naga'
  blurb: string; // one-liner shown in the picker
  defaultTradeDiscountPct: number; // placeholder until confirmed (Naga: 40)
  // When true the sheet has ONLY an RRP and cost is DERIVED as
  // rrpEx × (1 − tradeDiscount). When false the sheet carries a real cost
  // (e.g. a tapware supplier with RRP + cost tiers) and the discount is ignored.
  derivesCostFromRrp: boolean;
  categories: string[]; // PC categories this supplier typically fills (hint only)
  // Multi-tier suppliers (same catalogue at more than one trade tier). When set,
  // the UI shows an ACTIVE-TIER toggle instead of a trade-discount field, and
  // each item's cost is stored per tier in cost_tiers. undefined → single cost.
  tierLabels?: string[]; // e.g. ["46", "49"]
  defaultTier?: string; // e.g. "46"
  // 1-based row where product DATA begins (headers/banners above it). Suppliers
  // whose header text is unreliable map by column POSITION and start here rather
  // than sniffing the header row. Undefined → the config's parse() decides.
  dataStartRow?: number;
  parse: (grid: string[][]) => ParsedProduct[];
}

// Generic pricing pass — shared by every supplier. Turns parsed products into
// priced rows: sell = RRP (inc GST); cost = derived from the trade discount
// (derive-cost suppliers) or the file's own cost; margin + flag computed off the
// ex-GST figures.
export function priceProducts(
  products: ParsedProduct[],
  tradeDiscountPct: number,
  derivesCostFromRrp: boolean,
  floorPct: number = MARGIN_FLOOR_PCT,
): PricedProduct[] {
  const disc = Math.max(0, Number(tradeDiscountPct) || 0);
  return products.map((p) => {
    const rrpEx = round2(p.rrpInc / (1 + GST_RATE));
    const derived = derivesCostFromRrp || p.costEx == null;
    const cost = derived ? round2(rrpEx * (1 - disc / 100)) : round2(p.costEx as number);
    const marginPct = rrpEx > 0 ? round2(((rrpEx - cost) / rrpEx) * 100) : 0;
    const flag: MarginFlag = marginPct < floorPct ? "below" : marginPct < floorPct + 10 ? "thin" : marginPct < 55 ? "ok" : "push";
    return { ...p, rrpEx, sell: round2(p.rrpInc), cost, marginPct, flag, provisional: derived };
  });
}

export const FLAG_META: Record<MarginFlag, { label: string; cls: string }> = {
  push: { label: "Healthy", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  ok: { label: "OK", cls: "border-slate-600/50 bg-slate-700/30 text-slate-300" },
  thin: { label: "Thin", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  below: { label: "Below floor", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
};
