import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";
import {
  rowToCapacity,
  capacityToRow,
  DEFAULT_CAPACITY,
  type CapacitySettings,
} from "@/lib/business/capacity";

// Resilient read: when there's no row yet (or the migration hasn't been applied),
// return sensible defaults rather than throwing — same pattern as branding.
export async function fetchCapacity(supabase: SupabaseClient): Promise<CapacitySettings> {
  try {
    const orgId = await getOrgId(supabase);
    const { data, error } = await supabase
      .from("org_capacity")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_CAPACITY };
    return rowToCapacity(data);
  } catch {
    return { ...DEFAULT_CAPACITY };
  }
}

export async function saveCapacity(
  supabase: SupabaseClient,
  cap: CapacitySettings,
): Promise<void> {
  const orgId = await getOrgId(supabase);
  const { error } = await supabase
    .from("org_capacity")
    .upsert(capacityToRow(orgId, cap), { onConflict: "org_id" });
  if (error) throw error;
}
