// Per-CREATIVE (individual ad) analysis — the level a good media buyer actually
// optimises at. Pure functions, no I/O. Uses the same account-calibrated targets
// as the set-level brain (verdict.ts) but adds frequency-based creative-fatigue
// detection and ranks the ads within a set to name the winners and losers.
//
// Deterministic backbone: these flags + diagnosis/recommendation strings are
// always produced from the numbers, so the UI has a complete answer even when
// the AI enrichment is unavailable.
import type { AdNode } from "@/lib/integrations/meta/insights";
import type { ResolvedTargets } from "@/lib/meta/verdict";

// Average times a person has seen the creative. Meta's own rule of thumb: past
// ~3 the audience is over-served and performance decays; past ~4.5 it's burnt.
export const FREQ_OVEREXPOSED = 3;
export const FREQ_BURNT = 4.5;

export type CreativeFlag = "winner" | "scale" | "refresh" | "rework" | "retire" | "learning" | "hold";
export type CreativeAction = "keep" | "scale" | "refresh" | "rework" | "pause" | "watch";

export interface CreativeMetrics {
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  ctr: number; // %
  leads: number;
  cpl: number | null; // cost per lead (AUD); null when no leads yet
}

export interface CreativeInsight {
  id: string;
  name: string;
  status: string | null;
  metrics: CreativeMetrics;
  flag: CreativeFlag;
  action: CreativeAction;
  rank: number | null; // 1 = best cost-per-lead in the set (ads with leads only)
  isTop: boolean; // clear winner of the set
  isWorst: boolean; // worst performer among those with signal
  headline: string; // short deterministic label, e.g. "Overexposed — refresh"
  diagnosis: string; // plain-English what's happening (deterministic baseline)
  recommendation: string; // specific action (deterministic baseline)
  // Filled by the AI enrichment (optional):
  working?: string; // what's working about a winner (style/angle to repeat)
  change?: string; // what to change on a loser
}

const round = (n: number) => Math.round(n);
const money = (n: number, ccy = "AUD") => {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(Number(n) || 0); }
  catch { return "$" + round(Number(n) || 0); }
};
const f2 = (n: number) => (Number(n) || 0).toFixed(1);

function classify(a: AdNode, cpl: number | null, hasSignal: boolean, isTop: boolean, isWorst: boolean, t: ResolvedTargets, ccy: string): Pick<CreativeInsight, "flag" | "action" | "headline" | "diagnosis" | "recommendation"> {
  const freq = a.frequency || 0;
  const overexposed = freq >= FREQ_OVEREXPOSED;
  const burnt = freq >= FREQ_BURNT;
  const cplStr = cpl != null ? `${money(cpl, ccy)}/lead` : "no leads yet";

  // Not enough signal → leave it alone.
  if (!hasSignal) {
    return { flag: "learning", action: "watch", headline: "Still learning", diagnosis: `${money(a.spend, ccy)} spent, ${a.leads} lead${a.leads === 1 ? "" : "s"} — not enough signal to judge this creative yet.`, recommendation: "Leave it running while Meta learns; check back once it has more data." };
  }

  // Spent with no leads → kill it.
  if (a.leads === 0 && a.spend > t.zeroLeadSpend) {
    return { flag: "retire", action: "pause", headline: "Not converting", diagnosis: `${money(a.spend, ccy)} spent and 0 leads${overexposed ? `, frequency ${f2(freq)}` : ""} — this creative isn't pulling enquiries.`, recommendation: "Pause it and put the budget behind a creative that's working." };
  }

  const winnerCpl = cpl != null && cpl <= t.healthyCpl;
  const okCpl = cpl != null && cpl <= t.concerningCpl;

  // Winner (healthy cost per lead).
  if (winnerCpl) {
    if (burnt) return { flag: "refresh", action: "refresh", headline: "Winner — but overexposed", diagnosis: `Strong: leads at ${cplStr}, but frequency is ${f2(freq)} — the audience has seen it too many times.`, recommendation: "This creative WORKS — keep the style/angle, but refresh it (new cut or a fresh audience) before fatigue kills performance." };
    if (overexposed) return { flag: "refresh", action: "refresh", headline: "Working — watch fatigue", diagnosis: `Performing at ${cplStr}, but frequency ${f2(freq)} is creeping up (over-served).`, recommendation: "It's working — line up a refresh (new cut/angle or widen the audience) so it doesn't fatigue." };
    if (isTop) return { flag: "winner", action: "keep", headline: "Top performer", diagnosis: `Best cost per lead in the set at ${cplStr}, frequency ${f2(freq)} (healthy) — this is your winner.`, recommendation: "Double down: put more budget here and make more creatives in this style/angle." };
    return { flag: "scale", action: "scale", headline: "Working — room to scale", diagnosis: `${cplStr}, frequency ${f2(freq)} (healthy) — delivering with headroom.`, recommendation: "Push more budget behind this one; it can take more." };
  }

  // Middle (acceptable cost per lead).
  if (okCpl) {
    if (burnt) return { flag: "retire", action: "pause", headline: "Burnt out", diagnosis: `Frequency ${f2(freq)} and ${cplStr} — over-served and no longer efficient.`, recommendation: "Retire it — it's had its run." };
    if (overexposed) return { flag: "refresh", action: "refresh", headline: "Overexposed — refresh", diagnosis: `${cplStr} but frequency ${f2(freq)} — the audience has seen it too often.`, recommendation: "Refresh the creative or widen the audience before the cost per lead climbs." };
    return { flag: "hold", action: "watch", headline: "Holding", diagnosis: `${cplStr}, frequency ${f2(freq)} — around target.`, recommendation: "Hold and keep watching." };
  }

  // Loser (cost per lead over the concerning mark, or leads but dear).
  if (!overexposed) {
    return { flag: "rework", action: "rework", headline: "Fresh but not landing", diagnosis: `${a.impressions.toLocaleString()} impressions at frequency ${f2(freq)} (still fresh) but ${cplStr} — the hook/creative isn't landing.`, recommendation: "The angle isn't working — rework the hook, or pause and try a different creative." };
  }
  return { flag: "retire", action: "pause", headline: "Overexposed & dear", diagnosis: `Frequency ${f2(freq)} and ${cplStr}, over your target — over-served and expensive.`, recommendation: "Pause it and redeploy the spend to a winner." };
}

// Analyse every ad within a set. Ranks by cost per lead (ads with leads) to
// surface the clear winner and the worst performer.
export function analyseCreatives(ads: AdNode[], t: ResolvedTargets, currency = "AUD"): CreativeInsight[] {
  const rows = (ads || []).map((a) => ({
    a,
    cpl: a.leads > 0 ? a.spend / a.leads : null,
    hasSignal: a.spend >= t.learningMinSpend || a.leads >= t.learningMinLeads,
  }));
  const ranked = rows.filter((r) => r.cpl != null && r.hasSignal).sort((x, y) => (x.cpl! - y.cpl!));
  const rankMap = new Map<string, number>();
  ranked.forEach((r, i) => rankMap.set(r.a.id, i + 1));
  const bestId = ranked[0]?.a.id;
  const worstId = ranked.length > 1 ? ranked[ranked.length - 1].a.id : undefined;

  return rows.map(({ a, cpl, hasSignal }) => {
    const isTop = a.id === bestId && cpl != null && cpl <= t.concerningCpl;
    const isWorst = a.id === worstId;
    const c = classify(a, cpl, hasSignal, isTop, isWorst, t, currency);
    return {
      id: a.id,
      name: a.name,
      status: a.status,
      metrics: { spend: a.spend, impressions: a.impressions, reach: a.reach, frequency: a.frequency, ctr: a.ctr, leads: a.leads, cpl },
      rank: rankMap.get(a.id) ?? null,
      isTop,
      isWorst,
      ...c,
    };
  });
}

// Plain-English winners/losers line for the set (deterministic — also the AI
// fallback so there's always a summary).
export function creativeSetSummary(insights: CreativeInsight[]): string {
  if (!insights.length) return "No ads in this set yet.";
  const names = (arr: CreativeInsight[]) => arr.map((i) => i.name).join(", ");
  const winners = insights.filter((i) => i.flag === "winner" || i.flag === "scale");
  const refresh = insights.filter((i) => i.flag === "refresh");
  const cut = insights.filter((i) => i.flag === "retire" || i.flag === "rework");
  const parts: string[] = [];
  if (winners.length) parts.push(`Winner${winners.length > 1 ? "s" : ""}: ${names(winners)} — keep and make more like this.`);
  if (refresh.length) parts.push(`Overexposed, refresh: ${names(refresh)}.`);
  if (cut.length) parts.push(`Pause/rework: ${names(cut)}.`);
  if (!parts.length) return "Still gathering signal — nothing to change yet.";
  return parts.join(" ");
}

export const FLAG_META: Record<CreativeFlag, { label: string; cls: string }> = {
  winner: { label: "Winner", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  scale: { label: "Scale", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  refresh: { label: "Refresh", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  rework: { label: "Rework", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  retire: { label: "Retire", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
  learning: { label: "Learning", cls: "border-slate-600/50 bg-slate-700/30 text-slate-300" },
  hold: { label: "Hold", cls: "border-slate-600/50 bg-slate-700/30 text-slate-300" },
};
