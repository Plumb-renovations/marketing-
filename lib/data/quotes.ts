import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";
import { computeTotals, computeStageAmounts, tierTotals, representativeTier, DEFAULT_TIER_NAMES, type Quote, type QuoteStatus, type TierKey } from "@/lib/quotes/model";

// Merge stored tier names over the defaults so all three keys are always present.
function mapTierNames(raw: any): Record<TierKey, string> {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    good: typeof r.good === "string" && r.good.trim() ? r.good : DEFAULT_TIER_NAMES.good,
    better: typeof r.better === "string" && r.better.trim() ? r.better : DEFAULT_TIER_NAMES.better,
    best: typeof r.best === "string" && r.best.trim() ? r.best : DEFAULT_TIER_NAMES.best,
  };
}

// True when a Postgres/PostgREST error is "column does not exist" — i.e. a not-
// yet-applied migration. Lets writes that use a new column degrade gracefully
// (retry without it) so the quote still saves before the migration is run.
const isUndefinedColumn = (e: any) =>
  e?.code === "42703" || /column .* does not exist|could not find the .* column/i.test(e?.message || "");

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
      trade: it.trade ?? null,
      tradeType: it.trade_type ?? null,
      tier: it.tier ?? null,
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
    tiered: row.tiered ?? false,
    acceptedTier: row.accepted_tier ?? null,
    tierNames: mapTierNames(row.tier_names),
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
  // For a tiered quote the stored headline total is the representative tier
  // (accepted, else "better") — a single all-items total would be meaningless
  // (it'd add all three tiers' finishes). A normal quote totals all its items.
  const totals = quote.tiered
    ? tierTotals(quote.items, gstRegistered, quote.gstInclusive)[representativeTier(quote.acceptedTier)]
    : computeTotals(quote.items, gstRegistered, quote.gstInclusive);
  const stages = computeStageAmounts(quote.stages, totals.total);

  const docRow: Record<string, any> = {
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
    tiered: quote.tiered,
    accepted_tier: quote.acceptedTier ?? null,
    tier_names: quote.tierNames ?? null,
  };
  let { error: qErr } = await supabase.from("quote_docs").upsert(docRow);
  // Granular fallback: drop tier_names (0034) first, then tiered/accepted_tier
  // (0033) — so a quote still saves if 0034 isn't applied yet WITHOUT also
  // losing the tiered flag when only 0033 is present.
  if (qErr && isUndefinedColumn(qErr)) {
    const { tier_names, ...noNames } = docRow;
    ({ error: qErr } = await supabase.from("quote_docs").upsert(noNames));
    if (qErr && isUndefinedColumn(qErr)) {
      const { tiered, accepted_tier, ...legacy } = noNames;
      ({ error: qErr } = await supabase.from("quote_docs").upsert(legacy));
    }
  }
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
    const rows = quote.items.map((it, i) => ({
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
      trade: it.trade ?? null,
      trade_type: it.tradeType ?? null,
      tier: it.tier ?? null,
    }));
    let { error } = await supabase.from("quote_doc_items").insert(rows);
    // If 0032/0033 aren't applied yet, retry without the trade/tier columns so
    // saving still works (the quote just isn't trade/tier-tagged until they run).
    if (error && isUndefinedColumn(error)) {
      const legacy = rows.map(({ trade, trade_type, tier, ...rest }) => rest);
      ({ error } = await supabase.from("quote_doc_items").insert(legacy));
    }
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
