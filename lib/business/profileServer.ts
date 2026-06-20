import { createAdminClient } from "@/lib/supabase/admin";
import { rowToProfile, DEFAULT_PROFILE, type BusinessProfile } from "./profile";

// Server-side resolver: the org's Business Profile (or generic defaults). Used
// by the AI generation + ad-publish routes so copy and targeting are per-org.
export async function getBusinessProfile(orgId: string): Promise<BusinessProfile> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("business_profiles").select("*").eq("org_id", orgId).maybeSingle();
    return data ? rowToProfile(data) : { ...DEFAULT_PROFILE };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}
