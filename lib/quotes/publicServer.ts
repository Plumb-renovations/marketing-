// Server-only: imports the service-role admin client. Never import into a
// client component.
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToBrand, type BrandSettings } from "@/lib/business/brand";
import { computeStageAmounts, type Quote, type QuoteStatus } from "@/lib/quotes/model";

// Loads a quote for the PUBLIC tracked page by its token. Uses the service-role
// client because the visitor is anonymous (no org membership), so this is the
// one place a quote is read outside RLS — and only ever by an unguessable token.
// Internal unit cost is never selected, so it can't leak to the client doc.
export interface PublicQuoteBundle {
  quote: Quote;
  brand: BrandSettings;
  businessName: string;
}

// Doc/section/stage columns are fixed; the line-item column list is built so we
// can drop `trade` (0032) when that column isn't present yet. Internal unit_cost
// is never selected, so it can never leak to the client document.
const DOC_COLS =
  "id, org_id, quote_number, reference, status, client_name, client_email, client_phone, client_address, project_name, site_address, quote_date, valid_until, scope_description, intro_note, terms, inclusions, exclusions, gst_inclusive, subtotal, gst_amount, total, public_token, sent_at, viewed_at, view_count, accepted_at, " +
  "quote_doc_sections(id, name, sort_order), ";
const STAGE_COLS = ", quote_doc_stages(id, label, milestone_note, percent, fixed_amount, amount, status, sort_order)";
const itemCols = (withTrade: boolean) =>
  `quote_doc_items(id, section_id, description, detail, qty, unit, unit_price, amount, sort_order${withTrade ? ", trade" : ""})`;

export async function fetchPublicQuote(token: string): Promise<PublicQuoteBundle | null> {
  if (!token) return null;
  const admin = createAdminClient();

  // Prefer selecting `trade` (for the client's by-trade consolidation); if 0032
  // isn't applied the column is missing, so fall back to the legacy select.
  let { data: row, error } = await admin.from("quote_docs").select(DOC_COLS + itemCols(true) + STAGE_COLS).eq("public_token", token).maybeSingle();
  if (error && (error.code === "42703" || /column .* does not exist/i.test(error.message || ""))) {
    ({ data: row, error } = await admin.from("quote_docs").select(DOC_COLS + itemCols(false) + STAGE_COLS).eq("public_token", token).maybeSingle());
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
    sections,
    items,
    stages,
  };
}
