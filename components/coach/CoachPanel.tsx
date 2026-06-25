"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Compass, Loader2, AlertTriangle, RefreshCw, TrendingUp, TrendingDown, Minus,
  ArrowUpRight, Pause, ArrowRight, Sparkles,
} from "lucide-react";
import { Panel, Chip, Dot } from "@/components/ui/primitives";
import { fetchCoach, runCoachAction, type CoachReport, type CoachInsight } from "@/lib/ai/coach";

const sevDot: Record<string, string> = { high: "red", medium: "amber", low: "cyan" };
const CONF: Record<string, { label: string; status: string }> = {
  early: { label: "Early read — still learning your account", status: "amber" },
  building: { label: "Building confidence as your data grows", status: "cyan" },
  solid: { label: "Solid read on your account", status: "emerald" },
};

type Confirm = { insight: CoachInsight } | null;

// Hazel's proactive coach. `limit` trims for compact placements (home / Meta);
// the full list + headline + weekly lives on the /coach page.
export default function CoachPanel({ limit, showWeekly = true, compact = false }: { limit?: number; showWeekly?: boolean; compact?: boolean }) {
  const [report, setReport] = useState<CoachReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [actioned, setActioned] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setReport(await fetchCoach()); } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const doAction = async () => {
    if (!confirm?.insight.signalAction) return;
    const a = confirm.insight.signalAction;
    setBusy(true);
    const ok = await runCoachAction({ type: a.type, id: a.id, dailyMinor: a.dailyMinor });
    setBusy(false);
    setConfirm(null);
    if (ok) { setActioned((p) => new Set(p).add(confirm.insight.signalId || a.id)); setTimeout(load, 800); }
  };

  if (loading) {
    return <Panel className="p-5"><div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Hazel is reviewing your account…</div></Panel>;
  }
  if (error || !report) {
    return (
      <Panel className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-2 text-sm text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error || "Coach unavailable."}</div>
          <button onClick={load} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800"><RefreshCw className="h-3.5 w-3.5" /></button>
        </div>
      </Panel>
    );
  }

  const conf = CONF[report.confidence] || CONF.building;
  const insights = limit ? report.insights.slice(0, limit) : report.insights;
  const w = report.weekly;

  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"><Compass className="h-4 w-4" /></span>
          <div>
            <h3 className="font-display text-base font-semibold text-slate-100">Hazel's Marketing Coach</h3>
            <p className="text-[11px] text-slate-500">What a top media buyer would do with your account right now.</p>
          </div>
        </div>
        <button onClick={load} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800" title="Refresh"><RefreshCw className="h-3.5 w-3.5" /></button>
      </div>

      {report.headline && (
        <p className="mb-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-3 py-2.5 text-sm text-cyan-100">
          <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-cyan-400" />{report.headline}
        </p>
      )}

      {/* Weekly facts — the report states WHAT happened. */}
      {showWeekly && w && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5 text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-slate-200">
            {w.direction === "up" ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : w.direction === "down" ? <TrendingDown className="h-4 w-4 text-red-400" /> : <Minus className="h-4 w-4 text-slate-500" />}
            This week vs last
          </span>
          <span className="text-slate-400">Leads <span className="font-data text-slate-200">{w.last.leads}→{w.this.leads}</span>{w.leadsDeltaPct != null && <span className={w.leadsDeltaPct >= 0 ? "text-emerald-400" : "text-red-400"}> ({w.leadsDeltaPct >= 0 ? "+" : ""}{w.leadsDeltaPct}%)</span>}</span>
          <span className="text-slate-400">Cost/lead <span className="font-data text-slate-200">{w.this.cpl != null ? `$${w.this.cpl}` : "—"}</span></span>
          <span className="text-slate-400">Spend <span className="font-data text-slate-200">${Math.round(w.this.spend)}</span></span>
        </div>
      )}

      {insights.length === 0 ? (
        <p className="text-sm text-slate-500">You're in good shape — nothing urgent right now. Hazel will flag the moment something needs attention.</p>
      ) : (
        <ul className="space-y-2.5">
          {insights.map((it, i) => {
            const done = actioned.has(it.signalId || "");
            return (
              <li key={i} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
                <div className="flex items-start gap-3">
                  <Dot status={sevDot[it.severity] || "slate"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-display">{it.area}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-100">{it.title}</p>
                    {it.why && <p className="mt-0.5 text-xs text-slate-400">{it.why}</p>}
                    {it.action && <p className="mt-1 text-xs text-cyan-200">→ {it.action}</p>}
                    {it.signalAction && !done && (
                      <button
                        onClick={() => setConfirm({ insight: it })}
                        className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${it.signalAction.type === "pause" ? "border border-red-500/40 text-red-300 hover:bg-red-500/10" : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"}`}
                      >
                        {it.signalAction.type === "pause" ? <><Pause className="h-3.5 w-3.5" /> Pause it</> : <><ArrowUpRight className="h-3.5 w-3.5" /> Scale to {it.signalAction.label}</>}
                      </button>
                    )}
                    {done && <p className="mt-2 text-xs text-emerald-400">✓ Done — Hazel will re-check after Meta settles.</p>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between">
        <Chip status={conf.status}>{conf.label}</Chip>
        {compact && <Link href="/coach" className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200">Open Coach <ArrowRight className="h-3.5 w-3.5" /></Link>}
      </div>

      {/* Confirm-gated action */}
      {confirm?.insight.signalAction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div onClick={() => setConfirm(null)} className="absolute inset-0 bg-stone-900/50" />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
            <h4 className="font-display text-base font-semibold text-slate-100">
              {confirm.insight.signalAction.type === "pause" ? "Pause this ad set?" : "Increase budget?"}
            </h4>
            <p className="mt-1.5 text-sm text-slate-400">
              {confirm.insight.signalAction.type === "pause"
                ? `This pauses "${confirm.insight.signalAction.name}" on Meta now. You can switch it back on any time.`
                : `This raises "${confirm.insight.signalAction.name}" to ${confirm.insight.signalAction.label} on Meta now (a gradual step, so it won't reset learning).`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800">Cancel</button>
              <button onClick={doAction} disabled={busy} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${confirm.insight.signalAction.type === "pause" ? "bg-red-400 text-slate-950 hover:bg-red-300" : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"}`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {confirm.insight.signalAction.type === "pause" ? "Pause it" : "Do it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
