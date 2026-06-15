"use client";

import { useState } from "react";
import {
  Filter, Trophy, Facebook, Eye, Search, AlertTriangle, Plus, Check, X, Bot,
  Sparkles, Lightbulb, Swords, MapPin, ChevronRight, ChevronDown, TrendingUp, Star,
} from "lucide-react";
import {
  Panel, Eyebrow, Chip, SrcChip, SectionHeader, StatTable, Spark, RecBlock,
  ConnectPrompt, Stat, Draft, DiagnosisCard,
} from "@/components/ui/primitives";
import {
  FUNNEL, FUNNEL_BY_SOURCE, GOOGLE_TOTALS, GOOGLE_CAMPAIGNS, GOOGLE_KEYWORDS,
  SEARCH_TERMS_GOOD, SEARCH_TERMS_BAD, GOOGLE_DEVICES, GOOGLE_MONTHLY, META,
  META_RECS, CONTENT_IDEAS, COMPETITORS, COMPETITOR_RECS, ASSISTANTS,
} from "@/lib/domain/constants";
import { audFmt } from "@/lib/domain/format";

/* ----------------------------- FUNNEL ---------------------------------- */
export function FunnelView() {
  const maxW = FUNNEL[0].value;
  return (
    <div className="space-y-8">
      <SectionHeader icon={Filter} title="Lead Funnel" desc="Visitor → lead → quote → won, from your tracker (30 Mar – 21 Apr). Where leads are lost, and which channel earns." />
      <Panel className="p-6">
        <div className="space-y-5">
          {FUNNEL.map((f, i) => {
            const pct = Math.max(12, (f.value / maxW) * 100);
            const conv = i > 0 ? Math.round((f.value / FUNNEL[i - 1].value) * 100) : null;
            const leak = conv !== null && conv < 35;
            return (
              <div key={f.stage}>
                <div className="flex items-baseline justify-between"><span className="font-display text-sm font-medium text-slate-200">{f.stage}</span>
                  <div className="flex items-center gap-3">{conv !== null && <span className={`font-data text-xs ${leak ? "text-amber-400" : "text-slate-500"}`}>{conv}% step</span>}<span className="font-data tabular-nums text-base text-slate-100">{f.value}</span></div></div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-800"><div className={`h-3 rounded-full ${leak ? "bg-amber-400" : "bg-gradient-to-r from-cyan-500 to-cyan-400"}`} style={{ width: `${pct}%` }} /></div>
                <p className="mt-1 text-xs text-slate-500">{f.sub}</p>
              </div>
            );
          })}
        </div>
      </Panel>
      <div>
        <Eyebrow>By source</Eyebrow>
        <div className="mt-3"><StatTable columns={["Source", "Leads", "Qualified", "Quoted", "Won", "Revenue", "Read"]} rows={FUNNEL_BY_SOURCE}
          render={(r: (typeof FUNNEL_BY_SOURCE)[number]) => (<tr key={r.key} className="text-slate-300"><td className="px-4 py-3"><SrcChip source={r.key} /></td><td className="px-4 py-3 text-right font-data">{r.leads}</td><td className="px-4 py-3 text-right font-data">{r.qualified}</td><td className="px-4 py-3 text-right font-data">{r.quoted}</td><td className="px-4 py-3 text-right font-data">{r.won}</td><td className="px-4 py-3 text-right font-data text-emerald-300">{r.rev}</td><td className="px-4 py-3 text-right text-xs text-slate-500 max-w-[220px]">{r.note}</td></tr>)} /></div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DiagnosisCard icon={Trophy} status="amber" title="Quote → won" body="2 of 9 quotes closed (22%). Both losses were on price — your biggest controllable leak." />
        <DiagnosisCard icon={Facebook} status="red" title="Meta isn’t closing" body="8 Meta leads, 0 won. Cleanly qualified but low purchase-intent. Several quotes still open — watch close-rate by source." />
        <DiagnosisCard icon={Eye} status="amber" title="Tiny sample" body="16 leads over 3 weeks. Directional, not statistical — but Google’s revenue edge is clear so far." />
      </div>
    </div>
  );
}

/* ----------------------------- GOOGLE ---------------------------------- */
export function GoogleView() {
  return (
    <div className="space-y-8">
      <SectionHeader icon={Search} title="Google Ads" desc="12 months to Jun 2026 · AUD · account currently paused." />
      <Panel className="p-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-200">Conversions recorded: <span className="font-data font-semibold">0.00</span> on <span className="font-data font-semibold">{audFmt(GOOGLE_TOTALS.spend)}</span> of spend. The account has optimised blind for a year — fix tracking before relaunch.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Spend (12-mo)" value={audFmt(GOOGLE_TOTALS.spend)} />
          <Stat label="Clicks" value={GOOGLE_TOTALS.clicks.toLocaleString()} />
          <Stat label="Avg CPC" value={GOOGLE_TOTALS.cpc} sub="≈3× higher than launch" />
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Monthly spend</p><div className="mt-2"><Spark data={GOOGLE_MONTHLY} status="cyan" /></div></div>
        </div>
      </Panel>

      <div><Eyebrow>Campaigns</Eyebrow><div className="mt-3"><StatTable columns={["Campaign", "Spend", "Clicks", "CTR", "Conv.", ""]} rows={GOOGLE_CAMPAIGNS}
        render={(c: (typeof GOOGLE_CAMPAIGNS)[number]) => (<tr key={c.name} className="text-slate-300"><td className="px-4 py-3 font-medium text-slate-200">{c.name}</td><td className="px-4 py-3 text-right font-data tabular-nums">{c.spend}</td><td className="px-4 py-3 text-right font-data tabular-nums">{c.clicks}</td><td className="px-4 py-3 text-right font-data tabular-nums text-slate-400">{c.ctr}</td><td className="px-4 py-3 text-right font-data tabular-nums text-red-400">{c.conv}</td><td className="px-4 py-3 text-right"><Chip status="paused">paused</Chip></td></tr>)} /></div></div>

      <div><Eyebrow>Keywords (top by spend)</Eyebrow><div className="mt-3"><StatTable columns={["Keyword", "Match", "Spend", "Clicks", "CTR", "Action"]} rows={GOOGLE_KEYWORDS}
        render={(k: (typeof GOOGLE_KEYWORDS)[number]) => (<tr key={k.kw + k.type} className="text-slate-300"><td className="px-4 py-3 font-data text-slate-200">{k.kw}</td><td className="px-4 py-3 text-right text-xs text-slate-400">{k.type}</td><td className="px-4 py-3 text-right font-data tabular-nums">{k.spend}</td><td className="px-4 py-3 text-right font-data tabular-nums text-slate-400">{k.clicks}</td><td className="px-4 py-3 text-right font-data tabular-nums text-slate-400">{k.ctr}</td><td className="px-4 py-3 text-right"><Chip status={k.status}>{k.action}</Chip></td></tr>)} /></div></div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel className="p-5"><Eyebrow icon={Plus}>Search terms — promote / fund</Eyebrow><ul className="mt-3 space-y-1.5">{SEARCH_TERMS_GOOD.map((t) => <li key={t} className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5"><span className="font-data text-sm text-slate-200">{t}</span><Check className="h-3.5 w-3.5 text-emerald-400" /></li>)}</ul></Panel>
        <Panel className="p-5"><Eyebrow icon={X}>Negatives — block these</Eyebrow><ul className="mt-3 flex flex-wrap gap-2">{SEARCH_TERMS_BAD.map((t) => <li key={t} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-xs text-red-200"><X className="h-3 w-3" />{t}</li>)}</ul></Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel className="p-5"><Eyebrow>Devices</Eyebrow><div className="mt-3 space-y-3">{GOOGLE_DEVICES.map((d) => (<div key={d.d}><div className="flex justify-between text-sm"><span className="text-slate-300">{d.d}</span><span className="font-data tabular-nums text-slate-200">{d.spend} · {d.pct}%</span></div><div className="mt-1 h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-cyan-500" style={{ width: `${d.pct}%` }} /></div></div>))}</div><p className="mt-3 text-[11px] text-slate-500">76% of spend is mobile — the mobile landing + click-to-call must be flawless.</p></Panel>
        <RecBlock icon={Bot} title="Google recommendations" items={[
          { status: "red", t: "Fix conversion tracking first", d: "Calls + lead form + Tradify offline import. Everything else compounds off this." },
          { status: "red", t: "Restructure ‘bathroom renovation price’", d: "Broad price-shopper term, 26% of spend." },
          { status: "amber", t: "Add negatives + location exclusions", d: "Stop paying for cheap/budget and out-of-area clicks." },
          { status: "green", t: "Fund geo-core + suburb terms", d: "Where your quoted and won leads actually come from." },
        ]} />
      </div>
    </div>
  );
}

/* ------------------------------ META ----------------------------------- */
export function MetaView() {
  const c = META.campaigns[0];
  return (
    <div className="space-y-8">
      <SectionHeader icon={Facebook} title="Meta Ads" desc={`${META.window} · billed in ${META.currency}.`} />
      <Panel className="p-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-100/90">Account bills in <span className="font-semibold">NZD</span> for an AU business, and the active campaign’s leads (on-Meta instant forms) qualified but produced <span className="font-semibold">0 won jobs</span> in the tracked window.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Spend" value={c.spend} />
          <Stat label="Leads" value={c.leads} />
          <Stat label="Cost / lead" value={c.cpl} />
          <Stat label="Link CTR" value={c.ctr} sub="low for lead gen" />
          <Stat label="Frequency" value={c.freq} />
          <Stat label="Reach" value={c.reach} />
        </div>
      </Panel>

      <div><Eyebrow>Campaigns</Eyebrow><div className="mt-3"><StatTable columns={["Campaign", "Spend", "Leads", "Cost / lead", "CTR", "Lead form", ""]} rows={META.campaigns}
        render={(c: (typeof META.campaigns)[number]) => (<tr key={c.name} className="text-slate-300"><td className="px-4 py-3 font-medium text-slate-200">{c.name}</td><td className="px-4 py-3 text-right font-data tabular-nums">{c.spend}</td><td className="px-4 py-3 text-right font-data tabular-nums">{c.leads}</td><td className="px-4 py-3 text-right font-data tabular-nums">{c.cpl}</td><td className="px-4 py-3 text-right font-data tabular-nums text-slate-400">{c.ctr}</td><td className="px-4 py-3 text-right text-xs text-slate-400">{c.lf}</td><td className="px-4 py-3 text-right"><Chip status={c.status}>{c.status}</Chip></td></tr>)} /></div>
        <p className="mt-2 text-[11px] text-slate-500">Ad-level breakdown isn’t in this export — pull an ad-level CSV from Ads Manager to see which creative to scale or pause.</p>
      </div>

      <RecBlock icon={Bot} title="Meta recommendations" items={META_RECS} />
    </div>
  );
}

/* ---------------------------- CONTENT ---------------------------------- */
export function ContentView() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <div className="space-y-6">
      <SectionHeader icon={Sparkles} title="Content Engine" desc="What your real data says to make next — built around fixed-price proof and your winning suburbs." />
      {CONTENT_IDEAS.map((c) => {
        const isOpen = open[c.id];
        return (
          <Panel key={c.id} className="p-5">
            <div className="flex items-start gap-3"><Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" /><div className="flex-1">
              <p className="text-sm leading-relaxed text-slate-300">{c.insight}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-500 font-display">From: {c.project}</p>
              <button onClick={() => setOpen((p) => ({ ...p, [c.id]: !p[c.id] }))} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"><Sparkles className="h-4 w-4" /> {isOpen ? "Hide draft" : "Generate post"}</button>
            </div></div>
            {isOpen && (<div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-800 pt-4 md:grid-cols-2">
              <Draft label="Headline" value={c.headline} /><Draft label="Ad" value={c.ad} /><Draft label="Post" value={c.post} full /><Draft label="Caption" value={c.caption} full /></div>)}
          </Panel>
        );
      })}
    </div>
  );
}

/* -------------------------- COMPETITORS -------------------------------- */
export function CompetitorView() {
  const maxR = Math.max(...COMPETITORS.map((c) => c.reviews));
  return (
    <div className="space-y-8">
      <SectionHeader icon={Swords} title="Competitors" desc="Your Gold Coast field, by Google review count — a proxy for local visibility and trust." />
      <div className="space-y-2">
        {COMPETITORS.map((c) => (
          <Panel key={c.name} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-display text-base font-semibold text-slate-100">{c.name}</span><Chip status={c.threat === "high" ? "red" : c.threat === "medium" ? "amber" : "slate"}>{c.threat}</Chip><span className="inline-flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" />{c.suburb}</span></div>
                <p className="mt-1.5 text-sm text-slate-400">{c.note}</p>
                <div className="mt-2 h-1.5 max-w-md rounded-full bg-slate-800"><div className="h-1.5 rounded-full bg-cyan-500" style={{ width: `${(c.reviews / maxR) * 100}%` }} /></div>
              </div>
              <div className="flex items-center gap-5 text-right">
                <div><p className="font-data text-lg tabular-nums text-amber-300">{c.rating.toFixed(1)}★</p><p className="text-[11px] text-slate-500">rating</p></div>
                <div><p className="font-data text-lg tabular-nums text-slate-100">{c.reviews}</p><p className="text-[11px] text-slate-500">reviews</p></div>
              </div>
            </div>
          </Panel>
        ))}
      </div>
      <RecBlock icon={Bot} title="How to compete" items={COMPETITOR_RECS.map((r) => ({ status: "amber", t: r, d: "" }))} />
    </div>
  );
}

/* --------------------------- ASSISTANTS -------------------------------- */
export function AssistantsView() {
  const [openA, setOpenA] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  return (
    <div className="space-y-6">
      <SectionHeader icon={Bot} title="Assistants" desc="Six specialists watching your channels. Tap a question for a specific answer." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ASSISTANTS.map((as) => {
          const isOpen = openA === as.id;
          const Icon = as.icon;
          return (
            <Panel key={as.id} className="overflow-hidden">
              <button onClick={() => setOpenA(isOpen ? null : as.id)} className="flex w-full items-start gap-3 p-5 text-left transition hover:bg-slate-800/30">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-cyan-400"><Icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><div className="flex items-center justify-between"><span className="font-display font-semibold text-slate-100">{as.name}</span><ChevronRight className={`h-4 w-4 text-slate-500 transition ${isOpen ? "rotate-90" : ""}`} /></div><p className="mt-1 text-sm text-slate-400">{as.latest}</p></div>
              </button>
              {isOpen && (<div className="border-t border-slate-800 px-5 py-4"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Ask</p><div className="mt-2 space-y-2">
                {as.qa.map((qa, i) => {
                  const key = `${as.id}-${i}`;
                  const shown = answers[key];
                  return (<div key={key}>
                    <button onClick={() => setAnswers((p) => ({ ...p, [key]: !p[key] }))} className="flex w-full items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-left text-sm text-slate-300 transition hover:border-cyan-500/40 hover:bg-slate-800/40">{qa.q}<ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${shown ? "rotate-180" : ""}`} /></button>
                    {shown && <p className="mt-1.5 rounded-lg bg-slate-950/50 p-3 text-sm leading-relaxed text-slate-300">{qa.a}</p>}</div>);
                })}
              </div></div>)}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------- SEO / REVIEWS ------------------------------- */
export function SeoView() {
  return (
    <ConnectPrompt icon={TrendingUp} title="Connect your SEO data" body="No rank tracker or Search Console is linked yet, so rankings and organic traffic aren’t shown. Your suburbs are clear from won/quoted jobs — see the Action Centre for the pages worth building." items={["Google Search Console", "A rank tracker (e.g. for ‘bathroom renovations gold coast’ and suburb terms)"]} />
  );
}

export function ReviewsView() {
  return (
    <ConnectPrompt icon={Star} title="Connect your Google Business Profile" body="Your own reviews, rating, calls and direction requests aren’t linked yet. The competitor field is in the Competitors tab — top rival sits at 107 reviews / 5.0, so a review-velocity target matters." items={["Google Business Profile (reviews, calls, clicks, directions)"]} />
  );
}
