// Hazel's media-buying brain. Pure functions — no I/O. Encodes built-in
// best-practice defaults (the user never sets thresholds), auto-calibrates the
// guard rails from THIS account's own data, and turns the numbers into a
// plain-English Scale / Hold / Pause / Still-learning verdict for a tradie.

// ---- Hazel's built-in home-reno defaults (dollars) -------------------------
export const DEFAULTS = {
  healthyCpl: 150, // under this cost-per-lead is healthy
  concerningCpl: 350, // over this → pause
  zeroLeadSpend: 200, // spent this much with 0 leads → pause
  learningMinSpend: 100, // below this $ there's no real signal yet
  learningMinLeads: 5, // below this many leads there's no real signal yet
  learningTargetResults: 50, // Meta exits the learning phase ~50 results/wk
  changeFreezeDays: 4, // don't re-judge a budget change for ~4 days
  budgetStepPct: 25, // scale in +25% steps, never double
};

export interface TargetOverrides {
  targetCpl?: number | null;
  concerningCpl?: number | null;
  targetCostPerWon?: number | null;
  budgetStepPct?: number | null;
}

export interface ResolvedTargets {
  healthyCpl: number;
  concerningCpl: number;
  zeroLeadSpend: number;
  learningMinSpend: number;
  learningMinLeads: number;
  learningTargetResults: number;
  changeFreezeDays: number;
  budgetStepPct: number;
  targetCostPerWon: number | null;
  recalibrated: boolean; // true once this account's own data has moved the rails
  basis: string; // human note on how the rails were set
}

const round = (n: number) => Math.round(n);

// Blend Hazel's default with the account's observed cost-per-lead. The more
// leads the account has produced, the more the rails reflect THIS business
// (capped so defaults still anchor early).
export function calibrateTargets(
  account: { spend: number; leads: number; costPerWon: number | null },
  overrides?: TargetOverrides,
): ResolvedTargets {
  const observedCpl = account.leads > 0 ? account.spend / account.leads : null;
  const w = Math.max(0, Math.min(0.75, account.leads / 50)); // 0 → 0.75 as leads grow
  const blendedHealthy = observedCpl != null ? DEFAULTS.healthyCpl * (1 - w) + observedCpl * w : DEFAULTS.healthyCpl;

  const healthyCpl = overrides?.targetCpl ?? round(blendedHealthy);
  const concerningCpl = overrides?.concerningCpl ?? round(Math.max(DEFAULTS.concerningCpl, healthyCpl * (DEFAULTS.concerningCpl / DEFAULTS.healthyCpl)));
  const zeroLeadSpend = round(Math.max(DEFAULTS.zeroLeadSpend, healthyCpl * 1.3));
  const recalibrated = observedCpl != null && account.leads >= 10;

  return {
    healthyCpl,
    concerningCpl,
    zeroLeadSpend,
    learningMinSpend: DEFAULTS.learningMinSpend,
    learningMinLeads: DEFAULTS.learningMinLeads,
    learningTargetResults: DEFAULTS.learningTargetResults,
    changeFreezeDays: DEFAULTS.changeFreezeDays,
    budgetStepPct: overrides?.budgetStepPct ?? DEFAULTS.budgetStepPct,
    targetCostPerWon: overrides?.targetCostPerWon ?? account.costPerWon,
    recalibrated,
    basis: recalibrated
      ? `Auto-tuned from your account: ~${account.leads} leads at $${round(observedCpl || 0)}/lead so far.`
      : `Hazel's home-reno starting targets — they'll re-tune to your account as leads build up.`,
  };
}

export type VerdictKind = "scale" | "hold" | "pause" | "learning";

export interface NodeInput {
  level: "campaign" | "adset" | "ad";
  status?: string | null; // effective_status
  spend: number;
  leads: number;
  ctr: number; // %
  dailyBudgetMinor?: number | null; // adset budget, minor units (cents)
  updatedTime?: string | null; // Meta last-edit time
  costPerWon?: number | null; // when won-job data is attributed
  wonJobs?: number;
}

export interface Verdict {
  kind: VerdictKind;
  label: string;
  reason: string;
  basisNote: string; // "Judging on cost per won job" vs "...cost per lead"
  action?: { type: "budget" | "pause"; figureMinor?: number; figureLabel?: string };
}

const dollars = (n: number) => `$${round(n).toLocaleString()}`;
const daysSince = (iso?: string | null) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
};

// Suggested new daily budget (minor units) from the +step% rule.
export function suggestDailyBudget(currentMinor: number, stepPct: number): number {
  return Math.round(currentMinor * (1 + stepPct / 100));
}

const delivering = (status?: string | null) => !status || /ACTIVE/i.test(status);

export function verdictFor(m: NodeInput, t: ResolvedTargets): Verdict {
  const cpl = m.leads > 0 ? m.spend / m.leads : Infinity;
  const useWon = m.costPerWon != null && (m.wonJobs || 0) > 0 && t.targetCostPerWon != null;
  const basisNote = useWon
    ? `Judging on cost per WON job ($${round(m.costPerWon!)}) — your real jobs from this ${m.level}.`
    : (m.costPerWon != null && (m.wonJobs || 0) > 0
        ? `Cost per won job is $${round(m.costPerWon!)}; judging on cost per lead until there's a won-job target.`
        : `Judging on cost per lead — no won-job data for this ${m.level} yet.`);

  // 1) Not enough signal → leave it alone (respect the learning phase).
  if (m.spend < t.learningMinSpend || m.leads < t.learningMinLeads) {
    const why = m.leads < t.learningMinLeads
      ? `only ${m.leads} lead${m.leads === 1 ? "" : "s"} so far`
      : `only ${dollars(m.spend)} spent`;
    return {
      kind: "learning",
      label: "Still learning",
      reason: `${dollars(m.spend)} spent, ${m.leads} lead${m.leads === 1 ? "" : "s"} — ${why}. Too early to judge; leave it alone while Meta learns.`,
      basisNote,
    };
  }

  // 2) Clear losers → pause.
  if (m.leads === 0 && m.spend > t.zeroLeadSpend) {
    return {
      kind: "pause",
      label: "Pause",
      reason: `${dollars(m.spend)} spent, 0 leads — switch this off and put the budget into a winner.`,
      basisNote,
      action: { type: "pause" },
    };
  }
  if (useWon ? m.costPerWon! > t.targetCostPerWon! * 2 : cpl > t.concerningCpl) {
    return {
      kind: "pause",
      label: "Pause",
      reason: useWon
        ? `$${round(m.costPerWon!)}/won job, well over your ~${dollars(t.targetCostPerWon!)} target — pause it.`
        : `${dollars(cpl)}/lead, over the ~${dollars(t.concerningCpl)} concerning mark — pause and redeploy the spend.`,
      basisNote,
      action: { type: "pause" },
    };
  }

  // 3) Don't touch a recent change — let learning settle.
  const dsc = daysSince(m.updatedTime);
  if (dsc != null && dsc < t.changeFreezeDays) {
    return {
      kind: "hold",
      label: "Hold",
      reason: `Changed ${dsc} day${dsc === 1 ? "" : "s"} ago — leave it ~${t.changeFreezeDays} days so Meta can finish re-learning before we judge it.`,
      basisNote,
    };
  }

  const inLearningPhase = m.leads < t.learningTargetResults;

  // 4) Winners → scale gradually.
  const isWinner = useWon ? m.costPerWon! < t.targetCostPerWon! : cpl < t.healthyCpl;
  if (isWinner && delivering(m.status)) {
    const canBudget = m.level === "adset" && m.dailyBudgetMinor && m.dailyBudgetMinor > 0;
    const newMinor = canBudget ? suggestDailyBudget(m.dailyBudgetMinor!, t.budgetStepPct) : undefined;
    const figureLabel = newMinor ? `${dollars(newMinor / 100)}/day` : undefined;
    return {
      kind: "scale",
      label: "Scale",
      reason: useWon
        ? `$${round(m.costPerWon!)}/won job, under your ~${dollars(t.targetCostPerWon!)} target and still delivering — scale gradually (+${t.budgetStepPct}%).${inLearningPhase ? " Still early, so step up slowly." : ""}`
        : `${dollars(cpl)}/lead, under your ~${dollars(t.healthyCpl)} target and still delivering — scale gradually (+${t.budgetStepPct}%). Big jumps reset Meta's learning.`,
      basisNote,
      action: canBudget
        ? { type: "budget", figureMinor: newMinor, figureLabel }
        : undefined,
    };
  }

  // 5) Otherwise hold.
  return {
    kind: "hold",
    label: "Hold",
    reason: useWon
      ? `$${round(m.costPerWon!)}/won job, around your ~${dollars(t.targetCostPerWon!)} target — hold and keep watching.`
      : `${dollars(cpl)}/lead, around your ~${dollars(t.healthyCpl)} target — hold and keep watching.${inLearningPhase ? ` Still in Meta's learning phase (${m.leads}/${t.learningTargetResults} results).` : ""}`,
    basisNote,
  };
}

// Account-level coaching: at low volume, concentrate spend rather than spreading.
export function consolidationTip(
  adsets: { name: string; leads: number; spend: number; status?: string | null }[],
  t: ResolvedTargets,
): string | null {
  const active = adsets.filter((a) => delivering(a.status));
  const totalLeads = active.reduce((s, a) => s + a.leads, 0);
  if (active.length >= 3 && totalLeads < t.learningTargetResults) {
    const best = active.slice().sort((a, b) => {
      const ca = a.leads > 0 ? a.spend / a.leads : Infinity;
      const cb = b.leads > 0 ? b.spend / b.leads : Infinity;
      return ca - cb;
    })[0];
    return `You're spread across ${active.length} ad sets at low volume (${totalLeads} leads total). Meta optimises far better with concentrated signal — consider consolidating spend into "${best?.name || "your best ad set"}" so it can exit the learning phase.`;
  }
  return null;
}
