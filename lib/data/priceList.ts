import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";

// The per-org PRICE LIST (rate card). Standard rates for common items — the
// smart line-item picker auto-fills from here, and a future AI review layer
// reads it to flag lines that are too cheap / too dear vs the business's rates.
//
// Multi-tenant: reads use select * + RLS (is_member(org_id)) with NO org_id
// filter — the documented footgun. Writes set org_id via getOrgId. Reads are
// resilient: if 0031 hasn't been applied yet the table is missing, so we log
// and return an empty list rather than failing the page.

// A price-list item is either a CONSTRUCTION rate (trades/labour) or a PC ITEM
// (fixture/tile). The quote builder keeps the two palettes separate.
export type PriceKind = "construction" | "pc";

export interface PriceItem {
  id: string;
  category: string;
  name: string;
  unit: string;
  unitPrice: number; // the SELL price — the only price the client ever sees
  notes: string;
  sortOrder: number;
  trade?: string | null; // suggested trade when this rate is added to a quote
  kind: PriceKind; // 'construction' (default) or 'pc' (fixtures & tiles)
  // PC cost→markup→sell. INTERNAL ONLY — never shown to the client.
  costPrice: number | null; // what the business pays the supplier
  markupPct: number | null; // per-item markup override (null → org default)
  // Supplier-import provenance (0042). INTERNAL except unitPrice (the sell).
  supplier: string | null; // e.g. 'naga'
  code: string | null; // supplier SKU — matched on re-import
  rrpInc: number | null; // supplier RRP, GST-inclusive (the sell basis)
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
}

function mapItem(row: any): PriceItem {
  return {
    id: row.id,
    category: row.category ?? "",
    name: row.name ?? "",
    unit: row.unit ?? "ea",
    unitPrice: Number(row.unit_price) || 0,
    notes: row.notes ?? "",
    sortOrder: row.sort_order ?? 0,
    trade: row.trade ?? null,
    // Tolerate 0038 not being applied yet — rows without `kind` are construction.
    kind: row.kind === "pc" ? "pc" : "construction",
    // Tolerate 0041 not being applied yet — rows without cost/markup are null.
    costPrice: row.cost_price != null ? Number(row.cost_price) : null,
    markupPct: row.markup_pct != null ? Number(row.markup_pct) : null,
    // Tolerate 0042 not being applied yet — supplier fields absent → null.
    supplier: row.supplier ?? null,
    code: row.code ?? null,
    rrpInc: row.rrp_inc != null ? Number(row.rrp_inc) : null,
    widthMm: row.width_mm != null ? Number(row.width_mm) : null,
    depthMm: row.depth_mm != null ? Number(row.depth_mm) : null,
    heightMm: row.height_mm != null ? Number(row.height_mm) : null,
  };
}

// Build the DB row for a price item (shared by single + batch upserts).
function priceRow(orgId: string, item: PriceItem, sortOrder: number): Record<string, any> {
  return {
    id: item.id,
    org_id: orgId,
    category: (item.category || "").trim(),
    name: (item.name || "").trim(),
    unit: (item.unit || "").trim() || "ea",
    unit_price: item.unitPrice,
    notes: (item.notes || "").trim() || null,
    sort_order: sortOrder,
    trade: item.trade?.trim() || null,
    kind: item.kind === "pc" ? "pc" : "construction",
    cost_price: item.costPrice != null ? item.costPrice : null,
    markup_pct: item.markupPct != null ? item.markupPct : null,
    supplier: item.supplier?.trim() || null,
    code: item.code?.trim() || null,
    rrp_inc: item.rrpInc != null ? item.rrpInc : null,
    width_mm: item.widthMm != null ? item.widthMm : null,
    depth_mm: item.depthMm != null ? item.depthMm : null,
    height_mm: item.heightMm != null ? item.heightMm : null,
  };
}

// Strip the not-yet-migrated columns from a row, newest migration first, so an
// upsert still succeeds before a migration is applied. Returns the same row
// shape minus the dropped keys.
function stripNewestColumns(row: Record<string, any>, level: number): Record<string, any> {
  const r = { ...row };
  if (level >= 1) { delete r.supplier; delete r.code; delete r.rrp_inc; delete r.width_mm; delete r.depth_mm; delete r.height_mm; } // 0042
  if (level >= 2) { delete r.cost_price; delete r.markup_pct; } // 0041
  if (level >= 3) { delete r.kind; } // 0038
  if (level >= 4) { delete r.trade; } // 0032
  return r;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Suggested SELL price from a cost + markup. Used by the price-list editor to
// auto-fill the sell when cost or markup change; the user can still override the
// sell directly. Pure — safe to reuse for the future supplier-spreadsheet import.
export function suggestedSell(cost: number | null, markupPct: number | null, defaultMarkupPct: number): number {
  const c = Number(cost) || 0;
  const m = markupPct != null ? Number(markupPct) : Number(defaultMarkupPct) || 0;
  return round2(c * (1 + m / 100));
}

const isUndefinedColumn = (e: any) =>
  e?.code === "42703" || /column .* does not exist|could not find the .* column/i.test(e?.message || "");

export async function fetchPriceList(supabase: SupabaseClient): Promise<PriceItem[]> {
  const { data, error } = await supabase.from("price_list_items").select("*").order("sort_order", { ascending: true });
  if (error) {
    console.error("[priceList] fetch:", error.message);
    return [];
  }
  return (data || []).map(mapItem);
}

// Upsert a batch of rows, retrying with newer columns stripped (newest migration
// first) if the DB doesn't have them yet. Shared by single + bulk-import saves.
async function upsertRows(supabase: SupabaseClient, rows: Record<string, any>[]): Promise<void> {
  let { error } = await supabase.from("price_list_items").upsert(rows);
  for (let level = 1; error && isUndefinedColumn(error) && level <= 4; level++) {
    ({ error } = await supabase.from("price_list_items").upsert(rows.map((r) => stripNewestColumns(r, level))));
  }
  if (error) throw error;
}

export async function upsertPriceItem(supabase: SupabaseClient, item: PriceItem): Promise<void> {
  const orgId = await getOrgId(supabase);
  await upsertRows(supabase, [priceRow(orgId, item, item.sortOrder)]);
}

// Bulk import: upsert many items in ONE round-trip. Items keep their id, so a
// re-import (callers reuse the existing id when a supplier `code` matches) UPDATES
// rather than duplicating. Sort order continues after the current max.
export async function importPriceItems(supabase: SupabaseClient, items: PriceItem[], startSort = 0): Promise<void> {
  if (!items.length) return;
  const orgId = await getOrgId(supabase);
  const rows = items.map((it, i) => priceRow(orgId, it, it.sortOrder ?? startSort + i));
  await upsertRows(supabase, rows);
}

// Recompute the internal COST (and nothing the client sees) for every item of a
// supplier from its stored RRP and a (changed) trade discount — so adjusting the
// discount updates costs/margins WITHOUT re-importing. Returns the count touched.
export async function recomputeSupplierCosts(supabase: SupabaseClient, supplier: string, tradeDiscountPct: number): Promise<number> {
  const all = await fetchPriceList(supabase);
  const disc = Math.max(0, Number(tradeDiscountPct) || 0);
  const mine = all
    .filter((p) => (p.supplier || "") === supplier && p.rrpInc != null)
    .map((p) => ({ ...p, costPrice: round2((p.rrpInc as number) / 1.1 * (1 - disc / 100)) }));
  if (!mine.length) return 0;
  await importPriceItems(supabase, mine);
  return mine.length;
}

export async function deletePriceItem(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("price_list_items").delete().eq("id", id);
  if (error) throw error;
}
