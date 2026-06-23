"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Facebook, ChevronRight, ChevronDown, Loader2, AlertTriangle, RefreshCw, TrendingUp,
  Pause, Rocket, Sparkles, Gauge, Plug,
} from "lucide-react";
import { Panel, SectionHeader, Chip } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/quotes/model";
import { fetchAdTargets, saveAdTargets } from "@/lib/data/adTargets";
import {
  calibrateTargets, verdictFor, consolidationTip,
  type ResolvedTargets, type TargetOverrides, type Verdict, type NodeInput,
} from "@/lib/meta/verdict";

const VERDICT_CLS: Record<string, string> = {
  scale: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  hold: "bg-slate-700/40 text-slate-300 border-slate-600/50",
  pause: "bg-red-500/10 text-red-300 border-red-500/30",
  learning: "bg-amber-500/10 text-amber-300 border-amber-500/30",
};

type Confirm = { title: string; body: string; type: "budget" | "pause"; id: string; dailyMinor?: number } | null;

export default function MetaManagerScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<any>(null);
  const [overrides, setOverrides] = useState<TargetOverrides>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showTargets, setShowTargets] = useState(false);

  const load = useCallback(async () => {
    const [res, ov] = await Promise.all([
      fetch("/api/meta/insights").then((r) => r.json()).catch(() => ({ error: "fetch_failed" })),
      fetchAdTargets(supabase),
    ]);
    setData(res);
    setOverrides(ov);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const tree = data?.tree;
  const currency = tree?.currency || "AUD";
  const targets: ResolvedTargets = useMemo(
    () => calibrateTargets(
      { spend: tree?.account?.spend || 0, leads: tree?.account?.leads || 0, costPerWon: data?.accountCostPerWon ?? null },
      overrides,
    ),
    [tree, data, overrides],
  );

  const runAction = async () => {
    if (!confirm) return;
    setBusyId(confirm.id);
    try {
      await fetch("/api/meta/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: confirm.type, id: confirm.id, dailyMinor: confirm.dailyMinor }),
      });
      setConfirm(null);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading your Meta campaigns…</div>;
  }

  if (data?.configured === false) {
    return (
      <div className="space-y-6">
        <SectionHeader icon={Facebook} title="Meta Ads" desc="Your full campaign → ad set → ad manager, with Hazel's verdict on every ad." />
        <Panel className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan-400"><Plug className="h-6 w-6" /></div>
          <h3 className="mt-4 font-display text-base font-semibold text-slate-100">Connect Meta to see your ads</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Once your Meta ad account is connected, Hazel pulls every campaign, ad set and ad and tells you what to scale, hold or pause.</p>
          <Link href="/integrations" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400">Go to Integrations</Link>
        </Panel>
      </div>
    );
  }

  if (data?.error === "reconnect") {
    return (
      <div className="space-y-6">
        <SectionHeader icon={Facebook} title="Meta Ads" desc="Your full campaign → ad set → ad manager." />
        <Panel className="p-6"><div className="flex items-start gap-2 text-sm text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4" /> Your Meta connection expired. <Link href="/integrations" className="text-cyan-300 underline">Reconnect in Integrations</Link> to refresh the data.</div></Panel>
      </div>
    );
  }

  if (data?.error || !tree) {
    return (
      <div className="space-y-6">
        <SectionHeader icon={Facebook} title="Meta Ads" desc="Your full campaign → ad set → ad manager." />
        <Panel className="p-6"><div className="flex items-start gap-2 text-sm text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4" /> Couldn't load Meta data{data?.message ? `: ${data.message}` : ""}. <button onClick={load} className="text-cyan-300 underline">Try again</button></div></Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader icon={Facebook} title="Meta Ads" desc="Campaign → ad set → ad, with Hazel's plain-English verdict on every ad." />
        <button onClick={load} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {/* Hazel's current targets (auto-tuned) */}
      <Panel className="p-4">
        <button onClick={() => setShowTargets((v) => !v)} className="flex w-full items-center gap-2 text-left">
          <Gauge className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-slate-200">Hazel's current targets</span>
          <span className="text-[11px] text-slate-500">healthy &lt; {money(targets.healthyCpl, currency)}/lead · pause &gt; {money(targets.concerningCpl, currency)}/lead{targets.targetCostPerWon ? ` · won-job target ${money(targets.targetCostPerWon, currency)}` : ""}</span>
          {showTargets ? <ChevronDown className="ml-auto h-4 w-4 text-slate-500" /> : <ChevronRight className="ml-auto h-4 w-4 text-slate-500" />}
        </button>
        <p className="mt-1 pl-6 text-[11px] text-slate-500">{targets.basis} {targets.recalibrated ? "" : "Defaults shown — they re-tune automatically."}</p>
        {showTargets && (
          <TargetOverridesEditor
            current={targets}
            overrides={overrides}
            currency={currency}
            onSave={async (o) => { await saveAdTargets(supabase, o); setOverrides(o); }}
          />
        )}
      </Panel>

      {tree.campaigns.length === 0 && <Panel className="p-10 text-center text-sm text-slate-500">No campaigns in this ad account yet.</Panel>}

      <div className="space-y-3">
        {tree.campaigns.map((c: any) => {
          const tip = consolidationTip(c.adsets, targets);
          return (
            <Panel key={c.id} className="overflow-hidden p-0">
              <RowHeader node={c} level="campaign" currency={currency} open={expanded.has(c.id)} onToggle={() => toggle(c.id)} />
              {expanded.has(c.id) && (
                <div className="border-t border-slate-800 bg-slate-950/30 px-3 py-2">
                  {tip && <div className="mb-2 flex items-start gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-2.5 text-xs text-cyan-200"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {tip}</div>}
                  {c.adsets.length === 0 && <p className="px-2 py-3 text-xs text-slate-600">No ad sets.</p>}
                  {c.adsets.map((s: any) => {
                    const v = verdictFor(toInput(s, "adset"), targets);
                    return (
                      <div key={s.id} className="mb-1.5 rounded-lg border border-slate-800/70">
                        <RowHeader node={s} level="adset" currency={currency} open={expanded.has(s.id)} onToggle={() => toggle(s.id)} verdict={v} />
                        <VerdictBar v={v} busy={busyId === s.id} onAct={(cf) => setConfirm(cf)} node={s} currency={currency} />
                        {expanded.has(s.id) && (
                          <div className="border-t border-slate-800 bg-slate-950/40 px-2 py-1.5">
                            {s.ads.length === 0 && <p className="px-2 py-2 text-xs text-slate-600">No ads.</p>}
                            {s.ads.map((a: any) => {
                              const av = verdictFor(toInput(a, "ad"), targets);
                              return (
                                <div key={a.id} className="mb-1 rounded-md border border-slate-800/60">
                                  <RowHeader node={a} level="ad" currency={currency} verdict={av} />
                                  <VerdictBar v={av} busy={busyId === a.id} onAct={(cf) => setConfirm(cf)} node={a} currency={currency} />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => !busyId && setConfirm(null)}>
          <div className="absolute inset-0 bg-slate-950/70" />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-semibold text-slate-100">{confirm.title}</h3>
            <p className="mt-1.5 text-sm text-slate-400">{confirm.body}</p>
            <p className="mt-2 text-[11px] text-amber-300/90">This writes to Meta live and affects real spend.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} disabled={!!busyId} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800">Cancel</button>
              <button onClick={runAction} disabled={!!busyId} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-950 transition ${confirm.type === "pause" ? "bg-red-400 hover:bg-red-300" : "bg-cyan-500 hover:bg-cyan-400"}`}>
                {busyId ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {confirm.type === "pause" ? "Pause it" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toInput(node: any, level: "campaign" | "adset" | "ad"): NodeInput {
  return {
    level,
    status: node.status,
    spend: node.spend,
    leads: node.leads,
    ctr: node.ctr,
    dailyBudgetMinor: node.dailyBudgetMinor ?? null,
    updatedTime: node.updatedTime,
    costPerWon: node.costPerWon ?? null,
    wonJobs: node.wonJobs ?? 0,
  };
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="text-right"><div className="font-data text-xs tabular-nums text-slate-200">{value}</div><div className="text-[9px] uppercase tracking-wider text-slate-600">{label}</div></div>;
}

function RowHeader({ node, level, currency, open, onToggle, verdict }: { node: any; level: string; currency: string; open?: boolean; onToggle?: () => void; verdict?: Verdict }) {
  const cpl = node.leads > 0 ? node.spend / node.leads : null;
  const statusOk = !node.status || /ACTIVE/i.test(node.status);
  const pad = level === "campaign" ? "px-4 py-3" : level === "adset" ? "px-3 py-2.5" : "px-2.5 py-2";
  return (
    <div className={`flex items-center gap-3 ${pad}`}>
      <button onClick={onToggle} disabled={!onToggle} className={`flex min-w-0 flex-1 items-center gap-2 text-left ${!onToggle ? "cursor-default" : ""}`}>
        {onToggle ? (open ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />) : <span className="w-4 shrink-0" />}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`truncate ${level === "campaign" ? "font-display text-sm font-semibold text-slate-100" : "text-sm text-slate-200"}`}>{node.name}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] ${statusOk ? "text-emerald-400" : "text-slate-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${statusOk ? "bg-emerald-400" : "bg-slate-500"}`} />{(node.status || "—").toLowerCase().replace(/_/g, " ")}</span>
          </div>
          {verdict && <div className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">{node.level || ""}</div>}
        </div>
      </button>
      <div className="hidden items-center gap-3 sm:flex">
        <Metric label="spend" value={money(node.spend, currency)} />
        <Metric label="leads" value={String(node.leads)} />
        <Metric label="cost/lead" value={cpl != null ? money(cpl, currency) : "—"} />
        <Metric label="ctr" value={`${node.ctr.toFixed(2)}%`} />
        <Metric label="reach" value={node.reach.toLocaleString()} />
        <Metric label="freq" value={node.frequency.toFixed(2)} />
      </div>
      {verdict && <Chip status={verdict.kind === "scale" ? "emerald" : verdict.kind === "pause" ? "red" : verdict.kind === "learning" ? "amber" : "slate"}>{verdict.label}</Chip>}
    </div>
  );
}

function VerdictBar({ v, node, currency, busy, onAct }: { v: Verdict; node: any; currency: string; busy: boolean; onAct: (c: Confirm) => void }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-800/60 px-3 py-2 text-xs`}>
      <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${VERDICT_CLS[v.kind]}`}>{v.label}</span>
      <span className="min-w-0 flex-1 text-slate-300">{v.reason}</span>
      <span className="hidden text-[10px] text-slate-600 lg:inline">{v.basisNote}</span>
      {v.action?.type === "budget" && v.action.figureMinor && (
        <button
          disabled={busy}
          onClick={() => onAct({ type: "budget", id: node.id, dailyMinor: v.action!.figureMinor, title: `Increase budget to ${v.action!.figureLabel}?`, body: `Raise "${node.name}" to ${v.action!.figureLabel} (a +${Math.round(((v.action!.figureMinor! / (node.dailyBudgetMinor || v.action!.figureMinor!)) - 1) * 100)}% step). Meta keeps optimising; big jumps reset learning.` })}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
        >
          <Rocket className="h-3 w-3" /> Increase to {v.action.figureLabel}
        </button>
      )}
      {v.action?.type === "pause" && (
        <button
          disabled={busy}
          onClick={() => onAct({ type: "pause", id: node.id, title: `Pause "${node.name}"?`, body: `This switches the ${node.level || "ad"} off in Meta. You can turn it back on any time.` })}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-500/15 px-2 py-1 text-[11px] font-medium text-red-300 transition hover:bg-red-500/25 disabled:opacity-50"
        >
          <Pause className="h-3 w-3" /> Pause it
        </button>
      )}
    </div>
  );
}

function TargetOverridesEditor({ current, overrides, currency, onSave }: { current: ResolvedTargets; overrides: TargetOverrides; currency: string; onSave: (o: TargetOverrides) => Promise<void> }) {
  const [o, setO] = useState<TargetOverrides>(overrides);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return (
    <div className="mt-3 border-t border-slate-800 pt-3">
      <p className="mb-2 text-[11px] text-slate-500">Advanced — Hazel auto-tunes these. Leave blank to use the auto value (shown as the placeholder); set one to pin it.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Healthy cost/lead" ph={String(current.healthyCpl)} value={o.targetCpl} onChange={(v) => { setO((p) => ({ ...p, targetCpl: num(v) })); setSaved(false); }} />
        <Field label="Pause over cost/lead" ph={String(current.concerningCpl)} value={o.concerningCpl} onChange={(v) => { setO((p) => ({ ...p, concerningCpl: num(v) })); setSaved(false); }} />
        <Field label="Target cost/won job" ph={current.targetCostPerWon ? String(current.targetCostPerWon) : "—"} value={o.targetCostPerWon} onChange={(v) => { setO((p) => ({ ...p, targetCostPerWon: num(v) })); setSaved(false); }} />
        <Field label="Scale step %" ph={String(current.budgetStepPct)} value={o.budgetStepPct} onChange={(v) => { setO((p) => ({ ...p, budgetStepPct: num(v) })); setSaved(false); }} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={async () => { setSaving(true); try { await onSave(o); setSaved(true); } finally { setSaving(false); } }} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save targets</button>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
        <span className="text-[11px] text-slate-600">in {currency}</span>
      </div>
    </div>
  );
}

function Field({ label, ph, value, onChange }: { label: string; ph: string; value: number | null | undefined; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-display">{label}</span>
      <input type="number" value={value ?? ""} placeholder={ph} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-data text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50" />
    </label>
  );
}
