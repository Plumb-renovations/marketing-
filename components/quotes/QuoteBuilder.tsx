"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye, Pencil, Save, Send, Loader2, Plus, Trash2, GripVertical, Columns3, Copy, RefreshCw, AlertTriangle, ArrowLeft, CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchQuote, saveQuote } from "@/lib/data/quotes";
import { fetchBrandSettings } from "@/lib/data/brand";
import { fetchBusinessProfile } from "@/lib/data/businessProfile";
import { fetchSavedItems, type SavedItem } from "@/lib/data/savedItems";
import { fetchLeads } from "@/lib/data/leads";
import { DEFAULT_BRAND, type BrandSettings } from "@/lib/business/brand";
import {
  emptyQuote, computeTotals, computeStageAmounts, stagePercentSum, money,
  type Quote, type QuoteItem, type QuoteStage,
} from "@/lib/quotes/model";
import QuoteDocument from "@/components/quotes/QuoteDocument";

const uid = () => crypto.randomUUID();
const STATUS_CLS: Record<string, string> = {
  draft: "bg-slate-700/40 text-slate-300 border-slate-600/50",
  sent: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  viewed: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
  accepted: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  declined: "bg-red-500/10 text-red-300 border-red-500/30",
  expired: "bg-amber-500/10 text-amber-300 border-amber-500/30",
};

export default function QuoteBuilder({ id, leadPrefill }: { id: string; leadPrefill?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const isNew = id === "new";

  const [q, setQ] = useState<Quote | null>(null);
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRAND);
  const [businessName, setBusinessName] = useState("");
  const [saved, setSavedItems] = useState<SavedItem[]>([]);
  const [leads, setLeads] = useState<{ id: string; name: string; email?: string; phone?: string; suburb?: string; project?: string }[]>([]);
  const [tab, setTab] = useState<"details" | "preview">("details");
  const [showInternal, setShowInternal] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "exit" | "send">(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const dragIdx = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const [b, prof, lib, ld] = await Promise.all([
        fetchBrandSettings(supabase).catch(() => DEFAULT_BRAND),
        fetchBusinessProfile(supabase).catch(() => null),
        fetchSavedItems(supabase).catch(() => []),
        fetchLeads(supabase).catch(() => []),
      ]);
      setBrand(b);
      setBusinessName(prof?.businessName || "");
      setSavedItems(lib);
      setLeads(ld.map((l: any) => ({ id: l.id, name: l.name, suburb: l.suburb, project: l.project })));

      if (isNew) {
        const nq = emptyQuote(uid());
        nq.terms = b.defaultTerms || "";
        nq.stages = (b.defaultPaymentSchedule || []).map((s, i) => ({
          id: uid(), label: s.label, milestoneNote: "", percent: Number(s.percent) || 0, fixedAmount: null, amount: 0, status: "pending", sortOrder: i,
        }));
        const lead = leadPrefill ? ld.find((l: any) => l.id === leadPrefill) : null;
        if (lead) {
          nq.leadId = lead.id;
          nq.clientName = lead.name;
          nq.projectName = lead.project || "";
          nq.siteAddress = lead.suburb && lead.suburb !== "—" ? lead.suburb : "";
        }
        setQ(nq);
      } else {
        const loaded = await fetchQuote(supabase, id).catch(() => null);
        setQ(loaded || emptyQuote(id));
      }
    })();
  }, [supabase, id, isNew, leadPrefill]);

  if (!q) {
    return <div className="flex items-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading quote…</div>;
  }

  const totals = computeTotals(q.items, brand.gstRegistered, q.gstInclusive);
  const stages = computeStageAmounts(q.stages, totals.total);
  const pctSum = stagePercentSum(q.stages);
  const preview: Quote = { ...q, ...totals, stages };

  const upd = (patch: Partial<Quote>) => setQ((p) => (p ? { ...p, ...patch } : p));
  const updItem = (i: number, patch: Partial<QuoteItem>) => upd({ items: q.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const addItem = (seed?: Partial<QuoteItem>) =>
    upd({ items: [...q.items, { id: uid(), sectionId: null, description: "", detail: "", qty: 1, unit: "ea", unitPrice: 0, unitCost: null, sortOrder: q.items.length, ...seed }] });
  const insertSaved = (s: SavedItem) =>
    addItem({ description: s.description, detail: s.detail, qty: s.defaultQty, unit: s.unit, unitPrice: s.unitPrice });
  const removeItem = (i: number) => upd({ items: q.items.filter((_, j) => j !== i) });

  const onDrop = (to: number) => {
    const from = dragIdx.current;
    dragIdx.current = null;
    if (from == null || from === to) return;
    const items = [...q.items];
    const [m] = items.splice(from, 1);
    items.splice(to, 0, m);
    upd({ items });
  };

  const persist = async (status?: Quote["status"]) => {
    const toSave = { ...q, ...computeTotals(q.items, brand.gstRegistered, q.gstInclusive), stages: computeStageAmounts(q.stages, totals.total), ...(status ? { status } : {}) };
    await saveQuote(supabase, toSave, brand.gstRegistered);
    return toSave;
  };

  const doSave = async (exit: boolean) => {
    setBusy(exit ? "exit" : "save");
    setError("");
    try {
      await persist();
      setNote("Saved");
      if (exit) router.push("/quotes");
      else if (isNew) router.replace(`/quotes/${q.id}`);
    } catch (e: any) {
      setError(e?.message || "Couldn't save the quote.");
    } finally {
      setBusy(null);
    }
  };

  const doSend = async () => {
    setBusy("send");
    setError("");
    try {
      await persist();
      const res = await fetch("/api/quotes/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: q.id }) });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || data?.error || "Couldn't send.");
        return;
      }
      upd({ status: "sent", quoteNumber: data.quoteNumber || q.quoteNumber, publicToken: data.publicToken || q.publicToken });
      setNote(`Sent — ${data.quoteNumber || "quote finalised"}`);
    } catch (e: any) {
      setError(e?.message || "Couldn't send.");
    } finally {
      setBusy(null);
    }
  };

  const inp = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50";
  const lbl = "text-[11px] uppercase tracking-wider text-slate-500 font-display";

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/quotes")} className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:bg-slate-800"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h1 className="font-display text-lg font-semibold tracking-tight text-slate-100">{q.quoteNumber || (isNew ? "New quote" : "Quote")}</h1>
            <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_CLS[q.status] || STATUS_CLS.draft}`}>{q.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tab active={tab === "details"} onClick={() => setTab("details")} icon={Pencil} label="Details" />
          <Tab active={tab === "preview"} onClick={() => setTab("preview")} icon={Eye} label="Preview" />
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2">
        <button onClick={() => doSave(false)} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save &amp; continue</button>
        <button onClick={() => doSave(true)} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-50">{busy === "exit" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save &amp; exit</button>
        <button onClick={doSend} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50">{busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send</button>
        <div className="ml-auto flex items-center gap-2">
          {note && <span className="inline-flex items-center gap-1 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> {note}</span>}
          <button onClick={() => addItem()} className="hidden" />
          <button title="Duplicate" onClick={() => { const nq = { ...q, id: uid(), quoteNumber: null, status: "draft" as const, publicToken: null, sentAt: null }; setQ(nq); setNote("Duplicated (unsaved)"); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-400 transition hover:bg-slate-800"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
          <button title="Revise" onClick={() => upd({ status: "draft", quoteNumber: null })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-400 transition hover:bg-slate-800"><RefreshCw className="h-3.5 w-3.5" /> Revise</button>
        </div>
      </div>

      {error && <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}

      {tab === "preview" ? (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <QuoteDocument quote={preview} brand={brand} businessName={businessName} />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header fields */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className={lbl}>Customer</span>
                <input list="quote-leads" value={q.clientName} onChange={(e) => { const v = e.target.value; const m = leads.find((l) => l.name === v); upd(m ? { clientName: m.name, leadId: m.id, projectName: q.projectName || m.project || "", siteAddress: q.siteAddress || (m.suburb && m.suburb !== "—" ? m.suburb : "") } : { clientName: v }); }} placeholder="Pick a lead or type a name" className={"mt-1 " + inp} />
                <datalist id="quote-leads">{leads.map((l) => <option key={l.id} value={l.name} />)}</datalist>
              </label>
              <Field label="Site / project" value={q.projectName} onChange={(v) => upd({ projectName: v })} cls={inp} lbl={lbl} />
              <Field label="Reference" value={q.reference} onChange={(v) => upd({ reference: v })} cls={inp} lbl={lbl} />
              <Field label="Client email" value={q.clientEmail} onChange={(v) => upd({ clientEmail: v })} cls={inp} lbl={lbl} />
              <Field label="Client phone" value={q.clientPhone} onChange={(v) => upd({ clientPhone: v })} cls={inp} lbl={lbl} />
              <Field label="Site address" value={q.siteAddress} onChange={(v) => upd({ siteAddress: v })} cls={inp} lbl={lbl} />
              <label className="block"><span className={lbl}>Quote date</span><input type="date" value={q.quoteDate} onChange={(e) => upd({ quoteDate: e.target.value })} className={"mt-1 font-data " + inp} /></label>
              <label className="block"><span className={lbl}>Valid until</span><input type="date" value={q.validUntil} onChange={(e) => upd({ validUntil: e.target.value })} className={"mt-1 font-data " + inp} /></label>
              <label className="block">
                <span className={lbl}>GST treatment</span>
                <div className="mt-1 flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
                  {([["false", "Exclusive"], ["true", "Inclusive"]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => upd({ gstInclusive: v === "true" })} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${q.gstInclusive === (v === "true") ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}>{l}</button>
                  ))}
                </div>
              </label>
            </div>
            <label className="mt-3 block"><span className={lbl}>Scope description</span><textarea value={q.scopeDescription} onChange={(e) => upd({ scopeDescription: e.target.value })} rows={3} placeholder="Overall scope of works…" className={"mt-1 " + inp} /></label>
          </div>

          {/* Line items */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-200">Line items</h3>
              <div className="flex items-center gap-2">
                <select onChange={(e) => { const s = saved.find((x) => x.id === e.target.value); if (s) insertSaved(s); e.currentTarget.selectedIndex = 0; }} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300 focus:border-cyan-500/50">
                  <option value="">Insert saved item…</option>
                  {saved.map((s) => <option key={s.id} value={s.id}>{s.description} · {money(s.unitPrice, brand.currency)}</option>)}
                </select>
                <button onClick={() => setShowInternal((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${showInternal ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200" : "border-slate-700 text-slate-400 hover:bg-slate-800"}`}><Columns3 className="h-3.5 w-3.5" /> Cost / margin</button>
              </div>
            </div>
            {showInternal && <p className="mb-2 text-[11px] text-amber-300/80">Cost &amp; margin are internal only — they never appear on the client document or PDF.</p>}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 font-display">
                    <th className="w-6"></th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2 text-right w-16">Qty</th>
                    <th className="px-2 py-2 w-20">Unit</th>
                    <th className="px-2 py-2 text-right w-28">Unit price</th>
                    {showInternal && <th className="px-2 py-2 text-right w-24">Unit cost</th>}
                    {showInternal && <th className="px-2 py-2 text-right w-20">Margin</th>}
                    <th className="px-2 py-2 text-right w-28">Amount</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {q.items.map((it, i) => {
                    const amount = (it.qty || 0) * (it.unitPrice || 0);
                    const margin = it.unitCost != null && it.unitPrice ? Math.round(((it.unitPrice - it.unitCost) / it.unitPrice) * 100) : null;
                    return (
                      <tr key={it.id} draggable onDragStart={() => (dragIdx.current = i)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(i)} className="border-t border-slate-800 align-top">
                        <td className="cursor-grab pt-3 text-slate-600"><GripVertical className="h-4 w-4" /></td>
                        <td className="px-2 py-1.5">
                          <input value={it.description} onChange={(e) => updItem(i, { description: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && i === q.items.length - 1) addItem(); }} placeholder="Description" className={inp} />
                          <input value={it.detail} onChange={(e) => updItem(i, { detail: e.target.value })} placeholder="Detail (optional sub-line)" className={"mt-1 text-xs " + inp} />
                        </td>
                        <td className="px-2 py-1.5"><input type="number" value={it.qty} onChange={(e) => updItem(i, { qty: Number(e.target.value) })} className={"text-right font-data " + inp} /></td>
                        <td className="px-2 py-1.5"><input value={it.unit} onChange={(e) => updItem(i, { unit: e.target.value })} className={"font-data " + inp} /></td>
                        <td className="px-2 py-1.5"><input type="number" value={it.unitPrice} onChange={(e) => updItem(i, { unitPrice: Number(e.target.value) })} className={"text-right font-data " + inp} /></td>
                        {showInternal && <td className="px-2 py-1.5"><input type="number" value={it.unitCost ?? ""} onChange={(e) => updItem(i, { unitCost: e.target.value === "" ? null : Number(e.target.value) })} placeholder="—" className={"text-right font-data " + inp} /></td>}
                        {showInternal && <td className="px-2 py-3 text-right font-data text-xs text-slate-400">{margin == null ? "—" : margin + "%"}</td>}
                        <td className="px-2 py-3 text-right font-data text-slate-200">{money(amount, brand.currency)}</td>
                        <td className="px-2 py-2"><button onClick={() => removeItem(i)} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button onClick={() => addItem()} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"><Plus className="h-4 w-4" /> Add line</button>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <Row label="Subtotal" value={money(totals.subtotal, brand.currency)} />
                {brand.gstRegistered && <Row label={`GST (10%)${q.gstInclusive ? " incl." : ""}`} value={money(totals.gstAmount, brand.currency)} />}
                <div className="flex items-center justify-between border-t border-slate-700 pt-1.5 text-base font-semibold text-slate-100"><span>Total</span><span className="font-data text-cyan-300">{money(totals.total, brand.currency)}</span></div>
              </div>
            </div>
          </div>

          {/* Payment schedule */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-200">Payment schedule</h3>
              <span className={`text-[11px] ${pctSum === 100 || !q.stages.length ? "text-slate-500" : "text-amber-300"}`}>{q.stages.length ? `${pctSum}%${pctSum === 100 ? "" : " — should total 100%"}` : "none"}</span>
            </div>
            <div className="space-y-2">
              {q.stages.map((s, i) => {
                const amt = computeStageAmounts([s], totals.total)[0].amount;
                return (
                  <div key={s.id} className="grid grid-cols-12 items-center gap-2">
                    <input value={s.label} onChange={(e) => upd({ stages: q.stages.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Stage (e.g. Deposit)" className={"col-span-4 " + inp} />
                    <input value={s.milestoneNote} onChange={(e) => upd({ stages: q.stages.map((x, j) => (j === i ? { ...x, milestoneNote: e.target.value } : x)) })} placeholder="Milestone note" className={"col-span-4 " + inp} />
                    <div className="col-span-2 flex items-center rounded-lg border border-slate-700 bg-slate-950">
                      <input type="number" value={s.percent ?? ""} onChange={(e) => upd({ stages: q.stages.map((x, j) => (j === i ? { ...x, percent: e.target.value === "" ? null : Number(e.target.value), fixedAmount: null } : x)) })} placeholder="%" className="w-full bg-transparent px-2 py-2 text-right font-data text-sm text-slate-200 focus:outline-none" />
                      <span className="pr-2 text-xs text-slate-500">%</span>
                    </div>
                    <div className="col-span-1 text-right font-data text-xs text-slate-300">{money(amt, brand.currency)}</div>
                    <button onClick={() => upd({ stages: q.stages.filter((_, j) => j !== i) })} className="col-span-1 rounded-md border border-slate-700 p-2 text-slate-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                );
              })}
            </div>
            <button onClick={() => upd({ stages: [...q.stages, { id: uid(), label: "", milestoneNote: "", percent: 0, fixedAmount: null, amount: 0, status: "pending", sortOrder: q.stages.length }] })} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /> Add stage</button>
          </div>

          {/* Inclusions / exclusions / terms */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block"><span className={lbl}>Inclusions</span><textarea value={q.inclusions} onChange={(e) => upd({ inclusions: e.target.value })} rows={3} className={"mt-1 " + inp} /></label>
            <label className="block"><span className={lbl}>Exclusions</span><textarea value={q.exclusions} onChange={(e) => upd({ exclusions: e.target.value })} rows={3} className={"mt-1 " + inp} /></label>
          </div>
          <label className="block"><span className={lbl}>Intro note</span><textarea value={q.introNote} onChange={(e) => upd({ introNote: e.target.value })} rows={2} className={"mt-1 " + inp} /></label>
          <label className="block"><span className={lbl}>Terms</span><textarea value={q.terms} onChange={(e) => upd({ terms: e.target.value })} rows={4} className={"mt-1 " + inp} /></label>
        </div>
      )}
    </div>
  );
}

function Tab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${active ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200" : "border-slate-700 text-slate-400 hover:bg-slate-800"}`}><Icon className="h-4 w-4" /> {label}</button>
  );
}
function Field({ label, value, onChange, cls, lbl }: { label: string; value: string; onChange: (v: string) => void; cls: string; lbl: string }) {
  return <label className="block"><span className={lbl}>{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} className={"mt-1 " + cls} /></label>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between text-slate-400"><span>{label}</span><span className="font-data text-slate-300">{value}</span></div>;
}
