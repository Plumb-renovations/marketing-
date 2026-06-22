"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, Star, MapPin, RefreshCw, Loader2, AlertTriangle, Bot } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { fetchCompetitorInsights, type CompetitorReviewsData } from "@/lib/data/competitorInsights";

// Section 1 — "Why they're winning": a ranked, review-based competitive overview
// auto-built from Google Places + AI. Reads the org's stored snapshot; the
// "Refresh" button re-pulls + re-analyses (also runs weekly via cron).
export default function WhyTheyreWinning() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<CompetitorReviewsData>({ insights: [], report: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = async () => setData(await fetchCompetitorInsights(supabase));

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [supabase]);

  const refresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch("/api/competitors/refresh", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(reasonText(j?.message) || "Couldn't refresh. Please try again.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Couldn't refresh.");
    } finally {
      setRefreshing(false);
    }
  };

  const { insights, report } = data;
  const maxR = Math.max(1, ...insights.map((c) => c.reviewCount || 0));
  const updated = report?.generatedAt ? new Date(report.generatedAt).toLocaleDateString() : null;

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-cyan-400"><Trophy className="h-5 w-5" /></div>
          <div>
            <h3 className="font-display text-base font-semibold text-slate-100">Why they&apos;re winning</h3>
            <p className="text-sm text-slate-500">Your top local rivals by Google rating &amp; reviews, with where they&apos;re ahead and how to beat them.{updated ? ` Updated ${updated}.` : ""}</p>
          </div>
        </div>
        <button onClick={refresh} disabled={refreshing} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-50">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
        </button>
      </div>

      {error && <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}

      {/* Market pattern summary */}
      {report?.marketSummary && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3.5 text-sm text-cyan-100">
          <Bot className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
          <p><span className="font-medium">Pattern across your market:</span> {report.marketSummary}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : insights.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-sm text-slate-400">
            {report?.status === "error"
              ? report.message || "Couldn't build the overview yet."
              : "No competitor overview yet."}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">Hazel finds your top local rivals from your trade + service area (set on your Business Profile) and analyses their reviews. Hit Refresh to build it now.</p>
          <button onClick={refresh} disabled={refreshing} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Build overview
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {insights.map((c, i) => (
            <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-data text-xs text-slate-600">#{i + 1}</span>
                    <span className="font-display text-base font-semibold text-slate-100">{c.name}</span>
                    {c.address && <span className="hidden items-center gap-1 text-xs text-slate-500 sm:inline-flex"><MapPin className="h-3 w-3" />{c.address}</span>}
                  </div>
                  <div className="mt-2 h-1.5 max-w-md rounded-full bg-slate-800"><div className="h-1.5 rounded-full bg-cyan-500" style={{ width: `${((c.reviewCount || 0) / maxR) * 100}%` }} /></div>
                </div>
                <div className="flex items-center gap-5 text-right">
                  <div><p className="inline-flex items-center gap-1 font-data text-lg tabular-nums text-amber-300">{c.rating != null ? c.rating.toFixed(1) : "—"}<Star className="h-3.5 w-3.5 fill-amber-300" /></p><p className="text-[11px] text-slate-500">rating</p></div>
                  <div><p className="font-data text-lg tabular-nums text-slate-100">{c.reviewCount ?? "—"}</p><p className="text-[11px] text-slate-500">reviews</p></div>
                </div>
              </div>
              {(c.whyAhead || c.howToBeat) && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {c.whyAhead && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-display">Why they&apos;re ahead</p>
                      <p className="mt-1 text-sm text-slate-300">{c.whyAhead}</p>
                    </div>
                  )}
                  {c.howToBeat && (
                    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-cyan-400/80 font-display">How to beat them</p>
                      <p className="mt-1 text-sm text-cyan-100">{c.howToBeat}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function reasonText(message?: string): string {
  if (message === "places_not_configured") return "Google Places isn't configured yet — set GOOGLE_PLACES_API_KEY, then refresh.";
  if (message === "no_results") return "No competitors found — check the trade + service area on your Business Profile.";
  return message || "";
}
