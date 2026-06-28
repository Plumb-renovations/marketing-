import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessProfile } from "@/lib/business/profileServer";
import { runGenerator } from "@/lib/ai/server";
import { CADENCE, type JourneyLead, type JourneyStage, type LeadQual } from "./model";
import { analysePatterns } from "./coach";

// Server-side journey ops: capture (AI extract → update lead + event), staging,
// follow-up cadence, pre-quote briefing, and loss capture + advice. Reuses the
// existing leads table + Anthropic pipeline.

const DAY = 86_400_000;
const COLS =
  "id,name,project,source,stage,lead_date,created_at,journey_stage,contact_outcome,contacted_at,quote_sent_at,followup_step,followup_due,last_touch_at,qual,lost_reason,lost_detail,phone";

export function mapJourneyLead(r: any): JourneyLead {
  return {
    id: r.id, name: r.name, project: r.project ?? null, createdAt: r.created_at, leadDate: r.lead_date, stage: r.stage,
    journeyStage: r.journey_stage ?? null, contactOutcome: r.contact_outcome ?? null,
    contactedAt: r.contacted_at ?? null, quoteSentAt: r.quote_sent_at ?? null,
    followupStep: r.followup_step ?? 0, followupDue: r.followup_due ?? null, lastTouchAt: r.last_touch_at ?? null,
    qual: (r.qual ?? {}) as LeadQual, lostReason: r.lost_reason ?? null, lostDetail: r.lost_detail ?? null,
    source: r.source, phone: r.phone ?? null,
  };
}

export async function fetchJourneyLeads(supabase: SupabaseClient, orgId: string): Promise<JourneyLead[]> {
  const { data } = await supabase
    .from("leads").select(COLS).eq("org_id", orgId).is("archived_at", null)
    .order("created_at", { ascending: false }).limit(500);
  return (data || []).map(mapJourneyLead);
}

export async function getJourney(supabase: SupabaseClient, orgId: string, leadId: string) {
  const { data: row } = await supabase.from("leads").select(`${COLS},briefing`).eq("org_id", orgId).eq("id", leadId).maybeSingle();
  if (!row) return null;
  const r: any = row;

  // Backfill quote_sent_at when a quote has gone out by ANY path (board move to
  // Quotes, the quote builder, or a branded quote) so the follow-up cadence
  // starts — fixes the Sales Coach staying on "Book the site visit".
  if (!r.quote_sent_at && (r.stage === "quote" || r.stage === "won")) {
    let sentAt: string | null = null;
    try {
      const { data: docs } = await supabase.from("quote_docs").select("sent_at, created_at, status").eq("org_id", orgId).eq("lead_id", leadId).order("created_at", { ascending: true });
      const sentDoc = (docs || []).find((d: any) => ["sent", "viewed", "accepted", "declined"].includes(d.status));
      sentAt = sentDoc?.sent_at || sentDoc?.created_at || null;
    } catch { /* quote_docs optional */ }
    const quoteSentAt = sentAt || new Date().toISOString();
    const patch: Record<string, any> = { quote_sent_at: quoteSentAt, updated_at: new Date().toISOString() };
    if (!r.journey_stage || ["new", "contacted", "qualified"].includes(r.journey_stage)) patch.journey_stage = "quote_sent";
    if ((r.followup_step ?? 0) === 0 && !r.followup_due) patch.followup_due = new Date(Date.parse(quoteSentAt) + CADENCE[0].day * DAY).toISOString();
    await supabase.from("leads").update(patch).eq("id", leadId);
    Object.assign(r, { quote_sent_at: quoteSentAt, journey_stage: patch.journey_stage ?? r.journey_stage, followup_due: patch.followup_due ?? r.followup_due });
  }

  const { data: events } = await supabase.from("lead_journey_events").select("*").eq("org_id", orgId).eq("lead_id", leadId).order("created_at", { ascending: false }).limit(50);
  return { lead: mapJourneyLead(r), briefing: r.briefing ?? null, events: events || [] };
}

async function insertEvent(supabase: SupabaseClient, orgId: string, leadId: string, e: { kind: string; channel?: string | null; source?: string; body?: string; extracted?: any }) {
  try { await supabase.from("lead_journey_events").insert({ org_id: orgId, lead_id: leadId, kind: e.kind, channel: e.channel ?? null, source: e.source ?? "system", body: e.body ?? null, extracted: e.extracted ?? null }); }
  catch (err) { console.error("[journey] event insert failed:", (err as Error).message); }
}

// Capture a voice/typed update → extract facts, advance the journey, log it.
export async function logUpdate(supabase: SupabaseClient, orgId: string, leadId: string, body: string, source: "voice" | "typed") {
  const cur = await getJourney(supabase, orgId, leadId);
  if (!cur) throw new Error("lead not found");
  const profile = await getBusinessProfile(orgId);
  const ai: any = await runGenerator("lead-extract", {
    journey: { note: body, name: cur.lead.name, project: cur.lead.project, currentStage: cur.lead.journeyStage || cur.lead.stage, qual: cur.lead.qual },
  }, profile);

  const facts = ai?.facts || {};
  const qual: LeadQual = { ...(cur.lead.qual || {}) };
  for (const k of ["budgetAud", "jobSizeEstimate", "timeline", "motivation", "vision", "decisionStyle", "visionClarity", "competingQuotes"] as const) {
    if (facts[k] != null && facts[k] !== "") (qual as any)[k] = facts[k];
  }
  if (Array.isArray(facts.concerns) && facts.concerns.length) qual.concerns = facts.concerns;

  const now = new Date().toISOString();
  const outcome: string | null = ai?.outcome ?? null;
  const sug: string | null = ai?.suggestedStage ?? null;
  const patch: Record<string, any> = { qual, last_touch_at: now, updated_at: now };
  if (outcome) patch.contact_outcome = outcome;

  const contactish = ["no_answer", "qualified", "unqualified"].includes(outcome || "") || ["contacted", "qualified", "quote_sent", "following_up", "won"].includes(sug || "");
  if (contactish && !cur.lead.contactedAt) patch.contacted_at = now; // first contact → speed-to-contact

  let js: JourneyStage | null = (sug as JourneyStage) || (outcome === "qualified" ? "qualified" : outcome === "no_answer" || outcome === "unqualified" ? "contacted" : (cur.lead.journeyStage as JourneyStage) || null);
  if (js && js !== "lost") patch.journey_stage = js; // never auto-lose without a reason
  if (js === "qualified" && cur.lead.stage === "new") patch.stage = "qualified";
  if (js === "won") patch.stage = "won";
  if (js === "quote_sent") {
    patch.stage = "quote";
    if (!cur.lead.quoteSentAt) { patch.quote_sent_at = now; patch.followup_step = 0; patch.followup_due = new Date(Date.now() + CADENCE[0].day * DAY).toISOString(); }
  }

  await supabase.from("leads").update(patch).eq("id", leadId);
  await insertEvent(supabase, orgId, leadId, { kind: "note", source, body, extracted: ai });
  return { extraction: ai };
}

// Log a contact OUTCOME on a new/contacted lead. Records first contact + the
// outcome (which the Marketing Coach reads to judge lead QUALITY by source).
//   no_answer  → contacted; pre-writes an intro text so the next call is expected
//   qualified  → moves to qualified
//   unqualified→ out of the active pipeline with a reason
export async function setOutcome(supabase: SupabaseClient, orgId: string, leadId: string, outcome: "no_answer" | "qualified" | "unqualified", detail?: string) {
  const cur = await getJourney(supabase, orgId, leadId);
  if (!cur) throw new Error("lead not found");
  const now = new Date().toISOString();
  const patch: Record<string, any> = { contact_outcome: outcome, contacted_at: cur.lead.contactedAt || now, last_touch_at: now, updated_at: now };
  let message: string | undefined;

  if (outcome === "qualified") {
    patch.journey_stage = "qualified";
    if (cur.lead.stage === "new") patch.stage = "qualified";
  } else if (outcome === "no_answer") {
    patch.journey_stage = "contacted";
    try {
      const profile = await getBusinessProfile(orgId);
      const ai: any = await runGenerator("lead-message", { journey: { name: cur.lead.name, channel: "text", tone: "intro text after a missed call (so they know who's calling)", qual: cur.lead.qual } }, profile);
      message = String(ai?.message || "");
    } catch { /* message optional */ }
  } else if (outcome === "unqualified") {
    patch.journey_stage = "lost"; patch.stage = "lost"; patch.lost_reason = "unqualified";
    if (detail) patch.lost_detail = detail;
  }

  await supabase.from("leads").update(patch).eq("id", leadId);
  await insertEvent(supabase, orgId, leadId, {
    kind: outcome === "no_answer" ? "call" : "stage",
    channel: outcome === "no_answer" ? "call" : null,
    source: "typed",
    body: `Outcome: ${outcome.replace("_", " ")}${detail ? ` — ${detail}` : ""}`,
  });
  return { message, journey: await getJourney(supabase, orgId, leadId) };
}

// Manually set the journey stage (e.g. "Mark quote sent", "Won").
export async function setJourneyStage(supabase: SupabaseClient, orgId: string, leadId: string, stage: JourneyStage) {
  const cur = await getJourney(supabase, orgId, leadId);
  if (!cur) throw new Error("lead not found");
  const now = new Date().toISOString();
  const patch: Record<string, any> = { journey_stage: stage, last_touch_at: now, updated_at: now };
  if (stage === "contacted" && !cur.lead.contactedAt) patch.contacted_at = now;
  if (stage === "qualified") patch.stage = "qualified";
  if (stage === "won") patch.stage = "won";
  if (stage === "quote_sent") {
    patch.stage = "quote"; patch.quote_sent_at = now; patch.followup_step = 0; patch.followup_due = new Date(Date.now() + CADENCE[0].day * DAY).toISOString();
  }
  await supabase.from("leads").update(patch).eq("id", leadId);
  await insertEvent(supabase, orgId, leadId, { kind: "stage", source: "system", body: `Stage → ${stage}` });
}

// Record that a follow-up was done → advance the cadence to the next step.
export async function advanceFollowup(supabase: SupabaseClient, orgId: string, leadId: string, channel: string) {
  const cur = await getJourney(supabase, orgId, leadId);
  if (!cur) throw new Error("lead not found");
  const now = new Date().toISOString();
  const step = (cur.lead.followupStep ?? 0) + 1;
  const sent = cur.lead.quoteSentAt ? Date.parse(cur.lead.quoteSentAt) : Date.now();
  const next = CADENCE[step];
  await supabase.from("leads").update({
    journey_stage: "following_up", followup_step: step, last_touch_at: now, updated_at: now,
    followup_due: next ? new Date(sent + next.day * DAY).toISOString() : null,
  }).eq("id", leadId);
  await insertEvent(supabase, orgId, leadId, { kind: channel === "call" ? "call" : "text", channel, source: "typed", body: "Followed up" });
}

export async function generateBrief(supabase: SupabaseClient, orgId: string, leadId: string) {
  const cur = await getJourney(supabase, orgId, leadId);
  if (!cur) throw new Error("lead not found");
  const profile = await getBusinessProfile(orgId);
  const ai: any = await runGenerator("pre-quote-brief", { journey: { name: cur.lead.name, project: cur.lead.project, qual: cur.lead.qual } }, profile);
  await supabase.from("leads").update({ briefing: ai, updated_at: new Date().toISOString() }).eq("id", leadId);
  await insertEvent(supabase, orgId, leadId, { kind: "system", source: "system", body: "Generated pre-quote briefing" });
  return ai;
}

export async function markLost(supabase: SupabaseClient, orgId: string, leadId: string, reason: string, detail: string) {
  const cur = await getJourney(supabase, orgId, leadId);
  if (!cur) throw new Error("lead not found");
  const now = new Date().toISOString();
  await supabase.from("leads").update({ stage: "lost", journey_stage: "lost", lost_reason: reason, lost_detail: detail || null, last_touch_at: now, updated_at: now }).eq("id", leadId);
  const profile = await getBusinessProfile(orgId);
  const pat = analysePatterns(await fetchJourneyLeads(supabase, orgId));
  const patternsText = pat.insights.join(" ") || `${pat.lost} lost, ${pat.won} won so far.`;
  let ai: any = null;
  try { ai = await runGenerator("loss-coach", { journey: { reason, detail, qual: cur.lead.qual, patternsText } }, profile); } catch { /* advice optional */ }
  await insertEvent(supabase, orgId, leadId, { kind: "lost", source: "system", body: `Lost — ${reason}${detail ? `: ${detail}` : ""}`, extracted: ai });
  return { advice: ai, patterns: pat };
}

export async function generateMessage(supabase: SupabaseClient, orgId: string, leadId: string, channel: string, tone: string) {
  const cur = await getJourney(supabase, orgId, leadId);
  if (!cur) throw new Error("lead not found");
  const profile = await getBusinessProfile(orgId);
  const ai: any = await runGenerator("lead-message", { journey: { name: cur.lead.name, channel, tone, qual: cur.lead.qual } }, profile);
  return { message: String(ai?.message || "") };
}
