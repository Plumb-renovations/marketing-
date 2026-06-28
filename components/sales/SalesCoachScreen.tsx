"use client";

import { useCallback, useEffect, useState } from "react";
import { Target, Phone, Snowflake, Flame, Loader2, RefreshCw, AlertTriangle, TrendingUp, ChevronRight } from "lucide-react";
import { Panel, SectionHeader, Chip } from "@/components/ui/primitives";
import { useData } from "@/components/DataProvider";
import { fetchSalesCoach, type SalesCoachData, type SalesQueueItem } from "@/lib/leadJourney/client";
import { speedLabel } from "@/lib/leadJourney/coach";

const CONF: Record<string, { label: string; status: string }> = {
  early: { label: "Early read — still learning your patterns", status: "amber" },
  building: { label: "Patterns building as deals close", status: "cyan" },
  solid: { label: "Solid read on your win/loss patterns", status: "emerald" },
};

export default function SalesCoachScreen() {
  const { setSelId } = useData();
  const [data, setData] = useState<SalesCoachData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setData(await fetchSalesCoach()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const Item = ({ it, tone }: { it: SalesQueueItem; tone: "call" | "cold" }) => (
    <button onClick={() => setSelId(it.id)} className="flex w-full items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-left transition hover:border-cyan-500/40">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone === "call" ? "bg-red-500/10 text-red-300" : "bg-sky-500/10 text-sky-300"}`}>{tone === "call" ? <Phone className="h-3.5 w-3.5" /> : <Snowflake className="h-3.5 w-3.5" />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-100">{it.name}</span>
          {it.project && <span className="text-[11px] text-slate-500">· {it.project}</span>}
          {tone === "call" && it.waitingMin != null && <Chip status="red">waiting {speedLabel(it.waitingMin)}</Chip>}
          {tone === "cold" && <Chip status="sky">follow-up {(it.step ?? 0) + 1}</Chip>}
        </div>
        <p className="mt-0.5 text-xs text-cyan-200">{it.action.title}</p>
        <p className="text-[11px] text-slate-400">{it.action.detail}</p>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader icon={Target} title="Sales Coach" desc="Hazel works every deal — who to call now, which quotes are going cold, and what your wins and losses are teaching you. Open a lead to log an update and get coached." />
        <button onClick={load} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading your deals…</div>
      ) : !data ? (
        <Panel className="p-6 text-center text-sm text-slate-500">Couldn't load the Sales Coach.</Panel>
      ) : (
        <>
          {/* Call now */}
          <Panel className="p-4">
            <div className="mb-2 flex items-center gap-2"><Flame className="h-4 w-4 text-red-400" /><h3 className="font-display text-sm font-semibold text-slate-100">Call now — speed wins jobs</h3>{data.callNow.length > 0 && <Chip status="red">{data.callNow.length}</Chip>}</div>
            {data.callNow.length === 0 ? <p className="text-sm text-slate-500">No uncontacted leads — nice, you're on top of it.</p> : <div className="space-y-2">{data.callNow.map((it) => <Item key={it.id} it={it} tone="call" />)}</div>}
          </Panel>

          {/* Deals going cold */}
          <Panel className="p-4">
            <div className="mb-2 flex items-center gap-2"><Snowflake className="h-4 w-4 text-sky-400" /><h3 className="font-display text-sm font-semibold text-slate-100">Deals going cold — chase them</h3>{data.cold.length > 0 && <Chip status="sky">{data.cold.length}</Chip>}</div>
            {data.cold.length === 0 ? <p className="text-sm text-slate-500">No quotes overdue a follow-up. Keep the cadence going.</p> : <div className="space-y-2">{data.cold.map((it) => <Item key={it.id} it={it} tone="cold" />)}</div>}
          </Panel>

          {/* Patterns */}
          <Panel className="p-4">
            <div className="mb-2 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-cyan-400" /><h3 className="font-display text-sm font-semibold text-slate-100">What your deals are teaching you</h3></div>
            <p className="mb-2 text-xs text-slate-500">{data.patterns.won} won · {data.patterns.lost} lost</p>
            {data.patterns.insights.length > 0 ? (
              <ul className="space-y-1.5">{data.patterns.insights.map((i, n) => <li key={n} className="flex items-start gap-2 text-sm text-slate-200"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" /> {i}</li>)}</ul>
            ) : (
              <p className="text-sm text-slate-500">Not enough closed deals yet to spot patterns. Hazel sharpens this as you log wins and losses.</p>
            )}
            {data.patterns.lossByReason.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Losses by reason</p>
                {data.patterns.lossByReason.map((r) => (
                  <div key={r.reason} className="flex items-center gap-2 text-xs"><span className="w-44 shrink-0 truncate text-slate-300">{r.label}</span><div className="h-1.5 flex-1 rounded-full bg-slate-800"><div className="h-1.5 rounded-full bg-red-400/70" style={{ width: `${Math.min(100, (r.count / Math.max(1, data.patterns.lost)) * 100)}%` }} /></div><span className="w-6 text-right font-data text-slate-400">{r.count}</span></div>
                ))}
              </div>
            )}
            <div className="mt-3"><Chip status={CONF[data.patterns.confidence]?.status || "slate"}>{CONF[data.patterns.confidence]?.label}</Chip></div>
          </Panel>
        </>
      )}
    </div>
  );
}
