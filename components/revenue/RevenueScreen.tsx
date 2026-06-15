"use client";

import { Banknote } from "lucide-react";
import { Panel, Eyebrow, SectionHeader, StatTable, SrcChip } from "@/components/ui/primitives";
import { audFmt, leadValue, monthKey } from "@/lib/domain/format";
import type { Lead } from "@/lib/domain/types";
import { useData } from "@/components/DataProvider";

export default function RevenueScreen() {
  const { leads } = useData();
  const won = leads.filter((l) => l.stage === "won");
  const totalRev = won.reduce((s, l) => s + leadValue(l), 0);
  const byMonth: Record<string, { jobs: number; rev: number }> = {};
  won.forEach((l) => {
    const k = monthKey(l.date);
    byMonth[k] = byMonth[k] || { jobs: 0, rev: 0 };
    byMonth[k].jobs++;
    byMonth[k].rev += leadValue(l);
  });
  const months = Object.entries(byMonth);
  const avg = won.length ? totalRev / won.length : 0;

  return (
    <div className="space-y-8">
      <SectionHeader icon={Banknote} title="Job Revenue" desc="Won jobs, totalled overall and by month. Updates automatically as you mark quotes won." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel className="p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Total revenue won</p><p className="mt-2 font-data text-2xl font-semibold tabular-nums text-emerald-300">{audFmt(totalRev)}</p></Panel>
        <Panel className="p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Jobs won</p><p className="mt-2 font-data text-2xl font-semibold tabular-nums text-slate-100">{won.length}</p></Panel>
        <Panel className="p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Average job</p><p className="mt-2 font-data text-2xl font-semibold tabular-nums text-slate-100">{audFmt(avg)}</p></Panel>
        <Panel className="p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Open quotes</p><p className="mt-2 font-data text-2xl font-semibold tabular-nums text-amber-300">{audFmt(leads.filter((l) => l.stage === "quote").reduce((s, l) => s + leadValue(l), 0))}</p></Panel>
      </div>

      <div>
        <Eyebrow>By month</Eyebrow>
        <div className="mt-3">
          <StatTable columns={["Month", "Jobs won", "Revenue won"]} rows={months.length ? months : [["—", { jobs: 0, rev: 0 }]]}
            render={([m, v]: [string, { jobs: number; rev: number }]) => (
              <tr key={m} className="text-slate-300"><td className="px-4 py-3 font-medium text-slate-200">{m}</td><td className="px-4 py-3 text-right font-data tabular-nums">{v.jobs}</td><td className="px-4 py-3 text-right font-data tabular-nums text-emerald-300">{audFmt(v.rev)}</td></tr>
            )} />
        </div>
      </div>

      <div>
        <Eyebrow>Won jobs</Eyebrow>
        <div className="mt-3">
          <StatTable columns={["Date", "Name", "Suburb", "Project", "Source", "Revenue", "Tradify #"]} rows={won}
            render={(l: Lead) => (
              <tr key={l.id} className="text-slate-300">
                <td className="px-4 py-3 font-data text-slate-400">{l.date}</td>
                <td className="px-4 py-3 font-medium text-slate-200">{l.name}</td>
                <td className="px-4 py-3">{l.suburb}</td>
                <td className="px-4 py-3 text-slate-400">{l.project}</td>
                <td className="px-4 py-3 text-right"><SrcChip source={l.source} /></td>
                <td className="px-4 py-3 text-right font-data tabular-nums text-emerald-300">{audFmt(leadValue(l))}</td>
                <td className="px-4 py-3 text-right text-xs text-slate-500">{l.tradify || "—"}</td>
              </tr>
            )} />
        </div>
      </div>
    </div>
  );
}
