import { money } from "@/lib/quotes/model";

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
const UNDER_RATE = 0.85; // price below 85% of the rate-card rate → too cheap
const OVER_RATE = 1.5; // price above 150% of the rate-card rate → check

const norm = (s?: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

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
    const cost = it.unitCost == null ? null : Number(it.unitCost);
    const match = matchRate(it.description, it.unit, priceList);
    const rate = match ? match.unitPrice : null;
    const margin = cost != null && price > 0 ? Math.round(((price - cost) / price) * 100) : null;

    let verdict: PricingVerdict | null = null;
    let severity: PricingFlag["severity"] = "low";
    let reason = "";

    if (price <= 0 && (Number(it.qty) || 0) > 0) {
      verdict = "too_cheap"; severity = "high";
      reason = "No price set on this line — it'll add nothing to the total.";
    } else if (cost != null && price > 0 && price <= cost) {
      verdict = "too_cheap"; severity = "high";
      reason = `Priced at or below your cost (${money(cost)}) — you'd make nothing or lose money on this line.`;
    } else if (margin != null && margin < THIN_MARGIN) {
      verdict = "too_cheap"; severity = "medium";
      reason = `Thin margin (${margin}%) — under a healthy mark-up. Make sure labour and overheads are covered.`;
    } else if (rate != null && price > 0 && price < rate * UNDER_RATE) {
      verdict = "too_cheap"; severity = "medium";
      reason = `${Math.round((1 - price / rate) * 100)}% under your price-list rate of ${money(rate)}/${match!.unit}. Double-check you're not leaving money on the table.`;
    } else if (rate != null && price > rate * OVER_RATE) {
      verdict = "too_dear"; severity = "low";
      reason = `Well above your price-list rate of ${money(rate)}/${match!.unit} — fine if it's justified (access, complexity), just check it isn't a typo.`;
    } else if (margin != null && margin >= HEALTHY_MARGIN) {
      verdict = "healthy"; severity = "low";
      reason = `Healthy margin (${margin}%)${rate != null ? " and in line with your rate card" : ""}.`;
    } else if (rate != null) {
      verdict = "healthy"; severity = "low";
      reason = `In line with your price-list rate (${money(rate)}/${match!.unit}).`;
    } else {
      continue; // nothing to compare against
    }

    out.push({ lineId: it.id, description: desc, verdict, severity, reason, unitPrice: price, unitCost: cost, rate, margin });
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
