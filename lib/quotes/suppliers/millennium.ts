import type { ParsedProduct, SupplierConfig } from "./types";

// MILLENNIUM (tapware & metalwork) — the second supplier config. Much simpler
// than Naga: clean rows, no merged cells or dual-price text.
//
// Sheet shape: two title/banner rows, header on row 3, data from row 4.
// Columns: A=CODE, B=DESCRIPTION (range + item + finish), C=RRP EX GST,
// D=DISC (decimal, e.g. 0.46/0.49), E=NETT EX GST (the real cost), F=APN
// (barcode), G=RRP INC GST, H=UPDATED (date, first row only).
//
// PRICING: unlike Naga, Millennium HAS a real cost column, so derivesCostFromRrp
// is false — sell = RRP inc (G), cost = NETT ex (E) taken straight from the file.
// The file's DISC (D) tells us which tier it is (46 or 49); both tiers are the
// same catalogue, so importing both files (matched on code) fills cost_tiers
// {46,49} and the active-tier toggle picks the live one. Categories come from
// DESCRIPTION keywords.

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const num = (v: unknown): number | null => {
  const cleaned = String(v ?? "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

// Normalise the brand's one-n misspelling and tidy whitespace.
const normDesc = (s: string) => (s || "").replace(/millenn?ium/gi, "Millennium").replace(/\s+/g, " ").trim();

// Category from DESCRIPTION keywords. Order matters — check the compound terms
// (SHOWER MIXER, BATH SPOUT) before the generic ones (MIXER, SPOUT).
function millenniumCategory(desc: string): string {
  const d = desc.toUpperCase();
  if (/\bWASTE\b/.test(d)) return "Wastes";
  if (/\bSHOWER\b/.test(d)) return "Showers"; // shower mixer, rail shower, shower head
  if (/\bBATH\b.*\b(SPOUT|FILLER|OUTLET)\b|\b(SPOUT|FILLER|OUTLET)\b.*\bBATH\b/.test(d)) return "Baths";
  if (/\bTOWEL\b|\bTOILET ROLL\b|\bROBE HOOK\b|\bSOAP\b|\bSHELF\b/.test(d)) return "Accessories";
  if (/\bMIXER\b|\bSPOUT\b|\bDIVERTER\b|\bBASIN\b|\bTAP\b|\bWALL TOP\b/.test(d)) return "Tapware";
  return "Tapware"; // Millennium is all tapware/metalwork — sensible default
}

function parse(grid: string[][]): ParsedProduct[] {
  // Find the header row (has an RRP column + a NETT or DISC column); data follows.
  let start = 3;
  const hIdx = grid.findIndex((r) => r.some((c) => /rrp/i.test(c || "")) && r.some((c) => /(nett|disc)/i.test(c || "")));
  if (hIdx >= 0) start = hIdx + 1;

  const out: ParsedProduct[] = [];
  for (let i = start; i < grid.length; i++) {
    const r = grid[i] || [];
    const code = (r[0] || "").trim();
    const description = normDesc(r[1] || "");
    const rrpEx = num(r[2]);
    const disc = num(r[3]);
    const nettEx = num(r[4]);
    const rrpIncCol = num(r[6]);

    if (!code && !description) continue; // blank line
    if (!code) continue; // need a code to import

    // Sell = RRP inc (col G); fall back to RRP ex × 1.1 if the inc column is blank.
    const rrpInc = round2(rrpIncCol != null ? rrpIncCol : (rrpEx || 0) * 1.1);
    // Cost = NETT ex (col E); fall back to RRP ex × (1 − disc) if NETT is blank.
    const costEx = round2(nettEx != null ? nettEx : (rrpEx || 0) * (1 - (disc ?? 0)));
    // Tier label from the file's DISC (0.46 → "46").
    const tier = disc != null ? String(Math.round(disc * 100)) : null;

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
  parse,
};
