import { money, round2 } from "@/lib/quotes/model";

// Deterministic quote-review brain — the reliable, AI-free half of "Review with
// Hazel". It does the pricing sanity check (line items vs the price list AND the
// per-line internal cost/margin) and the keyword/scope detection. The AI layer
// adds the wording-to-close suggestions on top. Pure + side-effect-free so it's
// fast, testable, and readable by the AI prompt.

// ---- Shapes ---------------------------------------------------------------
export interface ReviewLine {
  id: string;
  description: string;
  detail?: string;
  qty: number;
  unit: string;
  unitPrice: number;
  unitCost: number | null; // INTERNAL — never shown to the client
}

export interface ReviewQuote {
  leadId?: string | null;
  projectName?: string;
  reference?: string;
  scopeDescription?: string;
  inclusions?: string;
  exclusions?: string;
  introNote?: string;
  items: ReviewLine[];
}

export interface PriceRef { name: string; unit: string; unitPrice: number }

export type PricingVerdict = "too_cheap" | "too_dear" | "healthy";
export interface PricingFlag {
  lineId: string;
  description: string;
  verdict: PricingVerdict;
  severity: "high" | "medium" | "low";
  reason: string;
  unitPrice: number;
  unitCost: number | null;
  rate: number | null; // matched price-list rate, if any
  margin: number | null; // % if cost known
}

export interface KeywordFlag {
  id: string;
  phrase: string; // the matched phrase
  label: string;
  note: string;
  severity: "high" | "medium" | "low";
}

// ---- Pricing sanity -------------------------------------------------------
const HEALTHY_MARGIN = 25; // at/above → healthy
const THIN_MARGIN = 15; // below → flag thin
// Like-for-like deviation thresholds against the price-list rate. Only flag a
// MEANINGFUL gap — normal variation under these stays quiet ("in line"). Tweak
// here to taste.
const RATE_UNDER_THRESHOLD = 0.2; // >20% under → too cheap
const RATE_OVER_THRESHOLD = 0.5; // >50% over → check

const norm = (s?: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

// Units that mean "the whole job / one-off", i.e. the price-list rate already IS
// the total for that work (not a per-quantity rate). When a quote line is built
// from a per-point / per-m² quantity but the price-list item is one of these, we
// compare the line's TOTAL against the rate — never per-unit-of-one vs
// per-unit-of-another (the bug that flagged a $3,300 / 3-point plumbing line as
// "72% under" a $3,980/ea whole-job rate).
const WHOLE_JOB_UNITS = new Set(["ea", "each", "fixed", "job", "lot", "item", "sum", "ls", "unit"]);

// Best price-list match for a line: the rate-card item whose name overlaps the
// line description (either direction), preferring a matching unit.
function matchRate(desc: string, unit: string, priceList: PriceRef[]): PriceRef | null {
  const d = norm(desc);
  if (!d) return null;
  let best: PriceRef | null = null;
  let bestScore = 0;
  for (const p of priceList) {
    const n = norm(p.name);
    if (!n) continue;
    if (d.includes(n) || n.includes(d)) {
      const score = Math.min(n.length, d.length) + (norm(p.unit) === norm(unit) ? 5 : 0);
      if (score > bestScore) { bestScore = score; best = p; }
    }
  }
  return best;
}

// One verdict per line (priority: loss → thin → under-rate → over-rate →
// healthy). Lines with nothing to compare (no cost, no rate match) are skipped.
export function analysePricing(items: ReviewLine[], priceList: PriceRef[]): PricingFlag[] {
  const out: PricingFlag[] = [];
  for (const it of items) {
    const desc = it.description?.trim() || "(unnamed line)";
    const price = Number(it.unitPrice) || 0;
    const qty = Number(it.qty) || 0;
    const lineTotal = round2(qty * price);
    const cost = it.unitCost == null ? null : Number(it.unitCost);
    const match = matchRate(it.description, it.unit, priceList);
    const rate = match ? match.unitPrice : null;
    const margin = cost != null && price > 0 ? Math.round(((price - cost) / price) * 100) : null;

    // Compare LIKE-FOR-LIKE against the price-list rate.
    //  • units match (both per m², both per point, …) → compare per-unit price.
    //  • units differ but the price-list rate is a whole-job rate (ea/fixed/…)
    //    → compare the line's TOTAL against the rate.
    //  • otherwise the bases aren't comparable → don't flag against the rate.
    let cmp: number | null = null; // the line value to compare
    let cmpRate: number | null = null; // the price-list value, same basis
    let rateLabel = ""; // how to describe the rate in the message
    if (match && rate != null && rate > 0) {
      if (norm(it.unit) === norm(match.unit)) {
        cmp = price; cmpRate = rate; rateLabel = `${money(rate)}/${match.unit}`;
      } else if (WHOLE_JOB_UNITS.has(norm(match.unit))) {
        cmp = lineTotal; cmpRate = rate; rateLabel = `${money(rate)} for this work`;
      }
    }
    const underPct = cmp != null && cmpRate ? (cmpRate - cmp) / cmpRate : 0;
    const overPct = cmp != null && cmpRate ? (cmp - cmpRate) / cmpRate : 0;

    let verdict: PricingVerdict | null = null;
    let severity: PricingFlag["severity"] = "low";
    let reason = "";

    if (price <= 0 && qty > 0) {
      verdict = "too_cheap"; severity = "high";
      reason = "No price set on this line — it'll add nothing to the total.";
    } else if (cost != null && price > 0 && price <= cost) {
      verdict = "too_cheap"; severity = "high";
      reason = `Priced at or below your cost (${money(cost)}) — you'd make nothing or lose money on this line.`;
    } else if (margin != null && margin < THIN_MARGIN) {
      verdict = "too_cheap"; severity = "medium";
      reason = `Thin margin (${margin}%) — under a healthy mark-up. Make sure labour and overheads are covered.`;
    } else if (cmp != null && underPct > RATE_UNDER_THRESHOLD) {
      verdict = "too_cheap"; severity = "medium";
      reason = `${Math.round(underPct * 100)}% under your price-list rate of ${rateLabel}. Double-check you're not leaving money on the table.`;
    } else if (cmp != null && overPct > RATE_OVER_THRESHOLD) {
      verdict = "too_dear"; severity = "low";
      reason = `Well above your price-list rate of ${rateLabel} — fine if it's justified (access, complexity), just check it isn't a typo.`;
    } else if (margin != null && margin >= HEALTHY_MARGIN) {
      verdict = "healthy"; severity = "low";
      reason = `Healthy margin (${margin}%)${cmp != null ? " and in line with your rate card" : ""}.`;
    } else if (cmp != null) {
      verdict = "healthy"; severity = "low";
      reason = `In line with your price-list rate (${rateLabel}).`;
    } else {
      continue; // nothing comparable
    }

    out.push({ lineId: it.id, description: desc, verdict, severity, reason, unitPrice: price, unitCost: cost, rate: cmpRate, margin });
  }
  return out;
}

// ---- Keyword / scope detection --------------------------------------------
export interface Trigger { id: string; phrases: string[]; label: string; note: string; severity: "high" | "medium" | "low" }

// Built-in trade trigger phrases that usually change the price or imply a
// missing line. Sensible default set — kept as an exported constant so it can be
// extended (or moved to a per-org table) later without touching the engine.
export const DEFAULT_TRIGGERS: Trigger[] = [
  { id: "slab", phrases: ["concrete slab", "slab", "slab floor", "on slab"], label: "Concrete slab", note: "Moving plumbing through a concrete slab usually costs more (cutting/coring + make-good). Is that allowed for?", severity: "high" },
  { id: "subfloor", phrases: ["subfloor", "sub-floor", "sub floor", "replace subfloor"], label: "Subfloor", note: "If the subfloor needs replacing or repairing, make sure there's a line item for it — it's commonly missed.", severity: "high" },
  { id: "structural", phrases: ["remove wall", "removing a wall", "structural", "load bearing", "load-bearing", "lintel", "beam"], label: "Structural / wall removal", note: "Removing a wall can need an engineer + lintel/beam. Structural work is often under-quoted — confirm it's priced.", severity: "high" },
  { id: "upstairs", phrases: ["second storey", "second story", "upstairs", "second floor", "first floor", "level 2"], label: "Upstairs / second storey", note: "Upstairs work usually means harder access, extra waterproofing and more labour — check it's reflected in the price.", severity: "medium" },
  { id: "asbestos", phrases: ["asbestos", "fibro", "asbestos sheet"], label: "Asbestos", note: "Asbestos needs licensed removal + disposal — it must be a separate, properly-priced line, not absorbed into demo.", severity: "high" },
  { id: "relocate", phrases: ["relocate", "move the toilet", "move toilet", "move plumbing", "move the vanity", "reposition"], label: "Relocating fixtures", note: "Relocating fixtures means new plumbing/waste points — confirm each move is quoted, not just the fixture.", severity: "medium" },
  { id: "waterdamage", phrases: ["water damage", "rot", "rotten", "leak", "mould", "mold", "termite", "white ant"], label: "Hidden damage", note: "Water damage / rot / termites can blow out scope once you open up. Consider a provisional sum or a clear exclusion.", severity: "medium" },
  { id: "oldhome", phrases: ["old home", "old house", "heritage", "pre-1985", "queenslander", "character home"], label: "Older / heritage home", note: "Older homes often hide non-standard framing, lead paint or asbestos — pad your provisional allowances.", severity: "low" },
  { id: "tileovertile", phrases: ["tile over tile", "over existing tiles", "leave existing tiles"], label: "Tiling over existing", note: "Tiling over existing tiles affects waterproofing warranty and floor heights — make sure the method is spelled out.", severity: "low" },
  { id: "pcsum", phrases: ["pc sum", "provisional sum", "supply by others", "by owner", "client to supply"], label: "PC / provisional sum", note: "PC/provisional items: state the allowance clearly so a fixture upgrade doesn't become an awkward variation later.", severity: "low" },
];

// Assemble all the quote's own text + notes for scanning.
export function buildReviewText(q: ReviewQuote): string {
  const lines = (q.items || []).map((it) => `${it.description || ""} ${it.detail || ""}`).join(" \n ");
  return [q.projectName, q.reference, q.scopeDescription, q.inclusions, q.exclusions, q.introNote, lines].filter(Boolean).join(" \n ");
}

export function detectKeywords(text: string, triggers: Trigger[] = DEFAULT_TRIGGERS): KeywordFlag[] {
  const hay = norm(text);
  if (!hay) return [];
  const out: KeywordFlag[] = [];
  for (const t of triggers) {
    const hit = t.phrases.find((ph) => hay.includes(norm(ph)));
    if (hit) out.push({ id: t.id, phrase: hit, label: t.label, note: t.note, severity: t.severity });
  }
  return out;
}

// Deterministic fallback headline when the AI layer is unavailable.
export function fallbackHeadline(pricing: PricingFlag[], keywords: KeywordFlag[]): string {
  const cheap = pricing.filter((p) => p.verdict === "too_cheap").length;
  const kw = keywords.length;
  if (cheap || kw) {
    const bits = [
      cheap ? `${cheap} line${cheap > 1 ? "s" : ""} may be under-priced` : "",
      kw ? `${kw} scope flag${kw > 1 ? "s" : ""} to check` : "",
    ].filter(Boolean);
    return `Before you send: ${bits.join(" and ")}.`;
  }
  return "Pricing looks healthy and no scope red flags — tighten the wording and send it.";
}
