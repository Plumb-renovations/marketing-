// Trades / categories for quote line items. The CLIENT-facing quote consolidates
// components into ONE line per trade; internally each component keeps its own
// rate + cost/margin. The list is a sensible default — it's free text on the
// item, so the user can type any trade and extend it.

export type TradeType = "in_house" | "sub_trade";

export const DEFAULT_TRADES: string[] = [
  "Demolition",
  "Plumbing",
  "Carpentry",
  "Wall lining",
  "Waterproofing",
  "Tiling",
  "Electrical",
  "Painting",
  "Joinery",
  "Plastering",
  "Flooring",
  "Glazing / shower screens",
  "Fit-off plumbing",
  "Rubbish removal",
];

// Trades this business does IN-HOUSE by default (labour + materials). The owner
// confirmed plumbing, carpentry, wall lining and fit-off plumbing are in-house;
// everything else defaults to sub-trade. Only a DEFAULT — the per-line toggle
// always wins and is fully editable.
const IN_HOUSE = new Set(["plumbing", "carpentry", "wall lining", "fit-off plumbing", "fit off plumbing"]);

export function inferTradeType(trade: string | null | undefined): TradeType {
  return IN_HOUSE.has((trade || "").trim().toLowerCase()) ? "in_house" : "sub_trade";
}

export const TRADE_TYPE_LABEL: Record<TradeType, string> = {
  in_house: "In-house",
  sub_trade: "Sub-trade",
};
