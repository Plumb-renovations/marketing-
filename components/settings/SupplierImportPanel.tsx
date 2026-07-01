"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, CheckCircle2, AlertTriangle, FileSpreadsheet, Upload } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { SUPPLIERS, getSupplier, parseGrid, priceProducts, FLAG_META, MARGIN_FLOOR_PCT, type ParsedProduct, type PricedProduct } from "@/lib/quotes/suppliers";
import { fetchPriceList, importPriceItems, recomputeSupplierCosts, recomputeSupplierTier, type PriceItem } from "@/lib/data/priceList";
import { fetchSupplierDiscounts, saveSupplierDiscount, fetchSupplierTiers, saveSupplierActiveTier } from "@/lib/data/supplierSettings";

const uid = () => crypto.randomUUID();
const money = (n: number, ccy = "AUD") => { try { return new Intl.NumberFormat("en-AU", { style: "currency", currency: ccy }).format(Number(n) || 0); } catch { return "$" + (Number(n) || 0).toFixed(2); } };
const dims = (p: { widthMm: number | null; depthMm: number | null; heightMm: number | null }) => [p.widthMm, p.depthMm, p.heightMm].filter((x) => x != null).join(" × ");

// Bulk import PC items from a supplier spreadsheet (CSV). Supplier-aware: each
// supplier config owns its column mapping / category rule / pricing rule, so new
// suppliers slot in without touching this flow. Upload → preview → confirm.
// The client only ever sees the SELL price; cost + margin are internal.
export default function SupplierImportPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [supplierId, setSupplierId] = useState(SUPPLIERS[0]?.id || "");
  const [discount, setDiscount] = useState<number>(SUPPLIERS[0]?.defaultTradeDiscountPct || 0);
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [tiers, setTiers] = useState<Record<string, string>>({});
  const [activeTier, setActiveTier] = useState<string>("");
  const [existing, setExisting] = useState<PriceItem[]>([]);
  const [parsed, setParsed] = useState<ParsedProduct[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [includeKitchen, setIncludeKitchen] = useState(false);
  const [busy, setBusy] = useState<"" | "import" | "recalc">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const config = getSupplier(supplierId);

  useEffect(() => {
    (async () => {
      const [list, d, t] = await Promise.all([
        fetchPriceList(supabase).catch(() => []),
        fetchSupplierDiscounts(supabase).catch(() => ({})),
        fetchSupplierTiers(supabase).catch(() => ({})),
      ]);
      setExisting(list);
      setDiscounts(d);
      setTiers(t);
    })();
  }, [supabase]);

  // When the supplier (or loaded settings) changes, seed the trade discount and
  // active cost tier from the saved settings, falling back to config defaults.
  useEffect(() => {
    const cfg = getSupplier(supplierId);
    if (cfg) {
      setDiscount(discounts[supplierId] ?? cfg.defaultTradeDiscountPct);
      setActiveTier(tiers[supplierId] ?? cfg.defaultTier ?? cfg.tierLabels?.[0] ?? "");
    }
    setParsed(null); setFileName(""); setNote(""); setError("");
  }, [supplierId, discounts, tiers]);

  const multiTier = !!config?.tierLabels?.length;

  const onFile = async (file: File | null) => {
    if (!file || !config) return;
    setError(""); setNote(""); setParsed(null);
    try {
      const grid = parseGrid(await file.text());
      const rows = config.parse(grid);
      if (!rows.length) { setError("No products found — check this is the right supplier's CSV (export Excel as CSV first)."); return; }
      setParsed(rows);
      setFileName(file.name);
    } catch (e: any) {
      setError(e?.message || "Couldn't read that file. Please export it as CSV and try again.");
    }
  };

  const preview: PricedProduct[] = useMemo(
    () => (parsed && config ? priceProducts(parsed, discount, config.derivesCostFromRrp) : []),
    [parsed, config, discount],
  );

  // Match on supplier + code so a re-import UPDATES rather than duplicating.
  const existingByCode = useMemo(() => {
    const m = new Map<string, PriceItem>();
    for (const it of existing) if (it.supplier === supplierId && it.code) m.set(it.code, it);
    return m;
  }, [existing, supplierId]);

  const importable = preview.filter((p) => includeKitchen || !p.excluded);
  const skipped = preview.length - importable.length;
  const updates = importable.filter((p) => existingByCode.has(p.code)).length;
  const creates = importable.length - updates;
  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of importable) m.set(p.category, (m.get(p.category) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [importable]);
  const flagCounts = useMemo(() => {
    const m: Record<string, number> = { below: 0, thin: 0, ok: 0, push: 0 };
    for (const p of importable) m[p.flag]++;
    return m;
  }, [importable]);

  // The tier this uploaded file represents (multi-tier suppliers) — read from the
  // parsed rows, falling back to the config default.
  const fileTier = (parsed?.find((p) => p.tier)?.tier || config?.defaultTier || "") as string;

  const toPriceItem = (p: PricedProduct, sort: number): PriceItem => {
    const ex = existingByCode.get(p.code);
    const size = dims(p);
    // Multi-tier: merge this file's tier cost into any tiers already stored for
    // the item (so importing the -46 then -49 file keeps BOTH), and set the live
    // cost_price from the active tier (falling back to this file's cost).
    let costTiers: Record<string, number> | null = null;
    let costPrice = p.cost;
    if (multiTier) {
      const pTier = p.tier || fileTier;
      costTiers = { ...(ex?.costTiers || {}), ...(pTier ? { [pTier]: p.cost } : {}) };
      costPrice = (activeTier && costTiers[activeTier] != null ? costTiers[activeTier] : p.cost);
    }
    return {
      id: ex?.id ?? uid(),
      category: p.category,
      name: p.description || p.code,
      unit: "ea",
      unitPrice: p.sell, // SELL — the only price the client sees
      notes: size ? `${p.description || p.code} — ${size} mm` : p.description || p.code,
      sortOrder: sort,
      trade: null,
      kind: "pc",
      costPrice, // INTERNAL
      markupPct: null,
      supplier: supplierId,
      code: p.code,
      rrpInc: p.rrpInc,
      widthMm: p.widthMm, depthMm: p.depthMm, heightMm: p.heightMm,
      costTiers,
    };
  };

  const runImport = async () => {
    if (!importable.length) return;
    setBusy("import"); setError(""); setNote("");
    try {
      const startSort = existing.reduce((mx, x) => Math.max(mx, x.sortOrder), 0) + 1;
      const items = importable.map((p, i) => toPriceItem(p, startSort + i));
      await importPriceItems(supabase, items);
      // Persist the relevant supplier setting (active tier / trade discount).
      if (multiTier) { await saveSupplierActiveTier(supabase, supplierId, activeTier); setTiers((t) => ({ ...t, [supplierId]: activeTier })); }
      else { await saveSupplierDiscount(supabase, supplierId, discount); setDiscounts((d) => ({ ...d, [supplierId]: discount })); }
      const fresh = await fetchPriceList(supabase).catch(() => existing);
      setExisting(fresh);
      setNote(`Imported ${items.length} ${config?.name || ""} products — ${creates} new, ${updates} updated.${multiTier ? ` Tier ${fileTier} costs stored; active tier ${activeTier}.` : ""} They're in your PC items list under their categories.`);
      setParsed(null); setFileName("");
    } catch (e: any) {
      setError(e?.message || "Import failed. If you haven't run migrations 0042/0043 yet, do that first.");
    } finally {
      setBusy("");
    }
  };

  const saveDiscountAndRecalc = async () => {
    setBusy("recalc"); setError(""); setNote("");
    try {
      await saveSupplierDiscount(supabase, supplierId, discount);
      const n = await recomputeSupplierCosts(supabase, supplierId, discount);
      const fresh = await fetchPriceList(supabase).catch(() => existing);
      setExisting(fresh);
      setDiscounts((d) => ({ ...d, [supplierId]: discount }));
      setNote(n > 0 ? `Saved — recalculated cost & margin on ${n} existing ${config?.name || ""} item${n === 1 ? "" : "s"} (no re-import needed).` : "Saved the trade discount.");
    } catch (e: any) {
      setError(e?.message || "Couldn't save / recalculate.");
    } finally {
      setBusy("");
    }
  };

  // Flip the active cost tier (Millennium 46/49) and recompute cost from the
  // stored tiers — no re-import.
  const saveTierAndRecalc = async () => {
    setBusy("recalc"); setError(""); setNote("");
    try {
      await saveSupplierActiveTier(supabase, supplierId, activeTier);
      const n = await recomputeSupplierTier(supabase, supplierId, activeTier);
      const fresh = await fetchPriceList(supabase).catch(() => existing);
      setExisting(fresh);
      setTiers((t) => ({ ...t, [supplierId]: activeTier }));
      setNote(n > 0 ? `Active tier set to ${activeTier} — recalculated cost & margin on ${n} ${config?.name || ""} item${n === 1 ? "" : "s"} (no re-import).` : `Saved active tier ${activeTier}. Import a file to populate costs.`);
    } catch (e: any) {
      setError(e?.message || "Couldn't save / recalculate the tier.");
    } finally {
      setBusy("");
    }
  };

  const existingForSupplier = existing.filter((it) => it.supplier === supplierId).length;

  return (
    <Panel className="p-5">
      <div className="flex items-start gap-2">
        <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
        <div>
          <h3 className="font-display text-base font-semibold text-slate-100">Import PC items from a supplier</h3>
          <p className="mt-0.5 text-sm text-slate-500">Upload a supplier price list (CSV) — it&apos;s parsed, categorised and priced (cost → sell) for review before anything is saved. The client only ever sees the sell price; cost &amp; margin stay internal.</p>
        </div>
      </div>

      {/* Supplier + trade discount */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Supplier</span>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-200 focus:border-cyan-500/50">
            {SUPPLIERS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {config && <p className="mt-1 text-[11px] text-slate-500">{config.blurb}</p>}
        </label>
        {config?.derivesCostFromRrp && (
          <label className="block">
            <span className="text-xs font-medium text-slate-400">{config.name} trade discount</span>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950">
                <input type="number" value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} className="w-20 bg-transparent px-2.5 py-2 text-right font-data text-sm text-slate-200 focus:outline-none" />
                <span className="pr-2.5 text-xs text-slate-500">%</span>
              </div>
              <button onClick={saveDiscountAndRecalc} disabled={busy !== ""} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-300 transition hover:bg-slate-800 disabled:opacity-50">
                {busy === "recalc" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save &amp; recalc{existingForSupplier > 0 ? ` (${existingForSupplier})` : ""}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-amber-300/80">Cost = RRP (ex GST) × (1 − discount). Placeholder until confirmed — change it any time to recalculate all {config.name} costs &amp; margins without re-importing.</p>
          </label>
        )}
        {multiTier && config && (
          <label className="block">
            <span className="text-xs font-medium text-slate-400">{config.name} active cost tier</span>
            <div className="mt-1 flex items-center gap-2">
              <select value={activeTier} onChange={(e) => setActiveTier(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-200 focus:border-cyan-500/50">
                {config.tierLabels!.map((t) => <option key={t} value={t}>-{t} (disc 0.{t})</option>)}
              </select>
              <button onClick={saveTierAndRecalc} disabled={busy !== ""} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-300 transition hover:bg-slate-800 disabled:opacity-50">
                {busy === "recalc" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save &amp; recalc{existingForSupplier > 0 ? ` (${existingForSupplier})` : ""}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Real NETT cost comes from the file. Import both the -{config.tierLabels![0]} and -{config.tierLabels![config.tierLabels!.length - 1]} files to store both tiers, then flip the live one here — a one-click change, no re-import.</p>
          </label>
        )}
      </div>

      {/* Upload */}
      <div className="mt-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-sm text-cyan-200 transition hover:bg-cyan-500/10">
          <Upload className="h-4 w-4" /> Choose CSV file
          <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
        </label>
        {fileName && <span className="ml-2 text-xs text-slate-400">{fileName}</span>}
        <p className="mt-1.5 text-[11px] text-slate-500">Excel (.xlsx)? In Excel choose <b>File → Save As → CSV (UTF-8)</b>, then upload that.</p>
      </div>

      {error && <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-red-300"><AlertTriangle className="h-4 w-4" /> {error}</p>}
      {note && <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> {note}</p>}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-display text-sm font-semibold text-slate-200">Preview — {importable.length} to import <span className="font-normal text-slate-500">({creates} new, {updates} update{updates === 1 ? "" : "s"}{skipped ? `, ${skipped} skipped` : ""})</span></h4>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-400"><input type="checkbox" checked={includeKitchen} onChange={(e) => setIncludeKitchen(e.target.checked)} className="accent-cyan-500" /> Include kitchen items (FFC/GRID)</label>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {catCounts.map(([c, n]) => <span key={c} className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-300">{c} <span className="text-slate-500">{n}</span></span>)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            {(["push", "ok", "thin", "below"] as const).map((f) => <span key={f} className={`rounded-md border px-2 py-0.5 ${FLAG_META[f].cls}`}>{FLAG_META[f].label} {flagCounts[f]}</span>)}
            {config?.derivesCostFromRrp && <span className="text-amber-300/80">· margins provisional — based on the placeholder {config.name} trade discount ({discount}%), not final until confirmed. Floor {MARGIN_FLOOR_PCT}%.</span>}
            {multiTier && <span className="text-slate-400">· this file is the -{fileTier || "?"} tier (real NETT cost — margins are final). Active tier {activeTier}. Floor {MARGIN_FLOOR_PCT}%.</span>}
          </div>

          <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="sticky top-0 bg-slate-900 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-2 py-2">Code</th><th className="px-2 py-2">Category</th><th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2 text-right">Sell (RRP)</th><th className="px-2 py-2 text-right">Cost</th><th className="px-2 py-2 text-right">Margin</th><th className="px-2 py-2">Flag</th><th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {preview.map((p, i) => {
                  const skip = !includeKitchen && p.excluded;
                  const isUpdate = existingByCode.has(p.code);
                  return (
                    <tr key={`${p.code}-${i}`} className={skip ? "opacity-40" : ""}>
                      <td className="px-2 py-1.5 font-data text-slate-300">{p.code}</td>
                      <td className="px-2 py-1.5 text-slate-300">{p.category}</td>
                      <td className="px-2 py-1.5 text-slate-400">{p.description}</td>
                      <td className="px-2 py-1.5 text-right font-data text-amber-300">{money(p.sell)}</td>
                      <td className="px-2 py-1.5 text-right font-data text-slate-400">{money(p.cost)}</td>
                      <td className="px-2 py-1.5 text-right font-data text-slate-400">{p.marginPct}%</td>
                      <td className="px-2 py-1.5"><span className={`rounded border px-1.5 py-0.5 text-[10px] ${FLAG_META[p.flag].cls}`}>{FLAG_META[p.flag].label}</span></td>
                      <td className="px-2 py-1.5 text-[10px] text-slate-500">{skip ? "kitchen — skip" : isUpdate ? "update" : "new"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={runImport} disabled={busy !== "" || !importable.length} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
              {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Import {importable.length} products
            </button>
            <button onClick={() => { setParsed(null); setFileName(""); }} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800">Cancel</button>
          </div>
        </div>
      )}
    </Panel>
  );
}
