"use client";

import { useState } from "react";
import Link from "next/link";
import {
  X, FileText, Pencil, Trophy, Banknote, Plus, Check, RotateCcw, Trash2, Send,
} from "lucide-react";
import { Chip, SrcChip, Eyebrow, Field } from "@/components/ui/primitives";
import { STAGES, LOST_REASONS, JOB_STATUSES, PAID_KEYS, ORGANIC_KEYS, SOURCES } from "@/lib/domain/constants";
import { audFmt, quoteTotals, leadValue, uid } from "@/lib/domain/format";
import type { Lead, Quote, LineItem } from "@/lib/domain/types";
import { useData } from "@/components/DataProvider";

/* --------------------------- LEAD DRAWER ------------------------------- */
function LeadDrawer({ lead, onClose, actions }: { lead: Lead; onClose: () => void; actions: ReturnType<typeof useData>["actions"] }) {
  const [lostOpen, setLostOpen] = useState(false);
  const stage = STAGES.find((s) => s.id === lead.stage)!;
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-stone-900/40" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2"><Chip status={stage.accent}>{stage.label}</Chip><SrcChip source={lead.source} /></div>
          <button onClick={onClose} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <h3 className="font-display text-xl font-semibold text-slate-100">{lead.name}</h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label="Suburb" value={lead.suburb} />
            <Field label="Project" value={lead.project} />
            <Field label="Lead date" value={lead.date} />
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Source</p>
              <select value={lead.source} onChange={(e) => actions.setSource(lead.id, e.target.value)} className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 focus:border-cyan-500/50">
                <optgroup label="Paid">{PAID_KEYS.map((k) => <option key={k} value={k}>{SOURCES[k].label}</option>)}</optgroup>
                <optgroup label="Organic">{ORGANIC_KEYS.map((k) => <option key={k} value={k}>{SOURCES[k].label}</option>)}</optgroup>
              </select>
            </div>
          </div>

          {(lead.quotes.length > 0 || lead.stage === "quote" || lead.stage === "won" || lead.stage === "lost") && (
            <div className="mt-6">
              <Eyebrow icon={FileText}>Quotes</Eyebrow>
              <div className="mt-3 space-y-2">
                {lead.quotes.length === 0 && <p className="text-xs text-slate-500">No quotes yet.</p>}
                {lead.quotes.map((q) => {
                  const t = quoteTotals(q);
                  const isWon = lead.wonQuoteId === q.id;
                  return (
                    <div key={q.id} className={`rounded-xl border p-3 ${isWon ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-800 bg-slate-950/40"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Chip status={q.status === "sent" ? "cyan" : "slate"}>{q.status === "sent" ? "Sent" : "Draft"}</Chip>
                          {isWon && <Chip status="emerald">Won</Chip>}
                        </div>
                        <span className="font-data text-sm font-semibold tabular-nums text-slate-100">{audFmt(t.total, true)}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">{q.lineItems.length} line item{q.lineItems.length !== 1 ? "s" : ""} · incl. {audFmt(t.gst, true)} GST</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button onClick={() => actions.editQuote(lead.id, q.id)} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-cyan-500/40"><Pencil className="h-3 w-3" /> Edit</button>
                        {lead.stage === "quote" && <button onClick={() => actions.markWon(lead.id, q.id)} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/90 px-2 py-1 text-xs font-medium text-slate-950 transition hover:bg-emerald-400"><Trophy className="h-3 w-3" /> Mark won</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {lead.stage === "won" && (
            <div className="mt-6">
              <Eyebrow icon={Banknote}>Job</Eyebrow>
              <p className="mt-2 font-data text-2xl font-semibold tabular-nums text-emerald-300">{audFmt(leadValue(lead), true)}</p>
              <p className="text-xs text-slate-500">recorded as revenue won</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Scheduled start</p>
                  <input type="date" value={lead.startDate || ""} onChange={(e) => actions.scheduleJob(lead.id, { startDate: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-data text-sm text-slate-200 focus:border-cyan-500/50" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Duration (weeks)</p>
                  <input type="number" min="1" value={lead.durationWeeks || ""} onChange={(e) => actions.scheduleJob(lead.id, { durationWeeks: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-data text-sm text-slate-200 focus:border-cyan-500/50" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Status</p>
                <div className="mt-1 flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
                  {JOB_STATUSES.map((s) => (
                    <button key={s.id} onClick={() => actions.scheduleJob(lead.id, { jobStatus: s.id as Lead["jobStatus"] })} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${(lead.jobStatus || "scheduled") === s.id ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Tradify job # / link</p>
                <input value={lead.tradify || ""} onChange={(e) => actions.setTradify(lead.id, e.target.value)} placeholder="Paste Tradify job number or link" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50" />
              </div>
            </div>
          )}
          {lead.stage === "lost" && (
            <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-[11px] uppercase tracking-wider text-red-300 font-display">Lost</p>
              <p className="mt-1 text-sm text-slate-300">Reason: {lead.lostReason || "—"}</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 p-4">
          <Link href={`/quotes/new?lead=${lead.id}`} className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20"><FileText className="h-4 w-4" /> Build branded quote</Link>
          {lead.stage === "new" && (
            <button onClick={() => actions.qualify(lead.id)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"><Check className="h-4 w-4" /> Qualify lead</button>
          )}
          {lead.stage === "qualified" && (
            <button onClick={() => actions.newQuote(lead.id)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"><FileText className="h-4 w-4" /> Create quote</button>
          )}
          {lead.stage === "quote" && !lostOpen && (
            <div className="flex gap-2">
              <button onClick={() => actions.newQuote(lead.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-200 transition hover:bg-slate-800"><Plus className="h-4 w-4" /> New revision</button>
              <button onClick={() => setLostOpen(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10"><X className="h-4 w-4" /> Mark lost</button>
            </div>
          )}
          {lead.stage === "quote" && lostOpen && (
            <div>
              <p className="mb-2 text-xs text-slate-400">Reason lost:</p>
              <div className="flex flex-wrap gap-1.5">
                {LOST_REASONS.map((r) => <button key={r} onClick={() => { actions.markLost(lead.id, r); setLostOpen(false); }} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-red-500/40 hover:text-red-300">{r}</button>)}
                <button onClick={() => setLostOpen(false)} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-500">Cancel</button>
              </div>
            </div>
          )}
          {(lead.stage === "won" || lead.stage === "lost") && (
            <button onClick={() => actions.reopen(lead.id)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800"><RotateCcw className="h-4 w-4" /> Reopen to Quotes</button>
          )}
        </div>
      </aside>
    </>
  );
}

/* -------------------------- QUOTE BUILDER ------------------------------ */
function QuoteBuilder({ editor, leadName, onSave, onClose }: { editor: { leadId: string; quote: Quote }; leadName?: string; onSave: (q: Quote) => void; onClose: () => void }) {
  const [items, setItems] = useState<LineItem[]>(editor.quote.lineItems.length ? editor.quote.lineItems : [{ id: uid(), desc: "", qty: 1, unitPrice: 0 }]);
  const [status, setStatus] = useState(editor.quote.status || "draft");
  const setItem = (id: string, k: keyof LineItem, v: any) => setItems((p) => p.map((li) => (li.id === id ? { ...li, [k]: v } : li)));
  const addItem = () => setItems((p) => [...p, { id: uid(), desc: "", qty: 1, unitPrice: 0 }]);
  const delItem = (id: string) => setItems((p) => p.filter((li) => li.id !== id));
  const t = quoteTotals({ lineItems: items });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-stone-900/40" />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div><Eyebrow icon={FileText}>Quote builder</Eyebrow><p className="mt-1 font-display text-base font-semibold text-slate-100">{leadName}</p></div>
          <button onClick={onClose} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-[1fr_64px_104px_88px_32px] gap-2 px-1 pb-2 text-[11px] uppercase tracking-wider text-slate-500 font-display">
            <span>Description</span><span className="text-right">Qty</span><span className="text-right">Unit price</span><span className="text-right">Line</span><span />
          </div>
          <div className="space-y-2">
            {items.map((li) => {
              const line = (Number(li.qty) || 0) * (Number(li.unitPrice) || 0);
              return (
                <div key={li.id} className="grid grid-cols-[1fr_64px_104px_88px_32px] items-center gap-2">
                  <input value={li.desc} onChange={(e) => setItem(li.id, "desc", e.target.value)} placeholder="e.g. Demolition & removal" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50" />
                  <input type="number" value={li.qty} onChange={(e) => setItem(li.id, "qty", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-right font-data text-sm text-slate-200 focus:border-cyan-500/50" />
                  <input type="number" value={li.unitPrice} onChange={(e) => setItem(li.id, "unitPrice", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-right font-data text-sm text-slate-200 focus:border-cyan-500/50" />
                  <span className="text-right font-data text-sm tabular-nums text-slate-300">{audFmt(line)}</span>
                  <button onClick={() => delItem(li.id)} className="flex items-center justify-center text-slate-600 transition hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
          <button onClick={addItem} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-700 px-3 py-2 text-sm text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-300"><Plus className="h-4 w-4" /> Add line item</button>

          <div className="mt-5 ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-400"><span>Subtotal</span><span className="font-data tabular-nums text-slate-200">{audFmt(t.sub, true)}</span></div>
            <div className="flex justify-between text-slate-400"><span>GST (10%)</span><span className="font-data tabular-nums text-slate-200">{audFmt(t.gst, true)}</span></div>
            <div className="flex justify-between border-t border-slate-800 pt-1.5 text-base font-semibold text-slate-100"><span>Total</span><span className="font-data tabular-nums text-cyan-300">{audFmt(t.total, true)}</span></div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-4">
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
            {["draft", "sent"].map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${status === s ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}>{s === "draft" ? "Draft" : "Sent"}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800">Cancel</button>
            <button onClick={() => onSave({ ...editor.quote, lineItems: items, status })} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"><Send className="h-4 w-4" /> Save quote</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- ADD LEAD ---------------------------------- */
function AddLead({ onSave, onClose }: { onSave: (f: { name: string; suburb: string; source: string; project: string }) => void; onClose: () => void }) {
  const [f, setF] = useState({ name: "", suburb: "", source: "google_ads", project: "Bathroom" });
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-stone-900/40" />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between"><Eyebrow icon={Plus}>New lead</Eyebrow><button onClick={onClose} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
        <div className="mt-4 space-y-3">
          <input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50" />
          <input value={f.suburb} onChange={(e) => setF({ ...f, suburb: e.target.value })} placeholder="Suburb" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50" />
          <input value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} placeholder="Project type" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50" />
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-display">Source</p>
            <select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50">
              <optgroup label="Paid">{PAID_KEYS.map((k) => <option key={k} value={k}>{SOURCES[k].label}</option>)}</optgroup>
              <optgroup label="Organic">{ORGANIC_KEYS.map((k) => <option key={k} value={k}>{SOURCES[k].label}</option>)}</optgroup>
            </select>
          </div>
        </div>
        <button disabled={!f.name.trim()} onClick={() => onSave(f)} className="mt-4 w-full rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40">Add to New Leads</button>
      </div>
    </div>
  );
}

/* ---- Global drawer host: wires the modals to shared state ---- */
export default function Drawers() {
  const { leads, selId, setSelId, editor, setEditor, addOpen, setAddOpen, actions, addLead } = useData();
  const sel = leads.find((l) => l.id === selId) || null;
  return (
    <>
      {sel && <LeadDrawer lead={sel} onClose={() => setSelId(null)} actions={actions} />}
      {editor && <QuoteBuilder editor={editor} leadName={leads.find((l) => l.id === editor.leadId)?.name} onSave={(q) => actions.saveQuote(editor.leadId, q)} onClose={() => setEditor(null)} />}
      {addOpen && <AddLead onSave={addLead} onClose={() => setAddOpen(false)} />}
    </>
  );
}
