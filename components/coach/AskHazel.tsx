"use client";

import { useState } from "react";
import { MessagesSquare, Loader2, Send, Sparkles, AlertTriangle } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { askHazel, SUGGESTED_QUESTIONS } from "@/lib/ai/coach";

// Reactive coach: the user types anything (or taps a suggested question he didn't
// know to ask) and Hazel answers from HIS real data + best practice.
export default function AskHazel() {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<{ answer: string; followups: string[] } | null>(null);
  const [error, setError] = useState("");

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || loading) return;
    setAsked(text); setQ(text); setLoading(true); setError(""); setAnswer(null);
    try { setAnswer(await askHazel(text)); } catch (e) { setError((e as Error).message); }
    setLoading(false);
  };

  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"><MessagesSquare className="h-4 w-4" /></span>
        <div>
          <h3 className="font-display text-base font-semibold text-slate-100">Ask Hazel</h3>
          <p className="text-[11px] text-slate-500">Ask anything about your marketing — answered from your real numbers.</p>
        </div>
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }}
          rows={2}
          placeholder="e.g. Is my cost per lead any good? What should I do this week?"
          className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
        />
        <button onClick={() => ask(q)} disabled={loading || !q.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>

      {/* Suggested questions — teach him what to ask. */}
      {!answer && !loading && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-display">Not sure what to ask?</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-200">{s}</button>
            ))}
          </div>
        </div>
      )}

      {loading && <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Hazel is reading your account…</p>}
      {error && <p className="mt-3 flex items-start gap-2 text-sm text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>}

      {answer && (
        <div className="mt-4">
          {asked && <p className="mb-1.5 text-xs text-slate-500">You asked: <span className="text-slate-300">{asked}</span></p>}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
            <p className="flex items-start gap-2 whitespace-pre-wrap text-sm text-slate-200"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" /><span>{answer.answer}</span></p>
          </div>
          {answer.followups.length > 0 && (
            <div className="mt-2.5">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-display">Ask next</p>
              <div className="flex flex-wrap gap-1.5">
                {answer.followups.map((f) => (
                  <button key={f} onClick={() => ask(f)} className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-200">{f}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
