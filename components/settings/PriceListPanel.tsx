"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, CheckCircle2, Plus, Trash2, Tags, Sparkles } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { fetchPriceList, upsertPriceItem, deletePriceItem, type PriceItem } from "@/lib/data/priceList";
import { STARTER_PRICE_LIST } from "@/lib/quotes/priceListDefaults";
import { DEFAULT_TRADES } from "@/lib/quotes/trades";

const uid = () => crypto.randomUUID();
const cls = "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50";

// The per-org PRICE LIST (rate card). Standard rates the smart line-item picker
// auto-fills from, and the future AI reviewer reads to flag a line too cheap /
// too dear. Self-contained: loads + saves its own data so it can drop into the
// Branding & Quotes page (or anywhere) without threading state.
export default function PriceListPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const removed = useMemo(() => new Set<string>(), []);

  useEffect(() => {
    (async () => {
      const list = await fetchPriceList(supabase).catch(() => []);
      setItems(list);
      setLoading(false);
    })();
  }, [supabase]);

  const set = (i: number, patch: Partial<PriceItem>) => setItems((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = () => setItems((p) => [...p, { id: uid(), category: "", name: "", unit: "ea", unitPrice: 0, notes: "", sortOrder: p.length, trade: "" }]);
  const remove = (i: number) => setItems((p) => { const it = p[i]; if (it) removed.add(it.id); return p.filter((_, j) => j !== i); });
  const loadStarter = () =>
    setItems((p) => [...p, ...STARTER_PRICE_LIST.map((s, i) => ({ ...s, id: uid(), sortOrder: p.length + i }))]);

  const save = async () => {
    setSaving(true); setError(""); setDone(false);
    try {
      for (const id of removed) await deletePriceItem(supabase, id);
      removed.clear();
      await Promise.all(items.map((it, i) => upsertPriceItem(supabase, { ...it, sortOrder: i })));
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Couldn't save the price list. If you haven't run migration 0031 yet, do that first.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-slate-100"><Tags className="h-4 w-4 text-cyan-400" /> Price list</h3>
          <p className="mt-0.5 text-sm text-slate-500">Your standard rates (per m², per point, fixed packages…). The quote builder fills the rate from here, and Hazel will use it to flag lines that look too cheap or too dear.</p>
        </div>
        {done && <span className="inline-flex shrink-0 items-center gap-1 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading price list…</div>
      ) : (
        <>
          <datalist id="price-trades">{DEFAULT_TRADES.map((t) => <option key={t} value={t} />)}</datalist>
          <div className="mt-3 space-y-2">
            {items.map((it, i) => (
              <div key={it.id} className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                <div className="grid grid-cols-12 gap-2">
                  <input value={it.category} onChange={(e) => set(i, { category: e.target.value })} placeholder="Category" className={cls + " col-span-4"} />
                  <input value={it.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Item" className={cls + " col-span-4"} />
                  <input list="price-trades" value={it.trade ?? ""} onChange={(e) => set(i, { trade: e.target.value })} placeholder="Trade" className={cls + " col-span-3"} />
                  <button onClick={() => remove(i)} className="col-span-1 rounded-md border border-slate-700 p-2 text-slate-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <input value={it.unit} onChange={(e) => set(i, { unit: e.target.value })} placeholder="unit (m², point, fixed…)" className={cls + " col-span-3 font-data"} />
                  <input type="number" value={it.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value) })} placeholder="rate" className={cls + " col-span-3 text-right font-data"} />
                  <input value={it.notes} onChange={(e) => set(i, { notes: e.target.value })} placeholder="note (what the rate covers — optional)" className={cls + " col-span-6"} />
                </div>
              </div>
            ))}
            {!items.length && <p className="text-sm text-slate-500">No rates yet — add your own, or load a starter set to edit.</p>}
          </div>

          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
            <button onClick={add} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><Plus className="h-4 w-4" /> Add rate</button>
            <button onClick={loadStarter} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><Sparkles className="h-4 w-4" /> Load starter rates</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save price list
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}
