"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, CheckCircle2, Plus, Trash2, Tags, Sparkles } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { fetchPriceList, upsertPriceItem, deletePriceItem, suggestedSell, type PriceItem, type PriceKind } from "@/lib/data/priceList";
import { fetchBrandSettings, savePcMarkupDefault } from "@/lib/data/brand";
import { DEFAULT_BRAND } from "@/lib/business/brand";
import { STARTER_PRICE_LIST, STARTER_PC_LIST } from "@/lib/quotes/priceListDefaults";
import { DEFAULT_TRADES } from "@/lib/quotes/trades";

const uid = () => crypto.randomUUID();
const cls = "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50";
const money = (n: number, ccy = "AUD") => { try { return new Intl.NumberFormat("en-AU", { style: "currency", currency: ccy }).format(Number(n) || 0); } catch { return "$" + (Number(n) || 0).toFixed(2); } };

// Common bathroom-reno PC categories offered as suggestions (the user can type
// any category — the list stays open).
const PC_CATEGORIES = ["Basins", "Toilets", "Tapware", "Tiles", "Vanities", "Baths", "Showers", "Screens", "Accessories"];

// The per-org PRICE LIST (rate card). Construction trades + PC items & tiles.
// PC items carry an internal COST and MARKUP → the SELL price the client sees;
// cost + markup NEVER leave this panel / the builder. Self-contained.
export default function PriceListPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<PriceItem[]>([]);
  const [defaultMarkup, setDefaultMarkup] = useState<number>(0);
  const [currency, setCurrency] = useState("AUD");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const removed = useMemo(() => new Set<string>(), []);

  useEffect(() => {
    (async () => {
      const [list, brand] = await Promise.all([
        fetchPriceList(supabase).catch(() => []),
        fetchBrandSettings(supabase).catch(() => DEFAULT_BRAND),
      ]);
      setItems(list);
      setDefaultMarkup(brand.defaultPcMarkupPct || 0);
      setCurrency(brand.currency || "AUD");
      setLoading(false);
    })();
  }, [supabase]);

  const set = (i: number, patch: Partial<PriceItem>) => setItems((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = (kind: PriceKind, category = "") =>
    setItems((p) => [...p, { id: uid(), category, name: "", unit: "ea", unitPrice: 0, notes: "", sortOrder: p.length, trade: "", kind, costPrice: null, markupPct: null }]);
  const remove = (i: number) => setItems((p) => { const it = p[i]; if (it) removed.add(it.id); return p.filter((_, j) => j !== i); });
  const loadStarter = (kind: PriceKind) => {
    const starter = kind === "pc" ? STARTER_PC_LIST : STARTER_PRICE_LIST;
    setItems((p) => [...p, ...starter.map((s, i) => ({ ...s, id: uid(), sortOrder: p.length + i, kind, costPrice: null, markupPct: null }))]);
  };

  // Cost/markup edits keep the SELL (unit_price) in step; the user can still type
  // a sell directly (a manual override that ignores the markup).
  const setCost = (i: number, it: PriceItem, v: string) => {
    const cost = v === "" ? null : Number(v);
    set(i, cost != null ? { costPrice: cost, unitPrice: suggestedSell(cost, it.markupPct, defaultMarkup) } : { costPrice: null });
  };
  const setMarkup = (i: number, it: PriceItem, v: string) => {
    const m = v === "" ? null : Number(v);
    set(i, it.costPrice != null ? { markupPct: m, unitPrice: suggestedSell(it.costPrice, m, defaultMarkup) } : { markupPct: m });
  };

  // Real index into the flat `items` array, so set/remove keep working while we
  // render two filtered, category-grouped sections.
  const withIndex = items.map((it, i) => ({ it, i }));
  const constructionRows = withIndex.filter(({ it }) => it.kind !== "pc");
  const pcRows = withIndex.filter(({ it }) => it.kind === "pc");
  const pcCatOptions = Array.from(new Set([...PC_CATEGORIES, ...pcRows.map(({ it }) => it.category.trim()).filter(Boolean)]));

  // Group rows by category (first-appearance order; blank → "Uncategorised").
  const groupRows = (rows: { it: PriceItem; i: number }[]) => {
    const order: string[] = [];
    const m = new Map<string, { it: PriceItem; i: number }[]>();
    for (const r of rows) {
      const c = r.it.category.trim() || "Uncategorised";
      if (!m.has(c)) { m.set(c, []); order.push(c); }
      m.get(c)!.push(r);
    }
    return order.map((c) => [c, m.get(c)!] as const);
  };

  const renderRow = (it: PriceItem, i: number) => {
    const isPc = it.kind === "pc";
    const cost = it.costPrice ?? 0;
    const marginDollars = Math.round((it.unitPrice - cost) * 100) / 100;
    const marginPct = cost > 0 ? Math.round(((it.unitPrice - cost) / cost) * 100) : null;
    return (
      <div key={it.id} className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/40 p-2">
        <div className="grid grid-cols-12 gap-2">
          <input list={isPc ? "pc-categories" : undefined} value={it.category} onChange={(e) => set(i, { category: e.target.value })} placeholder="Category" className={cls + " col-span-4"} />
          <input value={it.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Item" className={cls + " col-span-4"} />
          <input list="price-trades" value={it.trade ?? ""} onChange={(e) => set(i, { trade: e.target.value })} placeholder="Trade" className={cls + " col-span-3"} />
          <button onClick={() => remove(i)} className="col-span-1 rounded-md border border-slate-700 p-2 text-slate-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
        </div>
        {isPc ? (
          <>
            <div className="grid grid-cols-12 items-center gap-2">
              <input value={it.unit} onChange={(e) => set(i, { unit: e.target.value })} placeholder="unit" className={cls + " col-span-3 font-data"} />
              <label className="col-span-3 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2"><span className="text-[10px] uppercase tracking-wide text-slate-500">Cost</span><input type="number" value={it.costPrice ?? ""} onChange={(e) => setCost(i, it, e.target.value)} placeholder="—" className="w-full bg-transparent py-2 text-right font-data text-sm text-slate-200 focus:outline-none" /></label>
              <label className="col-span-3 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2"><span className="text-[10px] uppercase tracking-wide text-slate-500">Markup</span><input type="number" value={it.markupPct ?? ""} onChange={(e) => setMarkup(i, it, e.target.value)} placeholder={`${defaultMarkup}`} className="w-full bg-transparent py-2 text-right font-data text-sm text-slate-200 focus:outline-none" /><span className="text-xs text-slate-500">%</span></label>
              <label className="col-span-3 flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/5 px-2"><span className="text-[10px] uppercase tracking-wide text-amber-300/80">Sell</span><input type="number" value={it.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value) || 0 })} className="w-full bg-transparent py-2 text-right font-data text-sm text-amber-100 focus:outline-none" /></label>
            </div>
            <p className="text-[11px] text-slate-500">
              Client sees <span className="font-data text-amber-300">{money(it.unitPrice, currency)}</span>/{it.unit || "ea"} (sell).
              {it.costPrice != null && <> Internal margin <span className="font-data text-slate-300">{money(marginDollars, currency)}</span>{marginPct != null ? ` · ${marginPct}% markup` : ""} — never shown to the client.</>}
            </p>
          </>
        ) : (
          <div className="grid grid-cols-12 gap-2">
            <input value={it.unit} onChange={(e) => set(i, { unit: e.target.value })} placeholder="unit (m², point, fixed…)" className={cls + " col-span-6 font-data"} />
            <input type="number" value={it.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value) })} placeholder="rate" className={cls + " col-span-6 text-right font-data"} />
          </div>
        )}
        <textarea value={it.notes} onChange={(e) => set(i, { notes: e.target.value })} rows={Math.min(10, Math.max(2, (it.notes || "").split(/\r?\n/).length))} placeholder="Description — the scope text shown on the quote. One point per line for dot points." className={cls + " resize-y"} />
      </div>
    );
  };

  const section = (kind: PriceKind, title: string, blurb: string, rows: { it: PriceItem; i: number }[]) => {
    const groups = groupRows(rows);
    return (
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/20 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-display text-sm font-semibold text-slate-200">{title}</h4>
          <span className="text-[11px] text-slate-500">{rows.length} {rows.length === 1 ? "item" : "items"}</span>
        </div>
        <p className="mt-0.5 text-[12px] text-slate-500">{blurb}</p>

        {kind === "pc" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2">
            <span className="text-xs text-slate-400">Default markup</span>
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950">
              <input type="number" value={defaultMarkup} onChange={(e) => setDefaultMarkup(Math.max(0, Number(e.target.value) || 0))} className="w-16 bg-transparent px-2 py-1.5 text-right font-data text-sm text-slate-200 focus:outline-none" />
              <span className="pr-2 text-xs text-slate-500">%</span>
            </div>
            <span className="text-[11px] text-slate-500">applied to PC items that don&apos;t set their own markup (cost → sell). Saved with this list.</span>
          </div>
        )}

        <div className="mt-2 space-y-3">
          {groups.map(([cat, gr]) => (
            <div key={cat}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[11px] font-display uppercase tracking-wider text-slate-500">{cat} <span className="text-slate-600">· {gr.length}</span></p>
                <button onClick={() => add(kind, cat === "Uncategorised" ? "" : cat)} className="inline-flex items-center gap-1 rounded-md border border-slate-800 px-2 py-1 text-[11px] text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"><Plus className="h-3 w-3" /> Add</button>
              </div>
              <div className="space-y-2">{gr.map(({ it, i }) => renderRow(it, i))}</div>
            </div>
          ))}
          {!rows.length && <p className="text-sm text-slate-500">None yet — add one{kind === "pc" ? ", or load starter PC items" : ", or load starter rates"} to edit.</p>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => add(kind)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><Plus className="h-4 w-4" /> Add {kind === "pc" ? "PC item" : "rate"}</button>
          <button onClick={() => loadStarter(kind)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><Sparkles className="h-4 w-4" /> Load starter {kind === "pc" ? "PC items" : "rates"}</button>
        </div>
      </div>
    );
  };

  const save = async () => {
    setSaving(true); setError(""); setDone(false);
    try {
      for (const id of removed) await deletePriceItem(supabase, id);
      removed.clear();
      await Promise.all(items.map((it, i) => upsertPriceItem(supabase, { ...it, sortOrder: i })));
      await savePcMarkupDefault(supabase, defaultMarkup);
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Couldn't save the price list. If you haven't run migration 0031/0041 yet, do that first.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-slate-100"><Tags className="h-4 w-4 text-cyan-400" /> Price list</h3>
          <p className="mt-0.5 text-sm text-slate-500">Construction trades and PC items &amp; tiles, organised by category. PC items track an internal cost + markup → the sell price the client sees; cost and markup are never shown to the client.</p>
        </div>
        {done && <span className="inline-flex shrink-0 items-center gap-1 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading price list…</div>
      ) : (
        <>
          <datalist id="price-trades">{DEFAULT_TRADES.map((t) => <option key={t} value={t} />)}</datalist>
          <datalist id="pc-categories">{pcCatOptions.map((c) => <option key={c} value={c} />)}</datalist>

          {section("construction", "Construction items", "Trades & labour rates — the construction line-item picker fills from these.", constructionRows)}
          {section("pc", "PC items & tiles", "Fixtures, tapware & tiles supplied as a PC sum — the fixtures palette fills from these only, by category.", pcRows)}

          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save price list
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}
