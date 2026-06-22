"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Receipt, ArrowRight, Loader2 } from "lucide-react";
import { Panel, SectionHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { fetchInvoices, type InvoiceRecord } from "@/lib/data/invoices";
import { fetchBrandSettings } from "@/lib/data/brand";
import { money } from "@/lib/quotes/model";
import { DEFAULT_BRAND } from "@/lib/business/brand";

const STATUS_CLS: Record<string, string> = {
  sent: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  skipped: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  failed: "bg-red-500/10 text-red-300 border-red-500/30",
};

// Invoices list — currently the lock-in deposit invoices raised when a client
// accepts a quote. Fully resilient: an empty list (or a not-yet-migrated DB)
// renders the "coming soon" state, never a crash.
export default function InvoicesScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [currency, setCurrency] = useState("AUD");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [inv, brand] = await Promise.all([
        fetchInvoices(supabase),
        fetchBrandSettings(supabase).catch(() => DEFAULT_BRAND),
      ]);
      setInvoices(inv);
      setCurrency(brand.currency || "AUD");
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Receipt}
        title="Invoices"
        desc="Deposit invoices raised when a client accepts a quote. Progress-claim invoicing (mark paid / Xero) follows."
      />

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
        </div>
      ) : invoices.length === 0 ? (
        <Panel className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan-400">
            <Receipt className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-base font-semibold text-slate-100">No invoices yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            When a client accepts a quote online, a lock-in deposit invoice is raised and listed here.
            Full progress-claim invoicing (mark paid, Xero) is coming.
          </p>
          <Link
            href="/quotes"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
          >
            Go to Quotes <ArrowRight className="h-4 w-4" />
          </Link>
        </Panel>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wider text-slate-500 font-display">
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {invoices.map((inv) => (
                <tr key={inv.id} className="transition hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-data text-slate-200">{inv.invoiceNumber || "—"}</td>
                  <td className="px-4 py-3 capitalize text-slate-400">
                    {inv.kind}
                    {inv.percent != null ? ` · ${inv.percent}%` : ""}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{inv.clientEmail || "—"}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-data text-slate-200">{money(inv.total, currency)}</td>
                  <td className="px-4 py-3">
                    <span
                      title={inv.message || undefined}
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_CLS[inv.status] || STATUS_CLS.sent}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
