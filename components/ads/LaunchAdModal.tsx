"use client";

import { useState } from "react";
import { X, Rocket, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Eyebrow, Chip } from "@/components/ui/primitives";
import type { Ad } from "@/lib/domain/types";

// Launch a saved Ad Creator draft straight to Meta or Google — live, or as a
// paused draft to review in the platform first. Targeting/budget/schedule are
// set here; the actual platform calls happen server-side at /api/ads/publish.
export default function LaunchAdModal({ ad, onClose }: { ad: Ad; onClose: () => void }) {
  const platform = ad.type; // 'meta' | 'google'
  const [campaignName, setCampaignName] = useState(`Plumb — ${ad.goal || "Bathroom renos"}`);
  const [budget, setBudget] = useState(30);
  const [mode, setMode] = useState<"paused" | "launch">("paused");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [ageMin, setAgeMin] = useState(30);
  const [ageMax, setAgeMax] = useState(65);
  const [url, setUrl] = useState("https://waterplumb.com.au");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const launch = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ads/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adId: ad.id,
          platform,
          mode,
          campaignName,
          dailyBudgetAud: Number(budget),
          startTime: startTime ? new Date(startTime).toISOString() : undefined,
          endTime: endTime ? new Date(endTime).toISOString() : undefined,
          ageMin: platform === "meta" ? Number(ageMin) : undefined,
          ageMax: platform === "meta" ? Number(ageMax) : undefined,
          link: url,
          finalUrl: url,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 412)
          setError(`${platform === "meta" ? "Meta" : "Google"} isn't connected yet — add its credentials in env (see docs/integrations).`);
        else setError(data?.error || data?.message || `Failed (${res.status})`);
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setError(e?.message || "Request failed");
    }
    setLoading(false);
  };

  const field = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50";
  const label = "mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-display";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-slate-950/80" />
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2"><Eyebrow icon={Rocket}>Launch ad</Eyebrow><Chip status={platform === "meta" ? "indigo" : "sky"}>{platform === "meta" ? "Meta" : "Google"}</Chip></div>
          <button onClick={onClose} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        {result ? (
          <div className="space-y-3 p-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
            <p className="text-sm text-slate-200">{result.status === "active" ? "Launched live." : "Created as a paused draft — review it in the ad platform, then enable it."}</p>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-left text-[11px] text-slate-400">
              {result.externalCampaignId && <p>Campaign: <span className="font-data text-slate-300">{result.externalCampaignId}</span></p>}
              {result.externalAdsetId && <p>{platform === "meta" ? "Ad set" : "Ad group"}: <span className="font-data text-slate-300">{result.externalAdsetId}</span></p>}
              {result.externalAdId && <p>Ad: <span className="font-data text-slate-300">{result.externalAdId}</span></p>}
            </div>
            <button onClick={onClose} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400">Done</button>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div><p className={label}>Campaign name</p><input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className={field} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className={label}>Daily budget (AUD)</p><div className="flex items-center rounded-lg border border-slate-700 bg-slate-950"><span className="pl-2.5 text-sm text-slate-500">$</span><input type="number" min="1" value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full bg-transparent px-2 py-2 font-data text-sm text-slate-200 focus:outline-none" /></div></div>
              <div><p className={label}>Destination URL</p><input value={url} onChange={(e) => setUrl(e.target.value)} className={field} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className={label}>Start (optional)</p><input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${field} font-data text-xs`} /></div>
              <div><p className={label}>End (optional)</p><input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${field} font-data text-xs`} /></div>
            </div>
            {platform === "meta" && (
              <div className="grid grid-cols-2 gap-3">
                <div><p className={label}>Age min</p><input type="number" value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} className={`${field} font-data`} /></div>
                <div><p className={label}>Age max</p><input type="number" value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} className={`${field} font-data`} /></div>
              </div>
            )}
            <div>
              <p className={label}>Launch mode</p>
              <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
                {([["paused", "Save as paused draft"], ["launch", "Launch live"]] as const).map(([m, lbl]) => (
                  <button key={m} onClick={() => setMode(m)} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${mode === m ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}>{lbl}</button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">{platform === "meta" ? "Targets Australia + age range (precise Gold Coast geo-radius coming next)." : "Search campaign with your generated headlines, descriptions and keywords."}</p>
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>
            )}
          </div>
        )}

        {!result && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-4">
            <button onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800">Cancel</button>
            <button onClick={launch} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Rocket className="h-4 w-4" /> {mode === "launch" ? "Launch live" : "Create paused"}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
