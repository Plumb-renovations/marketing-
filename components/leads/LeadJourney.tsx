"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic, MicOff, Loader2, Send, Sparkles, Clipboard, Phone, MessageSquare, CalendarCheck,
  ClipboardList, X, AlertTriangle, Palette, Trophy, History, Zap,
} from "lucide-react";
import { Chip, Eyebrow } from "@/components/ui/primitives";
import { fetchJourney, journeyAction, type JourneyDetail } from "@/lib/leadJourney/client";
import { LOSS_REASONS, STAGE_LABEL } from "@/lib/leadJourney/model";
import { effectiveStage, nextActionFor, speedToContactMinutes, speedLabel, suggestDesigner } from "@/lib/leadJourney/coach";

const URGENCY: Record<string, string> = { now: "red", soon: "amber", later: "slate", done: "emerald" };

export default function LeadJourney({ leadId, onChanged }: { leadId: string; onChanged?: () => void }) {
  const [data, setData] = useState<JourneyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string>("");
  const [message, setMessage] = useState("");
  const [lostOpen, setLostOpen] = useState(false);
  const [lossAdvice, setLossAdvice] = useState<{ advice?: string; system?: string } | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => { setData(await fetchJourney(leadId)); setLoading(false); }, [leadId]);
  useEffect(() => { load(); }, [load]);

  // ---- Voice capture (browser dictation — no audio leaves the device) ----
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const speechOk = typeof window !== "undefined" && ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition);
  const toggleMic = () => {
    if (!speechOk) return;
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const Rec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const rec = new Rec();
    rec.lang = "en-AU"; rec.interimResults = true; rec.continuous = true;
    let base = note ? note + " " : "";
    rec.onresult = (e: any) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setNote(base + txt);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec; rec.start(); setListening(true);
  };

  const act = async (body: Record<string, any>, key: string) => {
    setBusy(key); setErr("");
    try { const r = await journeyAction(leadId, body); await load(); onChanged?.(); return r; }
    catch (e) { setErr((e as Error).message); return null; }
    finally { setBusy(""); }
  };

  const log = async () => {
    if (!note.trim()) return;
    if (listening) { recRef.current?.stop(); setListening(false); }
    const r = await act({ action: "log", text: note, source: listening ? "voice" : "typed" }, "log");
    if (r) setNote("");
  };

  if (loading) return <div className="flex items-center gap-2 py-3 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading sales coach…</div>;
  if (!data) return <p className="text-xs text-slate-500">Sales coach data isn't available for this lead yet.</p>;

  const lead = data.lead;
  const stage = effectiveStage(lead);
  const next = nextActionFor(lead);
  const speed = speedToContactMinutes(lead);
  const designer = suggestDesigner(lead);
  const brief = data.briefing;
  const q = lead.qual || {};

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Eyebrow icon={Zap}>Sales coach</Eyebrow>
        <Chip status={stage === "won" ? "emerald" : stage === "lost" ? "red" : "cyan"}>{STAGE_LABEL[stage]}</Chip>
        <span className="text-[11px] text-slate-500">Speed to contact: <span className={speed != null && speed > 60 ? "text-amber-300" : "text-slate-300"}>{speedLabel(speed)}</span></span>
      </div>

      {/* Next action */}
      {next.urgency !== "done" && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
          <div className="flex items-center gap-2">
            <Chip status={URGENCY[next.urgency]}>{next.urgency === "now" ? "Do now" : next.urgency === "soon" ? "Soon" : "Next"}</Chip>
            <span className="text-sm font-medium text-slate-100">{next.title}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">{next.detail}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {next.channel === "call" && lead.phone && <a href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1 rounded-lg bg-cyan-500 px-2.5 py-1.5 text-xs font-medium text-slate-950 hover:bg-cyan-400"><Phone className="h-3.5 w-3.5" /> Call {lead.name.split(" ")[0]}</a>}
            {(next.channel === "text" || next.channel === "call") && (
              <button onClick={async () => { const r = await act({ action: "message", channel: next.channel, tone: next.kind.includes("final") ? "final" : "follow-up" }, "message"); if (r?.message) setMessage(r.message); }} disabled={busy === "message"} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                {busy === "message" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />} Write the message
              </button>
            )}
            {(stage === "quote_sent" || stage === "following_up") && <button onClick={() => act({ action: "followup", channel: next.channel }, "fu")} disabled={busy === "fu"} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50">Logged a follow-up</button>}
          </div>
          {message && (
            <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
              <p className="whitespace-pre-wrap text-xs text-slate-200">{message}</p>
              <button onClick={() => { navigator.clipboard?.writeText(message).catch(() => {}); }} className="mt-1 inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200"><Clipboard className="h-3 w-3" /> Copy</button>
            </div>
          )}
        </div>
      )}

      {/* Designer suggestion */}
      {(designer.suggest || brief?.designerSuggested) && (
        <p className="flex items-start gap-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 px-3 py-2 text-[11px] text-fuchsia-200"><Palette className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {brief?.designerReason || designer.reason}</p>
      )}

      {/* Capture: voice or type */}
      <div>
        <div className="relative">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Log an update — type, or tap the mic and speak (e.g. 'saw Sarah, wants full bathroom reno, ~30k, getting 2 other quotes, didn't answer first call')" className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50" />
          {speechOk && (
            <button onClick={toggleMic} title={listening ? "Stop" : "Dictate"} className={`absolute right-2 top-2 rounded-md p-1.5 ${listening ? "bg-red-500/20 text-red-300" : "text-slate-400 hover:bg-slate-800"}`}>
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11px] text-slate-600">{listening ? "Listening… speak naturally" : speechOk ? "Type or dictate — Hazel pulls the facts" : "Voice not supported in this browser — type your note"}</span>
          <button onClick={log} disabled={busy === "log" || !note.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-50">{busy === "log" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Log update</button>
        </div>
      </div>

      {/* Known facts */}
      {(q.budgetAud || q.motivation || q.timeline || (q.concerns && q.concerns.length) || q.competingQuotes != null) && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 text-[11px] text-slate-400">
          {q.budgetAud != null && <span className="mr-3">Budget: <span className="text-slate-200">${Math.round(q.budgetAud).toLocaleString()}</span></span>}
          {q.timeline && <span className="mr-3">Timeline: <span className="text-slate-200">{q.timeline}</span></span>}
          {q.competingQuotes != null && <span className="mr-3">Other quotes: <span className="text-slate-200">{q.competingQuotes}</span></span>}
          {q.motivation && <p className="mt-0.5">Why: <span className="text-slate-200">{q.motivation}</span></p>}
          {q.concerns && q.concerns.length > 0 && <p className="mt-0.5">Worried about: <span className="text-slate-200">{q.concerns.join(", ")}</span></p>}
        </div>
      )}

      {/* Stage actions + briefing */}
      <div className="flex flex-wrap gap-1.5">
        {(stage === "qualified" || stage === "contacted") && <button onClick={() => act({ action: "brief" }, "brief")} disabled={busy === "brief"} className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50">{busy === "brief" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />} Pre-quote briefing</button>}
        {stage !== "quote_sent" && stage !== "following_up" && stage !== "won" && stage !== "lost" && <button onClick={() => act({ action: "stage", stage: "quote_sent" }, "qs")} disabled={busy === "qs"} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"><CalendarCheck className="h-3.5 w-3.5" /> Mark quote sent</button>}
        {stage !== "won" && stage !== "lost" && <button onClick={() => act({ action: "stage", stage: "won" }, "won")} disabled={busy === "won"} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10"><Trophy className="h-3.5 w-3.5" /> Won</button>}
        {stage !== "won" && stage !== "lost" && <button onClick={() => setLostOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10"><X className="h-3.5 w-3.5" /> Mark lost</button>}
      </div>

      {lostOpen && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5">
          <p className="mb-1.5 text-[11px] text-slate-400">Why was it lost? (Hazel learns from this)</p>
          <div className="flex flex-wrap gap-1.5">
            {LOSS_REASONS.map((r) => (
              <button key={r.id} onClick={async () => { setLostOpen(false); const res = await act({ action: "lost", reason: r.id }, "lost"); if (res?.advice) setLossAdvice(res.advice); }} className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-red-500/40 hover:text-red-300">{r.label}</button>
            ))}
          </div>
        </div>
      )}
      {lossAdvice && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-100">
          <p className="flex items-start gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {lossAdvice.advice}</p>
          {lossAdvice.system && <p className="mt-1 text-amber-200">→ {lossAdvice.system}</p>}
        </div>
      )}

      {/* Pre-quote briefing */}
      {brief && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-cyan-300 font-display"><ClipboardList className="h-3.5 w-3.5" /> Win this customer</p>
          {brief.why && <p className="text-slate-300"><span className="text-slate-500">Why:</span> {brief.why}</p>}
          {brief.concern && <p className="mt-0.5 text-slate-300"><span className="text-slate-500">Defuse:</span> {brief.concern}</p>}
          {brief.leadWith && <p className="mt-0.5 text-slate-300"><span className="text-slate-500">Lead with:</span> {brief.leadWith}</p>}
          {brief.differentiateBy && <p className="mt-0.5 text-slate-300"><span className="text-slate-500">Stand out by:</span> {brief.differentiateBy}</p>}
          {Array.isArray(brief.askThese) && brief.askThese.length > 0 && <div className="mt-1"><span className="text-slate-500">Ask on site:</span><ul className="mt-0.5 list-disc pl-4 text-slate-300">{brief.askThese.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul></div>}
        </div>
      )}

      {err && <p className="text-[11px] text-red-300">{err}</p>}

      {/* Timeline */}
      {data.events.length > 0 && (
        <details className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
          <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-400"><History className="h-3.5 w-3.5" /> Journey timeline ({data.events.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {data.events.map((e) => (
              <li key={e.id} className="text-[11px] text-slate-400">
                <span className="text-slate-500">{new Date(e.created_at).toLocaleDateString()}</span> · <span className="text-slate-300">{e.kind}</span>{e.source === "voice" ? " 🎙" : ""} {e.body ? `— ${e.body.slice(0, 140)}` : ""}
                {e.extracted?.summary && <span className="block pl-3 text-slate-500">↳ {e.extracted.summary}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
