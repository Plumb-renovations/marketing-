import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";
import { rowToBrand, brandToRow, DEFAULT_BRAND, type BrandSettings } from "@/lib/business/brand";

export async function fetchBrandSettings(supabase: SupabaseClient): Promise<BrandSettings> {
  const orgId = await getOrgId(supabase);
  const { data, error } = await supabase.from("business_profiles").select("*").eq("org_id", orgId).maybeSingle();
  if (error) throw error;
  return data ? rowToBrand(data) : { ...DEFAULT_BRAND };
}

export async function saveBrandSettings(supabase: SupabaseClient, brand: BrandSettings): Promise<void> {
  const orgId = await getOrgId(supabase);
  // Column-scoped upsert: leaves the AI/targeting profile columns untouched.
  const { error } = await supabase.from("business_profiles").upsert(brandToRow(orgId, brand), { onConflict: "org_id" });
  if (error) throw error;
}
