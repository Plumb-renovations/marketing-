import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessProfile } from "@/lib/business/profile";
import { runGenerator } from "@/lib/ai/server";
import { buildSnapshot, type CoachSnapshot } from "./snapshot";
import { computeSignals, prioritise, type CoachSignal } from "./signals";

// Orchestrates the Marketing Coach: real data (snapshot) → deterministic signals
// (brain) → prioritised, plain-English advice (Anthropic). The AI references
// signal ids so the UI can attach the real scale/pause buttons; if the AI is
// unavailable we fall back to the deterministic signals so the panel is never
// empty (and never fabricated).

export interface CoachInsight {
  severity: "high" | "medium" | "low";
  area: string;
  title: string;
  why: string;
  action: string;
  signalId: string | null;
  signalAction?: CoachSignal["action"];
}

export interface NotWorking {
  title: string;
  why: string;
  recommendation: string;
}

export interface CoachReport {
  connected: boolean;
  reconnect: boolean;
  confidence: "early" | "building" | "solid";
  headline: string;
  insights: CoachInsight[];
  whatsNotWorking: NotWorking[];
  weekly: CoachSnapshot["weekly"];
  account: CoachSnapshot["meta"]["account"];
  leads: CoachSnapshot["leads"];
  aiError?: string;
}

const money = (n: number, ccy = "$") => `${ccy}${Math.round(n).toLocaleString()}`;

// A compact, human-readable account summary the model reasons over.
export function buildDataBlock(s: CoachSnapshot, signals: CoachSignal[]): string {
  const L: string[] = [];
  const a = s.meta.account;
  L.push(`DATA CONFIDENCE: ${s.confidence} (${s.confidence === "early" ? "thin data — use proven benchmarks, be cautious" : s.confidence === "building" ? "some data — sharpening" : "solid data"}).`);

  if (!s.meta.connected) {
    L.push("META: not connected.");
  } else if (s.meta.reconnect) {
    L.push("META: connection expired (needs reconnect).");
  } else {
    L.push(`META ACCOUNT (all-time): spend ${money(a.spend)}, ${a.leads} leads, cost/lead ${a.cpl != null ? money(a.cpl) : "n/a"}, CTR ${a.ctr}%, ${a.won} won jobs${a.costPerWon != null ? `, cost/won ${money(a.costPerWon)}` : ""}. Billing currency: ${a.currency}.`);
    L.push(`ADS LIVE: ${s.meta.activeAds} active ad(s) across ${s.meta.activeAdsets} active ad set(s) (${s.meta.totalAds} ads total).`);
    L.push(`HAZEL'S TARGETS (auto-tuned): healthy cost/lead ~${money(s.targets.healthyCpl)}, pause over ~${money(s.targets.concerningCpl)}, scale step +${s.targets.budgetStepPct}%. ${s.targets.basis}`);
    for (const ad of s.meta.adsets.slice(0, 12)) {
      const cpl = ad.leads > 0 ? money(ad.spend / ad.leads) : "no leads yet";
      L.push(`  · Ad set "${ad.name}" [${ad.status || "ACTIVE"}]: ${money(ad.spend)} spent, ${ad.leads} leads (${cpl}), CTR ${ad.ctr}%, freq ${ad.frequency.toFixed(1)}, budget ${ad.dailyBudgetMinor ? money(ad.dailyBudgetMinor / 100) + "/day" : "n/a"}, ${ad.activeAdCount}/${ad.adCount} ads active.`);
    }
  }

  if (s.weekly) {
    const w = s.weekly;
    L.push(`THIS WEEK vs LAST: leads ${w.last.leads}→${w.this.leads}${w.leadsDeltaPct != null ? ` (${w.leadsDeltaPct >= 0 ? "+" : ""}${w.leadsDeltaPct}%)` : ""}, spend ${money(w.last.spend)}→${money(w.this.spend)}, cost/lead ${w.last.cpl != null ? money(w.last.cpl) : "n/a"}→${w.this.cpl != null ? money(w.this.cpl) : "n/a"}.`);
  }

  const ld = s.leads;
  L.push(`LEADS (CRM, all sources): ${ld.total} total — ${ld.new} new, ${ld.qualified} qualified, ${ld.quote} quoting, ${ld.won} won, ${ld.lost} lost. This week ${ld.thisWeek}, last week ${ld.lastWeek}.${ld.avgJobValue ? ` Avg won-job value ${money(ld.avgJobValue)}.` : ""}`);
  if (ld.lostReasons.length) L.push(`LOST REASONS: ${ld.lostReasons.slice(0, 4).map((r) => `${r.reason} (${r.count})`).join(", ")}.`);
  // Real qualification outcomes from the Sales Coach — judge lead QUALITY, not just volume.
  if (ld.outcomeQualified || ld.outcomeUnqualified || ld.outcomeNoAnswer) {
    L.push(`QUALIFICATION (logged by the owner): ${ld.outcomeQualified} qualified, ${ld.outcomeUnqualified} unqualified, ${ld.outcomeNoAnswer} no-answer. Weigh which leads actually QUALIFY, not just how many arrive.`);
  }
  if (ld.bySource.length) {
    L.push(`LEAD QUALITY BY SOURCE: ${ld.bySource.slice(0, 6).map((b) => `${b.source} — ${b.leads} leads, ${b.qualified} qualified, ${b.won} won`).join("; ")}. Favour sources/ad angles that produce QUALIFIED leads + jobs, not just cheap lead count.`);
  }

  if (signals.length) {
    L.push("FLAGGED SIGNALS (Hazel's brain already computed these):");
    for (const sig of signals) {
      L.push(`  [${sig.id}] (${sig.severity}/${sig.area}) ${sig.title} — ${sig.detail}${sig.action ? ` [ACTIONABLE id=${sig.id}: ${sig.action.type === "budget" ? `raise "${sig.action.name}" to ${sig.action.label}` : `pause "${sig.action.name}"`}]` : ""}`);
    }
  }
  return L.join("\n");
}

export async function buildCoachReport(supabase: SupabaseClient, orgId: string, profile: BusinessProfile): Promise<CoachReport> {
  const snapshot = await buildSnapshot(supabase, orgId);
  const signals = computeSignals(snapshot);
  const byId = new Map(signals.map((s) => [s.id, s]));

  let insights: CoachInsight[] = [];
  let whatsNotWorking: NotWorking[] = [];
  let aiError: string | undefined;
  let headline = "";
  let confidence = snapshot.confidence;

  try {
    const dataBlock = buildDataBlock(snapshot, signals);
    const ai: any = await runGenerator("coach", { dataBlock }, profile);
    headline = ai?.headline || "";
    if (ai?.confidence) confidence = ai.confidence;
    whatsNotWorking = (Array.isArray(ai?.whatsNotWorking) ? ai.whatsNotWorking : [])
      .map((w: any) => ({ title: String(w?.title || ""), why: String(w?.why || ""), recommendation: String(w?.recommendation || "") }))
      .filter((w: NotWorking) => w.title);
    insights = (ai?.insights || []).map((i: any) => {
      const sig = i?.signalId ? byId.get(String(i.signalId)) : undefined;
      return {
        severity: ["high", "medium", "low"].includes(i?.severity) ? i.severity : "medium",
        area: String(i?.area || "Marketing"),
        title: String(i?.title || ""),
        why: String(i?.why || ""),
        action: String(i?.action || ""),
        signalId: sig ? sig.id : null,
        signalAction: sig?.action,
      };
    }).filter((i: CoachInsight) => i.title);
  } catch (e) {
    aiError = (e as Error).message;
  }

  // Fallback: if the AI didn't produce insights, surface the deterministic
  // signals directly (honest — these are computed facts, not invented).
  if (!insights.length) {
    insights = prioritise(signals, 6).map((sig) => ({
      severity: sig.severity, area: sig.area, title: sig.title, why: sig.detail, action: "",
      signalId: sig.action ? sig.id : null, signalAction: sig.action,
    }));
  }

  // Brutal-honesty fallback: derive "what's not working" from the deterministic
  // not-working / cut-waste signals so the truth shows even if the AI is down.
  if (!whatsNotWorking.length) {
    whatsNotWorking = signals
      .filter((sig) => ["What's not working", "Cut waste", "Lead quality"].includes(sig.area))
      .slice(0, 4)
      .map((sig) => ({ title: sig.title, why: sig.detail, recommendation: "" }));
  }

  return {
    connected: snapshot.meta.connected,
    reconnect: snapshot.meta.reconnect,
    confidence,
    headline,
    insights,
    whatsNotWorking,
    weekly: snapshot.weekly,
    account: snapshot.meta.account,
    leads: snapshot.leads,
    aiError,
  };
}

export async function askCoach(
  supabase: SupabaseClient,
  orgId: string,
  profile: BusinessProfile,
  question: string,
): Promise<{ answer: string; followups: string[] }> {
  const snapshot = await buildSnapshot(supabase, orgId);
  const signals = computeSignals(snapshot);
  const dataBlock = buildDataBlock(snapshot, signals);
  const ai: any = await runGenerator("coach-ask", { dataBlock, question }, profile);
  return {
    answer: String(ai?.answer || "I couldn't read your account just now — try again in a moment."),
    followups: Array.isArray(ai?.followups) ? ai.followups.slice(0, 3).map(String) : [],
  };
}

// The weekly report: WHAT happened (facts) + Hazel's recommendations (coach).
export function buildWeeklyEmail(report: CoachReport, businessName: string): { subject: string; text: string; html: string } {
  const w = report.weekly;
  const dir = w?.direction === "up" ? "📈 up" : w?.direction === "down" ? "📉 down" : "steady";
  const subject = `Hazel's weekly marketing report — ${w ? `leads ${dir}` : "your numbers + what to do"}`;

  const facts: string[] = [];
  if (w) {
    facts.push(`Leads: ${w.last.leads} → ${w.this.leads}${w.leadsDeltaPct != null ? ` (${w.leadsDeltaPct >= 0 ? "+" : ""}${w.leadsDeltaPct}%)` : ""}`);
    facts.push(`Spend: ${money(w.last.spend)} → ${money(w.this.spend)}`);
    facts.push(`Cost per lead: ${w.last.cpl != null ? money(w.last.cpl) : "—"} → ${w.this.cpl != null ? money(w.this.cpl) : "—"}`);
  } else {
    facts.push(`Leads this week: ${report.leads.thisWeek} (last week ${report.leads.lastWeek})`);
  }
  facts.push(`Jobs won (all time): ${report.leads.won}${report.account.costPerWon != null ? ` · cost per won job ${money(report.account.costPerWon)}` : ""}`);

  const recs = report.insights.slice(0, 5);
  const recLines = recs.map((i, n) => `${n + 1}. ${i.title}${i.action ? ` — ${i.action}` : i.why ? ` — ${i.why}` : ""}`);

  const notWorking = report.whatsNotWorking.slice(0, 4);
  const nwLines = notWorking.map((w) => `• ${w.title}${w.recommendation ? ` — ${w.recommendation}` : w.why ? ` — ${w.why}` : ""}`);

  const text = [
    `Hazel's weekly marketing report for ${businessName}`,
    report.headline ? `\n${report.headline}` : "",
    `\nWHAT HAPPENED THIS WEEK`,
    ...facts.map((f) => `• ${f}`),
    `\nHAZEL'S RECOMMENDATIONS`,
    ...(recLines.length ? recLines : ["• You're in good shape — nothing urgent this week."]),
    ...(nwLines.length ? [`\nWHAT'S NOT WORKING / WHAT I'D STOP`, ...nwLines] : []),
    report.confidence === "early" ? `\n(Early read — Hazel is using proven benchmarks while your data builds.)` : "",
  ].filter(Boolean).join("\n");

  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;color:#0f172a">
    <h2 style="margin:0 0 4px">Hazel's weekly marketing report</h2>
    <p style="color:#475569;margin:0 0 16px">${esc(businessName)}</p>
    ${report.headline ? `<p style="font-size:15px"><strong>${esc(report.headline)}</strong></p>` : ""}
    <h3 style="margin:18px 0 6px">What happened this week</h3>
    <ul style="padding-left:18px;color:#334155">${facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
    <h3 style="margin:18px 0 6px">Hazel's recommendations</h3>
    <ol style="padding-left:18px;color:#334155">${(recs.length ? recs : [{ title: "You're in good shape — nothing urgent this week.", action: "", why: "" } as CoachInsight]).map((i) => `<li><strong>${esc(i.title)}</strong>${i.action ? ` — ${esc(i.action)}` : i.why ? ` — ${esc(i.why)}` : ""}</li>`).join("")}</ol>
    ${notWorking.length ? `<h3 style="margin:18px 0 6px;color:#b91c1c">What's not working / what I'd stop</h3><ul style="padding-left:18px;color:#334155">${notWorking.map((w) => `<li><strong>${esc(w.title)}</strong>${w.recommendation ? ` — ${esc(w.recommendation)}` : w.why ? ` — ${esc(w.why)}` : ""}</li>`).join("")}</ul>` : ""}
    ${report.confidence === "early" ? `<p style="color:#94a3b8;font-size:12px">Early read — Hazel is using proven benchmarks while your data builds.</p>` : ""}
  </div>`;

  return { subject, text, html };
}
