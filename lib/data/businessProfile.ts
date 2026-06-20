import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";
import { rowToProfile, profileToRow, DEFAULT_PROFILE, type BusinessProfile } from "@/lib/business/profile";

export async function fetchBusinessProfile(supabase: SupabaseClient): Promise<BusinessProfile> {
  const orgId = await getOrgId(supabase);
  const { data, error } = await supabase.from("business_profiles").select("*").eq("org_id", orgId).maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data) : { ...DEFAULT_PROFILE };
}

export async function saveBusinessProfile(supabase: SupabaseClient, profile: BusinessProfile): Promise<void> {
  const orgId = await getOrgId(supabase);
  const { error } = await supabase.from("business_profiles").upsert(profileToRow(orgId, profile), { onConflict: "org_id" });
  if (error) throw error;
}
