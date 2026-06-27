import { verdictFor, consolidationTip, type NodeInput } from "@/lib/meta/verdict";
import type { CoachSnapshot, CoachAdset } from "./snapshot";

// The deterministic "what an elite media buyer flags" layer. Pure functions over
// the snapshot, reusing Hazel's brain (verdictFor/consolidationTip) so the facts
// + actions are correct and carry REAL Meta entity ids for the scale/pause
// buttons. The AI layer then prioritises, phrases and adds judgement on top.

export interface CoachSignal {
  id: string;
  severity: "high" | "medium" | "low";
  area: string;
  title: string; // the fact / what
  detail: string; // why it matters + the recommended move, plain English
  action?: { type: "budget" | "pause"; level: "adset" | "ad"; id: string; name: string; dailyMinor?: number; label?: string };
}

const isActive = (s?: string | null) => !s || /ACTIVE/i.test(s);

export function computeSignals(s: CoachSnapshot): CoachSignal[] {
  const out: CoachSignal[] = [];
  const t = s.targets;
  const m = s.meta;

  if (!m.connected) {
    out.push({ id: "connect-meta", severity: "high", area: "Setup", title: "Meta isn't connected yet", detail: "Hazel can only coach your ads once your Meta ad account is connected. Connect it in Settings → Integrations." });
    return out;
  }
  if (m.reconnect) {
    out.push({ id: "reconnect-meta", severity: "high", area: "Setup", title: "Your Meta connection expired", detail: "Reconnect Meta in Settings → Integrations so Hazel can read your live ad performance again." });
    return out;
  }

  const toInput = (a: CoachAdset): NodeInput => ({
    level: "adset", status: a.status, spend: a.spend, leads: a.leads, ctr: a.ctr,
    dailyBudgetMinor: a.dailyBudgetMinor, updatedTime: a.updatedTime, costPerWon: null, wonJobs: 0,
  });

  // Per-ad-set verdicts: winners to scale, losers to pause (real entity ids).
  for (const a of m.adsets) {
    if (a.status && !isActive(a.status)) continue;
    const v = verdictFor(toInput(a), t);
    if (v.kind === "scale" && v.action?.type === "budget" && v.action.figureMinor) {
      out.push({ id: `scale-${a.id}`, severity: "high", area: "Scaling", title: `"${a.name}" is winning — ready to scale`, detail: v.reason, action: { type: "budget", level: "adset", id: a.id, name: a.name, dailyMinor: v.action.figureMinor, label: v.action.figureLabel } });
    } else if (v.kind === "pause") {
      out.push({ id: `pause-${a.id}`, severity: "high", area: "Cut waste", title: `"${a.name}" is over the line — pause it`, detail: v.reason, action: { type: "pause", level: "adset", id: a.id, name: a.name } });
    }
  }

  // Too few ads running.
  if (m.activeAds === 0) {
    out.push({ id: "no-ads", severity: "high", area: "Coverage", title: "No ads are running right now", detail: "Nothing is live, so no leads are coming from Meta. Launch at least one ad — ideally 3–5 to test — from the Ad Creator." });
  } else if (m.activeAds === 1) {
    out.push({ id: "one-ad", severity: "medium", area: "Creative testing", title: "You're running only 1 ad", detail: "Top media buyers test 3–5 ads at once and let the winner emerge. With one ad you can never find a better one. Add 2–4 variations." });
  }

  // No creative variety to test.
  const singleCreative = m.adsets.filter((a) => isActive(a.status) && a.activeAdCount === 1);
  if (singleCreative.length && m.activeAds <= 2) {
    out.push({ id: "no-variety", severity: "medium", area: "Creative testing", title: "No creative variety to test", detail: "Your ad set is running a single creative. Add 2–3 different images/videos/angles so Meta can find the best performer." });
  }

  // Ad fatigue (rising frequency).
  const fatigued = m.adsets.filter((a) => isActive(a.status) && a.frequency >= 2.6).sort((x, y) => y.frequency - x.frequency)[0];
  if (fatigued) {
    out.push({ id: `fatigue-${fatigued.id}`, severity: "medium", area: "Ad fatigue", title: `"${fatigued.name}" may be fatiguing`, detail: `People have seen it ${fatigued.frequency.toFixed(1)} times on average. When the same people see an ad too often, results drop and cost rises — refresh it with a new image/video.` });
  }

  // Budget too low to exit Meta's learning phase.
  for (const a of m.adsets) {
    if (!isActive(a.status) || !a.dailyBudgetMinor) continue;
    const weekly = (a.dailyBudgetMinor / 100) * 7;
    const canBuyLeads = t.healthyCpl > 0 ? weekly / t.healthyCpl : 0;
    if (canBuyLeads < t.learningMinLeads) {
      out.push({ id: `low-budget-${a.id}`, severity: "medium", area: "Budget", title: `"${a.name}" budget may be too low to learn`, detail: `At $${Math.round(a.dailyBudgetMinor / 100)}/day (~$${Math.round(weekly)}/week) and ~$${t.healthyCpl}/lead, it can't gather enough leads for Meta to optimise. Raise the budget or consolidate spend into fewer ad sets.` });
      break;
    }
  }

  // Spread too thin at low volume.
  const consTip = consolidationTip(m.adsets.map((a) => ({ name: a.name, leads: a.leads, spend: a.spend, status: a.status })), t);
  if (consTip) out.push({ id: "consolidate", severity: "medium", area: "Budget", title: "Spend is spread too thin", detail: consTip });

  // Leads not converting to jobs.
  if (s.leads.won === 0 && s.leads.total >= 8) {
    out.push({ id: "no-jobs", severity: "high", area: "Lead quality", title: "Leads aren't turning into jobs yet", detail: `You've had ${s.leads.total} leads but no won jobs recorded. That points to lead quality or follow-up, not just ad volume — tighten targeting/offer and make sure every lead is called fast (Speed to Lead).` });
  }

  // Week-on-week swing.
  if (s.weekly && s.weekly.leadsDeltaPct != null) {
    if (s.weekly.direction === "down") {
      out.push({ id: "week-down", severity: "high", area: "Trend", title: `Leads down ${Math.abs(s.weekly.leadsDeltaPct)}% on last week`, detail: `${s.weekly.last.leads} → ${s.weekly.this.leads} leads. Often a sign the ads are fatiguing or a winner was changed — test a fresh creative and check nothing was edited mid-flight.` });
    } else if (s.weekly.direction === "up") {
      out.push({ id: "week-up", severity: "low", area: "Trend", title: `Leads up ${s.weekly.leadsDeltaPct}% on last week`, detail: `${s.weekly.last.leads} → ${s.weekly.this.leads} leads. Good momentum — this is the time to scale your winning ad set (+${t.budgetStepPct}%) and add a couple of fresh variations.` });
    }
  }

  // Currency / billing mismatch.
  if (m.currency && m.currency !== "AUD") {
    out.push({ id: "currency", severity: "medium", area: "Billing", title: `Your ad account bills in ${m.currency}, not AUD`, detail: `For an Australian business that's worth fixing — it makes every cost figure harder to read and can add FX cost. Check the ad account currency in Meta Business settings.` });
  }

  // Honest data-sufficiency note.
  if (s.confidence === "early") {
    out.push({ id: "early-data", severity: "low", area: "Data", title: "Still an early read on your account", detail: "Not much spend or leads yet, so Hazel is leaning on proven home-reno benchmarks. The advice sharpens and personalises as your real numbers build — don't over-react to small swings." });
  }

  return out;
}

const RANK = { high: 0, medium: 1, low: 2 } as const;

export function prioritise(signals: CoachSignal[], limit?: number): CoachSignal[] {
  const sorted = signals.slice().sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return limit ? sorted.slice(0, limit) : sorted;
}
