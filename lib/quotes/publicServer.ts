// Server-only: imports the service-role admin client. Never import into a
// client component.
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToBrand, type BrandSettings } from "@/lib/business/brand";
import { computeStageAmounts, DEFAULT_TIER_NAMES, DEFAULT_PC_TIER_NAMES, type Quote, type QuoteStatus, type TierKey, type JourneyStage } from "@/lib/quotes/model";

function mapNames(raw: any, defaults: Record<TierKey, string>): Record<TierKey, string> {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    good: typeof r.good === "string" && r.good.trim() ? r.good : defaults.good,
    better: typeof r.better === "string" && r.better.trim() ? r.better : defaults.better,
    best: typeof r.best === "string" && r.best.trim() ? r.best : defaults.best,
  };
}
const mapTierNames = (raw: any) => mapNames(raw, DEFAULT_TIER_NAMES);
const mapJourney = (raw: any): JourneyStage[] =>
  Array.isArray(raw) ? raw.filter((s: any) => s && typeof s.label === "string").map((s: any) => ({ label: s.label, note: typeof s.note === "string" ? s.note : "" })) : [];

// Loads a quote for the PUBLIC tracked page by its token. Uses the service-role
// client because the visitor is anonymous (no org membership), so this is the
// one place a quote is read outside RLS — and only ever by an unguessable token.
// Internal unit cost is never selected, so it can't leak to the client doc.
export interface PublicQuoteBundle {
  quote: Quote;
  brand: BrandSettings;
  businessName: string;
}

// The select is built with an `extra` flag so we can drop the newer columns
// (trade/tier from 0032/0033) when they aren't present yet. Internal unit_cost
// is never selected, so it can never leak to the client document.
const DOC_SCALARS =
  "id, org_id, quote_number, reference, status, client_name, client_email, client_phone, client_address, project_name, site_address, quote_date, valid_until, scope_description, intro_note, terms, inclusions, exclusions, gst_inclusive, subtotal, gst_amount, total, public_token, sent_at, viewed_at, view_count, accepted_at";
const SECTIONS = "quote_doc_sections(id, name, sort_order)";
const STAGES = "quote_doc_stages(id, label, milestone_note, percent, fixed_amount, amount, status, sort_order)";
const itemCols = (extra: boolean, allow: boolean, pc: boolean) =>
  `quote_doc_items(id, section_id, description, detail, qty, unit, unit_price, amount, sort_order${extra ? ", trade, tier" : ""}${allow ? ", allowance" : ""}${pc ? ", pc_tier" : ""})`;
const docExtraCols = (extra: boolean, names: boolean, allow: boolean, pc: boolean) =>
  [extra ? "tiered, accepted_tier" : null, names ? "tier_names" : null, allow ? "allowance_note" : null, pc ? "pc_tiered, accepted_pc_tier, pc_tier_names, journey" : null].filter(Boolean).join(", ");
const buildSelect = (extra: boolean, names: boolean, allow: boolean, pc: boolean) =>
  [DOC_SCALARS, docExtraCols(extra, names, allow, pc) || null, SECTIONS, itemCols(extra, allow, pc), STAGES].filter(Boolean).join(", ");

export async function fetchPublicQuote(token: string): Promise<PublicQuoteBundle | null> {
  if (!token) return null;
  const admin = createAdminClient();
  const undef = (e: any) => e && (e.code === "42703" || /column .* does not exist/i.test(e.message || ""));

  // Prefer the full select (trade + construction tiers + PC tiers + journey).
  // Fall back step-by-step (newest migration first) if 0037 / 0035 / 0034 /
  // 0033 / 0032 aren't applied yet, rather than 500-ing the public page.
  const attempts: [boolean, boolean, boolean, boolean][] = [[true, true, true, true], [true, true, true, false], [true, true, false, false], [true, false, false, false], [false, false, false, false]];
  let row: any = null;
  let error: any = null;
  for (const [extra, names, allow, pc] of attempts) {
    ({ data: row, error } = await admin.from("quote_docs").select(buildSelect(extra, names, allow, pc)).eq("public_token", token).maybeSingle());
    if (!undef(error)) break;
  }
  if (error || !row) return null;

  const { data: prof } = await admin.from("business_profiles").select("*").eq("org_id", (row as any).org_id).maybeSingle();
  const brand = rowToBrand(prof);
  const businessName = prof?.business_name || "";

  return { quote: mapPublicQuote(row), brand, businessName };
}

// Records a view of the tracked link: bumps view_count, sets viewed_at on the
// first open, advances status sent → viewed, and logs a quote_views row.
export async function logQuoteView(
  token: string,
  meta: { userAgent?: string; referer?: string },
): Promise<void> {
  const admin = createAdminClient();
  const { data: q } = await admin
    .from("quote_docs")
    .select("id, org_id, status, view_count, viewed_at")
    .eq("public_token", token)
    .maybeSingle();
  if (!q) return;

  const patch: Record<string, any> = { view_count: (Number((q as any).view_count) || 0) + 1 };
  if (!(q as any).viewed_at) patch.viewed_at = new Date().toISOString();
  if ((q as any).status === "sent") patch.status = "viewed";

  await admin.from("quote_docs").update(patch).eq("id", (q as any).id);
  await admin.from("quote_views").insert({
    org_id: (q as any).org_id,
    quote_id: (q as any).id,
    user_agent: meta.userAgent ?? null,
    referer: meta.referer ?? null,
  });
}

function mapPublicQuote(row: any): Quote {
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
      unitCost: null, // never exposed publicly
      sortOrder: it.sort_order ?? 0,
      trade: it.trade ?? null,
      tradeType: null, // internal flag — never exposed publicly
      tier: it.tier ?? null,
      allowance: it.allowance ?? false,
      sourcePriceItemId: null, // internal — not needed/exposed publicly
      pcTier: it.pc_tier ?? null,
    }));
  const stages = computeStageAmounts(
    (row.quote_doc_stages || [])
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
      })),
    Number(row.total) || 0,
  );
  return {
    id: row.id,
    leadId: null,
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
    journey: mapJourney(row.journey),
    sections,
    items,
    stages,
  };
}
