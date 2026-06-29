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

export interface PriceItem {
  id: string;
  category: string;
  name: string;
  unit: string;
  unitPrice: number;
  notes: string;
  sortOrder: number;
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
  };
}

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
  const { error } = await supabase.from("price_list_items").upsert({
    id: item.id,
    org_id: orgId,
    category: item.category.trim(),
    name: item.name.trim(),
    unit: item.unit.trim() || "ea",
    unit_price: item.unitPrice,
    notes: item.notes.trim() || null,
    sort_order: item.sortOrder,
  });
  if (error) throw error;
}

export async function deletePriceItem(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("price_list_items").delete().eq("id", id);
  if (error) throw error;
}
