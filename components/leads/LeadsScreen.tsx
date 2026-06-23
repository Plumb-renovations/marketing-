"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, X, CalendarDays, RotateCcw, Plus, TrendingUp, MapPin, Archive, ArchiveRestore,
} from "lucide-react";
import { Panel, SrcChip } from "@/components/ui/primitives";
import { STAGES, SOURCES, STATUS } from "@/lib/domain/constants";
import { AI_RECS } from "@/lib/domain/constants";
import { audFmt, leadValue } from "@/lib/domain/format";
import type { Lead } from "@/lib/domain/types";
import { useData } from "@/components/DataProvider";

function AiBanner({ onOpen, dismissed, setDismissed }: { onOpen: () => void; dismissed: boolean; setDismissed: (v: boolean) => void }) {
  if (dismissed) return null;
  const r = AI_RECS.find((x) => x.priority);
  if (!r) return null; // no fabricated priority rec — banner only shows for real recs
  return (
    <Panel glow className="mb-5 bg-cyan-500/5">
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300"><Zap className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">Priority</span><span className="text-[10px] uppercase tracking-wider text-slate-500 font-display">{r.area} · confidence {r.confidence}%</span></div>
          <p className="mt-1 text-sm font-medium text-slate-100">{r.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={onOpen} className="rounded-lg bg-cyan-500 px-2.5 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-cyan-400">View actions</button>
          <button onClick={() => setDismissed(true)} className="rounded-md border border-slate-700 p-1.5 text-slate-500 transition hover:bg-slate-800"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </Panel>
  );
}

function LeadCard({ lead, onClick, onArchive }: { lead: Lead; onClick: () => void; onArchive: () => void }) {
  const val = leadValue(lead);
  return (
    <div className="group relative rounded-xl border border-slate-800 bg-slate-900 transition hover:border-cyan-500/40 hover:bg-slate-800/60">
      <button onClick={onClick} className="w-full p-3 text-left">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-semibold text-slate-100">{lead.name}</span>
          <SrcChip source={lead.source} />
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="h-3 w-3" />{lead.suburb} · {lead.project}</div>
        {val > 0 && (
          <div className="mt-2 flex items-center justify-between">
            <span className="font-data text-sm font-semibold tabular-nums text-slate-200">{audFmt(val)}</span>
            {lead.stage === "lost" && lead.lostReason && <span className="text-[10px] text-red-300">{lead.lostReason}</span>}
            {lead.quotes.length > 1 && <span className="text-[10px] text-slate-500">{lead.quotes.length} quotes</span>}
          </div>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onArchive(); }}
        title="Archive lead (removes it from lists + metrics)"
        className="absolute bottom-2 right-2 rounded-md border border-slate-700 bg-slate-950/80 p-1.5 text-slate-500 opacity-0 transition hover:text-amber-300 focus:opacity-100 group-hover:opacity-100"
      >
        <Archive className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StageColumn({ stage, leads, onCard, onArchive }: { stage: (typeof STAGES)[number]; leads: Lead[]; onCard: (id: string) => void; onArchive: (id: string) => void }) {
  const total = leads.reduce((s, l) => s + leadValue(l), 0);
  const showValue = ["quote", "won", "lost"].includes(stage.id);
  const a = STATUS[stage.accent] || STATUS.slate;
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${a.dot}`} /><span className="font-display text-sm font-semibold text-slate-200">{stage.label}</span><span className="font-data text-xs text-slate-500">{leads.length}</span></div>
        {showValue && total > 0 && <span className="font-data text-[11px] tabular-nums text-slate-400">{audFmt(total)}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-2">
        {leads.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate-600">Nothing here</p>}
        {leads.map((l) => <LeadCard key={l.id} lead={l} onClick={() => onCard(l.id)} onArchive={() => onArchive(l.id)} />)}
      </div>
    </div>
  );
}

function ArchivedList({ leads, onRestore }: { leads: Lead[]; onRestore: (id: string) => void }) {
  if (leads.length === 0) {
    return <Panel className="p-10 text-center text-sm text-slate-500">No archived leads. Archive a test/junk lead from the board and it'll move here — out of all counts and metrics.</Panel>;
  }
  return (
    <div className="space-y-2">
      {leads.map((l) => (
        <Panel key={l.id} className="flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-sm font-semibold text-slate-200">{l.name}</span>
              <SrcChip source={l.source} />
              <span className="text-[11px] capitalize text-slate-500">{l.stage}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="h-3 w-3" />{l.suburb} · {l.project}</div>
          </div>
          <button onClick={() => onRestore(l.id)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-emerald-300">
            <ArchiveRestore className="h-3.5 w-3.5" /> Unarchive
          </button>
        </Panel>
      ))}
    </div>
  );
}

export default function LeadsScreen() {
  const { leads, archivedLeads, actions, setSelId, setAddOpen, aiDismissed, setAiDismissed, resetBoard } = useData();
  const router = useRouter();
  const [month, setMonth] = useState("all");
  const [view, setView] = useState<"active" | "archived">("active");
  const monthLabel = (ym: string) => { const d = new Date(ym + "-01"); return isNaN(+d) ? ym : d.toLocaleDateString("en-AU", { month: "short", year: "numeric" }); };
  const monthsPresent = Array.from(new Set(leads.map((l) => (l.date || "").slice(0, 7)).filter(Boolean))).sort().reverse();
  const shown = month === "all" ? leads : leads.filter((l) => (l.date || "").slice(0, 7) === month);
  const trend = monthsPresent.slice().reverse().map((ym) => {
    const ls = leads.filter((l) => (l.date || "").slice(0, 7) === ym);
    return { ym, label: monthLabel(ym), paid: ls.filter((l) => SOURCES[l.source]?.paid).length, organic: ls.filter((l) => SOURCES[l.source] && !SOURCES[l.source].paid).length, total: ls.length };
  });
  const maxTrend = Math.max(1, ...trend.map((t) => t.total));

  return (
    <div>
      <AiBanner onOpen={() => router.push("/actions")} dismissed={aiDismissed} setDismissed={setAiDismissed} />

      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => setView("active")} className={tabCls(view === "active")}>Board</button>
        <button onClick={() => setView("archived")} className={tabCls(view === "archived")}>
          <Archive className="h-3.5 w-3.5" /> Archived{archivedLeads.length ? ` (${archivedLeads.length})` : ""}
        </button>
      </div>

      {view === "archived" ? (
        <ArchivedList leads={archivedLeads} onRestore={actions.unarchive} />
      ) : (
      <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Click any card to qualify it, build a quote, or mark it won or lost.</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-slate-500" />
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500/50">
              <option value="all">All months</option>
              {monthsPresent.map((ym) => <option key={ym} value={ym}>{monthLabel(ym)}</option>)}
            </select>
          </div>
          <button onClick={resetBoard} title="Reset to tracker data" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
          <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"><Plus className="h-4 w-4" /> Add lead</button>
        </div>
      </div>

      {trend.length > 0 && (
        <Panel className="mb-4 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 font-display"><TrendingUp className="h-3.5 w-3.5 text-cyan-400" />Leads per month</div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Paid</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Organic</span>
            </div>
          </div>
          <div className="mt-3 flex items-end gap-3 overflow-x-auto">
            {trend.map((t) => (
              <button key={t.ym} onClick={() => setMonth(month === t.ym ? "all" : t.ym)} className="flex shrink-0 flex-col items-center gap-1" style={{ width: 44 }} title={`${t.label}: ${t.paid} paid · ${t.organic} organic`}>
                <span className="font-data text-[11px] tabular-nums text-slate-300">{t.total}</span>
                <span className="flex h-24 w-full flex-col justify-end overflow-hidden rounded-md border border-slate-800 bg-slate-950">
                  <span className="w-full bg-emerald-400/80" style={{ height: `${(t.organic / maxTrend) * 100}%` }} />
                  <span className="w-full bg-amber-400/80" style={{ height: `${(t.paid / maxTrend) * 100}%` }} />
                </span>
                <span className={`text-[10px] ${month === t.ym ? "text-cyan-300" : "text-slate-500"}`}>{t.label}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((s) => <StageColumn key={s.id} stage={s} leads={shown.filter((l) => l.stage === s.id)} onCard={setSelId} onArchive={actions.archive} />)}
      </div>
      </>
      )}
    </div>
  );
}

const tabCls = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${active ? "bg-cyan-500 text-slate-950" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`;
