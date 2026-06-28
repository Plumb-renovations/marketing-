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
  link?: { href: string; label: string }; // non-Meta nudge → navigate (call/draft/post)
}

const isActive = (s?: string | null) => !s || /ACTIVE/i.test(s);
const money = (n: number) => "$" + Math.round(n).toLocaleString();
const daysSince = (iso?: string | null) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
};

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

  // ---- Brutal honesty: money in, nothing out -------------------------------
  // Real spend, zero won jobs → say it plainly (this is the truth most tools
  // won't tell). Spend-based, so it fires even at low lead volume.
  const moneyWasted = m.account.spend >= 300 && s.leads.won === 0;
  if (moneyWasted) {
    out.push({
      id: "money-wasted",
      severity: "high",
      area: "What's not working",
      title: `You've spent ${money(m.account.spend)} on Meta and won 0 jobs`,
      detail: `${m.account.leads} lead${m.account.leads === 1 ? "" : "s"} so far, none converted to a job. The likely culprits are lead quality (targeting/offer), or leads going cold before you call. The honest options: tighten the offer + targeting, call every lead within minutes (Speed to Lead), or pause the spend until the funnel converts — don't keep paying for leads that don't become jobs.`,
      link: { href: "/coach", label: "See the plan" },
    });
  } else if (s.leads.won === 0 && s.leads.total >= 8) {
    // Leads but no jobs (lower spend) — still flag the conversion gap.
    out.push({ id: "no-jobs", severity: "high", area: "Lead quality", title: "Leads aren't turning into jobs yet", detail: `You've had ${s.leads.total} leads but no won jobs recorded. That points to lead quality or follow-up, not just ad volume — tighten targeting/offer and make sure every lead is called fast (Speed to Lead).` });
  }

  // Spending more, getting fewer leads — the worst combination, said plainly.
  if (s.weekly && s.weekly.spendDeltaPct != null && s.weekly.spendDeltaPct >= 15 && s.weekly.leadsDeltaPct != null && s.weekly.leadsDeltaPct <= -10) {
    out.push({
      id: "spend-up-leads-down",
      severity: "high",
      area: "What's not working",
      title: `Spend is up ${s.weekly.spendDeltaPct}% but leads are down ${Math.abs(s.weekly.leadsDeltaPct)}%`,
      detail: `${money(s.weekly.last.spend)}→${money(s.weekly.this.spend)} for ${s.weekly.last.leads}→${s.weekly.this.leads} leads. You're paying more for less — usually ad fatigue or a winner that got changed. Refresh the creative and check nothing was edited mid-flight; if it doesn't recover, pull the budget back.`,
      link: { href: "/meta", label: "Open Meta" },
    });
  }

  // ---- Proactive nudges (no Meta write — a navigate action) ----------------
  // Uncalled new leads — speed-to-lead is where jobs are won or lost.
  if (s.leads.new >= 1) {
    out.push({
      id: "uncalled-leads",
      severity: s.leads.new >= 2 ? "high" : "medium",
      area: "Hot leads",
      title: `${s.leads.new} new lead${s.leads.new === 1 ? "" : "s"} awaiting first contact`,
      detail: `Leads called within ~5 minutes convert far better than ones left for hours. ${s.leads.new === 1 ? "This lead hasn't" : "These leads haven't"} been actioned yet — call now while ${s.leads.new === 1 ? "it's" : "they're"} hot.`,
      link: { href: "/leads", label: "Open leads" },
    });
  }

  // Haven't posted in a while — visibility decays without organic activity.
  const sincePost = daysSince(s.lastPostedAt);
  if (s.lastPostedAt == null) {
    out.push({ id: "stale-posting", severity: "low", area: "Organic", title: "You haven't published an organic post yet", detail: "Regular organic posts keep you visible and build trust between ad campaigns. Hazel can plan + write a month for you.", link: { href: "/calendar", label: "Plan posts" } });
  } else if (sincePost != null && sincePost >= 7) {
    out.push({ id: "stale-posting", severity: "medium", area: "Organic", title: `Haven't posted in ${sincePost} days`, detail: "Your feed's gone quiet — engagement and reach drop off when you stop posting. Hazel has ready-to-go posts; approve one to stay visible.", link: { href: "/calendar", label: "Plan a post" } });
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
