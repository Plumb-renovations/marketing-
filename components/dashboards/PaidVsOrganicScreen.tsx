"use client";

import { Scale, Coins, TrendingUp, PlugZap } from "lucide-react";
import { Panel, Eyebrow, Chip, SrcChip, SectionHeader, StatTable, SettingNum } from "@/components/ui/primitives";
import { SOURCES, SOURCE_KEYS } from "@/lib/domain/constants";
import { audFmt, leadValue } from "@/lib/domain/format";
import type { Metrics } from "@/lib/domain/types";
import { useData } from "@/components/DataProvider";

export default function PaidVsOrganicScreen() {
  const { leads, metrics, setMetrics } = useData();
  const setSpend = (k: string, v: number) => setMetrics((m) => ({ ...m, spend: { ...m.spend, [k]: v } }));
  const setOrg = (k: keyof Metrics["organic"], v: number) => setMetrics((m) => ({ ...m, organic: { ...m.organic, [k]: v } }));
  const rowFor = (k: string) => {
    const ls = leads.filter((l) => l.source === k);
    const won = ls.filter((l) => l.stage === "won");
    const revenue = won.reduce((s, l) => s + leadValue(l), 0);
    const cost = SOURCES[k].paid ? metrics.spend[k] || 0 : 0;
    return { k, paid: SOURCES[k].paid, leads: ls.length, won: won.length, revenue, cost, cpl: ls.length ? cost / ls.length : 0, cpw: won.length ? cost / won.length : 0 };
  };
  const allRows = SOURCE_KEYS.map(rowFor);
  const rows = allRows.filter((r) => r.paid || r.leads > 0);
  const paidRows = allRows.filter((r) => r.paid);
  const orgRows = allRows.filter((r) => !r.paid);
  const sum = (a: typeof allRows, f: (r: (typeof allRows)[number]) => number) => a.reduce((s, r) => s + f(r), 0);
  const pT = { leads: sum(paidRows, (r) => r.leads), won: sum(paidRows, (r) => r.won), cost: sum(paidRows, (r) => r.cost), rev: sum(paidRows, (r) => r.revenue) };
  const oT = { leads: sum(orgRows, (r) => r.leads), won: sum(orgRows, (r) => r.won), rev: sum(orgRows, (r) => r.revenue) };

  return (
    <div className="space-y-8">
      <SectionHeader icon={Scale} title="Paid vs Organic" desc="Every channel side by side — leads, cost, cost per lead, and how many became jobs. Driven by how each lead is tagged." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel className="p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Paid leads → won</p><p className="mt-2 font-data text-2xl font-semibold tabular-nums text-slate-100">{pT.leads} → {pT.won}</p><p className="text-[11px] text-slate-500">{audFmt(pT.cost)} spend · {audFmt(pT.rev)} won</p></Panel>
        <Panel className="p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Organic leads → won</p><p className="mt-2 font-data text-2xl font-semibold tabular-nums text-emerald-300">{oT.leads} → {oT.won}</p><p className="text-[11px] text-slate-500">$0 spend · {audFmt(oT.rev)} won</p></Panel>
        <Panel className="p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Paid cost / won</p><p className="mt-2 font-data text-2xl font-semibold tabular-nums text-cyan-300">{pT.won ? audFmt(pT.cost / pT.won) : "—"}</p><p className="text-[11px] text-slate-500">spend ÷ paid wins</p></Panel>
        <Panel className="p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Organic share of wins</p><p className="mt-2 font-data text-2xl font-semibold tabular-nums text-slate-100">{pT.won + oT.won ? Math.round((oT.won / (pT.won + oT.won)) * 100) : 0}%</p><p className="text-[11px] text-slate-500">free jobs vs paid</p></Panel>
      </div>

      <div>
        <Eyebrow icon={Coins}>By channel</Eyebrow>
        <p className="mt-1 text-xs text-slate-500">Paid spend is editable (≈ per month). Organic is free — any wins there are pure margin. Tag leads to organic sources on a lead’s card to populate those rows.</p>
        <div className="mt-3">
          <StatTable columns={["Channel", "Type", "Leads", "Cost", "Cost / lead", "Won", "Won revenue", "Cost / won"]} rows={rows}
            render={(r: (typeof rows)[number]) => (
              <tr key={r.k} className="text-slate-300">
                <td className="px-4 py-3"><SrcChip source={r.k} /></td>
                <td className="px-4 py-3 text-right"><Chip status={r.paid ? "amber" : "emerald"}>{r.paid ? "Paid" : "Organic"}</Chip></td>
                <td className="px-4 py-3 text-right font-data tabular-nums">{r.leads}</td>
                <td className="px-4 py-3 text-right">{r.paid
                  ? <span className="inline-flex items-center rounded-md border border-slate-700 bg-slate-950"><span className="pl-2 text-xs text-slate-500">$</span><input type="number" min="0" value={metrics.spend[r.k] || 0} onChange={(e) => setSpend(r.k, e.target.value === "" ? 0 : Number(e.target.value))} className="w-20 bg-transparent px-1 py-1 text-right font-data text-xs text-slate-200 focus:outline-none" /></span>
                  : <span className="font-data text-xs text-slate-500">$0</span>}</td>
                <td className="px-4 py-3 text-right font-data tabular-nums text-slate-400">{r.paid ? (r.leads ? audFmt(r.cpl) : "—") : "$0"}</td>
                <td className="px-4 py-3 text-right font-data tabular-nums">{r.won}</td>
                <td className="px-4 py-3 text-right font-data tabular-nums text-emerald-300">{audFmt(r.revenue)}</td>
                <td className="px-4 py-3 text-right font-data tabular-nums text-cyan-300">{r.paid ? (r.won ? audFmt(r.cpw) : "—") : "$0"}</td>
              </tr>
            )} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Spend in AUD. Google Ads is currently paused; Meta bills in NZD (≈{audFmt(metrics.spend.meta_ads || 0)} AUD/mo shown). Lead counts come from in-app tagging, so periods may differ from the ad-platform windows.</p>
      </div>

      <div>
        <Eyebrow icon={TrendingUp}>Organic reach (manual entry)</Eyebrow>
        <p className="mt-1 text-xs text-slate-500">Enter these from Instagram / Facebook Insights and your Google Business Profile until the APIs are connected.</p>
        <Panel className="mt-3 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <SettingNum label="IG reach / mo" value={metrics.organic.ig_reach} onChange={(v) => setOrg("ig_reach", v)} />
            <SettingNum label="IG engagements" value={metrics.organic.ig_eng} onChange={(v) => setOrg("ig_eng", v)} />
            <SettingNum label="FB reach / mo" value={metrics.organic.fb_reach} onChange={(v) => setOrg("fb_reach", v)} />
            <SettingNum label="FB engagements" value={metrics.organic.fb_eng} onChange={(v) => setOrg("fb_eng", v)} />
            <SettingNum label="GBP views / mo" value={metrics.organic.gbp_views} onChange={(v) => setOrg("gbp_views", v)} />
            <SettingNum label="GBP calls / mo" value={metrics.organic.gbp_calls} onChange={(v) => setOrg("gbp_calls", v)} />
          </div>
        </Panel>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
          <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
          <p>Milestone 4: auto-pull Instagram &amp; Facebook insights via the <span className="text-slate-300">Meta Graph API</span> and GBP views/calls via the <span className="text-slate-300">Google Business Profile API</span>. The Meta side needs app permissions + App Review (which takes time), so these stay manual until then.</p>
        </div>
      </div>
    </div>
  );
}
