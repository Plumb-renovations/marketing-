"use client";

import { useEffect, useState } from "react";
import { X, Rocket, Loader2, CheckCircle2, AlertTriangle, Wand2, ChevronLeft, ChevronRight, Layers, Target, ClipboardCheck } from "lucide-react";
import { Eyebrow, Chip } from "@/components/ui/primitives";
import type { Ad } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/client";
import { fetchBusinessProfile } from "@/lib/data/businessProfile";
import { generateCampaignPlan } from "@/lib/ai/generators";
import { pollJob } from "@/lib/media/pollJob";

// Meta campaign objectives (default Leads). Google has no objective picker here.
const META_OBJECTIVES: { id: string; label: string }[] = [
  { id: "OUTCOME_LEADS", label: "Leads (enquiries)" },
  { id: "OUTCOME_TRAFFIC", label: "Traffic (clicks to site)" },
  { id: "OUTCOME_ENGAGEMENT", label: "Engagement (messages)" },
  { id: "OUTCOME_AWARENESS", label: "Awareness (reach)" },
  { id: "OUTCOME_SALES", label: "Sales (conversions)" },
];
const SOFT_DAILY_CAP = 100; // flag budgets above this for a sanity check

// Build a Meta campaign → ad set → ad in one guided flow, on top of the existing
// publish path. Defaults to a PAUSED draft; live publishing needs a confirm.
export default function LaunchAdModal({ ad, onClose }: { ad: Ad; onClose: () => void }) {
  const platform = ad.type; // 'meta' | 'google'
  const isMeta = platform === "meta";

  // Campaign
  const [campaignName, setCampaignName] = useState(`Plumb — ${ad.goal || "Bathroom renos"}`);
  const [objective, setObjective] = useState("OUTCOME_LEADS");
  // Ad set
  const [adSetName, setAdSetName] = useState("");
  const [budget, setBudget] = useState(30);
  const [url, setUrl] = useState("https://waterplumb.com.au");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [ageMin, setAgeMin] = useState(30);
  const [ageMax, setAgeMax] = useState(65);
  const [lat, setLat] = useState(-28.17);
  const [lng, setLng] = useState(153.54);
  const [radiusKm, setRadiusKm] = useState(50);
  const [interests, setInterests] = useState("Home improvement, Home Ownership, Renovation, Interior design, Bathroom");
  const [advantage, setAdvantage] = useState(true);
  // Review
  const [mode, setMode] = useState<"paused" | "launch">("paused");

  const [step, setStep] = useState(0); // 0 campaign · 1 ad set · 2 review
  const [planning, setPlanning] = useState(false);
  const [planNote, setPlanNote] = useState("");
  const [confirmLive, setConfirmLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  // Async video ad: the publish returns a job we poll to completion.
  const [jobState, setJobState] = useState<"processing" | "published" | "failed" | null>(null);
  const [jobResultId, setJobResultId] = useState("");
  const [jobError, setJobError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const p = await fetchBusinessProfile(createClient());
        if (p.businessName) setCampaignName(`${p.businessName} — ${ad.goal || p.businessType || "Campaign"}`);
        if (p.serviceAreaLat != null) setLat(p.serviceAreaLat);
        if (p.serviceAreaLng != null) setLng(p.serviceAreaLng);
        if (p.serviceRadiusKm) setRadiusKm(p.serviceRadiusKm);
        if (p.audienceInterests.length) setInterests(p.audienceInterests.join(", "));
      } catch {
        /* keep defaults */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggest = async () => {
    setPlanning(true);
    setPlanNote("");
    try {
      const plan = await generateCampaignPlan({ goal: ad.goal || "" });
      if (plan.objective && META_OBJECTIVES.some((o) => o.id === plan.objective)) setObjective(plan.objective);
      if (plan.dailyBudgetAud > 0) setBudget(Math.round(plan.dailyBudgetAud));
      if (plan.interests.length) setInterests(plan.interests.join(", "));
      if (plan.campaignName) setCampaignName(plan.campaignName);
      if (plan.adSetName) setAdSetName(plan.adSetName);
      setPlanNote(plan.rationale || "Filled in a sensible starting setup — tweak anything before you publish.");
    } catch {
      setPlanNote("Hazel's AI was unavailable — the defaults are sensible; adjust and continue.");
    } finally {
      setPlanning(false);
    }
  };

  const doPublish = async () => {
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
          objective: isMeta ? objective : undefined,
          adSetName: isMeta ? (adSetName || undefined) : undefined,
          dailyBudgetAud: Number(budget),
          startTime: startTime ? new Date(startTime).toISOString() : undefined,
          endTime: endTime ? new Date(endTime).toISOString() : undefined,
          ageMin: isMeta ? Number(ageMin) : undefined,
          ageMax: isMeta ? Number(ageMax) : undefined,
          ...(isMeta
            ? {
                latitude: Number(lat),
                longitude: Number(lng),
                radiusKm: Number(radiusKm),
                interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
                advantageAudience: advantage,
              }
            : {}),
          link: url,
          finalUrl: url,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 412) setError(data?.message || `${isMeta ? "Meta" : "Google"} isn't connected — add it in Settings → Integrations.`);
        else setError(data?.error || data?.message || `Failed (${res.status})`);
      } else {
        setResult(data);
        // Video ads process asynchronously at Meta — poll the job to completion.
        if (data.status === "processing" && data.jobId) {
          setJobState("processing");
          pollJob(data.jobId, (s) => setJobState(s.state)).then((s) => {
            setJobState(s.state);
            if (s.state === "published") setJobResultId(s.resultId || "");
            if (s.state === "failed") setJobError(s.error || "Video processing failed.");
          });
        }
      }
    } catch (e: any) {
      setError(e?.message || "Request failed");
    }
    setLoading(false);
    setConfirmLive(false);
  };

  // Publish button: paused → publish straight away; live → require a confirm.
  const onPublishClick = () => {
    if (mode === "launch") setConfirmLive(true);
    else doPublish();
  };

  const field = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50";
  const label = "mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-display";
  const weekly = Number(budget) * 7;
  const overCap = Number(budget) > SOFT_DAILY_CAP;

  const steps = [
    { icon: Layers, label: "Campaign" },
    { icon: Target, label: "Ad set" },
    { icon: ClipboardCheck, label: "Review" },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-stone-900/40" />
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2"><Eyebrow icon={Rocket}>New campaign</Eyebrow><Chip status={isMeta ? "indigo" : "sky"}>{isMeta ? "Meta" : "Google"}</Chip></div>
          <button onClick={onClose} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        {result ? (
          result.jobId ? (
            <div className="space-y-3 p-6 text-center">
              {jobState === "failed" ? (
                <>
                  <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
                  <p className="text-sm text-slate-200">The video ad couldn't be published.</p>
                  <p className="text-[11px] text-red-300">{jobError}</p>
                  <button onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800">Close</button>
                </>
              ) : jobState === "published" ? (
                <>
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
                  <p className="text-sm text-slate-200">{result.mode === "launch" ? "Video ad launched live." : "Video ad created as a paused draft — review it in Ads Manager, then switch it on."}</p>
                  {jobResultId && <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-left text-[11px] text-slate-400"><p>Ad: <span className="font-data text-slate-300">{jobResultId}</span></p></div>}
                  <button onClick={onClose} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400">Done</button>
                </>
              ) : (
                <>
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-400" />
                  <p className="text-sm text-slate-200">Meta is processing your video…</p>
                  <p className="text-[11px] text-slate-500">This can take a minute or two. Keep this open — Hazel finishes the ad as soon as the video is ready, then tells you here.</p>
                </>
              )}
            </div>
          ) : (
          <div className="space-y-3 p-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
            <p className="text-sm text-slate-200">{result.status === "active" ? "Launched live." : "Created as a paused draft — review it in Ads Manager, then switch it on."}</p>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-left text-[11px] text-slate-400">
              {result.externalCampaignId && <p>Campaign: <span className="font-data text-slate-300">{result.externalCampaignId}</span></p>}
              {result.externalAdsetId && <p>{isMeta ? "Ad set" : "Ad group"}: <span className="font-data text-slate-300">{result.externalAdsetId}</span></p>}
              {result.externalAdId && <p>Ad: <span className="font-data text-slate-300">{result.externalAdId}</span></p>}
            </div>
            <button onClick={onClose} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400">Done</button>
          </div>
          )
        ) : (
          <>
            {/* Stepper */}
            <div className="flex items-center gap-1 border-b border-slate-800 px-5 py-2.5 text-[11px]">
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="flex items-center gap-1">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${i === step ? "bg-cyan-500/10 text-cyan-300" : i < step ? "text-emerald-400" : "text-slate-500"}`}><Icon className="h-3.5 w-3.5" />{s.label}</span>
                    {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-slate-700" />}
                  </div>
                );
              })}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* STEP 0 — CAMPAIGN */}
              {step === 0 && (
                <>
                  <button onClick={suggest} disabled={planning} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50">
                    {planning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Let Hazel suggest the setup
                  </button>
                  {planNote && <p className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400">{planNote}</p>}
                  <div><p className={label}>Campaign name</p><input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className={field} /></div>
                  {isMeta && (
                    <div>
                      <p className={label}>Objective</p>
                      <select value={objective} onChange={(e) => setObjective(e.target.value)} className={field}>
                        {META_OBJECTIVES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                      <p className="mt-1.5 text-[11px] text-slate-500">Leads is the right call for a tradie chasing enquiries — Hazel defaults to it.</p>
                    </div>
                  )}
                </>
              )}

              {/* STEP 1 — AD SET */}
              {step === 1 && (
                <>
                  {isMeta && <div><p className={label}>Ad set name</p><input value={adSetName} onChange={(e) => setAdSetName(e.target.value)} placeholder={`${campaignName} — Ad Set`} className={field} /></div>}
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className={label}>Daily budget (AUD)</p><div className="flex items-center rounded-lg border border-slate-700 bg-slate-950"><span className="pl-2.5 text-sm text-slate-500">$</span><input type="number" min="1" value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full bg-transparent px-2 py-2 font-data text-sm text-slate-200 focus:outline-none" /></div></div>
                    <div><p className={label}>Destination URL</p><input value={url} onChange={(e) => setUrl(e.target.value)} className={field} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className={label}>Start (optional)</p><input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${field} font-data text-xs`} /></div>
                    <div><p className={label}>End (optional)</p><input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${field} font-data text-xs`} /></div>
                  </div>
                  {isMeta && (
                    <>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                        <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500 font-display">Location — service area (hard constraint)</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div><p className={label}>Radius (km)</p><input type="number" min="1" max="80" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className={`${field} font-data`} /></div>
                          <div><p className={label}>Centre lat</p><input type="number" step="0.01" value={lat} onChange={(e) => setLat(Number(e.target.value))} className={`${field} font-data`} /></div>
                          <div><p className={label}>Centre lng</p><input type="number" step="0.01" value={lng} onChange={(e) => setLng(Number(e.target.value))} className={`${field} font-data`} /></div>
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500">Defaults to your Business Profile service area. Max 80km.</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                        <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500 font-display">Audience — Advantage+ suggestions (soft)</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div><p className={label}>Age min</p><input type="number" value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} className={`${field} font-data`} /></div>
                          <div><p className={label}>Age max</p><input type="number" value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} className={`${field} font-data`} /></div>
                        </div>
                        <div className="mt-2"><p className={label}>Interests (comma-separated)</p><textarea rows={2} value={interests} onChange={(e) => setInterests(e.target.value)} className={field} /></div>
                        <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                          <input type="checkbox" checked={advantage} onChange={(e) => setAdvantage(e.target.checked)} className="accent-cyan-500" />
                          Advantage+ audience (let Meta expand beyond these interests)
                        </label>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* STEP 2 — REVIEW */}
              {step === 2 && (
                <>
                  <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs">
                    <Row k="Campaign" v={campaignName} />
                    {isMeta && <Row k="Objective" v={META_OBJECTIVES.find((o) => o.id === objective)?.label || objective} />}
                    {isMeta && <Row k="Ad set" v={adSetName || `${campaignName} — Ad Set`} />}
                    <Row k="Daily budget" v={`$${budget}/day · ~$${weekly}/week`} />
                    {isMeta && <Row k="Location" v={`${radiusKm}km radius`} />}
                    <Row k="Ad" v={ad.content?.variations?.[0]?.headline || ad.content?.variations?.[0]?.primaryText?.slice(0, 60) || "Your saved ad"} />
                  </div>

                  <div>
                    <p className={label}>Publish mode</p>
                    <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
                      {([["paused", "Save as paused draft"], ["launch", "Launch live"]] as const).map(([m, lbl]) => (
                        <button key={m} onClick={() => { setMode(m); setConfirmLive(false); }} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${mode === m ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}>{lbl}</button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">Paused is the default — nothing spends until you switch it on in Ads Manager.</p>
                  </div>

                  {overCap && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> ${budget}/day is on the high side for a first test (~${weekly}/week). Hazel usually starts a single ad set around $20–$60/day to learn cheaply — double-check this is intended.
                    </div>
                  )}

                  {confirmLive && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                      <p className="text-xs text-red-200"><strong>Publish live at ${budget}/day (~${weekly}/week)?</strong> This goes live on Meta and spends real money straight away.</p>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => setConfirmLive(false)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800">Cancel</button>
                        <button onClick={doPublish} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-red-400 px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-red-300 disabled:opacity-50">{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Confirm & publish live</button>
                      </div>
                    </div>
                  )}

                  {error && <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
                </>
              )}
            </div>

            {/* Footer nav */}
            <div className="flex items-center justify-between gap-2 border-t border-slate-800 px-5 py-4">
              <button onClick={step === 0 ? onClose : () => { setStep((s) => s - 1); setConfirmLive(false); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800">
                {step === 0 ? "Cancel" : <><ChevronLeft className="h-4 w-4" /> Back</>}
              </button>
              {step < 2 ? (
                <button onClick={() => setStep((s) => s + 1)} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400">Next <ChevronRight className="h-4 w-4" /></button>
              ) : (
                !confirmLive && (
                  <button onClick={onPublishClick} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Rocket className="h-4 w-4" /> {mode === "launch" ? "Launch live" : "Create paused draft"}</>}
                  </button>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-baseline justify-between gap-3"><span className="text-slate-500">{k}</span><span className="min-w-0 truncate text-right text-slate-200">{v}</span></div>;
}
