"use client";

import { useEffect, useMemo, useState } from "react";
import { Palette, Loader2, Save, CheckCircle2, ImagePlus, X, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Panel, SectionHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { fetchBrandSettings, saveBrandSettings } from "@/lib/data/brand";
import { DEFAULT_BRAND, scheduleSum, type BrandSettings } from "@/lib/business/brand";
import { fetchSavedItems, upsertSavedItem, deleteSavedItem, type SavedItem } from "@/lib/data/savedItems";

const uid = () => crypto.randomUUID();

export default function BrandingSettingsScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [b, setB] = useState<BrandSettings>(DEFAULT_BRAND);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingBrand, setSavingBrand] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [saved, setSaved] = useState<"brand" | "items" | null>(null);
  const [error, setError] = useState("");
  const removed = useMemo(() => new Set<string>(), []);

  useEffect(() => {
    (async () => {
      try {
        const [brand, lib] = await Promise.all([fetchBrandSettings(supabase), fetchSavedItems(supabase)]);
        setB(brand);
        setItems(lib);
      } catch {
        setError("Couldn't load your branding settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const set = <K extends keyof BrandSettings>(k: K, v: BrandSettings[K]) => {
    setB((prev) => ({ ...prev, [k]: v }));
    setSaved(null);
  };

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onerror = rej;
      r.onload = () => res(r.result as string);
      r.readAsDataURL(f);
    });
    const up = await fetch("/api/brand/logo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) });
    const j = await up.json();
    if (!up.ok) {
      setError(j?.message || "Logo upload failed.");
      return;
    }
    set("logoUrl", j.url);
  };

  const saveBrand = async () => {
    setSavingBrand(true);
    setError("");
    try {
      await saveBrandSettings(supabase, b);
      setSaved("brand");
    } catch {
      setError("Couldn't save settings.");
    } finally {
      setSavingBrand(false);
    }
  };

  const saveLibrary = async () => {
    setSavingItems(true);
    setError("");
    try {
      for (const id of removed) await deleteSavedItem(supabase, id);
      removed.clear();
      await Promise.all(items.map((it, i) => upsertSavedItem(supabase, { ...it, sortOrder: i })));
      setSaved("items");
    } catch {
      setError("Couldn't save the line-item library.");
    } finally {
      setSavingItems(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading branding settings…
      </div>
    );
  }

  const sum = scheduleSum(b.defaultPaymentSchedule);

  return (
    <div className="space-y-6">
      <SectionHeader icon={Palette} title="Branding & Quote Settings" desc="Your logo, brand colour and details — quotes and invoices wear your brand, not Hazel's." />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <Panel className="p-5 space-y-5">
        {/* Logo + colours */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Lbl>Logo</Lbl>
            {b.logoUrl ? (
              <div className="relative mt-1.5 inline-flex items-center rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.logoUrl} alt="logo" className="max-h-16 max-w-[180px] object-contain" />
                <button onClick={() => set("logoUrl", null)} className="ml-2 rounded-md border border-slate-700 p-1 text-slate-400 hover:text-red-300"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 px-3 py-5 text-sm text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-300">
                <ImagePlus className="h-4 w-4" /> Upload logo (PNG/SVG)
                <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Color label="Brand colour" value={b.brandColor} onChange={(v) => set("brandColor", v)} />
            <Color label="Secondary (optional)" value={b.brandColor2 || "#000000"} onChange={(v) => set("brandColor2", v)} />
          </div>
        </div>

        {/* Business document details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Txt label="Sales contact name" value={b.contactName} onChange={(v) => set("contactName", v)} placeholder="e.g. Jordan Smith" />
          <Txt label="Contact phone" value={b.contactPhone} onChange={(v) => set("contactPhone", v)} placeholder="e.g. 0412 345 678" />
          <Txt label="Contact email" value={b.contactEmail} onChange={(v) => set("contactEmail", v)} />
          <Txt label="Business address" value={b.address} onChange={(v) => set("address", v)} />
          <Txt label="ABN" value={b.abn} onChange={(v) => set("abn", v)} />
          <Txt label="Licence no." value={b.licenceNo} onChange={(v) => set("licenceNo", v)} />
        </div>
        <Area label="Bank details (shown on invoices)" value={b.bankDetails} onChange={(v) => set("bankDetails", v)} rows={2} placeholder={"Acme Pty Ltd · BSB 000-000 · Acc 12345678"} />

        {/* Tax + currency + numbering */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
            <input type="checkbox" checked={b.gstRegistered} onChange={(e) => set("gstRegistered", e.target.checked)} className="h-4 w-4 accent-cyan-500" /> GST registered
          </label>
          <Txt label="Currency" value={b.currency} onChange={(v) => set("currency", v)} />
          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <Txt label="Quote prefix" value={b.quotePrefix} onChange={(v) => set("quotePrefix", v)} />
            <Num label="Next quote #" value={b.quoteNext} onChange={(v) => set("quoteNext", v)} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:col-start-3">
            <Txt label="Invoice prefix" value={b.invoicePrefix} onChange={(v) => set("invoicePrefix", v)} />
            <Num label="Next invoice #" value={b.invoiceNext} onChange={(v) => set("invoiceNext", v)} />
          </div>
        </div>

        <Area label="Default terms (prefilled on new quotes)" value={b.defaultTerms} onChange={(v) => set("defaultTerms", v)} rows={3} />

        {/* Default payment schedule */}
        <div>
          <div className="flex items-center justify-between">
            <Lbl>Default payment schedule</Lbl>
            <span className={`text-[11px] ${sum === 100 || b.defaultPaymentSchedule.length === 0 ? "text-slate-500" : "text-amber-300"}`}>
              {b.defaultPaymentSchedule.length ? `${sum}%${sum === 100 ? "" : " — should total 100%"}` : "none"}
            </span>
          </div>
          <div className="mt-2 space-y-2">
            {b.defaultPaymentSchedule.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={s.label} onChange={(e) => set("defaultPaymentSchedule", b.defaultPaymentSchedule.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Stage label (e.g. Deposit)" className={inputCls + " flex-1"} />
                <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950">
                  <input type="number" value={s.percent} onChange={(e) => set("defaultPaymentSchedule", b.defaultPaymentSchedule.map((x, j) => (j === i ? { ...x, percent: Number(e.target.value) } : x)))} className="w-16 bg-transparent px-2 py-2 font-data text-sm text-slate-200 focus:outline-none" />
                  <span className="pr-2.5 text-xs text-slate-500">%</span>
                </div>
                <button onClick={() => set("defaultPaymentSchedule", b.defaultPaymentSchedule.filter((_, j) => j !== i))} className="rounded-md border border-slate-700 p-2 text-slate-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button onClick={() => set("defaultPaymentSchedule", [...b.defaultPaymentSchedule, { label: "", percent: 0 }])} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /> Add stage</button>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
          <button onClick={saveBrand} disabled={savingBrand} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
            {savingBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
          </button>
          {saved === "brand" && <span className="inline-flex items-center gap-1 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
        </div>
      </Panel>

      {/* Saved line items library */}
      <Panel className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-100">Saved line items</h3>
            <p className="mt-0.5 text-sm text-slate-500">Your reusable library — one-tap insert when building a quote.</p>
          </div>
          {saved === "items" && <span className="inline-flex items-center gap-1 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
        </div>

        <div className="mt-4 space-y-2">
          {items.map((it, i) => (
            <div key={it.id} className="grid grid-cols-12 items-center gap-2">
              <input value={it.description} onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="Description" className={inputCls + " col-span-5"} />
              <input value={it.unit} onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} placeholder="ea" className={inputCls + " col-span-2 font-data"} />
              <input type="number" value={it.defaultQty} onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? { ...x, defaultQty: Number(e.target.value) } : x)))} placeholder="qty" className={inputCls + " col-span-2 font-data"} />
              <input type="number" value={it.unitPrice} onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? { ...x, unitPrice: Number(e.target.value) } : x)))} placeholder="price" className={inputCls + " col-span-2 font-data"} />
              <button onClick={() => { removed.add(it.id); setItems((p) => p.filter((_, j) => j !== i)); }} className="col-span-1 rounded-md border border-slate-700 p-2 text-slate-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {!items.length && <p className="text-sm text-slate-500">No saved items yet.</p>}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-slate-800 pt-4">
          <button onClick={() => setItems((p) => [...p, { id: uid(), description: "", detail: "", defaultQty: 1, unit: "ea", unitPrice: 0, sortOrder: p.length }])} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><Plus className="h-4 w-4" /> Add item</button>
          <button onClick={saveLibrary} disabled={savingItems} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
            {savingItems ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save library
          </button>
        </div>
      </Panel>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50";
const Lbl = ({ children }: { children: React.ReactNode }) => <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">{children}</span>;

function Txt({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <Lbl>{label}</Lbl>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={"mt-1 " + inputCls} />
    </label>
  );
}
function Area({ label, value, onChange, rows = 3, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <label className="block">
      <Lbl>{label}</Lbl>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={"mt-1 " + inputCls} />
    </label>
  );
}
function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <Lbl>{label}</Lbl>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className={"mt-1 font-data " + inputCls} />
    </label>
  );
}
function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <Lbl>{label}</Lbl>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded bg-transparent" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent font-data text-sm text-slate-200 focus:outline-none" />
      </div>
    </label>
  );
}
