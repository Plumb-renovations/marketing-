import type { ParsedProduct, SupplierConfig } from "./types";

// NAGA (ceramics & cabinetry) — the first supplier config.
//
// Sheet shape: row 1 a merged banner, row 2 the header, data from row 3.
// Columns: A=CODE, B/C/D=SIZE (w/d/h mm), E=DESCRIPTION, F=RRP (GST-inclusive,
// the ONLY price column). Cost is DERIVED: cost_ex = (RRP ÷ 1.1) × (1 − trade
// discount). Categories are derived from the CODE prefix. Messy data handled:
//  1) merged toilet rows — pan "(P)" rows inherit blank size/RRP from the row
//     above (forward-fill);
//  2) dual-price toilet cells (".. with Geberit / .. with R&T", "329 (PP SEAT)
//     / 359 (UF SEAT)") split into two distinct products;
//  3) full-width brackets （ ） in codes normalised to ASCII ( ).

const normBrackets = (s: string) => (s || "").replace(/（/g, "(").replace(/）/g, ")").trim();

const num = (v: unknown): number | null => {
  const cleaned = String(v ?? "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

// Code prefix → PC category. FFC/GRID are kitchen (excluded from the bathroom
// catalogue). BT* (all bath variants) and GENOA are baths.
function nagaCategory(code: string): { category: string; kind: "pc" | "kitchen"; excluded: boolean } {
  const alpha = (code.match(/^[A-Za-z]+/)?.[0] || "").toUpperCase();
  if (alpha === "FFC" || alpha === "GRID") return { category: "Kitchen", kind: "kitchen", excluded: true };
  if (alpha === "GENOA" || alpha.startsWith("BT")) return { category: "Baths", kind: "pc", excluded: false };
  const MAP: [string, string[]][] = [
    ["Vanities", ["CB", "ARMONIA", "MC", "CBS", "KB", "KBS", "HD"]],
    ["Tops & benchtops", ["SS", "PB", "PBS"]],
    ["Basins", ["APB", "ACMB", "Y", "FW"]],
    ["Toilets", ["BL", "TS", "BUTTON", "G"]],
    ["Accessories", ["PW", "CTR", "CH", "CG", "MM", "ATBL"]],
  ];
  for (const [category, prefixes] of MAP) if (prefixes.includes(alpha)) return { category, kind: "pc", excluded: false };
  return { category: "Other", kind: "pc", excluded: false };
}

// Split a (possibly dual-price) RRP cell into one or two priced variants.
// "599 with Geberit / 559 with R&T" → [{599,"Geberit"},{559,"R&T"}]
// "329 (PP SEAT) / 359 (UF SEAT)"   → [{329,"PP SEAT"},{359,"UF SEAT"}]
function splitDualPrice(cell: string): { rrp: number; label: string; suffix: string }[] {
  const c = (cell || "").trim();
  if (c.includes("/")) {
    const parts = c.split("/").map((p) => p.trim()).filter(Boolean);
    const parsed = parts
      .map((p) => {
        const n = num(p);
        if (n == null) return null;
        const label = p
          .replace(/[0-9.,$]+/g, "")
          .replace(/^\s*(with|inc\.?|incl\.?)\s+/i, "")
          .replace(/[()]/g, "")
          .trim();
        return { rrp: n, label };
      })
      .filter(Boolean) as { rrp: number; label: string }[];
    if (parsed.length >= 2) {
      return parsed.map((x) => ({ rrp: x.rrp, label: x.label, suffix: (x.label.split(/\s+/)[0] || "").toUpperCase().slice(0, 8) }));
    }
  }
  const n = num(c);
  return [{ rrp: n ?? 0, label: "", suffix: "" }];
}

function parse(grid: string[][]): ParsedProduct[] {
  // Find the header row (contains an RRP + a description column); data follows.
  let start = 2;
  const hIdx = grid.findIndex((r) => r.some((c) => /rrp/i.test(c || "")) && r.some((c) => /desc/i.test(c || "")));
  if (hIdx >= 0) start = hIdx + 1;

  const out: ParsedProduct[] = [];
  let lastW: number | null = null;
  let lastD: number | null = null;
  let lastH: number | null = null;
  let lastRrpCell = "";

  for (let i = start; i < grid.length; i++) {
    const r = grid[i] || [];
    const code = normBrackets(r[0] || "");
    const desc = (r[4] || "").trim();
    let w = num(r[1]);
    let d = num(r[2]);
    let h = num(r[3]);
    let rrpCell = (r[5] ?? "").toString().trim();

    if (!code && !desc && !rrpCell) continue; // blank line

    // Forward-fill merged cells: a pan-only "(P)" row inherits the cistern row's
    // RRP + size from above rather than becoming a $0 phantom.
    if (!rrpCell) rrpCell = lastRrpCell; else lastRrpCell = rrpCell;
    if (w == null && d == null && h == null) { w = lastW; d = lastD; h = lastH; } else { lastW = w; lastD = d; lastH = h; }

    if (!code) continue; // need a code to import a row

    const cat = nagaCategory(code);
    const variants = splitDualPrice(rrpCell);
    for (const v of variants) {
      const dual = variants.length > 1;
      out.push({
        code: dual && v.suffix ? `${code}-${v.suffix}` : code,
        category: cat.category,
        kind: cat.kind,
        excluded: cat.excluded,
        description: (desc || code) + (dual && v.label ? ` (${v.label})` : ""),
        widthMm: w,
        depthMm: d,
        heightMm: h,
        rrpInc: v.rrp,
        costEx: null, // Naga: cost is derived from RRP × (1 − trade discount)
      });
    }
  }
  return out;
}

export const NAGA: SupplierConfig = {
  id: "naga",
  name: "Naga",
  blurb: "Ceramics & cabinetry — RRP-only sheet; cost derived from your trade discount.",
  defaultTradeDiscountPct: 40, // placeholder until Naga confirm the real discount
  derivesCostFromRrp: true,
  categories: ["Vanities", "Tops & benchtops", "Basins", "Toilets", "Baths", "Accessories"],
  parse,
};
