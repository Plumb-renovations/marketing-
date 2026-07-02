"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { analyseCreatives, creativeSetSummary, FLAG_META, FREQ_OVEREXPOSED, type CreativeInsight } from "@/lib/meta/creatives";
import type { ResolvedTargets, TargetOverrides } from "@/lib/meta/verdict";

const money = (n: number, ccy = "AUD") => {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(Number(n) || 0); }
  catch { return "$" + Math.round(Number(n) || 0); }
};

// Individual-ad (creative) breakdown for one ad set. Deterministic flags + a
// ranked winners/losers read render instantly from the numbers; "Get Hazel's
// read" enriches each ad with an AI diagnosis + recommendation. If the AI is
// unavailable it silently keeps the deterministic read (never blank).
export default function CreativeBreakdown({
  adset, targets, currency, account, overrides,
}: {
  adset: any;
  targets: ResolvedTargets;
  currency: string;
  account: { spend: number; leads: number; costPerWon: number | null };
  overrides: TargetOverrides;
}) {
  const ads = adset?.ads || [];
  const base = useMemo(() => analyseCreatives(ads, targets, currency), [ads, targets, currency]);
  const [items, setItems] = useState<CreativeInsight[]>(base);
  const [summary, setSummary] = useState(creativeSetSummary(base));
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [note, setNote] = useState("");

  // Re-sync when the underlying data refreshes.
  useEffect(() => { setItems(base); setSummary(creativeSetSummary(base)); setRan(false); setNote(""); }, [base]);

  if (!ads.length) return null;

  const getRead = async () => {
    setLoading(true); setNote("");
    try {
      const res = await fetch("/api/ads/creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setName: adset.name, currency, account, overrides, ads }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || j?.error || "failed");
      setItems(j.items?.length ? j.items : base);
      setSummary(j.summary || summary);
      setRan(true);
      if (!j.aiUsed) setNote("Showing the deterministic read — Hazel's AI wasn't available just now.");
    } catch {
      setNote("Couldn't reach Hazel — showing the deterministic read from the numbers.");
    } finally {
      setLoading(false);
    }
  };

  const sorted = [...items].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  return (
    <div className="mb-2 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-display uppercase tracking-wider text-slate-400"><Sparkles className="h-3.5 w-3.5 text-cyan-400" /> Creative breakdown — {ads.length} ad{ads.length === 1 ? "" : "s"}</span>
        <button onClick={getRead} disabled={loading} className="inline-flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} {ran ? "Refresh Hazel's read" : "Get Hazel's read"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-slate-300">{summary}</p>
      {note && <p className="mt-1 text-[11px] text-amber-300/80">{note}</p>}

      <div className="mt-2 space-y-1.5">
        {sorted.map((i) => {
          const fm = FLAG_META[i.flag];
          const m = i.metrics;
          return (
            <div key={i.id} className="rounded-md border border-slate-800/70 bg-slate-900/40 p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200" title={i.name}>{i.name}</span>
                {i.isTop && <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">Top performer</span>}
                {i.isWorst && !i.isTop && <span className="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">Worst</span>}
                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${fm.cls}`}>{fm.label}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-data text-[11px] text-slate-500">
                <span>spend {money(m.spend, currency)}</span>
                <span>impressions {m.impressions.toLocaleString()}</span>
                <span>reach {m.reach.toLocaleString()}</span>
                <span className={m.frequency >= FREQ_OVEREXPOSED ? "text-amber-300" : ""}>freq {m.frequency.toFixed(1)}</span>
                <span>CTR {m.ctr.toFixed(2)}%</span>
                <span>leads {m.leads}</span>
                <span className={i.isTop ? "text-emerald-300" : ""}>{m.cpl != null ? `${money(m.cpl, currency)}/lead` : "no leads"}</span>
              </div>
              <p className="mt-1 text-[12px] text-slate-300">{i.diagnosis}</p>
              <p className="mt-0.5 text-[12px] text-cyan-200">→ {i.recommendation}</p>
              {i.working && <p className="mt-0.5 text-[11px] text-emerald-300/90">What&apos;s working: {i.working}</p>}
              {i.change && <p className="mt-0.5 text-[11px] text-amber-300/90">Change: {i.change}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
