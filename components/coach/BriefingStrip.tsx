"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Compass, X, ArrowUpRight, Pause, ArrowRight, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Dot } from "@/components/ui/primitives";
import { fetchAlerts, dismissAlert, runCoachAction, type CoachAlert } from "@/lib/ai/coach";

const sevDot: Record<string, string> = { high: "red", medium: "amber", low: "cyan" };

// Hazel comes to YOU: a persistent "needs your attention" strip (mounted app-
// wide) surfacing the highest-impact things from real data — each with the why
// + one action. Confirm-gated for anything that spends. Snooze hides for ~7d.
export default function BriefingStrip() {
  const [alerts, setAlerts] = useState<CoachAlert[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [closed, setClosed] = useState(false);
  const [confirm, setConfirm] = useState<CoachAlert | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetchAlerts();
    setAlerts(r.alerts || []);
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = (key: string) => setAlerts((p) => p.filter((a) => a.key !== key));
  const snooze = (a: CoachAlert) => { remove(a.key); dismissAlert(a.key); };

  const act = async () => {
    if (!confirm?.action) return;
    setBusy(true);
    const ok = await runCoachAction({ type: confirm.action.type, id: confirm.action.id, dailyMinor: confirm.action.dailyMinor });
    setBusy(false);
    if (ok) remove(confirm.key);
    setConfirm(null);
  };

  if (!loaded || closed || alerts.length === 0) return null;

  const shown = expanded ? alerts : alerts.slice(0, 3);

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-cyan-500/30 bg-cyan-500/5">
      <div className="flex items-center gap-2 border-b border-cyan-500/20 px-4 py-2">
        <Compass className="h-4 w-4 text-cyan-300" />
        <span className="text-sm font-medium text-slate-100">Hazel — needs your attention</span>
        <span className="rounded-full bg-cyan-500/20 px-1.5 text-[11px] font-semibold text-cyan-200">{alerts.length}</span>
        <Link href="/coach" className="ml-auto inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200">Open Coach <ArrowRight className="h-3 w-3" /></Link>
        <button onClick={() => setClosed(true)} className="rounded p-1 text-slate-500 transition hover:text-slate-300" title="Hide for now"><X className="h-3.5 w-3.5" /></button>
      </div>

      <ul className="divide-y divide-slate-800/60">
        {shown.map((a) => (
          <li key={a.key} className="flex items-start gap-2.5 px-4 py-2.5">
            <Dot status={sevDot[a.severity] || "slate"} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100">{a.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">{a.detail}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {a.action ? (
                <button onClick={() => setConfirm(a)} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${a.action.type === "pause" ? "border border-red-500/40 text-red-300 hover:bg-red-500/10" : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"}`}>
                  {a.action.type === "pause" ? <><Pause className="h-3 w-3" /> Pause</> : <><ArrowUpRight className="h-3 w-3" /> {a.action.label || "Scale"}</>}
                </button>
              ) : a.link ? (
                <Link href={a.link.href} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-800">{a.link.label} <ArrowRight className="h-3 w-3" /></Link>
              ) : null}
              <button onClick={() => snooze(a)} className="rounded p-1 text-slate-500 transition hover:text-slate-300" title="Snooze ~7 days"><X className="h-3.5 w-3.5" /></button>
            </div>
          </li>
        ))}
      </ul>

      {alerts.length > 3 && (
        <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-center gap-1 border-t border-slate-800/60 py-1.5 text-[11px] text-slate-400 transition hover:bg-slate-800/30">
          {expanded ? <>Show less <ChevronUp className="h-3 w-3" /></> : <>Show {alerts.length - 3} more <ChevronDown className="h-3 w-3" /></>}
        </button>
      )}

      {confirm?.action && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div onClick={() => setConfirm(null)} className="absolute inset-0 bg-stone-900/50" />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
            <h4 className="font-display text-base font-semibold text-slate-100">{confirm.action.type === "pause" ? "Pause this ad set?" : "Increase budget?"}</h4>
            <p className="mt-1.5 text-sm text-slate-400">
              {confirm.action.type === "pause"
                ? `This pauses "${confirm.action.name}" on Meta now. You can switch it back on any time.`
                : `This raises "${confirm.action.name}" to ${confirm.action.label} on Meta now (a gradual step, so it won't reset learning).`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800">Cancel</button>
              <button onClick={act} disabled={busy} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${confirm.action.type === "pause" ? "bg-red-400 text-slate-950 hover:bg-red-300" : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"}`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {confirm.action.type === "pause" ? "Pause it" : "Do it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
