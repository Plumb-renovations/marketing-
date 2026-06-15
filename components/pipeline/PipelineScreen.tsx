"use client";

import { useState } from "react";
import {
  CalendarRange, Zap, Settings, CalendarDays, TrendingUp, TrendingDown,
  Clock, ArrowUpRight, Hammer,
} from "lucide-react";
import { Panel, Eyebrow, Chip, SectionHeader, StatTable, SettingNum } from "@/components/ui/primitives";
import { JOB_STATUSES, STATUS } from "@/lib/domain/constants";
import { audFmt, leadValue, next12, sameMonth, monthShort } from "@/lib/domain/format";
import type { Lead, Settings as SettingsType } from "@/lib/domain/types";
import { useData } from "@/components/DataProvider";

export default function PipelineScreen() {
  const { leads, settings, setSettings, setSelId, actions } = useData();
  const [showSettings, setShowSettings] = useState(false);
  const set = (k: keyof SettingsType, v: number) => setSettings((s) => ({ ...s, [k]: v }));
  const jobs = leads.filter((l) => l.stage === "won");
  const months = next12();
  const { jobsTarget, revenueTarget, leadTimeWeeks, costPerLead, leadToWonRate } = settings;
  const leadTimeMonths = leadTimeWeeks / 4.345;
  const hasMoney = costPerLead > 0 && leadToWonRate > 0;
  const costPerWon = hasMoney ? costPerLead / (leadToWonRate / 100) : 0;
  const bandMeta: Record<string, { c: string; label: string }> = {
    slow: { c: "amber", label: "Slow" },
    filling: { c: "cyan", label: "Filling" },
    booked: { c: "emerald", label: "Booked out" },
  };

  const rows = months.map((m, i) => {
    const inMonth = jobs.filter((j) => sameMonth(j.startDate, m));
    const count = inMonth.length;
    const value = inMonth.reduce((s, j) => s + leadValue(j), 0);
    const ratio = jobsTarget > 0 ? count / jobsTarget : 0;
    const band = ratio >= 1 ? "booked" : ratio >= 0.5 ? "filling" : "slow";
    return { m, i, inMonth, count, value, ratio, band, short: Math.max(0, jobsTarget - count), fillable: i >= leadTimeMonths };
  });
  const fillableSlow = rows.filter((r) => r.band !== "booked" && r.fillable && r.short > 0);
  const tooSoonSlow = rows.filter((r) => r.band !== "booked" && !r.fillable && r.short > 0);
  const soonest = fillableSlow[0];
  const totalJobs = rows.reduce((s, r) => s + r.count, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);

  const rec = (r: (typeof rows)[number]) => {
    const pct = Math.round(r.ratio * 100);
    if (r.band === "booked") return { tone: "emerald", verb: "Hold / redirect", text: `Booked out (${pct}% of target). No extra spend needed — redirect budget to slower months.` };
    if (!r.fillable) return { tone: "slate", verb: "Too soon", text: `${pct}% booked, but it’s inside your ~${leadTimeWeeks}-week ad lead time. Too close to fill with new ads — focus spend on the months after.` };
    const dollar = hasMoney && r.short > 0 ? ` ~${r.short} job${r.short > 1 ? "s" : ""} short — at ≈${audFmt(costPerWon)} per won job, about ${audFmt(r.short * costPerWon)} in extra ad spend, committed now.` : "";
    return { tone: r.band === "slow" ? "amber" : "cyan", verb: r.band === "slow" ? "Increase" : "Top up", text: `${pct}% booked.${dollar || " Increase ad spend now to fill it."}` };
  };

  return (
    <div className="space-y-8">
      <SectionHeader icon={CalendarRange} title="Pipeline" desc="Your jobs booked ahead, month by month — and what to spend on ads to fill the gaps." />

      <Panel glow className="bg-cyan-500/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Eyebrow icon={Zap}>Forward look · next 12 months</Eyebrow>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              {soonest ? (
                <>Soonest slow month you can still fill with ads: <span className="font-semibold text-cyan-300">{monthShort(soonest.m)}</span> (~{Math.round(soonest.ratio * 100)}% booked{hasMoney && soonest.short > 0 ? <>, ~{soonest.short} job{soonest.short > 1 ? "s" : ""} short ≈ {audFmt(soonest.short * costPerWon)} extra ad spend</> : ""}).{fillableSlow.length > 1 ? ` ${fillableSlow.length} fillable slow months ahead — each is broken out below.` : ""}</>
              ) : (
                <>Every fillable month is at or above your target of {jobsTarget} job{jobsTarget !== 1 ? "s" : ""}/mo. Hold spend and redirect to the furthest months.</>
              )}
              {tooSoonSlow.length > 0 && <> The next {tooSoonSlow.length} slow month{tooSoonSlow.length > 1 ? "s are" : " is"} inside your ~{leadTimeWeeks}-week lead time — too close to fill, so push spend to the months after.</>}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{totalJobs} job{totalJobs !== 1 ? "s" : ""} · {audFmt(totalValue)} scheduled across the window. {hasMoney ? <>Cost-per-won-job ≈ {audFmt(costPerWon)} (rough — built from cost/lead ÷ {leadToWonRate}% lead→won; limited conversion data).</> : "Add cost/lead and a lead→won rate in settings for dollar estimates."} Spend shown in AUD; note Meta currently bills in NZD.</p>
          </div>
          <button onClick={() => setShowSettings((v) => !v)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"><Settings className="h-3.5 w-3.5" /> Capacity &amp; ad settings</button>
        </div>
        {showSettings && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 sm:grid-cols-3 lg:grid-cols-5">
            <SettingNum label="Jobs / month" value={jobsTarget} onChange={(v) => set("jobsTarget", v)} />
            <SettingNum label="Revenue target /mo" value={revenueTarget} onChange={(v) => set("revenueTarget", v)} prefix="$" />
            <SettingNum label="Ad lead time" value={leadTimeWeeks} onChange={(v) => set("leadTimeWeeks", v)} suffix="wks" />
            <SettingNum label="Cost / lead" value={costPerLead} onChange={(v) => set("costPerLead", v)} prefix="$" />
            <SettingNum label="Lead → won" value={leadToWonRate} onChange={(v) => set("leadToWonRate", v)} suffix="%" step="0.5" />
          </div>
        )}
      </Panel>

      <div>
        <Eyebrow icon={CalendarDays}>Booked ahead</Eyebrow>
        <div className="mt-3 space-y-2">
          {rows.map((r) => {
            const bm = bandMeta[r.band];
            const rc = rec(r);
            const revMet = revenueTarget > 0 && r.value >= revenueTarget;
            return (
              <Panel key={r.i} className="p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div className="w-24 shrink-0">
                    <p className="font-display text-sm font-semibold text-slate-100">{monthShort(r.m)}</p>
                    <p className="font-data text-[11px] text-slate-500">{r.count}/{jobsTarget} job{jobsTarget !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="min-w-[140px] flex-1">
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-800"><div className={`h-2.5 rounded-full ${STATUS[bm.c].dot}`} style={{ width: `${Math.min(100, r.ratio * 100)}%` }} /></div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-data text-[11px] tabular-nums text-slate-400">{audFmt(r.value)}{revenueTarget > 0 && <span className="text-slate-600"> / {audFmt(revenueTarget)}{revMet ? " ✓" : ""}</span>}</span>
                      <Chip status={bm.c}>{bm.label}</Chip>
                    </div>
                  </div>
                  <div className="flex w-full items-start gap-2 border-t border-slate-800/70 pt-3 sm:w-auto sm:flex-1 sm:border-0 sm:pt-0">
                    {rc.verb === "Increase" ? <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> : rc.verb === "Hold / redirect" ? <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : rc.verb === "Too soon" ? <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /> : <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />}
                    <div><span className={`font-display text-xs font-semibold ${STATUS[rc.tone].text}`}>{rc.verb}</span><p className="text-xs leading-relaxed text-slate-400">{rc.text}</p></div>
                  </div>
                </div>
                {r.inMonth.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-800/70 pt-3">
                    {r.inMonth.map((j) => (
                      <button key={j.id} onClick={() => setSelId(j.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-1 text-xs text-slate-300 transition hover:border-cyan-500/40"><Hammer className="h-3 w-3 text-slate-500" />{j.name} · {audFmt(leadValue(j))}</button>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      </div>

      <div>
        <Eyebrow icon={Hammer}>Jobs — set a start month &amp; status</Eyebrow>
        <p className="mt-1 text-xs text-slate-500">Won quotes become jobs here. Edit a job’s start date, duration and status inline, or click its name to open the full card.</p>
        <div className="mt-3">
          {jobs.length === 0 ? (
            <Panel className="p-6 text-center text-sm text-slate-500">No won jobs yet — mark a quote won on the Leads board and it’ll appear here.</Panel>
          ) : (
            <StatTable columns={["Job", "Value", "Suburb", "Scheduled start", "Weeks", "Status"]} rows={jobs}
              render={(j: Lead) => (
                <tr key={j.id} className="text-slate-300">
                  <td className="px-4 py-3"><button onClick={() => setSelId(j.id)} className="font-medium text-slate-100 underline-offset-2 hover:text-cyan-300 hover:underline">{j.name}</button></td>
                  <td className="px-4 py-3 text-right font-data tabular-nums text-emerald-300">{audFmt(leadValue(j))}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{j.suburb}</td>
                  <td className="px-4 py-3 text-right"><input type="date" value={j.startDate || ""} onChange={(e) => actions.scheduleJob(j.id, { startDate: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-data text-xs text-slate-200 focus:border-cyan-500/50" /></td>
                  <td className="px-4 py-3 text-right"><input type="number" min="1" value={j.durationWeeks || ""} onChange={(e) => actions.scheduleJob(j.id, { durationWeeks: Number(e.target.value) })} className="w-14 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-right font-data text-xs text-slate-200 focus:border-cyan-500/50" /></td>
                  <td className="px-4 py-3 text-right"><select value={j.jobStatus || "scheduled"} onChange={(e) => actions.scheduleJob(j.id, { jobStatus: e.target.value as Lead["jobStatus"] })} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500/50">{JOB_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></td>
                </tr>
              )} />
          )}
        </div>
      </div>
    </div>
  );
}
