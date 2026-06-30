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
  };
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

export async function upsertPriceItem(supabase: SupabaseClient, item: PriceItem): Promise<void> {
  const orgId = await getOrgId(supabase);
  const row: Record<string, any> = {
    id: item.id,
    org_id: orgId,
    category: item.category.trim(),
    name: item.name.trim(),
    unit: item.unit.trim() || "ea",
    unit_price: item.unitPrice,
    notes: item.notes.trim() || null,
    sort_order: item.sortOrder,
    trade: item.trade?.trim() || null,
    kind: item.kind === "pc" ? "pc" : "construction",
    cost_price: item.costPrice != null ? item.costPrice : null,
    markup_pct: item.markupPct != null ? item.markupPct : null,
  };
  let { error } = await supabase.from("price_list_items").upsert(row);
  // Granular fallback (newest migration first): drop cost/markup (0041), then
  // `kind` (0038), then `trade` (0032), so a save still works before each
  // migration is applied.
  if (error && isUndefinedColumn(error)) {
    const { cost_price, markup_pct, ...noCost } = row;
    ({ error } = await supabase.from("price_list_items").upsert(noCost));
    if (error && isUndefinedColumn(error)) {
      const { kind, ...noKind } = noCost;
      ({ error } = await supabase.from("price_list_items").upsert(noKind));
      if (error && isUndefinedColumn(error)) {
        const { trade, ...legacy } = noKind;
        ({ error } = await supabase.from("price_list_items").upsert(legacy));
      }
    }
  }
  if (error) throw error;
}

export async function deletePriceItem(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("price_list_items").delete().eq("id", id);
  if (error) throw error;
}
