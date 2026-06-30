// Per-org branding + tax/numbering/defaults for the client-facing quote and
// invoice documents. Stored on the same business_profiles row (column-scoped),
// so it co-exists with the AI/targeting Business Profile. Pure helpers.

export interface PaymentStagePreset {
  label: string;
  percent: number; // 0–100
}

export interface BrandSettings {
  logoUrl: string | null;
  brandColor: string; // primary accent on documents (themes all the copper accents)
  brandColor2: string; // optional secondary — themes the charcoal ink / dark accept block
  tagline: string; // sub-line under the masthead (e.g. "Specialising in Bathroom Renovations")
  regionLine: string; // service region line (e.g. "Gold Coast & Northern Rivers")
  showRibbon: boolean; // the flowing ribbon-line motif on the masthead (default on)
  quoteTemplate: string; // selected document template id (e.g. "premium")
  contactName: string; // sales contact shown on the quote's accept block
  contactPhone: string;
  contactEmail: string;
  address: string;
  abn: string;
  licenceNo: string;
  bankDetails: string;
  gstRegistered: boolean;
  currency: string;
  quotePrefix: string;
  quoteNext: number;
  invoicePrefix: string;
  invoiceNext: number;
  depositPercent: number; // lock-in deposit % invoiced automatically on accept
  defaultTerms: string;
  defaultPaymentSchedule: PaymentStagePreset[];
  defaultAllowanceNote: string; // saved framing text for the Tile & Fixture Allowance section
  defaultConfiguratorIntro: string; // saved intro framing for the client configurator
}

export const DEFAULT_BRAND: BrandSettings = {
  logoUrl: null,
  brandColor: "#B8763E",
  brandColor2: "",
  tagline: "",
  regionLine: "",
  showRibbon: true,
  quoteTemplate: "premium",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  address: "",
  abn: "",
  licenceNo: "",
  bankDetails: "",
  gstRegistered: true,
  currency: "AUD",
  quotePrefix: "Q-",
  quoteNext: 1,
  invoicePrefix: "INV-",
  invoiceNext: 1,
  depositPercent: 5,
  defaultTerms: "",
  defaultPaymentSchedule: [],
  defaultAllowanceNote: "",
  defaultConfiguratorIntro: "",
};

export function rowToBrand(row: any): BrandSettings {
  if (!row) return { ...DEFAULT_BRAND };
  return {
    logoUrl: row.logo_url ?? null,
    brandColor: row.brand_color || DEFAULT_BRAND.brandColor,
    brandColor2: row.brand_color2 ?? "",
    tagline: row.tagline ?? "",
    regionLine: row.region_line ?? "",
    showRibbon: row.show_ribbon ?? true,
    quoteTemplate: row.quote_template || "premium",
    contactName: row.doc_contact_name ?? "",
    contactPhone: row.doc_contact_phone ?? "",
    contactEmail: row.doc_contact_email ?? "",
    address: row.doc_address ?? "",
    abn: row.abn ?? "",
    licenceNo: row.licence_no ?? "",
    bankDetails: row.bank_details ?? "",
    gstRegistered: row.gst_registered ?? true,
    currency: row.currency || "AUD",
    quotePrefix: row.quote_number_prefix ?? "Q-",
    quoteNext: row.quote_next_number ?? 1,
    invoicePrefix: row.invoice_number_prefix ?? "INV-",
    invoiceNext: row.invoice_next_number ?? 1,
    depositPercent: row.deposit_percent != null ? Number(row.deposit_percent) : 5,
    defaultTerms: row.default_terms ?? "",
    defaultPaymentSchedule: Array.isArray(row.default_payment_schedule) ? row.default_payment_schedule : [],
    defaultAllowanceNote: row.default_allowance_note ?? "",
    defaultConfiguratorIntro: row.default_configurator_intro ?? "",
  };
}

// Only the brand columns — so saving this never disturbs the AI/targeting fields.
export function brandToRow(orgId: string, b: BrandSettings): Record<string, any> {
  return {
    org_id: orgId,
    logo_url: b.logoUrl,
    brand_color: b.brandColor.trim() || DEFAULT_BRAND.brandColor,
    brand_color2: b.brandColor2.trim() || null,
    tagline: b.tagline.trim() || null,
    region_line: b.regionLine.trim() || null,
    show_ribbon: b.showRibbon,
    quote_template: b.quoteTemplate || "premium",
    doc_contact_name: b.contactName.trim() || null,
    doc_contact_phone: b.contactPhone.trim() || null,
    doc_contact_email: b.contactEmail.trim() || null,
    doc_address: b.address.trim() || null,
    abn: b.abn.trim() || null,
    licence_no: b.licenceNo.trim() || null,
    bank_details: b.bankDetails.trim() || null,
    gst_registered: b.gstRegistered,
    currency: b.currency.trim() || "AUD",
    quote_number_prefix: b.quotePrefix,
    quote_next_number: Math.max(1, Math.floor(b.quoteNext || 1)),
    invoice_number_prefix: b.invoicePrefix,
    invoice_next_number: Math.max(1, Math.floor(b.invoiceNext || 1)),
    deposit_percent: Math.max(0, Math.min(100, Number(b.depositPercent) || 0)),
    default_terms: b.defaultTerms,
    default_payment_schedule: (b.defaultPaymentSchedule || []).map((s) => ({ label: s.label, percent: Number(s.percent) || 0 })),
    default_allowance_note: b.defaultAllowanceNote?.trim() || null,
    default_configurator_intro: b.defaultConfiguratorIntro?.trim() || null,
  };
}

export const scheduleSum = (stages: { percent: number }[]) =>
  stages.reduce((a, s) => a + (Number(s.percent) || 0), 0);
