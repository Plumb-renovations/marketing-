import type { ParsedProduct, SupplierConfig } from "./types";

// MILLENNIUM (tapware & metalwork) — the second supplier config.
//
// REAL sheet shape (mapped by COLUMN POSITION — the header text has irregular
// internal whitespace like "PRODUCT     CODE", so we never match on it):
//   Rows 1-2  banner/title ("MILLENNIUM BATHROOMWARE PRICE LIST" / "MAY 2026"),
//   Row 3     header, Row 4+ product data (~1,324 rows).
//   A(0) CODE · B(1) DESCRIPTION · C(2) RRP EX GST · D(3) DISC. ("49.00%") ·
//   E(4) NETT EX GST = COST · F(5) APN barcode (IGNORED — never a price) ·
//   G(6) RRP INC GST = SELL · H(7) UPDATED · I(8) trailing empty.
//
// PRICING: sell = RRP inc (G); cost = real NETT ex (E), taken from the file —
// derivesCostFromRrp is false. The DISC. percent (D) only labels the cost tier
// (46 / 49). Categories are derived from the DESCRIPTION (B) keywords.

const DATA_START_ROW = 4; // 1-based (skip 2 banner rows + 1 header)

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Numeric parse for money cells — strips $, commas, spaces, stray text.
const num = (v: unknown): number | null => {
  const s = String(v ?? "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

// DISC. is a percent STRING like "49.00%" → 49. Also tolerates a decimal form
// (0.49 → 49) so either export style yields the right tier.
const discountPct = (v: unknown): number | null => {
  let n = num(v);
  if (n == null) return null;
  if (n > 0 && n <= 1) n *= 100; // "0.49" decimal → 49
  return n;
};

// Fix the one-n brand misspelling and tidy whitespace.
const normDesc = (s: string) => (s || "").replace(/millenn?ium/gi, "Millennium").replace(/\s+/g, " ").trim();

// Category from the DESCRIPTION keywords. Compound/specific terms are checked
// first (SHOWER before MIXER; BATH SPOUT before SPOUT). Millennium is all
// metalwork, so the fallback is Tapware — never "Other".
function millenniumCategory(desc: string): string {
  const d = (desc || "").toUpperCase();
  if (d.includes("WASTE")) return "Wastes";
  if (d.includes("SHOWER")) return "Showers"; // shower mixer / rail shower / shower head
  if (d.includes("BATH SPOUT") || d.includes("BATH FILLER") || d.includes("BATH OUTLET")) return "Baths";
  if (/TOWEL RAIL|TOWEL BAR|TOILET ROLL|ROBE HOOK|SOAP|HOOK|SHELF/.test(d)) return "Accessories";
  if (/MIXER|SPOUT|DIVERTER|BASIN|\bTAP\b|WALL TOP/.test(d)) return "Tapware";
  return "Tapware";
}

function parse(grid: string[][]): ParsedProduct[] {
  const out: ParsedProduct[] = [];
  for (let i = DATA_START_ROW - 1; i < grid.length; i++) {
    const r = grid[i] || [];
    // Strip any stray BOM from the first cell + trim; ignore the trailing col I.
    const code = (r[0] ?? "").toString().replace(/^﻿/, "").trim();
    const description = normDesc((r[1] ?? "").toString());
    const rrpEx = num(r[2]); // C
    const discPct = discountPct(r[3]); // D "49.00%" → 49
    const cost = num(r[4]); // E  NETT ex-GST = COST
    // r[5] = F = APN barcode — deliberately NOT read (it is not a price).
    const sell = num(r[6]); // G  RRP inc-GST = SELL

    if (!code) continue; // need a code
    if (sell == null && rrpEx == null && cost == null) continue; // skip a stray header/blank row

    const rrpInc = round2(sell != null ? sell : (rrpEx || 0) * 1.1);
    const costEx = round2(cost != null ? cost : (rrpEx || 0) * (1 - (discPct ?? 0) / 100));
    const tier = discPct != null ? String(Math.round(discPct)) : null;

    out.push({
      code,
      category: millenniumCategory(description),
      kind: "pc",
      excluded: false,
      description: description || code,
      widthMm: null,
      depthMm: null,
      heightMm: null,
      rrpInc,
      costEx,
      tier,
    });
  }
  return out;
}

export const MILLENNIUM: SupplierConfig = {
  id: "millennium",
  name: "Millennium",
  blurb: "Tapware & metalwork — RRP + real NETT cost; two trade tiers (46 / 49).",
  defaultTradeDiscountPct: 46, // informational only — cost comes from the file
  derivesCostFromRrp: false, // real cost in the file — do NOT derive
  categories: ["Tapware", "Showers", "Baths", "Accessories", "Wastes"],
  tierLabels: ["46", "49"],
  defaultTier: "46",
  dataStartRow: DATA_START_ROW,
  parse,
};
