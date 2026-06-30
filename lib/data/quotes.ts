import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";
import { computeTotals, computeStageAmounts, priceableItems, representativeTier, DEFAULT_TIER_NAMES, DEFAULT_PC_TIER_NAMES, type Quote, type QuoteStatus, type TierKey, type JourneyStage } from "@/lib/quotes/model";

// Merge stored tier names over the given defaults so all three keys are present.
function mapNames(raw: any, defaults: Record<TierKey, string>): Record<TierKey, string> {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    good: typeof r.good === "string" && r.good.trim() ? r.good : defaults.good,
    better: typeof r.better === "string" && r.better.trim() ? r.better : defaults.better,
    best: typeof r.best === "string" && r.best.trim() ? r.best : defaults.best,
  };
}
const mapTierNames = (raw: any) => mapNames(raw, DEFAULT_TIER_NAMES);
function mapJourney(raw: any): JourneyStage[] {
  return Array.isArray(raw) ? raw.filter((s: any) => s && typeof s.label === "string").map((s: any) => ({ label: s.label, note: typeof s.note === "string" ? s.note : "" })) : [];
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
      allowance: it.allowance ?? false,
      sourcePriceItemId: it.source_price_item_id ?? null,
      pcTier: it.pc_tier ?? null,
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
    pcTiered: row.pc_tiered ?? false,
    acceptedPcTier: row.accepted_pc_tier ?? null,
    pcTierNames: mapNames(row.pc_tier_names, DEFAULT_PC_TIER_NAMES),
    allowanceNote: row.allowance_note ?? "",
    configuratorIntro: row.configurator_intro ?? "",
    comfortQuestion: row.comfort_question ?? "",
    journey: mapJourney(row.journey),
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
  // Stored headline total = the representative construction tier (build) + the
  // representative PC tier (allowance). For a non-tiered axis the representative
  // is null (all build / all fixtures). Only the chosen options ever count.
  const ctier = quote.tiered ? representativeTier(quote.acceptedTier) : null;
  const ptier = quote.pcTiered ? representativeTier(quote.acceptedPcTier) : null;
  const totals = computeTotals(priceableItems(quote.items, ctier, ptier), gstRegistered, quote.gstInclusive);
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
    allowance_note: quote.allowanceNote || null,
    configurator_intro: quote.configuratorIntro || null,
    comfort_question: quote.comfortQuestion || null,
    pc_tiered: quote.pcTiered,
    accepted_pc_tier: quote.acceptedPcTier ?? null,
    pc_tier_names: quote.pcTierNames ?? null,
    journey: quote.journey?.length ? quote.journey : null,
  };
  let { error: qErr } = await supabase.from("quote_docs").upsert(docRow);
  // Granular fallback (newest migration first): drop comfort_question (0040),
  // then configurator_intro (0039), then the PC/journey columns (0037), then
  // allowance_note (0035), then tier_names (0034), then tiered (0033) — so a
  // quote still saves when a later migration isn't applied.
  if (qErr && isUndefinedColumn(qErr)) {
    const { comfort_question, ...noComfort } = docRow;
    ({ error: qErr } = await supabase.from("quote_docs").upsert(noComfort));
    if (qErr && isUndefinedColumn(qErr)) {
    const { configurator_intro, ...noIntro } = noComfort;
    ({ error: qErr } = await supabase.from("quote_docs").upsert(noIntro));
    if (qErr && isUndefinedColumn(qErr)) {
    const { pc_tiered, accepted_pc_tier, pc_tier_names, journey, ...noPc } = noIntro;
    ({ error: qErr } = await supabase.from("quote_docs").upsert(noPc));
    if (qErr && isUndefinedColumn(qErr)) {
      const { allowance_note, ...noAllowance } = noPc;
      ({ error: qErr } = await supabase.from("quote_docs").upsert(noAllowance));
      if (qErr && isUndefinedColumn(qErr)) {
        const { tier_names, ...noNames } = noAllowance;
        ({ error: qErr } = await supabase.from("quote_docs").upsert(noNames));
        if (qErr && isUndefinedColumn(qErr)) {
          const { tiered, accepted_tier, ...legacy } = noNames;
          ({ error: qErr } = await supabase.from("quote_docs").upsert(legacy));
        }
      }
    }
    }
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
      allowance: it.allowance ?? false,
      source_price_item_id: it.sourcePriceItemId ?? null,
      pc_tier: it.pcTier ?? null,
    }));
    let { error } = await supabase.from("quote_doc_items").insert(rows);
    // Retry without optional columns (newest migration first) so saving still
    // works before each migration runs: drop pc_tier (0037), then allowance
    // (0035), then trade/tier (0032/0033).
    if (error && isUndefinedColumn(error)) {
      const noPc = rows.map(({ pc_tier, ...rest }) => rest);
      ({ error } = await supabase.from("quote_doc_items").insert(noPc));
      if (error && isUndefinedColumn(error)) {
        const noAllowance = noPc.map(({ allowance, source_price_item_id, ...rest }) => rest);
        ({ error } = await supabase.from("quote_doc_items").insert(noAllowance));
        if (error && isUndefinedColumn(error)) {
          const legacy = noAllowance.map(({ trade, trade_type, tier, ...rest }) => rest);
          ({ error } = await supabase.from("quote_doc_items").insert(legacy));
        }
      }
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
