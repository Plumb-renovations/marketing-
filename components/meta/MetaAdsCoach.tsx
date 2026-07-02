"use client";

import { useState } from "react";
import { MessagesSquare, Loader2, Send, Sparkles, AlertTriangle } from "lucide-react";
import { Panel } from "@/components/ui/primitives";

// The Meta Ads Coach — a specialist media-buyer chat that lives in the Meta ads
// area and answers from the user's REAL ad data (campaigns → ad sets → ads +
// per-creative flags), reasoning with proven media-buying frameworks.
const SUGGESTED = [
  "What should I turn off?",
  "Which ad should I scale?",
  "Why is my cost per lead high?",
  "What do I do next?",
  "Should I keep this running?",
];

interface Turn { q: string; a: string; topic?: string; followups?: string[] }

export default function MetaAdsCoach() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || loading) return;
    setLoading(true); setError(""); setNotice(""); setQ("");
    try {
      const res = await fetch("/api/meta-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, history: turns.slice(-4).map((t) => ({ q: t.q, a: t.a })) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || j?.error || "failed");
      if (j.connected === false || j.reconnect) setNotice(j.answer);
      setTurns((p) => [...p, { q: text, a: j.answer, topic: j.topic, followups: j.followups }]);
    } catch (e: any) {
      setError(e?.message || "Couldn't reach the Meta Ads Coach — try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"><MessagesSquare className="h-4 w-4" /></span>
        <div>
          <h3 className="font-display text-base font-semibold text-slate-100">Meta Ads Coach</h3>
          <p className="text-[11px] text-slate-500">A specialist media buyer — ask anything about your Meta ads; answered from your real campaigns, ad sets and individual ads.</p>
        </div>
      </div>

      {/* Conversation */}
      {turns.length > 0 && (
        <div className="mb-3 space-y-3">
          {turns.map((t, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-end"><span className="max-w-[85%] rounded-2xl rounded-br-sm bg-cyan-500/15 px-3 py-1.5 text-sm text-cyan-100">{t.q}</span></div>
              <div className="rounded-2xl rounded-bl-sm border border-slate-800 bg-slate-950/50 px-3.5 py-2.5">
                {t.topic && <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500 font-display">{t.topic}</div>}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{t.a}</p>
                {t.followups && t.followups.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.followups.map((f, j) => (
                      <button key={j} onClick={() => ask(f)} disabled={loading} className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800 disabled:opacity-50">{f}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="mb-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Reading your ads…</div>}
      {error && <p className="mb-2 inline-flex items-center gap-1.5 text-sm text-amber-300"><AlertTriangle className="h-4 w-4" /> {error}</p>}
      {notice && <p className="mb-2 text-[11px] text-amber-300/80">{notice}</p>}

      <div className="flex items-end gap-2">
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }}
          rows={2}
          placeholder="e.g. Which ad should I scale, and which should I turn off?"
          className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
        />
        <button onClick={() => ask(q)} disabled={loading || !q.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>

      {turns.length === 0 && !loading && (
        <div className="mt-3">
          <div className="mb-1.5 inline-flex items-center gap-1 text-[11px] text-slate-500"><Sparkles className="h-3 w-3 text-cyan-400" /> Try asking</div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800">{s}</button>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
