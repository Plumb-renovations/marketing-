"use client";

import { useState } from "react";
import {
  Filter, Facebook, Search, Bot,
  Sparkles, Lightbulb, Swords, MapPin, ChevronRight, ChevronDown, TrendingUp, Star,
} from "lucide-react";
import {
  Panel, Chip, SectionHeader, RecBlock,
  ConnectPrompt, Draft,
} from "@/components/ui/primitives";
import { CONTENT_IDEAS, COMPETITORS, COMPETITOR_RECS, ASSISTANTS } from "@/lib/domain/constants";

/* ----------------------------- FUNNEL ---------------------------------- */
export function FunnelView() {
  return (
    <div className="space-y-8">
      <SectionHeader icon={Filter} title="Lead Funnel" desc="Visitor → lead → quote → won. Builds from your real leads and quotes." />
      <Panel className="p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan-400"><Filter className="h-6 w-6" /></div>
        <h3 className="mt-4 font-display text-base font-semibold text-slate-100">No funnel data yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">As real leads move through to quotes and won jobs, your conversion funnel and by-source breakdown will populate here.</p>
      </Panel>
    </div>
  );
}

/* ----------------------------- GOOGLE ---------------------------------- */
export function GoogleView() {
  return (
    <div className="space-y-8">
      <SectionHeader icon={Search} title="Google Ads" desc="Live Google Ads performance for your account." />
      <Panel className="p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan-400"><Search className="h-6 w-6" /></div>
        <h3 className="mt-4 font-display text-base font-semibold text-slate-100">No Google Ads data yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Once your Google Ads account is connected and synced, your real campaigns, keywords and spend appear here. No sample data is shown.</p>
      </Panel>
    </div>
  );
}

/* ------------------------------ META ----------------------------------- */
export function MetaView() {
  // The live Meta manager (campaign → ad set → ad) lives on the Meta Ads page
  // (MetaManagerScreen). This legacy static view no longer carries sample data.
  return (
    <div className="space-y-8">
      <SectionHeader icon={Facebook} title="Meta Ads" desc="Live campaign → ad set → ad manager." />
      <Panel className="p-10 text-center text-sm text-slate-500">Open <span className="text-slate-300">Meta Ads</span> for your live campaigns and Hazel's verdicts.</Panel>
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
