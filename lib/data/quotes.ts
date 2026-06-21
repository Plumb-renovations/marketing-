import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";
import { computeTotals, computeStageAmounts, type Quote, type QuoteStatus } from "@/lib/quotes/model";

function mapQuote(row: any): Quote {
  const sections = (row.quote_doc_sections || [])
    .slice()
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((s: any) => ({ id: s.id, name: s.name ?? "", sortOrder: s.sort_order ?? 0 }));
  const items = (row.quote_doc_items || [])
    .slice()
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((it: any) => ({
      id: it.id,
      sectionId: it.section_id ?? null,
      description: it.description ?? "",
      detail: it.detail ?? "",
      qty: Number(it.qty) || 0,
      unit: it.unit ?? "ea",
      unitPrice: Number(it.unit_price) || 0,
      unitCost: it.unit_cost != null ? Number(it.unit_cost) : null,
      sortOrder: it.sort_order ?? 0,
    }));
  const stages = (row.quote_doc_stages || [])
    .slice()
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((st: any) => ({
      id: st.id,
      label: st.label ?? "",
      milestoneNote: st.milestone_note ?? "",
      percent: st.percent != null ? Number(st.percent) : null,
      fixedAmount: st.fixed_amount != null ? Number(st.fixed_amount) : null,
      amount: Number(st.amount) || 0,
      status: st.status ?? "pending",
      sortOrder: st.sort_order ?? 0,
    }));
  return {
    id: row.id,
    leadId: row.lead_id ?? null,
    quoteNumber: row.quote_number ?? null,
    reference: row.reference ?? "",
    status: (row.status ?? "draft") as QuoteStatus,
    clientName: row.client_name ?? "",
    clientEmail: row.client_email ?? "",
    clientPhone: row.client_phone ?? "",
    clientAddress: row.client_address ?? "",
    projectName: row.project_name ?? "",
    siteAddress: row.site_address ?? "",
    quoteDate: row.quote_date ?? new Date().toISOString().slice(0, 10),
    validUntil: row.valid_until ?? "",
    scopeDescription: row.scope_description ?? "",
    introNote: row.intro_note ?? "",
    terms: row.terms ?? "",
    inclusions: row.inclusions ?? "",
    exclusions: row.exclusions ?? "",
    gstInclusive: row.gst_inclusive ?? false,
    subtotal: Number(row.subtotal) || 0,
    gstAmount: Number(row.gst_amount) || 0,
    total: Number(row.total) || 0,
    sentAt: row.sent_at ?? null,
    viewedAt: row.viewed_at ?? null,
    viewCount: row.view_count ?? 0,
    acceptedAt: row.accepted_at ?? null,
    publicToken: row.public_token ?? null,
    sections,
    items,
    stages,
  };
}

const SELECT = "*, quote_doc_sections(*), quote_doc_items(*), quote_doc_stages(*)";

export async function listQuotes(supabase: SupabaseClient): Promise<Quote[]> {
  const { data, error } = await supabase.from("quote_docs").select(SELECT).order("created_at", { ascending: false });
  if (error) {
    console.error("[quotes] list:", error.message);
    return [];
  }
  return (data || []).map(mapQuote);
}

export async function fetchQuote(supabase: SupabaseClient, id: string): Promise<Quote | null> {
  const { data, error } = await supabase.from("quote_docs").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapQuote(data) : null;
}

// Upsert the quote + fully replace its sections/items/stages (recomputing totals
// with the org's GST registration). Returns the recomputed totals.
export async function saveQuote(supabase: SupabaseClient, quote: Quote, gstRegistered: boolean) {
  const orgId = await getOrgId(supabase);
  const totals = computeTotals(quote.items, gstRegistered, quote.gstInclusive);
  const stages = computeStageAmounts(quote.stages, totals.total);

  const { error: qErr } = await supabase.from("quote_docs").upsert({
    id: quote.id,
    org_id: orgId,
    lead_id: quote.leadId,
    quote_number: quote.quoteNumber,
    reference: quote.reference,
    status: quote.status,
    client_name: quote.clientName,
    client_email: quote.clientEmail,
    client_phone: quote.clientPhone,
    client_address: quote.clientAddress,
    project_name: quote.projectName,
    site_address: quote.siteAddress,
    quote_date: quote.quoteDate || null,
    valid_until: quote.validUntil || null,
    scope_description: quote.scopeDescription,
    intro_note: quote.introNote,
    terms: quote.terms,
    inclusions: quote.inclusions,
    exclusions: quote.exclusions,
    gst_inclusive: quote.gstInclusive,
    subtotal: totals.subtotal,
    gst_amount: totals.gstAmount,
    total: totals.total,
  });
  if (qErr) throw qErr;

  // Replace children.
  await supabase.from("quote_doc_items").delete().eq("quote_id", quote.id);
  await supabase.from("quote_doc_sections").delete().eq("quote_id", quote.id);
  await supabase.from("quote_doc_stages").delete().eq("quote_id", quote.id);

  if (quote.sections.length) {
    const { error } = await supabase.from("quote_doc_sections").insert(
      quote.sections.map((s, i) => ({ id: s.id, quote_id: quote.id, org_id: orgId, name: s.name, sort_order: i })),
    );
    if (error) throw error;
  }
  if (quote.items.length) {
    const { error } = await supabase.from("quote_doc_items").insert(
      quote.items.map((it, i) => ({
        id: it.id,
        quote_id: quote.id,
        org_id: orgId,
        section_id: it.sectionId,
        description: it.description,
        detail: it.detail || null,
        qty: it.qty,
        unit: it.unit,
        unit_price: it.unitPrice,
        amount: Math.round((it.qty || 0) * (it.unitPrice || 0) * 100) / 100,
        unit_cost: it.unitCost,
        sort_order: i,
      })),
    );
    if (error) throw error;
  }
  if (stages.length) {
    const { error } = await supabase.from("quote_doc_stages").insert(
      stages.map((s, i) => ({
        id: s.id,
        quote_id: quote.id,
        org_id: orgId,
        label: s.label,
        milestone_note: s.milestoneNote || null,
        percent: s.percent,
        fixed_amount: s.fixedAmount,
        amount: s.amount,
        status: s.status,
        sort_order: i,
      })),
    );
    if (error) throw error;
  }
  return totals;
}

export async function deleteQuote(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("quote_docs").delete().eq("id", id);
  if (error) throw error;
}
