"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Plus, Loader2 } from "lucide-react";
import { Panel, SectionHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { listQuotes } from "@/lib/data/quotes";
import { fetchBrandSettings } from "@/lib/data/brand";
import { money, type Quote } from "@/lib/quotes/model";
import { DEFAULT_BRAND } from "@/lib/business/brand";

const STATUS_CLS: Record<string, string> = {
  draft: "bg-slate-700/40 text-slate-300 border-slate-600/50",
  sent: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  viewed: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
  accepted: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  declined: "bg-red-500/10 text-red-300 border-red-500/30",
  expired: "bg-amber-500/10 text-amber-300 border-amber-500/30",
};

// Status filters live as tabs inside this page (not separate nav items).
// Each tab maps to one or more quote statuses.
const TABS: { id: string; label: string; match: (s: string) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "draft", label: "Drafts", match: (s) => s === "draft" },
  { id: "sent", label: "Sent", match: (s) => s === "sent" || s === "viewed" },
  { id: "accepted", label: "Accepted", match: (s) => s === "accepted" },
];

export default function QuotesScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [currency, setCurrency] = useState("AUD");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    (async () => {
      const [qs, b] = await Promise.all([listQuotes(supabase), fetchBrandSettings(supabase).catch(() => DEFAULT_BRAND)]);
      setQuotes(qs);
      setCurrency(b.currency || "AUD");
      setLoading(false);
    })();
  }, [supabase]);

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const visible = quotes.filter((q) => active.match(q.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader icon={FileText} title="Quotes" desc="Build, send and track branded quotes." />
        <Link href="/quotes/new" className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400">
          <Plus className="h-4 w-4" /> New quote
        </Link>
      </div>

      {!loading && quotes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const n = quotes.filter((q) => t.match(q.status)).length;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  tab === t.id
                    ? "bg-cyan-500 text-slate-950"
                    : "border border-slate-700 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {t.label}
                <span className={`ml-1.5 font-data text-xs ${tab === t.id ? "text-slate-950/70" : "text-slate-500"}`}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading quotes…</div>
      ) : quotes.length === 0 ? (
        <Panel className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan-400"><FileText className="h-6 w-6" /></div>
          <h3 className="mt-4 font-display text-base font-semibold text-slate-100">No quotes yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Create your first branded quote — it pulls your logo, colours and details from Branding settings.</p>
          <Link href="/quotes/new" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"><Plus className="h-4 w-4" /> New quote</Link>
        </Panel>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wider text-slate-500 font-display">
                <th className="px-4 py-3 font-medium">Quote</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {visible.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No {active.label.toLowerCase()} quotes.</td></tr>
              )}
              {visible.map((q) => (
                <tr key={q.id} className="transition hover:bg-slate-800/30">
                  <td className="px-4 py-3"><Link href={`/quotes/${q.id}`} className="font-data text-cyan-300 hover:text-cyan-200">{q.quoteNumber || "Draft"}</Link></td>
                  <td className="px-4 py-3 text-slate-200">{q.clientName || "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{q.quoteDate ? new Date(q.quoteDate).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-right font-data text-slate-200">{money(q.total, currency)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_CLS[q.status] || STATUS_CLS.draft}`}>{q.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
