import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";

export interface SavedItem {
  id: string;
  description: string;
  detail: string;
  defaultQty: number;
  unit: string;
  unitPrice: number;
  sortOrder: number;
}

function mapItem(row: any): SavedItem {
  return {
    id: row.id,
    description: row.description ?? "",
    detail: row.detail ?? "",
    defaultQty: Number(row.default_qty) || 1,
    unit: row.unit ?? "ea",
    unitPrice: Number(row.unit_price) || 0,
    sortOrder: row.sort_order ?? 0,
  };
}

export async function fetchSavedItems(supabase: SupabaseClient): Promise<SavedItem[]> {
  const { data, error } = await supabase.from("saved_line_items").select("*").order("sort_order", { ascending: true });
  // Resilient: if the 0011 migration hasn't created saved_line_items yet, treat
  // it as an empty library rather than failing the whole settings page.
  if (error) {
    console.error("[brand] fetchSavedItems:", error.message);
    return [];
  }
  return (data || []).map(mapItem);
}

export async function upsertSavedItem(supabase: SupabaseClient, item: SavedItem): Promise<void> {
  const orgId = await getOrgId(supabase);
  const { error } = await supabase.from("saved_line_items").upsert({
    id: item.id,
    org_id: orgId,
    description: item.description.trim(),
    detail: item.detail.trim() || null,
    default_qty: item.defaultQty,
    unit: item.unit.trim() || "ea",
    unit_price: item.unitPrice,
    sort_order: item.sortOrder,
  });
  if (error) throw error;
}

export async function deleteSavedItem(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("saved_line_items").delete().eq("id", id);
  if (error) throw error;
}
