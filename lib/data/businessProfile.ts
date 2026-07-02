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

// Targeted save for the ad brand-voice: the tone + example ads only, as a
// column-scoped upsert so it never disturbs the rest of the profile row. Owned
// by the ad interview panel (separate from the main profile form). Tolerates
// the ad_examples column (0045) being absent.
export async function saveAdVoice(supabase: SupabaseClient, tone: string, examples: string[]): Promise<void> {
  const orgId = await getOrgId(supabase);
  const clean = (examples || []).map((s) => (s || "").trim()).filter(Boolean).slice(0, 3);
  const row: Record<string, any> = { org_id: orgId, tone: (tone || "").trim(), ad_examples: clean.length ? clean : null };
  let { error } = await supabase.from("business_profiles").upsert(row, { onConflict: "org_id" });
  if (error && (error.code === "42703" || /column .* does not exist|could not find/i.test(error.message || ""))) {
    const { ad_examples, ...legacy } = row;
    ({ error } = await supabase.from("business_profiles").upsert(legacy, { onConflict: "org_id" }));
  }
  if (error) throw error;
}
