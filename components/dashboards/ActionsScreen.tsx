"use client";

import { useState } from "react";
import { ListChecks, Check, X } from "lucide-react";
import { Panel, Eyebrow, Chip, Dot, SectionHeader, Dial } from "@/components/ui/primitives";
import { ACTIONS, AI_RECS } from "@/lib/domain/constants";
import { useData } from "@/components/DataProvider";

export default function ActionsScreen() {
  const { done, toggleDone } = useData();
  const [filter, setFilter] = useState("all");
  const [recState, setRecState] = useState<Record<string, string>>({});
  const tabs = [
    { id: "all", label: "All" },
    { id: "high", label: "High" },
    { id: "med", label: "Medium" },
    { id: "low", label: "Low" },
  ];
  const list = ACTIONS.filter((a) => filter === "all" || a.pri === filter);
  const doneCount = ACTIONS.filter((a) => done.has(a.id)).length;
  const priColor: Record<string, string> = { high: "red", med: "amber", low: "slate" };
  const priority = AI_RECS.find((r) => r.priority)!;
  const rest = AI_RECS.filter((r) => !r.priority);

  return (
    <div className="space-y-6">
      <SectionHeader icon={ListChecks} title="Action Centre" desc="Your marketing chief’s read on the data, then every move ranked by impact." />

      <Panel glow className="bg-cyan-500/5 p-5">
        <div className="flex items-center gap-2"><span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">Priority</span><span className="text-[10px] uppercase tracking-wider text-slate-500 font-display">{priority.area} · confidence {priority.confidence}%</span></div>
        <h3 className="mt-2 font-display text-lg font-semibold leading-snug tracking-tight text-slate-100">{priority.title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{priority.body}</p>
        <p className="mt-2 text-[11px] text-cyan-300">{priority.estimate}</p>
      </Panel>
      <ul className="space-y-2">
        {rest.map((r) => {
          const s = recState[r.id];
          if (s === "dismissed") return null;
          return (
            <li key={r.id} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
              <Dot status={r.impact === "high" ? "red" : "amber"} />
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-wider text-slate-500 font-display">{r.area}</span><span className="font-data text-[10px] text-slate-600">conf {r.confidence}%</span></div><p className={`text-sm font-medium ${s === "done" ? "text-slate-500 line-through" : "text-slate-200"}`}>{r.title}</p><p className="mt-0.5 text-xs text-slate-500">{r.body}</p></div>
              <div className="flex shrink-0 gap-1">{s !== "done" ? (<><button onClick={() => setRecState((p) => ({ ...p, [r.id]: "done" }))} className="rounded-md border border-slate-700 p-1.5 text-slate-300 transition hover:border-cyan-500/50"><Check className="h-3.5 w-3.5" /></button><button onClick={() => setRecState((p) => ({ ...p, [r.id]: "dismissed" }))} className="rounded-md border border-slate-700 p-1.5 text-slate-500 transition hover:bg-slate-800"><X className="h-3.5 w-3.5" /></button></>) : <Check className="h-4 w-4 text-emerald-400" />}</div>
            </li>
          );
        })}
      </ul>

      <Panel className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">Checklist progress</span><span className="font-data text-sm text-slate-200">{doneCount}/{ACTIONS.length}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400" style={{ width: `${(doneCount / ACTIONS.length) * 100}%` }} /></div></Panel>

      <div className="flex gap-2">{tabs.map((t) => <button key={t.id} onClick={() => setFilter(t.id)} className={`rounded-lg px-3 py-1.5 text-sm transition ${filter === t.id ? "bg-cyan-500 text-slate-950" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>{t.label}</button>)}</div>
      <ul className="space-y-2">{list.map((a) => {
        const isDone = done.has(a.id);
        return (
          <li key={a.id}><Panel className={`p-4 transition ${isDone ? "opacity-60" : ""}`}><div className="flex items-start gap-3">
            <button onClick={() => toggleDone(a.id)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${isDone ? "border-cyan-500 bg-cyan-500" : "border-slate-600 hover:border-cyan-500/60"}`}>{isDone && <Check className="h-3.5 w-3.5 text-slate-950" />}</button>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Chip status={priColor[a.pri]}>{a.pri === "med" ? "medium" : a.pri}</Chip><span className="font-data text-[11px] text-cyan-300">{a.lift}</span></div><p className={`mt-1.5 text-sm ${isDone ? "text-slate-500 line-through" : "text-slate-200"}`}>{a.text}</p></div>
            <div className="flex shrink-0 gap-4 text-center"><Dial label="Impact" value={a.impact} tone="cyan" /><Dial label="Effort" value={a.diff} tone="slate" /></div>
          </div></Panel></li>
        );
      })}</ul>
    </div>
  );
}
