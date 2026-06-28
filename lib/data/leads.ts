import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lead, Quote } from "@/lib/domain/types";
import { getOrgId } from "@/lib/data/org";
import { extractEmail, extractPhone, extractFormFields } from "@/lib/leads/formData";

// ---- Row -> UI mapping --------------------------------------------------
function mapQuote(row: any): Quote {
  const items = (row.quote_line_items || [])
    .slice()
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map((li: any) => ({
      id: li.id,
      desc: li.description ?? "",
      qty: Number(li.qty) || 0,
      unitPrice: Number(li.unit_price) || 0,
    }));
  return {
    id: row.id,
    status: row.status ?? "draft",
    createdAt: row.created_at,
    lineItems: items,
  };
}

function mapLead(row: any): Lead {
  const quotes = (row.quotes || [])
    .slice()
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map(mapQuote);
  return {
    id: row.id,
    date: row.lead_date,
    name: row.name,
    suburb: row.suburb ?? "—",
    source: row.source,
    project: row.project ?? "",
    stage: row.stage,
    quotes,
    wonQuoteId: row.won_quote_id ?? null,
    lostReason: row.lost_reason ?? null,
    tradify: row.tradify ?? "",
    startDate: row.start_date ?? undefined,
    durationWeeks: row.duration_weeks ?? undefined,
    jobStatus: row.job_status ?? undefined,
    jobValue: row.job_value ?? null,
    archivedAt: row.archived_at ?? null,
    email: extractEmail(row.raw),
    phone: extractPhone(row.raw),
    formFields: extractFormFields(row.raw),
  };
}

// ---- UI -> Row mapping --------------------------------------------------
function leadRow(lead: Lead, orgId: string) {
  return {
    id: lead.id,
    org_id: orgId,
    name: lead.name,
    suburb: lead.suburb,
    source: lead.source,
    project: lead.project,
    stage: lead.stage,
    lead_date: lead.date,
    lost_reason: lead.lostReason ?? null,
    won_quote_id: lead.wonQuoteId ?? null,
    tradify: lead.tradify ?? null,
    start_date: lead.startDate || null,
    duration_weeks: lead.durationWeeks ?? null,
    job_status: lead.jobStatus ?? null,
    job_value: lead.jobValue ?? null,
    archived_at: lead.archivedAt ?? null,
  };
}

// ---- Reads --------------------------------------------------------------
export async function fetchLeads(supabase: SupabaseClient): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*, quotes(*, quote_line_items(*))")
    .order("lead_date", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapLead);
}

// ---- Writes -------------------------------------------------------------
// Upsert the lead row only (used by field-only actions + new leads).
export async function upsertLeadRow(supabase: SupabaseClient, lead: Lead) {
  const orgId = await getOrgId(supabase);
  const { error } = await supabase.from("leads").upsert(leadRow(lead, orgId));
  if (error) throw error;
}

// Patch a subset of lead fields (camelCase keys mapped to columns).
const FIELD_MAP: Record<string, string> = {
  stage: "stage",
  source: "source",
  tradify: "tradify",
  lostReason: "lost_reason",
  wonQuoteId: "won_quote_id",
  startDate: "start_date",
  durationWeeks: "duration_weeks",
  jobStatus: "job_status",
  jobValue: "job_value",
  archivedAt: "archived_at",
};

export async function patchLead(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, any>,
) {
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    const col = FIELD_MAP[k];
    if (col) row[col] = v === undefined ? null : v;
  }
  if (!Object.keys(row).length) return;
  const { error } = await supabase.from("leads").update(row).eq("id", id);
  if (error) throw error;
}

// Upsert a quote and fully replace its line items.
export async function persistQuote(
  supabase: SupabaseClient,
  leadId: string,
  quote: Quote,
) {
  const orgId = await getOrgId(supabase);
  const { error: qErr } = await supabase.from("quotes").upsert({
    id: quote.id,
    org_id: orgId,
    lead_id: leadId,
    status: quote.status,
    created_at: quote.createdAt,
  });
  if (qErr) throw qErr;

  await supabase.from("quote_line_items").delete().eq("quote_id", quote.id);

  const items = (quote.lineItems || []).map((li, i) => ({
    id: li.id,
    quote_id: quote.id,
    description: li.desc ?? "",
    qty: Number(li.qty) || 0,
    unit_price: Number(li.unitPrice) || 0,
    position: i,
  }));
  if (items.length) {
    const { error: liErr } = await supabase.from("quote_line_items").insert(items);
    if (liErr) throw liErr;
  }
}

// Upsert a lead together with all of its quotes + line items (used by reseed).
export async function persistFullLead(supabase: SupabaseClient, lead: Lead) {
  await upsertLeadRow(supabase, lead);
  for (const q of lead.quotes) await persistQuote(supabase, lead.id, q);
}

// Permanently delete a lead — and tombstone its external key so a Meta re-sync
// can't re-import it. For junk/test leads that must stay gone. Children cascade
// (quotes, journey events); quote_docs are removed so none are left orphaned.
export async function deleteLeadPermanent(supabase: SupabaseClient, id: string) {
  const { data: row } = await supabase.from("leads").select("org_id, external_source, external_id").eq("id", id).maybeSingle();
  if ((row as any)?.external_source && (row as any)?.external_id) {
    try {
      await supabase.from("deleted_lead_keys").insert({ org_id: (row as any).org_id, external_source: (row as any).external_source, external_id: (row as any).external_id });
    } catch { /* tombstone best-effort (table may not be migrated yet) */ }
  }
  try { await supabase.from("quote_docs").delete().eq("lead_id", id); } catch { /* none / not migrated */ }
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

// Reset: clear every lead in the org and reload the provided seed set.
export async function resetLeads(supabase: SupabaseClient, seed: Lead[]) {
  const { error } = await supabase.from("leads").delete().neq("id", "");
  if (error) throw error;
  for (const l of seed) await persistFullLead(supabase, l);
}
