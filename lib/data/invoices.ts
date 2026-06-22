import type { SupabaseClient } from "@supabase/supabase-js";

// Invoices raised against quotes (the deposit invoices from the accept flow;
// progress-claim invoices later). RESILIENT: returns [] on ANY error — a missing
// table (migration 0018 not yet run), RLS, or no rows — so the page renders an
// empty state instead of throwing a server-side exception.
export interface InvoiceRecord {
  id: string;
  quoteId: string;
  kind: string;
  invoiceNumber: string;
  clientEmail: string;
  percent: number | null;
  subtotal: number;
  gstAmount: number;
  total: number;
  status: string; // sent | failed | skipped
  message: string;
  sentAt: string | null;
  createdAt: string | null;
}

export async function fetchInvoices(supabase: SupabaseClient): Promise<InvoiceRecord[]> {
  try {
    const { data, error } = await supabase
      .from("quote_invoices")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[invoices] list:", error.message);
      return [];
    }
    return (data || []).map((r: any) => ({
      id: r.id,
      quoteId: r.quote_id,
      kind: r.kind ?? "deposit",
      invoiceNumber: r.invoice_number ?? "",
      clientEmail: r.client_email ?? "",
      percent: r.percent != null ? Number(r.percent) : null,
      subtotal: Number(r.subtotal) || 0,
      gstAmount: Number(r.gst_amount) || 0,
      total: Number(r.total) || 0,
      status: r.status ?? "sent",
      message: r.message ?? "",
      sentAt: r.sent_at ?? null,
      createdAt: r.created_at ?? null,
    }));
  } catch (e) {
    console.error("[invoices] list failed:", (e as Error).message);
    return [];
  }
}
