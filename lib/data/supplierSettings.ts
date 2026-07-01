import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";

// Per-org, per-supplier settings — currently the TRADE DISCOUNT that drives a
// derive-cost supplier's internal cost. Reads/writes tolerate the table being
// absent until migration 0042 is applied (returns {} / no-ops).
const missing = (e: any) =>
  e && (e.code === "42P01" || e.code === "42703" || /relation .* does not exist|does not exist|could not find/i.test(e.message || ""));

export async function fetchSupplierDiscounts(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("supplier_settings").select("supplier, trade_discount_pct");
  if (error) {
    if (!missing(error)) console.error("[supplierSettings] fetch:", error.message);
    return {};
  }
  const out: Record<string, number> = {};
  for (const r of data || []) out[String((r as any).supplier)] = Number((r as any).trade_discount_pct) || 0;
  return out;
}

export async function saveSupplierDiscount(supabase: SupabaseClient, supplier: string, pct: number): Promise<void> {
  const orgId = await getOrgId(supabase);
  const row = { org_id: orgId, supplier, trade_discount_pct: Math.max(0, Number(pct) || 0) };
  const { error } = await supabase.from("supplier_settings").upsert(row, { onConflict: "org_id,supplier" });
  if (error && !missing(error)) throw error;
}
