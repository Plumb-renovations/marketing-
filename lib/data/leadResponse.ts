import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";
import { rowToSettings, settingsToRow, type LeadResponseSettings } from "@/lib/leads/responseSettings";

export async function fetchLeadResponseSettings(supabase: SupabaseClient): Promise<LeadResponseSettings> {
  const orgId = await getOrgId(supabase);
  const { data, error } = await supabase.from("lead_response_settings").select("*").eq("org_id", orgId).maybeSingle();
  if (error) throw error;
  return rowToSettings(data);
}

export async function saveLeadResponseSettings(supabase: SupabaseClient, s: LeadResponseSettings): Promise<void> {
  const orgId = await getOrgId(supabase);
  const { error } = await supabase
    .from("lead_response_settings")
    .upsert(settingsToRow(orgId, s), { onConflict: "org_id" });
  if (error) throw error;
}
