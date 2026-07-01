"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye, Pencil, Save, Send, Loader2, Plus, Trash2, GripVertical, Columns3, Copy, RefreshCw, AlertTriangle, ArrowLeft, CheckCircle2, Printer, Tags, BookmarkPlus, LayoutTemplate, X, Sparkles, TrendingDown, TrendingUp, ShieldCheck, ScanSearch, MessageSquareQuote, Lightbulb, Wand2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchQuote, saveQuote } from "@/lib/data/quotes";
import { publicQuoteUrl } from "@/lib/quotes/publicUrl";
import { fetchBrandSettings, saveBrandSettings } from "@/lib/data/brand";
import { fetchBusinessProfile } from "@/lib/data/businessProfile";
import { fetchSavedItems, type SavedItem } from "@/lib/data/savedItems";
import { fetchPriceList, upsertPriceItem, type PriceItem } from "@/lib/data/priceList";
import { fetchQuoteTemplates, saveQuoteTemplate, deleteQuoteTemplate, type QuoteTemplate, type QuoteTemplateData } from "@/lib/data/quoteTemplates";
import { fetchLeads } from "@/lib/data/leads";
import { DEFAULT_BRAND, type BrandSettings } from "@/lib/business/brand";
import {
  emptyQuote, computeTotals, computeStageAmounts, stagePercentSum, money, tierTotals, pcTierTotals, TIERS, tierName, pcTierName,
  priceableItems, DEFAULT_ALLOWANCE_NOTE, DEFAULT_CONFIGURATOR_INTRO, DEFAULT_COMFORT_QUESTION, DEFAULT_JOURNEY, allowanceItemsOf,
  type Quote, type QuoteItem, type QuoteStage, type TierKey,
} from "@/lib/quotes/model";
import { DEFAULT_TRADES, inferTradeType, TRADE_TYPE_LABEL, type TradeType } from "@/lib/quotes/trades";
import { reviewQuote, type QuoteReviewResult } from "@/lib/quotes/reviewClient";
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
  const [priceList, setPriceList] = useState<PriceItem[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [review, setReview] = useState<QuoteReviewResult | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [appliedWording, setAppliedWording] = useState<Set<number>>(new Set());
  const [dismissedFlags, setDismissedFlags] = useState<Set<string>>(new Set());
  const [savingAllowanceDefault, setSavingAllowanceDefault] = useState(false);
  const [savingIntroDefault, setSavingIntroDefault] = useState(false);
  const [savingComfortDefault, setSavingComfortDefault] = useState(false);
  const [pcCat, setPcCat] = useState<string>(""); // selected PC category in the palette ("" = all)
  const [pcSort, setPcSort] = useState<"price-asc" | "price-desc" | "name">("price-asc"); // PC picker sort
  const [customPcOpen, setCustomPcOpen] = useState(false);
  const emptyCustomPc = { name: "", category: "", sell: 0, cost: "" as number | "", tier: null as null | "good" | "better" | "best", save: false };
  const [customPc, setCustomPc] = useState(emptyCustomPc);
  const [leads, setLeads] = useState<{ id: string; name: string; email?: string; phone?: string; suburb?: string; project?: string }[]>([]);
  const [tab, setTab] = useState<"details" | "preview">("details");
  const [showInternal, setShowInternal] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "exit" | "send">(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const dragIdx = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const [b, prof, lib, pl, tpls, ld] = await Promise.all([
        fetchBrandSettings(supabase).catch(() => DEFAULT_BRAND),
        fetchBusinessProfile(supabase).catch(() => null),
        fetchSavedItems(supabase).catch(() => []),
        fetchPriceList(supabase).catch(() => []),
        fetchQuoteTemplates(supabase).catch(() => []),
        fetchLeads(supabase).catch(() => []),
      ]);
      setBrand(b);
      setBusinessName(prof?.businessName || "");
      setSavedItems(lib);
      setPriceList(pl);
      setTemplates(tpls);
      setLeads(ld.map((l: any) => ({ id: l.id, name: l.name, suburb: l.suburb, project: l.project })));

      if (isNew) {
        const nq = emptyQuote(uid());
        nq.terms = b.defaultTerms || "";
        nq.allowanceNote = b.defaultAllowanceNote || DEFAULT_ALLOWANCE_NOTE;
        nq.configuratorIntro = b.defaultConfiguratorIntro || DEFAULT_CONFIGURATOR_INTRO;
        nq.comfortQuestion = b.defaultComfortQuestion || DEFAULT_COMFORT_QUESTION;
        nq.journey = DEFAULT_JOURNEY.map((s) => ({ ...s }));
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
        const qq = loaded || emptyQuote(id);
        // Auto-fill the allowance framing text + journey if not set yet.
        if (!qq.allowanceNote) qq.allowanceNote = b.defaultAllowanceNote || DEFAULT_ALLOWANCE_NOTE;
        if (!qq.configuratorIntro) qq.configuratorIntro = b.defaultConfiguratorIntro || DEFAULT_CONFIGURATOR_INTRO;
        if (!qq.comfortQuestion) qq.comfortQuestion = b.defaultComfortQuestion || DEFAULT_COMFORT_QUESTION;
        if (!qq.journey?.length) qq.journey = DEFAULT_JOURNEY.map((s) => ({ ...s }));
        setQ(qq);
      }
    })();
  }, [supabase, id, isNew, leadPrefill]);

  // Group the price list by category for the picker's optgroups, SEPARATED into
  // construction trades vs PC items/tiles so neither palette bleeds into the
  // other. MUST stay above the early return below — hooks run unconditionally,
  // in the same order, every render (depends only on priceList).
  const groupByCategory = (list: PriceItem[]) => {
    const m = new Map<string, PriceItem[]>();
    for (const p of list) { const k = p.category.trim() || "Other"; (m.get(k) ?? m.set(k, []).get(k)!).push(p); }
    return [...m.entries()];
  };
  const constructionGroups = useMemo(() => groupByCategory(priceList.filter((p) => p.kind !== "pc")), [priceList]);
  const pcGroups = useMemo(() => groupByCategory(priceList.filter((p) => p.kind === "pc")), [priceList]);
  // Sort each PC category's items — default cheapest-first, so the entry-level
  // options sit at the top (Standard tier) and the premium ones at the bottom
  // (Luxury tier), making it fast to pick a price level per tier.
  const pcGroupsSorted = useMemo(() => {
    const cmp = pcSort === "price-desc" ? (a: PriceItem, b: PriceItem) => b.unitPrice - a.unitPrice
      : pcSort === "name" ? (a: PriceItem, b: PriceItem) => a.name.localeCompare(b.name)
      : (a: PriceItem, b: PriceItem) => a.unitPrice - b.unitPrice;
    return pcGroups.map(([cat, list]) => [cat, [...list].sort(cmp)] as [string, PriceItem[]]);
  }, [pcGroups, pcSort]);

  if (!q) {
    return <div className="flex items-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading quote…</div>;
  }

  // Two parallel axes: construction tiers (build-only) + PC-item tiers (fixture
  // allowance). The headline total = representative construction + representative
  // PC. tierTotals = build-only; pcTiers = the fixture allowance per PC level.
  const tiers = tierTotals(q.items, brand.gstRegistered, q.gstInclusive);
  const pcTiers = pcTierTotals(q.items, brand.gstRegistered, q.gstInclusive);
  const totals = computeTotals(priceableItems(q.items, q.tiered ? "better" : null, q.pcTiered ? "better" : null), brand.gstRegistered, q.gstInclusive);
  const stages = computeStageAmounts(q.stages, totals.total);
  const pctSum = stagePercentSum(q.stages);
  const preview: Quote = { ...q, ...totals, stages };

  const upd = (patch: Partial<Quote>) => setQ((p) => (p ? { ...p, ...patch } : p));
  const updItem = (i: number, patch: Partial<QuoteItem>) => upd({ items: q.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const updItemById = (id: string, patch: Partial<QuoteItem>) => upd({ items: q.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  const removeItemById = (id: string) => upd({ items: q.items.filter((it) => it.id !== id) });
  const addItem = (seed?: Partial<QuoteItem>) =>
    upd({ items: [...q.items, { id: uid(), sectionId: null, description: "", detail: "", qty: 1, unit: "ea", unitPrice: 0, unitCost: null, sortOrder: q.items.length, trade: null, tradeType: null, tier: null, ...seed }] });
  const insertSaved = (s: SavedItem) =>
    addItem({ description: s.description, detail: s.detail, qty: s.defaultQty, unit: s.unit, unitPrice: s.unitPrice });
  // Smart line item: pull the rate + unit from the price list, qty stays 1 for
  // the user to set → amount = rate × qty (still fully editable/overridable). The
  // price-list item's DESCRIPTION (its `notes` field — the full scope text, may
  // be multi-line/bulleted) pre-fills the line description; the item name is a
  // sensible fallback when no description was written. Its trade pre-fills the
  // line's trade (+ inferred in-house/sub).
  const insertPriceItem = (p: PriceItem) => {
    const trade = (p.trade || "").trim() || null;
    const description = (p.notes || "").trim() || p.name;
    // Carry the SELL price to the client-facing unit price + the internal cost to
    // unitCost (margin stays internal, never on the client doc).
    addItem({ description, detail: "", qty: 1, unit: p.unit, unitPrice: p.unitPrice, unitCost: p.costPrice ?? null, trade, tradeType: trade ? inferTradeType(trade) : null });
  };
  // Set/clear a line's trade; when a trade is set and no in-house/sub flag exists
  // yet, default it from the known in-house trades (still user-overridable).
  const setItemTrade = (i: number, trade: string) => {
    const t = trade.trim();
    const cur = q.items[i];
    updItem(i, { trade: t || null, tradeType: t ? (cur.tradeType ?? inferTradeType(t)) : null });
  };
  const removeItem = (i: number) => upd({ items: q.items.filter((_, j) => j !== i) });

  // ---- Tile & Fixture Allowance (PC items / tiles — decoupled from build) ----
  const allowanceLineFor = (priceId: string) => q.items.find((it) => it.allowance && it.sourcePriceItemId === priceId);
  // Toggle a price-list item into/out of the allowance. On → add a priced line
  // flagged allowance (and tier-decoupled); off → remove that line.
  const togglePriceItemAllowance = (p: PriceItem) => {
    const existing = allowanceLineFor(p.id);
    if (existing) { upd({ items: q.items.filter((it) => it.id !== existing.id) }); return; }
    const trade = (p.trade || "").trim() || null;
    const description = (p.notes || "").trim() || p.name;
    // Sell price → client-facing unitPrice; supplier cost → internal unitCost.
    addItem({ description, detail: "", qty: 1, unit: p.unit, unitPrice: p.unitPrice, unitCost: p.costPrice ?? null, trade, tradeType: trade ? inferTradeType(trade) : null, tier: null, allowance: true, sourcePriceItemId: p.id });
  };
  // Add a CUSTOM PC item (not in the catalogue) as an allowance line — the client
  // sees only the sell price; the optional cost stays internal. Optionally save
  // it to the PC price list so it can be reused from the catalogue picker.
  const addCustomPcItem = async () => {
    const name = customPc.name.trim();
    const sell = Number(customPc.sell) || 0;
    if (!name || sell <= 0) { setError("Give the custom PC item a name and a sell price."); return; }
    setError("");
    const cost = customPc.cost === "" ? null : Number(customPc.cost);
    let sourceId: string | null = null;
    if (customPc.save) {
      const item: PriceItem = {
        id: uid(), category: customPc.category.trim(), name, unit: "ea", unitPrice: sell,
        notes: "", sortOrder: priceList.length, trade: null, kind: "pc",
        costPrice: cost, markupPct: null, supplier: null, code: null, rrpInc: null,
        widthMm: null, depthMm: null, heightMm: null, costTiers: null,
      };
      try { await upsertPriceItem(supabase, item); setPriceList((p) => [...p, item]); sourceId = item.id; }
      catch (e: any) { setError(e?.message || "Couldn't save the item to your price list."); return; }
    }
    addItem({ description: name, detail: "", qty: 1, unit: "ea", unitPrice: sell, unitCost: cost, trade: null, tier: null, allowance: true, pcTier: customPc.tier, sourcePriceItemId: sourceId });
    setNote(customPc.save ? "Custom PC item added and saved to your PC price list." : "Custom PC item added to this quote.");
    setCustomPc(emptyCustomPc); setCustomPcOpen(false);
  };
  const allowanceItems = allowanceItemsOf(q.items);
  const allowanceSubtotal = computeTotals(allowanceItems, brand.gstRegistered, q.gstInclusive).subtotal;
  const saveAllowanceDefault = async () => {
    setSavingAllowanceDefault(true); setError("");
    try {
      const next = { ...brand, defaultAllowanceNote: q.allowanceNote };
      await saveBrandSettings(supabase, next);
      setBrand(next);
      setNote("Saved as your default framing text");
    } catch (e: any) {
      setError(e?.message || "Couldn't save the default.");
    } finally {
      setSavingAllowanceDefault(false);
    }
  };
  const saveConfiguratorIntroDefault = async () => {
    setSavingIntroDefault(true); setError("");
    try {
      const next = { ...brand, defaultConfiguratorIntro: q.configuratorIntro };
      await saveBrandSettings(supabase, next);
      setBrand(next);
      setNote("Saved as your default configurator intro");
    } catch (e: any) {
      setError(e?.message || "Couldn't save the default.");
    } finally {
      setSavingIntroDefault(false);
    }
  };
  const saveComfortQuestionDefault = async () => {
    setSavingComfortDefault(true); setError("");
    try {
      const next = { ...brand, defaultComfortQuestion: q.comfortQuestion };
      await saveBrandSettings(supabase, next);
      setBrand(next);
      setNote("Saved as your default comfort question");
    } catch (e: any) {
      setError(e?.message || "Couldn't save the default.");
    } finally {
      setSavingComfortDefault(false);
    }
  };

  // Trades offered in the per-line picker: defaults + any already used on this
  // quote or carried by a price-list item (so the list stays extendable).
  const tradeOptions = Array.from(new Set([
    ...DEFAULT_TRADES,
    ...q.items.map((it) => (it.trade || "").trim()).filter(Boolean),
    ...priceList.map((p) => (p.trade || "").trim()).filter(Boolean),
  ])).sort();

  // ---- Saved quote templates (reusable sets of line items) ----------------
  const loadTemplate = (t: QuoteTemplate) => {
    if (q.items.length && !window.confirm(`Replace the current line items with the "${t.name}" template?`)) return;
    const items: QuoteItem[] = (t.data.items || []).map((li, i) => ({
      id: uid(), sectionId: null, description: li.description || "", detail: li.detail || "",
      qty: Number(li.qty) || 0, unit: li.unit || "ea", unitPrice: Number(li.unitPrice) || 0,
      unitCost: li.unitCost ?? null, sortOrder: i,
      trade: li.trade ?? null, tradeType: li.tradeType ?? null,
    }));
    upd({
      items,
      scopeDescription: q.scopeDescription || t.data.scopeDescription || "",
      inclusions: q.inclusions || t.data.inclusions || "",
      exclusions: q.exclusions || t.data.exclusions || "",
    });
    setNote(`Loaded template "${t.name}"`);
  };
  const saveAsTemplate = async () => {
    const name = tplName.trim();
    if (!name) return;
    const data: QuoteTemplateData = {
      items: q.items.map(({ description, detail, qty, unit, unitPrice, unitCost, trade, tradeType }) => ({ description, detail, qty, unit, unitPrice, unitCost, trade, tradeType })),
      scopeDescription: q.scopeDescription, inclusions: q.inclusions, exclusions: q.exclusions,
    };
    const id = uid();
    try {
      await saveQuoteTemplate(supabase, { id, name, data, sortOrder: templates.length });
      setTemplates((p) => [...p, { id, name, data, sortOrder: p.length, createdAt: null }]);
      setTplName(""); setTplOpen(false); setNote(`Saved template "${name}"`);
    } catch (e: any) {
      setError(e?.message || "Couldn't save the template. If migration 0031 isn't applied yet, run it first.");
    }
  };
  const removeTemplate = async (t: QuoteTemplate) => {
    if (!window.confirm(`Delete the "${t.name}" template?`)) return;
    try { await deleteQuoteTemplate(supabase, t.id); setTemplates((p) => p.filter((x) => x.id !== t.id)); }
    catch (e: any) { setError(e?.message || "Couldn't delete the template."); }
  };

  // ---- Review with Hazel (reads the current quote; never edits it) --------
  const runReview = async () => {
    setReviewBusy(true); setError("");
    try {
      const r = await reviewQuote({
        leadId: q.leadId,
        projectName: q.projectName,
        reference: q.reference,
        scopeDescription: q.scopeDescription,
        inclusions: q.inclusions,
        exclusions: q.exclusions,
        terms: q.terms,
        introNote: q.introNote,
        items: q.items.map((it) => ({ id: it.id, description: it.description, detail: it.detail, qty: it.qty, unit: it.unit, unitPrice: it.unitPrice, unitCost: it.unitCost, tier: it.tier, allowance: it.allowance })),
      }, totals.total);
      setReview(r);
      setAppliedWording(new Set()); // fresh review → nothing applied yet
      // Restore any scope flags the user already dismissed for THIS quote so
      // reviewed warnings don't keep reappearing.
      let dis = new Set<string>();
      try { const raw = localStorage.getItem(`qr-dismiss:${q.id}`); if (raw) dis = new Set(JSON.parse(raw) as string[]); } catch { /* ignore */ }
      setDismissedFlags(dis);
    } catch (e: any) {
      setError(e?.message || "Couldn't run the review.");
    } finally {
      setReviewBusy(false);
    }
  };
  // Dismiss a reviewed scope flag — persisted per quote so it stays gone.
  const dismissFlag = (id: string) => {
    setDismissedFlags((p) => {
      const n = new Set(p).add(id);
      try { localStorage.setItem(`qr-dismiss:${q.id}`, JSON.stringify([...n])); } catch { /* ignore */ }
      return n;
    });
  };

  // One-click apply a WORDING suggestion to the live quote — replaces the
  // targeted line's description (or the overall scope), leaving qty/unit/price/
  // cost untouched. Per-suggestion only; the user can still edit afterwards.
  const applyWording = (w: QuoteReviewResult["wording"][number], i: number) => {
    if (w.field === "description" && w.lineId) {
      const idx = q.items.findIndex((it) => it.id === w.lineId);
      if (idx < 0) return; // line was removed since the review ran
      updItem(idx, { description: w.suggestion });
    } else if (w.field === "scope") {
      upd({ scopeDescription: w.suggestion });
    } else {
      return;
    }
    setAppliedWording((p) => new Set(p).add(i));
    setNote("Applied Hazel's wording");
  };
  // A line-targeted suggestion is only applicable while that line still exists.
  const canApply = (w: QuoteReviewResult["wording"][number]) =>
    w.field === "scope" || (w.field === "description" && !!w.lineId && q.items.some((it) => it.id === w.lineId));

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
    // saveQuote recomputes the stored total itself (representative construction +
    // PC); here we just keep the in-memory copy + stages consistent.
    const toSave = { ...q, ...totals, stages: computeStageAmounts(q.stages, totals.total), ...(status ? { status } : {}) };
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
      upd({ status: "sent", quoteNumber: data.quoteNumber || q.quoteNumber, publicToken: data.publicToken || q.publicToken, sentAt: new Date().toISOString() });
      const REASON: Record<string, string> = {
        no_client_email: "no client email on file — add one and Send again to email it",
        email_not_configured: "email isn't configured — link is ready to share",
        send_failed: "the email failed to send — link is ready to share",
      };
      setNote(
        data.emailed
          ? `Sent ${data.quoteNumber || ""} — emailed to ${q.clientEmail}`.trim()
          : `Sent ${data.quoteNumber || ""} — ${REASON[data.emailReason] || "link ready to share"}`.trim(),
      );
    } catch (e: any) {
      setError(e?.message || "Couldn't send.");
    } finally {
      setBusy(null);
    }
  };

  const inp = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50";
  const lbl = "text-[11px] uppercase tracking-wider text-slate-500 font-display";
  const publicLink = q.publicToken ? publicQuoteUrl(q.publicToken) : "";

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
        <button title="Open the print dialog — choose “Save as PDF”" onClick={() => { setTab("preview"); setTimeout(() => window.print(), 120); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><Printer className="h-4 w-4" /> Save as PDF</button>
        <button title="Hazel reviews wording, pricing and scope before you send — reads the quote, never changes it" onClick={runReview} disabled={reviewBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-2 text-sm text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:opacity-50">{reviewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Review with Hazel</button>
        <div className="ml-auto flex items-center gap-2">
          {note && <span className="inline-flex items-center gap-1 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> {note}</span>}
          <button onClick={() => addItem()} className="hidden" />
          <button title="Duplicate" onClick={() => { const nq = { ...q, id: uid(), quoteNumber: null, status: "draft" as const, publicToken: null, sentAt: null }; setQ(nq); setNote("Duplicated (unsaved)"); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-400 transition hover:bg-slate-800"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
          <button title="Revise" onClick={() => upd({ status: "draft", quoteNumber: null })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-400 transition hover:bg-slate-800"><RefreshCw className="h-3.5 w-3.5" /> Revise</button>
        </div>
      </div>

      {error && <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}

      {/* Hazel's review — wording to close, pricing sanity, scope flags. Reads
          the quote only; never edits it. */}
      {review && (
        <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-100">Hazel&apos;s review</h3>
                <p className="mt-0.5 text-sm text-fuchsia-100/90">{review.headline}</p>
                {review.note && <p className="mt-1 text-[11px] text-amber-300">{review.note}</p>}
              </div>
            </div>
            <button onClick={() => setReview(null)} title="Dismiss" className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><X className="h-3.5 w-3.5" /></button>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {/* Pricing sanity */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <h4 className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400 font-display"><ShieldCheck className="h-3.5 w-3.5" /> Pricing check</h4>
              {review.pricing.length === 0 ? (
                <p className="text-xs text-slate-500">No cost or rate-card data to compare yet. Add unit costs (Cost / margin) or build your price list for a sharper check.</p>
              ) : (
                <ul className="space-y-1.5">
                  {review.pricing.map((p) => {
                    const tone = p.verdict === "healthy" ? "text-emerald-300" : p.verdict === "too_dear" ? "text-amber-300" : "text-red-300";
                    const Icon = p.verdict === "healthy" ? ShieldCheck : p.verdict === "too_dear" ? TrendingUp : TrendingDown;
                    return (
                      <li key={p.lineId} className="text-xs leading-snug">
                        <span className={`inline-flex items-center gap-1 font-medium ${tone}`}><Icon className="h-3 w-3 shrink-0" /> {p.description}</span>
                        <span className="text-slate-400"> — {p.reason}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Scope / keyword flags */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <h4 className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400 font-display"><ScanSearch className="h-3.5 w-3.5" /> Scope flags</h4>
              {(() => {
                const visible = review.keywords.filter((k) => !dismissedFlags.has(k.id));
                if (visible.length === 0) {
                  return <p className="text-xs text-slate-500">{review.keywords.length ? "All scope flags reviewed — nothing outstanding." : "No specific scope risks spotted."}</p>;
                }
                return (
                  <ul className="space-y-1.5">
                    {visible.map((k) => (
                      <li key={k.id} className="flex items-start justify-between gap-2 text-xs leading-snug">
                        <span>
                          <span className="inline-flex items-center gap-1 font-medium text-amber-300"><AlertTriangle className="h-3 w-3 shrink-0" /> {k.label}</span>
                          <span className="text-slate-400"> — {k.note}</span>
                        </span>
                        <button onClick={() => dismissFlag(k.id)} title="Dismiss — I've reviewed this" className="mt-0.5 shrink-0 rounded p-0.5 text-slate-500 transition hover:text-slate-300"><X className="h-3 w-3" /></button>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>

            {/* Wording to close */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <h4 className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400 font-display"><MessageSquareQuote className="h-3.5 w-3.5" /> Wording to close</h4>
              {review.wording.length === 0 ? (
                <p className="text-xs text-slate-500">{review.aiAvailable ? "Wording reads well — nothing to change." : "AI wording is unavailable right now; the pricing & scope checks still apply."}</p>
              ) : (
                <ul className="space-y-2">
                  {review.wording.map((w, i) => (
                    <li key={i} className="rounded-md border border-slate-800 bg-slate-950/40 p-2 text-xs leading-snug">
                      <p className="text-[11px] text-slate-500">{w.field === "scope" ? "Overall scope" : w.target ? `Replaces: ${w.target}` : "Line item"}</p>
                      <p className="mt-0.5 text-slate-200">{w.suggestion}</p>
                      {w.why && <p className="mt-0.5 text-[11px] text-slate-500">Why: {w.why}</p>}
                      <div className="mt-1.5">
                        {appliedWording.has(i) ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Applied — edit it anytime</span>
                        ) : canApply(w) ? (
                          <button onClick={() => applyWording(w, i)} title="Drop this wording into the quote — you can still edit it after" className="inline-flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[11px] font-medium text-cyan-200 transition hover:bg-cyan-500/20"><Wand2 className="h-3.5 w-3.5" /> Apply</button>
                        ) : w.field === "description" ? (
                          <span className="text-[11px] text-slate-600">That line was removed — nothing to apply to.</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {review.closeTips.length > 0 && (
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400 font-display"><Lightbulb className="h-3.5 w-3.5" /> To win it</h4>
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-300">{review.closeTips.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}

          <p className="mt-3 text-[11px] text-slate-500">Suggestions only — Hazel reads the quote and never changes it. You stay in control.</p>
        </div>
      )}

      {/* Sent status — the tracked client link + open tracking. */}
      {q.status !== "draft" && q.publicToken && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-emerald-300"><Send className="h-3.5 w-3.5" /> {q.sentAt ? `Sent ${new Date(q.sentAt).toLocaleDateString()}` : "Sent"}</span>
          <span className="inline-flex items-center gap-1.5 text-slate-400"><Eye className="h-3.5 w-3.5" /> {q.viewCount > 0 ? `Viewed ${q.viewCount}×${q.viewedAt ? ` · last ${new Date(q.viewedAt).toLocaleDateString()}` : ""}` : "Not viewed yet"}</span>
          <div className="ml-auto flex items-center gap-2">
            <input readOnly value={publicLink} onFocus={(e) => e.currentTarget.select()} className="w-56 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-data text-xs text-slate-300" />
            <button onClick={() => { navigator.clipboard?.writeText(publicLink); setNote("Link copied"); }} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800">Copy link</button>
            <a href={publicLink} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-cyan-300 transition hover:bg-slate-800">Open</a>
          </div>
        </div>
      )}

      {tab === "preview" ? (
        <div className="quote-print-root overflow-hidden rounded-xl border border-slate-800">
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
              <label className="block">
                <span className={lbl}>Construction options</span>
                <div className="mt-1 flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
                  {([["false", "Single price"], ["true", "Good / Better / Best"]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => upd({ tiered: v === "true" })} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${q.tiered === (v === "true") ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}>{l}</button>
                  ))}
                </div>
              </label>
              <label className="block">
                <span className={lbl}>PC items &amp; tiles options</span>
                <div className="mt-1 flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
                  {([["false", "Flat allowance"], ["true", "Standard / Premium / Luxury"]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => upd({ pcTiered: v === "true" })} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${q.pcTiered === (v === "true") ? "bg-amber-500 text-slate-950" : "text-slate-400"}`}>{l}</button>
                  ))}
                </div>
              </label>
            </div>
            <label className="mt-3 block"><span className={lbl}>Scope description</span><textarea value={q.scopeDescription} onChange={(e) => upd({ scopeDescription: e.target.value })} rows={3} placeholder="Overall scope of works…" className={"mt-1 " + inp} /></label>
          </div>

          {/* Configurator intro — the framing message atop the client's live
              configurator (the interactive tier + PC picker with running total) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-200">Configurator intro</h3>
              <span className="text-[11px] text-slate-500">framing message shown above the client&apos;s live tier + fixtures picker</span>
            </div>
            <textarea value={q.configuratorIntro} onChange={(e) => upd({ configuratorIntro: e.target.value })} rows={5} placeholder={DEFAULT_CONFIGURATOR_INTRO} className={inp} />
            <p className="mt-1 text-[11px] text-slate-500">First line shows as a heading. Leave blank to hide. This frames the quote as something the client tailors — they pick their construction level and fixtures right on the quote, and their combined total appears once they&apos;ve chosen both.</p>
            <div className="mt-1.5">
              <button onClick={saveConfiguratorIntroDefault} disabled={savingIntroDefault} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 disabled:opacity-50">{savingIntroDefault ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save as my default</button>
            </div>

            <label className="mt-4 block"><span className={lbl}>Comfort question (under the total)</span></label>
            <textarea value={q.comfortQuestion} onChange={(e) => upd({ comfortQuestion: e.target.value })} rows={3} placeholder={DEFAULT_COMFORT_QUESTION} className={"mt-1 " + inp} />
            <p className="mt-1 text-[11px] text-slate-500">Shown under the client&apos;s combined total — a gentle nudge that it&apos;s OK to adjust their selections to suit their budget. Leave blank to hide.</p>
            <div className="mt-1.5">
              <button onClick={saveComfortQuestionDefault} disabled={savingComfortDefault} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 disabled:opacity-50">{savingComfortDefault ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save as my default</button>
            </div>
          </div>

          {/* Quote templates — load a reusable set of line items, or save this one */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-cyan-400" />
                <h3 className="font-display text-sm font-semibold text-slate-200">Quote templates</h3>
                <span className="text-[11px] text-slate-500">load a pre-built set of lines, then adjust</span>
              </div>
              <button onClick={() => { setTplOpen((v) => !v); setTplName(""); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"><BookmarkPlus className="h-3.5 w-3.5" /> Save current as template</button>
            </div>

            {tplOpen && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input value={tplName} onChange={(e) => setTplName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveAsTemplate(); }} placeholder="Template name (e.g. Ground floor bathroom)" className={"max-w-xs " + inp} />
                <button onClick={saveAsTemplate} disabled={!tplName.trim() || !q.items.length} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"><Save className="h-4 w-4" /> Save template</button>
                <button onClick={() => setTplOpen(false)} className="rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-400 hover:bg-slate-800">Cancel</button>
                {!q.items.length && <span className="text-[11px] text-amber-300">Add some line items first.</span>}
              </div>
            )}

            {templates.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {templates.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/60 py-1 pl-2.5 pr-1 text-xs text-slate-200">
                    <button onClick={() => loadTemplate(t)} className="inline-flex items-center gap-1.5 hover:text-cyan-200" title="Load this template's line items"><LayoutTemplate className="h-3.5 w-3.5 text-cyan-400" /> {t.name} <span className="text-slate-500">· {t.data.items?.length || 0} lines</span></button>
                    <button onClick={() => removeTemplate(t)} className="rounded p-1 text-slate-500 hover:text-red-300" title="Delete template"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">No templates yet. Build a quote, then &ldquo;Save current as template&rdquo; to reuse it for the next job.</p>
            )}
          </div>

          {/* Line items */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-200">Line items</h3>
              <div className="flex flex-wrap items-center gap-2">
                {constructionGroups.length > 0 && (
                  <select title="Add a construction line from your price list — fills the rate, then set the quantity" onChange={(e) => { const p = priceList.find((x) => x.id === e.target.value); if (p) insertPriceItem(p); e.currentTarget.selectedIndex = 0; }} className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-2 py-1.5 text-xs text-cyan-200 focus:border-cyan-500/50">
                    <option value="">＋ From price list…</option>
                    {constructionGroups.map(([cat, list]) => (
                      <optgroup key={cat} label={cat}>
                        {list.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.unitPrice, brand.currency)}/{p.unit}</option>)}
                      </optgroup>
                    ))}
                  </select>
                )}
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
                          <textarea value={it.description} onChange={(e) => updItem(i, { description: e.target.value })} placeholder="Description — one scope point per line (bullets carry onto the client quote)" rows={Math.min(10, Math.max(2, (it.description || "").split(/\r?\n/).length))} className={"resize-y " + inp} />
                          <input value={it.detail} onChange={(e) => updItem(i, { detail: e.target.value })} placeholder="Detail (optional sub-line)" className={"mt-1 text-xs " + inp} />
                          {/* Trade tag + in-house/sub flag — the client sees one consolidated line per trade. */}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <input list="quote-trades" value={it.trade ?? ""} onChange={(e) => setItemTrade(i, e.target.value)} placeholder="Trade (e.g. Plumbing)" className={"text-xs " + inp} style={{ maxWidth: 170 }} />
                            {(it.trade || "").trim() && (
                              <div className="flex items-center gap-0.5 rounded-lg border border-slate-700 p-0.5">
                                {(["in_house", "sub_trade"] as TradeType[]).map((tt) => (
                                  <button key={tt} type="button" onClick={() => updItem(i, { tradeType: tt })} className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${(it.tradeType ?? "sub_trade") === tt ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}>{TRADE_TYPE_LABEL[tt]}</button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Build vs Tile & Fixture Allowance (allowance is tier-decoupled). */}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <div className="flex items-center gap-0.5 rounded-lg border border-slate-700 p-0.5" style={{ width: "fit-content" }}>
                              <button type="button" onClick={() => updItem(i, { allowance: false })} className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${!it.allowance ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`} title="Part of the build scope">Build</button>
                              <button type="button" onClick={() => updItem(i, { allowance: true, tier: null })} className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${it.allowance ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`} title="Fixture/tile allowance — shown in its own section, decoupled from the build tier">Allowance</button>
                            </div>
                            {/* CONSTRUCTION tier: Shared base / that tier's finishes (build lines only). */}
                            {q.tiered && !it.allowance && (
                              <div className="flex items-center gap-0.5 rounded-lg border border-slate-700 p-0.5" style={{ width: "fit-content" }}>
                                <button type="button" onClick={() => updItem(i, { tier: null })} className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${!it.tier ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`} title="Shared across all options">Shared</button>
                                {TIERS.map((t) => (
                                  <button key={t.key} type="button" onClick={() => updItem(i, { tier: t.key })} title={tierName(q.tierNames, t.key)} className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${it.tier === t.key ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}>{tierName(q.tierNames, t.key)}</button>
                                ))}
                              </div>
                            )}
                            {/* PC tier: which fixtures/tiles level this allowance line belongs to. */}
                            {q.pcTiered && it.allowance && (
                              <div className="flex items-center gap-0.5 rounded-lg border border-slate-700 p-0.5" style={{ width: "fit-content" }}>
                                <button type="button" onClick={() => updItem(i, { pcTier: null })} className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${!it.pcTier ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`} title="Shared across all PC levels">Shared</button>
                                {TIERS.map((t) => (
                                  <button key={t.key} type="button" onClick={() => updItem(i, { pcTier: t.key })} title={pcTierName(q.pcTierNames, t.key)} className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${it.pcTier === t.key ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}>{pcTierName(q.pcTierNames, t.key)}</button>
                                ))}
                              </div>
                            )}
                          </div>
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
            <datalist id="quote-trades">{tradeOptions.map((t) => <option key={t} value={t} />)}</datalist>
            <button onClick={() => addItem()} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"><Plus className="h-4 w-4" /> Add line</button>
            <p className="mt-2 text-[11px] text-slate-500">Tag each line with a trade — the client sees one consolidated line per trade (e.g. all carpentry items become a single &ldquo;Carpentry&rdquo; line). In-house / sub-trade is saved for back-costing later.</p>

            {/* Totals */}
            {q.tiered ? (
              <div className="mt-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {TIERS.map((t) => (
                    <div key={t.key} className={`rounded-xl border p-3 ${t.key === "better" ? "border-cyan-500/40 bg-cyan-500/5" : "border-slate-800 bg-slate-950/40"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <input
                          value={q.tierNames[t.key]}
                          onChange={(e) => upd({ tierNames: { ...q.tierNames, [t.key]: e.target.value } })}
                          placeholder={tierName(null, t.key)}
                          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-display text-sm font-semibold text-slate-100 focus:border-cyan-500/50"
                        />
                        {t.key === "better" && <span className="shrink-0 rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300">Most pick this</span>}
                      </div>
                      <div className="mt-1 font-data text-lg font-semibold text-cyan-300">{money(tiers[t.key].subtotal, brand.currency)}</div>
                      <div className="text-[11px] text-slate-500">{brand.gstRegistered ? "ex GST" : ""} · base + {tierName(q.tierNames, t.key).toLowerCase()} finishes</div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Name each option above (defaults: Essential / Premium / Luxury). Each option = the shared base build + that tier&apos;s finishes. Mark fixtures/tiles/coverage lines with a tier; leave the base build as &ldquo;Shared&rdquo;.</p>
              </div>
            ) : (
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <Row label={`Subtotal${brand.gstRegistered ? " (ex GST)" : ""}`} value={money(totals.subtotal, brand.currency)} />
                  {brand.gstRegistered && <Row label={`GST (10%)${q.gstInclusive ? " incl." : ""}`} value={money(totals.gstAmount, brand.currency)} />}
                  <div className="flex items-center justify-between border-t border-slate-700 pt-1.5 text-base font-semibold text-slate-100"><span>Total payable{brand.gstRegistered ? " (inc GST)" : ""}</span><span className="font-data text-cyan-300">{money(totals.total, brand.currency)}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Tile & Fixture Allowance — PC items / tiles, decoupled from build tier */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-200">Tile &amp; Fixture Allowance</h3>
              <span className="text-[11px] text-slate-500">PC items &amp; tiles — a separate layer, not locked to the build tier</span>
            </div>

            <label className="block">
              <span className={lbl}>Framing text (shown atop the allowance on the client quote)</span>
              <textarea value={q.allowanceNote} onChange={(e) => upd({ allowanceNote: e.target.value })} rows={3} placeholder={DEFAULT_ALLOWANCE_NOTE} className={"mt-1 " + inp} />
            </label>
            <div className="mt-1.5">
              <button onClick={saveAllowanceDefault} disabled={savingAllowanceDefault} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 disabled:opacity-50">{savingAllowanceDefault ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save as my default</button>
            </div>

            {pcGroups.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-slate-500">Pick a category, then tick the PC items &amp; tiles for this bathroom — each adds a priced allowance line (the client sees the sell price); untick to remove. Sorted cheapest-first so entry-level options sit up top and premium ones at the bottom.</p>
                {/* Category-driven: choose a category and see only those items. */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => setPcCat("")} className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${pcCat === "" ? "border-amber-500/50 bg-amber-500/10 text-amber-200" : "border-slate-700 text-slate-400 hover:bg-slate-800"}`}>All</button>
                  {pcGroupsSorted.map(([cat, list]) => (
                    <button key={cat} type="button" onClick={() => setPcCat(cat)} className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${pcCat === cat ? "border-amber-500/50 bg-amber-500/10 text-amber-200" : "border-slate-700 text-slate-400 hover:bg-slate-800"}`}>{cat} <span className="text-slate-500">{list.length}</span></button>
                  ))}
                  <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-slate-700 p-0.5">
                    {([["price-asc", "$ ↑"], ["price-desc", "$ ↓"], ["name", "A–Z"]] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setPcSort(v)} title={v === "price-asc" ? "Cheapest first" : v === "price-desc" ? "Dearest first" : "By name"} className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${pcSort === v ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3 pt-1">
                  {pcGroupsSorted.filter(([cat]) => pcCat === "" || cat === pcCat).map(([cat, list]) => (
                    <div key={cat}>
                      <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-display">{cat}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((p) => {
                          const on = !!allowanceLineFor(p.id);
                          return (
                            <button key={p.id} type="button" onClick={() => togglePriceItemAllowance(p)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${on ? "border-amber-500/50 bg-amber-500/10 text-amber-200" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}>
                              {on ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {p.name} <span className="text-slate-500">· {money(p.unitPrice, brand.currency)}/{p.unit}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Add PC items &amp; tiles in Branding &amp; Quotes &rarr; Price list (the &ldquo;PC items &amp; tiles&rdquo; section) to tick them on here — or add a custom one-off below.</p>
            )}

            {/* Add a CUSTOM PC item — not in the catalogue (another supplier, a
                one-off, a special order). Client sees the sell price only. */}
            <div className="mt-3 border-t border-slate-800 pt-3">
              {!customPcOpen ? (
                <button type="button" onClick={() => setCustomPcOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"><Plus className="h-4 w-4" /> Add custom PC item</button>
              ) : (
                <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-200">Custom PC item — not in the catalogue</span>
                    <button type="button" onClick={() => { setCustomPc(emptyCustomPc); setCustomPcOpen(false); setError(""); }} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
                  </div>
                  <input value={customPc.name} onChange={(e) => setCustomPc({ ...customPc, name: e.target.value })} placeholder="Item name / description (e.g. Feature stone basin)" className={inp} />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <input list="pc-cats-builder" value={customPc.category} onChange={(e) => setCustomPc({ ...customPc, category: e.target.value })} placeholder="Category (e.g. Basins)" className={inp} />
                    <label className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/5 px-2"><span className="text-[10px] uppercase tracking-wide text-amber-300/80">Sell</span><input type="number" value={customPc.sell || ""} onChange={(e) => setCustomPc({ ...customPc, sell: Number(e.target.value) || 0 })} placeholder="0" className="w-full bg-transparent py-2 text-right font-data text-sm text-amber-100 focus:outline-none" /></label>
                    <label className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2"><span className="text-[10px] uppercase tracking-wide text-slate-500">Cost</span><input type="number" value={customPc.cost} onChange={(e) => setCustomPc({ ...customPc, cost: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="—" className="w-full bg-transparent py-2 text-right font-data text-sm text-slate-200 focus:outline-none" /></label>
                  </div>
                  {q.pcTiered && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">PC level:</span>
                      <div className="flex items-center gap-0.5 rounded-lg border border-slate-700 p-0.5">
                        <button type="button" onClick={() => setCustomPc({ ...customPc, tier: null })} className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${!customPc.tier ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}>Shared</button>
                        {TIERS.map((t) => (
                          <button key={t.key} type="button" onClick={() => setCustomPc({ ...customPc, tier: t.key })} className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${customPc.tier === t.key ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}>{pcTierName(q.pcTierNames, t.key)}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-400"><input type="checkbox" checked={customPc.save} onChange={(e) => setCustomPc({ ...customPc, save: e.target.checked })} className="accent-amber-500" /> Also save to my PC price list (reuse later)</label>
                    <button type="button" onClick={addCustomPcItem} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-amber-400"><Plus className="h-4 w-4" /> Add to quote</button>
                  </div>
                  <p className="text-[10px] text-slate-500">The client sees only the sell price. Cost (optional) is internal, for your margin.</p>
                </div>
              )}
              <datalist id="pc-cats-builder">{pcGroups.map(([c]) => <option key={c} value={c} />)}</datalist>
            </div>

            {allowanceItems.length > 0 && (
              <div className="mt-3 border-t border-slate-800 pt-3">
                {q.pcTiered && (
                  <>
                    <p className="mb-2 text-[11px] text-slate-500">Tag each PC item with a level (Shared / {pcTierName(q.pcTierNames, "good")} / {pcTierName(q.pcTierNames, "better")} / {pcTierName(q.pcTierNames, "best")}) — exactly like the construction options. The client picks one level (separate from the construction option).</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {TIERS.map((t) => (
                        <div key={t.key} className={`rounded-xl border p-3 ${t.key === "better" ? "border-amber-500/40 bg-amber-500/5" : "border-slate-800 bg-slate-950/40"}`}>
                          <input value={q.pcTierNames[t.key]} onChange={(e) => upd({ pcTierNames: { ...q.pcTierNames, [t.key]: e.target.value } })} placeholder={pcTierName(null, t.key)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-display text-sm font-semibold text-slate-100 focus:border-amber-500/50" />
                          <div className="mt-1 font-data text-lg font-semibold text-amber-300">{money(pcTiers[t.key].subtotal, brand.currency)}</div>
                          <div className="text-[11px] text-slate-500">{brand.gstRegistered ? "ex GST" : ""} fixture allowance</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Per-PC-item rows with the SAME tier selector as construction
                    lines — a direct replica, just with the PC level labels. */}
                <div className="mt-3 space-y-1.5">
                  {allowanceItems.map((it) => (
                    <div key={it.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-200" title={it.description}>{(it.description || "").split(/\r?\n/)[0] || "Item"}</span>
                      <span className="font-data text-xs text-slate-400">{money((it.qty || 0) * (it.unitPrice || 0), brand.currency)}</span>
                      {q.pcTiered && (
                        <div className="flex items-center gap-0.5 rounded-lg border border-slate-700 p-0.5" style={{ width: "fit-content" }}>
                          <button type="button" onClick={() => updItemById(it.id, { pcTier: null })} className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${!it.pcTier ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`} title="Shared across all PC levels">Shared</button>
                          {TIERS.map((t) => (
                            <button key={t.key} type="button" onClick={() => updItemById(it.id, { pcTier: t.key })} title={pcTierName(q.pcTierNames, t.key)} className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${it.pcTier === t.key ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}>{pcTierName(q.pcTierNames, t.key)}</button>
                          ))}
                        </div>
                      )}
                      <button onClick={() => removeItemById(it.id)} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:text-red-300" title="Remove this PC item"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-400">{allowanceItems.length} PC item{allowanceItems.length === 1 ? "" : "s"}{q.pcTiered ? "" : " — flat allowance"}</span>
                  <span className="font-data font-semibold text-amber-300">{money(allowanceSubtotal, brand.currency)} <span className="text-[11px] font-normal text-slate-500">{brand.gstRegistered ? "ex GST" : ""} allowance</span></span>
                </div>
              </div>
            )}
          </div>

          {/* Renovation journey roadmap */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-200">Renovation journey</h3>
              <span className="text-[11px] text-slate-500">the process roadmap shown on the client quote</span>
            </div>
            <div className="space-y-2">
              {q.journey.map((s, i) => (
                <div key={i} className="grid grid-cols-12 items-start gap-2">
                  <span className="col-span-1 pt-2 text-center font-data text-xs text-slate-500">{i + 1}</span>
                  <input value={s.label} onChange={(e) => upd({ journey: q.journey.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Stage" className={"col-span-4 " + inp} />
                  <input value={s.note ?? ""} onChange={(e) => upd({ journey: q.journey.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })} placeholder="Short note (optional)" className={"col-span-6 " + inp} />
                  <button onClick={() => upd({ journey: q.journey.filter((_, j) => j !== i) })} className="col-span-1 rounded-md border border-slate-700 p-2 text-slate-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => upd({ journey: [...q.journey, { label: "", note: "" }] })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /> Add stage</button>
              <button onClick={() => upd({ journey: DEFAULT_JOURNEY.map((s) => ({ ...s })) })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800">Reset to default roadmap</button>
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
