import { CADENCE, lossLabel, type JourneyLead, type JourneyStage } from "./model";

// The deterministic sales-manager brain: what to do next on a deal, how fast
// the user responded, when a quote's gone cold, targeted loss advice, and
// win/loss patterns over time. Pure functions — the AI layer adds the wording
// (suggested messages, briefings) on top.

const MIN = 60_000;
const DAY = 86_400_000;
const ms = (iso?: string | null) => (iso ? Date.parse(iso) : NaN);

// Map the existing board stage onto a journey stage when the finer one is unset.
export function effectiveStage(l: JourneyLead): JourneyStage {
  if (l.journeyStage) return l.journeyStage;
  switch (l.stage) {
    case "qualified": return "qualified";
    // A lead sitting in the board's Quotes column HAS had a quote sent —
    // whether via the quote builder, a branded quote, or a board move — even if
    // quote_sent_at wasn't stamped. Treat it as quote_sent so the cadence runs.
    case "quote": return "quote_sent";
    case "won": return "won";
    case "lost": return "lost";
    default: return l.contactedAt ? "contacted" : "new";
  }
}

// Minutes from lead arriving to first contact (speed-to-contact — the big lever).
export function speedToContactMinutes(l: JourneyLead): number | null {
  const start = ms(l.createdAt) || ms(l.leadDate);
  const contact = ms(l.contactedAt);
  if (isNaN(start) || isNaN(contact)) return null;
  return Math.max(0, Math.round((contact - start) / MIN));
}

export function speedLabel(mins: number | null): string {
  if (mins == null) return "not contacted yet";
  if (mins < 60) return `${mins} min`;
  if (mins < 1440) return `${Math.round(mins / 60)} hr`;
  return `${Math.round(mins / 1440)} day${mins >= 2880 ? "s" : ""}`;
}

// The next cadence step due for a sent quote (or null if none/exhausted).
// Falls back to last-touch / lead-date as the cadence base when quote_sent_at
// wasn't stamped (e.g. a quote sent via the builder or a board move), so the
// follow-up cadence still runs.
export function cadenceFor(l: JourneyLead): { step: number; dueAt: number; tone: string; channel: "text" | "call" } | null {
  if (effectiveStage(l) !== "quote_sent" && effectiveStage(l) !== "following_up") return null;
  const sent = [l.quoteSentAt, l.lastTouchAt, l.leadDate].map(ms).find((n) => !isNaN(n));
  if (sent == null) return null;
  const step = Math.min(l.followupStep ?? 0, CADENCE.length - 1);
  const c = CADENCE[step];
  if (!c) return null;
  return { step, dueAt: sent + c.day * DAY, tone: c.tone, channel: c.channel };
}

// State of a lead's booked quote visit (pure, timezone-agnostic — works off the
// stored ISO timestamp). "soon" = within ~90 min before the start through ~3 hr
// after (i.e. it's happening / about to); "upcoming" = further out; "past" =
// well after the start (visit done, time to quote). Day/time LABELS are left to
// the UI so they render in the viewer's local timezone.
export type VisitState = "none" | "soon" | "upcoming" | "past";
export function visitState(l: JourneyLead, now = Date.now()): { state: VisitState; minsUntil: number | null } {
  const t = ms(l.visitAt);
  if (isNaN(t)) return { state: "none", minsUntil: null };
  const minsUntil = Math.round((t - now) / MIN);
  if (minsUntil < -180) return { state: "past", minsUntil };
  if (minsUntil <= 90) return { state: "soon", minsUntil };
  return { state: "upcoming", minsUntil };
}

export interface NextAction {
  kind: string;
  title: string;
  detail: string;
  channel: "call" | "text" | "visit" | "none";
  urgency: "now" | "soon" | "later" | "done";
}

// What Hazel would tell the user to do RIGHT NOW on this specific deal.
export function nextActionFor(l: JourneyLead, now = Date.now()): NextAction {
  const stage = effectiveStage(l);
  if (stage === "won") return { kind: "won", title: "Won — nice work", detail: "Job's in the bag. Schedule it and ask for a review once it's done.", channel: "none", urgency: "done" };
  if (stage === "lost") return { kind: "lost", title: "Marked lost", detail: "Logged for learning. Hazel will use the reason to sharpen future advice.", channel: "none", urgency: "done" };

  // Not contacted yet → speed is everything.
  if (!l.contactedAt && stage === "new") {
    return { kind: "call_now", title: "Call now — speed wins jobs", detail: "Leads called within minutes convert far better than ones left for hours. Ring them now while they're hot; if no answer, send a text so they know who you are.", channel: "call", urgency: "now" };
  }

  // Quote sent / following up → run the cadence. Evaluated BEFORE the
  // no-answer / qualified branches on purpose: a lead that was marked Qualified
  // (contact_outcome = "qualified") and THEN had a quote sent still carries that
  // earlier outcome. The badge keys on effectiveStage (→ quote_sent /
  // following_up), so checking those branches first keeps the coaching card in
  // lock-step with the badge instead of falling back to "Book the site visit".
  if (stage === "quote_sent" || stage === "following_up") {
    const cad = cadenceFor(l);
    if (cad && now >= cad.dueAt) {
      const overdue = Math.round((now - cad.dueAt) / DAY);
      return {
        kind: "followup",
        title: `Follow up now — ${cad.tone}`,
        detail: `Quote's been out a while${overdue > 0 ? ` (${overdue} day${overdue === 1 ? "" : "s"} since this step was due)` : ""}. Don't let it go silent — ${cad.channel === "text" ? "send a text" : "give them a call"}. Hazel can write the message.`,
        channel: cad.channel,
        urgency: "now",
      };
    }
    if (cad) {
      const inDays = Math.max(0, Math.round((cad.dueAt - now) / DAY));
      return { kind: "followup_wait", title: `Next follow-up in ${inDays} day${inDays === 1 ? "" : "s"}`, detail: `Quote's out and the cadence is running. Hazel will nudge you for the ${cad.tone} on day ${CADENCE[cad.step].day}.`, channel: cad.channel, urgency: "later" };
    }
    return { kind: "followup_done", title: "Cadence exhausted — make the call", detail: "You've followed up the full sequence with no reply. Either make one last personal call, or mark it lost (ghosted) so Hazel learns from it.", channel: "call", urgency: "soon" };
  }

  // Called, no answer → switch channel.
  if (l.contactOutcome === "no_answer") {
    return { kind: "switch_text", title: "No answer — send a text", detail: "People dodge unknown numbers. Send a short text introducing yourself and why you're calling, so the next call is expected.", channel: "text", urgency: "now" };
  }

  // Qualified → book the site visit, then manage the booked visit + prep.
  // Keyed on the journey stage, not a lingering contact_outcome, so a later
  // stage always wins.
  if (stage === "qualified") {
    const v = visitState(l, now);
    if (v.state === "soon") {
      return { kind: "visit_soon", title: "Quote visit now — here's how to win it", detail: "Your booked quote visit is happening now. Open the pre-quote briefing so you walk in knowing their why, what to lead with and how to stand out.", channel: "visit", urgency: "now" };
    }
    if (v.state === "upcoming") {
      const inDays = Math.max(0, Math.round((v.minsUntil ?? 0) / 1440));
      return { kind: "visit_booked", title: inDays <= 1 ? "Quote visit booked — prep ready" : `Quote visit booked — in ${inDays} days`, detail: "The visit's in the diary and Hazel's pre-quote briefing is ready. Review the prep before you go so you walk in ready to win this specific customer.", channel: "visit", urgency: inDays <= 1 ? "soon" : "later" };
    }
    if (v.state === "past") {
      return { kind: "visit_done", title: "Visit done — send the quote", detail: "You've done the site visit. Get the quote out while it's fresh, then Hazel runs the follow-up cadence so it never goes silent.", channel: "none", urgency: "soon" };
    }
    return { kind: "book_visit", title: "Book the site visit", detail: "They're qualified — lock in a measure & quote visit. Book it into Hazel and she'll prep a pre-quote briefing so you walk in ready to win this specific customer.", channel: "call", urgency: "soon" };
  }

  // Contacted but not yet qualified.
  return { kind: "qualify", title: "Qualify them", detail: "Find out the budget, timeline, why they're renovating and whether they're getting other quotes. Log it by voice or text and Hazel will brief you for the quote.", channel: "call", urgency: "soon" };
}

export function isCold(l: JourneyLead, now = Date.now()): boolean {
  const stage = effectiveStage(l);
  if (stage !== "quote_sent" && stage !== "following_up") return false;
  const cad = cadenceFor(l);
  return !!cad && now >= cad.dueAt;
}

// A lead needs calling NOW when there's no recorded contact at all (no
// contacted_at, no logged outcome, no quote out) and it isn't won/lost or
// already in quote/follow-up. Robust to board-stage quirks — keys on the
// absence of real contact, not just the literal "new" stage.
export function needsCallNow(l: JourneyLead): boolean {
  if (l.contactedAt || l.contactOutcome || l.quoteSentAt) return false;
  const st = effectiveStage(l);
  return st !== "won" && st !== "lost" && st !== "quote_sent" && st !== "following_up";
}

// Suggest bringing the showroom designer: big, vision/emotion-led job where the
// client is unsure on style. (Smart suggestion only — deeper integration later.)
export function suggestDesigner(l: JourneyLead): { suggest: boolean; reason: string } {
  const q = l.qual || {};
  const size = q.jobSizeEstimate ?? q.budgetAud ?? 0;
  const big = size >= 25000;
  const unsure = q.visionClarity === "unsure" || /luxur|not sure|unsure|no idea|help|ideas/i.test(`${q.vision || ""} ${(q.concerns || []).join(" ")}`);
  const emotional = q.decisionStyle ? /emotion|vision|forever|dream|luxur/i.test(q.decisionStyle) : false;
  const suggest = big && (unsure || emotional);
  return {
    suggest,
    reason: suggest
      ? `This looks like a ~$${Math.round(size / 1000)}k job and they're ${unsure ? "unsure on style" : "vision-led"} — bring the showroom designer to the quote. It helps them commit AND lets you spec showroom products.`
      : "",
  };
}

// Targeted advice for a specific loss reason.
export function lossAdvice(reasonId?: string | null): string {
  switch (reasonId) {
    case "no_response": return "Ghosted after the quote is the #1 fixable leak. Run an anti-ghosting cadence next time — text day 2, call day 5, a value reminder day 10, a friendly break-up day 17. Most 'no responses' just got busy.";
    case "price": return "Price loss usually means value wasn't clear, not that you were too dear. Sell the outcome + de-risk (fixed price, licensed, warranty, your finished work) before the number. On big jobs, a designer + showroom visit reframes price as value.";
    case "competitor": return "Find out who and why if you can — speed, rapport, price or presentation. Often the winner simply followed up better or made the client feel more confident.";
    case "timing": return "Not dead — just early. Keep it warm: log a reason + set a reminder to check back when their timing lands. A quick seasonal message keeps you front of mind.";
    case "changed_mind": return "Often cold feet or a partner not sold. Reassuring proof (finished jobs, reviews) and a no-pressure check-in can revive these.";
    case "unqualified": return "Fine to let go — but tighten targeting/qualifying so you spend less time on poor-fit leads.";
    default: return "Logged. The more losses you tag with a reason, the sharper Hazel's pattern-spotting gets.";
  }
}

// ---- Patterns over time (sharpens as data accumulates) --------------------
export interface JourneyPatterns {
  confidence: "early" | "building" | "solid";
  decided: number;
  won: number;
  lost: number;
  lossByReason: { reason: string; label: string; count: number }[];
  topLeak: { label: string; count: number } | null;
  priceLossesBigJobs: number;
  wonAvgSpeedMin: number | null;
  lostAvgSpeedMin: number | null;
  insights: string[];
}

export function analysePatterns(leads: JourneyLead[]): JourneyPatterns {
  const won = leads.filter((l) => effectiveStage(l) === "won");
  const lost = leads.filter((l) => effectiveStage(l) === "lost");
  const decided = won.length + lost.length;
  const confidence: JourneyPatterns["confidence"] = decided < 10 ? "early" : decided < 30 ? "building" : "solid";

  const tally: Record<string, number> = {};
  let priceLossesBigJobs = 0;
  for (const l of lost) {
    const r = l.lostReason || "other";
    tally[r] = (tally[r] || 0) + 1;
    const size = l.qual?.jobSizeEstimate ?? l.qual?.budgetAud ?? 0;
    if (r === "price" && size >= 20000) priceLossesBigJobs++;
  }
  const lossByReason = Object.entries(tally).map(([reason, count]) => ({ reason, label: lossLabel(reason), count })).sort((a, b) => b.count - a.count);
  const topLeak = lossByReason[0] ? { label: lossByReason[0].label, count: lossByReason[0].count } : null;

  const avgSpeed = (ls: JourneyLead[]) => {
    const xs = ls.map((l) => speedToContactMinutes(l)).filter((x): x is number => x != null);
    return xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null;
  };
  const wonAvgSpeedMin = avgSpeed(won);
  const lostAvgSpeedMin = avgSpeed(lost);

  const insights: string[] = [];
  if (topLeak && topLeak.count >= 2) insights.push(`Your #1 leak is "${topLeak.label}" (${topLeak.count} lost). ${topLeak.label.startsWith("No response") ? "A disciplined follow-up cadence would recover a chunk of these." : "Worth tackling head-on."}`);
  if (priceLossesBigJobs >= 2) insights.push(`${priceLossesBigJobs} price losses on $20k+ jobs — you may be under-positioning on big work. Sell value (designer, showroom, proof) before the number.`);
  if (wonAvgSpeedMin != null && lostAvgSpeedMin != null && lostAvgSpeedMin > wonAvgSpeedMin * 1.5) {
    insights.push(`Your won jobs were contacted in ~${speedLabel(wonAvgSpeedMin)} vs ~${speedLabel(lostAvgSpeedMin)} for lost ones. Speed-to-contact is closing your deals — call new leads faster.`);
  }
  return { confidence, decided, won: won.length, lost: lost.length, lossByReason, topLeak, priceLossesBigJobs, wonAvgSpeedMin, lostAvgSpeedMin, insights };
}
