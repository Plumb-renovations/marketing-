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
  tier?: string | null; // good/better/best, or null (shared) — context for the AI
  allowance?: boolean; // fixture/tile allowance line
}

export interface ReviewQuote {
  leadId?: string | null;
  projectName?: string;
  reference?: string;
  scopeDescription?: string;
  inclusions?: string;
  exclusions?: string;
  terms?: string; // used only to detect whether unforeseen-conditions are already covered
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

// ---- Scope-risk detection (high signal, low noise) ------------------------
// We only flag SPECIFIC, actionable risks — never generic situations true of
// nearly every job. Two principles fixed the "too trigger-happy" behaviour:
//   1. Scan only the WORK scope (scope text + line items + intro), NOT the
//      exclusions/terms clauses. Scanning the terms made the quote's own
//      "unforeseen conditions (rot, asbestos, water damage…)" clause trigger the
//      very risks it already covers.
//   2. Require a real signal — e.g. a slab AND plumbing being moved, or a
//      subfloor mentioned with NO subfloor line item — not just one stray word
//      like "slab" in standard demolition language.

// The work actually described — excludes exclusions/terms on purpose.
function scopeText(q: ReviewQuote): string {
  const lines = (q.items || []).map((it) => `${it.description || ""} ${it.detail || ""}`).join("\n");
  return norm([q.projectName, q.reference, q.scopeDescription, q.introNote, lines].filter(Boolean).join("\n"));
}
function itemsText(q: ReviewQuote): string {
  return norm((q.items || []).map((it) => `${it.description || ""} ${it.detail || ""}`).join("\n"));
}

// Do the terms/exclusions already cover unforeseen / concealed conditions? If so
// we don't nag about adding an exclusion for hidden damage — it's handled.
function coversUnforeseen(q: ReviewQuote): boolean {
  const t = norm([q.terms, q.exclusions].filter(Boolean).join("\n"));
  if (!t) return false;
  return /unfor[e]?seen|concealed|conceal|latent|hidden|unknown condition|not visible|behind the wall|once (we )?open|provisional sum|subject to (further )?inspection/.test(t);
}

export function detectScopeFlags(q: ReviewQuote): KeywordFlag[] {
  const scope = scopeText(q);
  if (!scope) return [];
  const items = itemsText(q);
  const has = (arr: string[]) => arr.some((p) => scope.includes(norm(p)));
  const itemsHave = (arr: string[]) => arr.some((p) => items.includes(norm(p)));
  const covered = coversUnforeseen(q);
  const out: KeywordFlag[] = [];

  // 1) Concrete slab AND plumbing being moved → genuine added cost. A slab on
  //    its own (e.g. "grind slab" in standard demo) is NOT flagged.
  const slab = has(["concrete slab", "on a slab", "on slab", "slab-on-ground", "slab on ground"]);
  const movingPlumbing = has(["relocate", "move the toilet", "move toilet", "moving the toilet", "move plumbing", "moving plumbing", "new plumbing point", "add a plumbing point", "reposition", "move the vanity", "move the basin", "move the shower", "move the floor waste", "relocate floor waste", "shift the"]);
  if (slab && movingPlumbing)
    out.push({ id: "slab_plumbing", phrase: "concrete slab + moved plumbing", label: "Slab + moved plumbing", note: "Moving plumbing through a concrete slab usually adds real cost (cutting/coring + make-good). Make sure that's allowed for.", severity: "high" });

  // 2) Subfloor mentioned in the scope but NO subfloor line item → likely a
  //    genuine omission.
  const subfloorMentioned = has(["subfloor", "sub-floor", "sub floor", "replace subfloor", "floor structure", "bearers and joists"]);
  const subfloorLined = itemsHave(["subfloor", "sub-floor", "sub floor", "floor structure", "bearer", "joist"]);
  if (subfloorMentioned && !subfloorLined)
    out.push({ id: "subfloor", phrase: "subfloor", label: "Subfloor — is it quoted?", note: "The scope mentions the subfloor but there's no subfloor line item. If it needs replacing/repairing, add a line so it isn't absorbed.", severity: "high" });

  // 3) Structural / wall removal → a real risk. Unambiguous structural words
  //    always flag; a generic "remove … wall" only flags when it ISN'T about
  //    removing wall LINING/tiles/sheets/cladding (standard demo, not structural).
  const structuralWords = has(["structural", "load bearing", "load-bearing", "lintel", "rsj", "steel beam", "remove a wall", "removing a wall", "remove dividing wall", "knock out wall", "knock down wall"]);
  const wallRemoval = /\b(remove|removing|knock out|knock down|take out|demolish)\b[^.]{0,20}\bwall\b/.test(scope);
  const wallLiningContext = /\bwall\b[^.]{0,14}\b(lining|linings|tile|tiles|sheet|sheets|cladding|render|paper|paint)\b/.test(scope);
  if (structuralWords || (wallRemoval && !wallLiningContext))
    out.push({ id: "structural", phrase: "wall removal / structural", label: "Structural / wall removal", note: "Removing a wall can need an engineer + lintel/beam. Confirm structural work is scoped and priced.", severity: "high" });

  // 4) Asbestos named in the WORK scope (not just a terms clause) and not a
  //    priced line → needs its own licensed removal line.
  if (has(["asbestos", "fibro sheet", "fibro lining"]) && !itemsHave(["asbestos"]))
    out.push({ id: "asbestos", phrase: "asbestos", label: "Asbestos", note: "Asbestos needs licensed removal + disposal as its own priced line — don't fold it into general demo.", severity: "high" });

  // 5) EXISTING damage explicitly noted in the scope AND the terms don't cover
  //    unforeseen conditions → suggest a provisional sum / clause. (Standard demo
  //    with no damage words won't fire; if the terms already cover it, we stay
  //    quiet — it's handled.)
  const damageNoted = has(["rotten", "water damage", "water-damaged", "water damaged", "active leak", "existing leak", "termite damage", "white ant damage", "previous water"]);
  if (damageNoted && !covered)
    out.push({ id: "unforeseen", phrase: "existing damage noted", label: "Existing damage noted", note: "The scope notes existing damage, but your terms don't appear to cover unforeseen/concealed conditions. Add a provisional sum or an unforeseen-conditions clause so extra work isn't on you.", severity: "medium" });

  // 6) Second storey / upstairs → access + extra labour worth a check.
  if (has(["second storey", "second story", "second floor", "upstairs", "level 2"]))
    out.push({ id: "upstairs", phrase: "upstairs / second storey", label: "Upstairs / second storey", note: "Upstairs work usually means harder access + more labour/waterproofing — check it's reflected in the price.", severity: "medium" });

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
