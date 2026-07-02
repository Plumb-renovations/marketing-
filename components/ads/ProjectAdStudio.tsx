"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Wand2, Loader2, Copy, Save, Sparkles, AlertTriangle, MessageSquareQuote, ChevronDown } from "lucide-react";
import { Chip, copyText } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { fetchBusinessProfile, saveAdVoice } from "@/lib/data/businessProfile";
import { generateProjectAd, fallbackProjectAd, type ProjectAnswers, type ProjectAdVariation } from "@/lib/ai/generators";

// Hazel's interview-then-write ad studio. Hazel asks about a real finished job,
// the user answers in their own words, then Hazel writes a top-class BUT human-
// sounding ad set from those details — matching the saved brand voice.
const QUESTIONS: { key: keyof ProjectAnswers; label: string; placeholder: string; rows?: number }[] = [
  { key: "project", label: "What was the project?", placeholder: "e.g. Full main bathroom reno; ensuite; laundry" },
  { key: "before", label: "What was it like before — what was wrong, or what problem did the client have?", placeholder: "e.g. Leaking shower, water-damaged floor, dated 90s tiles, cramped layout", rows: 3 },
  { key: "features", label: "What did you do? Key features of the finished result?", placeholder: "e.g. Floor-to-ceiling tiling, freestanding bath, feature niche, heated towel rail, new layout", rows: 3 },
  { key: "suburb", label: "Where was it? (suburb)", placeholder: "e.g. Palm Beach" },
  { key: "cared", label: "What did the client care about most / worry about?", placeholder: "e.g. Not being ripped off, mess, getting it done on time, quality that lasts", rows: 2 },
  { key: "special", label: "Anything special about how it went?", placeholder: "e.g. Finished 3 days early; solved a tricky drainage problem; client cried when they saw it", rows: 2 },
  { key: "result", label: "Any real result or a client quote?", placeholder: 'e.g. "Best tradies we\'ve ever used" — or: booked another job off it', rows: 2 },
];

export default function ProjectAdStudio({ onClose, onUseInMeta }: { onClose: () => void; onUseInMeta: (text: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [ans, setAns] = useState<ProjectAnswers>({});
  const [tone, setTone] = useState("");
  const [examples, setExamples] = useState<string[]>(["", "", ""]);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [savingVoice, setSavingVoice] = useState(false);
  const [voiceSaved, setVoiceSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const [ads, setAds] = useState<ProjectAdVariation[] | null>(null);
  const [voiceNote, setVoiceNote] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    fetchBusinessProfile(supabase)
      .then((p) => { setTone(p.tone || ""); setExamples([...(p.adExamples || []), "", "", ""].slice(0, 3)); })
      .catch(() => {});
  }, [supabase]);

  const set = (k: keyof ProjectAnswers, v: string) => setAns((a) => ({ ...a, [k]: v }));
  const hasAnswers = Object.values(ans).some((v) => (v || "").trim());

  const saveVoice = async () => {
    setSavingVoice(true); setVoiceSaved(false);
    try { await saveAdVoice(supabase, tone, examples); setVoiceSaved(true); }
    catch (e: any) { setError(e?.message || "Couldn't save your voice."); }
    finally { setSavingVoice(false); }
  };

  const write = async () => {
    setLoading(true); setError(""); setOffline(false);
    const project = ans;
    const adExamples = examples.map((s) => s.trim()).filter(Boolean);
    try {
      const r = await generateProjectAd({ project, adVoice: tone, adExamples });
      setAds(r.ads); setVoiceNote(r.voiceNote);
    } catch (e: any) {
      const r = fallbackProjectAd(project);
      setAds(r.ads); setVoiceNote(r.voiceNote); setOffline(true); setError(e?.message || "AI request failed");
    } finally {
      setLoading(false);
    }
  };

  const updateAd = (i: number, patch: Partial<ProjectAdVariation>) => setAds((p) => (p ? p.map((a, j) => (j === i ? { ...a, ...patch } : a)) : p));
  const doCopy = (i: number, a: ProjectAdVariation) => { copyText(`${a.primaryText}\n\nHeadline: ${a.headline}\nCTA: ${a.cta}`); setCopied(i); setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500); };

  const inp = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-stone-900/40" />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div className="flex items-center gap-2 font-display text-sm font-semibold text-slate-100"><Wand2 className="h-4 w-4 text-cyan-400" /> Write an ad from a real job</div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-sm text-slate-400">Tell Hazel about a job you just finished — in your own words. She&apos;ll turn your real details into a top-class, human-sounding ad set (not generic AI copy).</p>

          {/* The interview */}
          <div className="space-y-3">
            {QUESTIONS.map((q) => (
              <label key={q.key} className="block">
                <span className="text-[12px] font-medium text-slate-300">{q.label}</span>
                {q.rows ? (
                  <textarea value={ans[q.key] || ""} onChange={(e) => set(q.key, e.target.value)} rows={q.rows} placeholder={q.placeholder} className={"mt-1 resize-y " + inp} />
                ) : (
                  <input value={ans[q.key] || ""} onChange={(e) => set(q.key, e.target.value)} placeholder={q.placeholder} className={"mt-1 " + inp} />
                )}
              </label>
            ))}
          </div>

          {/* Brand voice (optional, saved) */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40">
            <button onClick={() => setVoiceOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
              <span className="text-[12px] font-semibold text-slate-200">Your brand voice <span className="font-normal text-slate-500">— optional, so Hazel sounds like you</span></span>
              <ChevronDown className={`h-4 w-4 text-slate-500 transition ${voiceOpen ? "rotate-180" : ""}`} />
            </button>
            {voiceOpen && (
              <div className="space-y-2 border-t border-slate-800 px-3 py-3">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Voice / tone</span>
                  <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="e.g. Straight-talking, warm, no jargon — like a mate who does great work" className={"mt-1 " + inp} />
                </label>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Example ads you like (up to 3)</span>
                {examples.map((ex, i) => (
                  <textarea key={i} value={ex} onChange={(e) => setExamples((p) => p.map((x, j) => (j === i ? e.target.value : x)))} rows={2} placeholder={`Example ad ${i + 1} — paste one you'd be happy to have written`} className={"resize-y " + inp} />
                ))}
                <div className="flex items-center gap-2">
                  <button onClick={saveVoice} disabled={savingVoice} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 disabled:opacity-50">{savingVoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save my voice</button>
                  {voiceSaved && <span className="text-[11px] text-emerald-400">Saved — Hazel will use this every time.</span>}
                </div>
              </div>
            )}
          </div>

          <button onClick={write} disabled={loading || !hasAnswers} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {ads ? "Rewrite the ad set" : "Write my ad set"}
          </button>
          {!hasAnswers && <p className="text-center text-[11px] text-slate-500">Answer at least one question to get started.</p>}

          {error && <p className="inline-flex items-center gap-1.5 text-sm text-amber-300"><AlertTriangle className="h-4 w-4" /> {offline ? `Live AI unavailable (${error}) — showing editable templates from your answers.` : error}</p>}

          {/* Output — the ad set */}
          {ads && ads.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[12px] text-amber-200/90">
                <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0" /> Read each one out loud — if you wouldn&apos;t say it to a customer, change it. These are a starting point; make them yours.
              </div>
              {voiceNote && <p className="text-[11px] text-slate-500">{voiceNote}</p>}
              {ads.map((a, i) => (
                <div key={i} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Chip status="indigo">{a.angle || `Variation ${i + 1}`}</Chip>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => doCopy(i, a)} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800"><Copy className="h-3 w-3" /> {copied === i ? "Copied" : "Copy"}</button>
                      <button onClick={() => onUseInMeta(a.primaryText)} className="inline-flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200 transition hover:bg-cyan-500/20"><Wand2 className="h-3 w-3" /> Use in Meta ad</button>
                    </div>
                  </div>
                  <textarea value={a.primaryText} onChange={(e) => updateAd(i, { primaryText: e.target.value })} rows={Math.min(10, Math.max(3, (a.primaryText || "").split(/\n/).length + 1))} className={"resize-y " + inp} />
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="block"><span className="text-[10px] uppercase tracking-wider text-slate-500 font-display">Headline</span><input value={a.headline} onChange={(e) => updateAd(i, { headline: e.target.value })} className={"mt-0.5 " + inp} /></label>
                    <label className="block"><span className="text-[10px] uppercase tracking-wider text-slate-500 font-display">Call to action</span><input value={a.cta} onChange={(e) => updateAd(i, { cta: e.target.value })} className={"mt-0.5 " + inp} /></label>
                  </div>
                  {a.sayItOutLoud && (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300/90"><MessageSquareQuote className="mt-0.5 h-3 w-3 shrink-0" /> {a.sayItOutLoud}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
