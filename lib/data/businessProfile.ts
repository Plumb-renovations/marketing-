import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";
import { rowToProfile, profileToRow, DEFAULT_PROFILE, type BusinessProfile } from "@/lib/business/profile";

export async function fetchBusinessProfile(supabase: SupabaseClient): Promise<BusinessProfile> {
  const orgId = await getOrgId(supabase);
  const { data, error } = await supabase.from("business_profiles").select("*").eq("org_id", orgId).maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data) : { ...DEFAULT_PROFILE };
}

export async function saveBusinessProfile(
  supabase: SupabaseClient,
  profile: BusinessProfile,
): Promise<BusinessProfile> {
  const orgId = await getOrgId(supabase);
  // Org-scoped upsert keyed on the org_id PK: updates the row if it exists,
  // inserts it for a brand-new org. `.select()` reads the persisted row back so
  // the caller can confirm the write and refresh from it — and any RLS/column
  // error surfaces here instead of being swallowed.
  const { data, error } = await supabase
    .from("business_profiles")
    .upsert(profileToRow(orgId, profile), { onConflict: "org_id" })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data) : profile;
}
