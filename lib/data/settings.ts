import type { SupabaseClient } from "@supabase/supabase-js";
import type { Settings, Metrics } from "@/lib/domain/types";
import { getOrgId } from "@/lib/data/org";
import { DEFAULT_SETTINGS, DEFAULT_METRICS } from "@/lib/domain/seed";

export async function fetchSettings(
  supabase: SupabaseClient,
): Promise<{ settings: Settings; metrics: Metrics }> {
  const orgId = await getOrgId(supabase);
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { settings: DEFAULT_SETTINGS, metrics: DEFAULT_METRICS };
  return {
    settings: {
      jobsTarget: data.jobs_target ?? DEFAULT_SETTINGS.jobsTarget,
      revenueTarget: Number(data.revenue_target) || 0,
      leadTimeWeeks: data.lead_time_weeks ?? DEFAULT_SETTINGS.leadTimeWeeks,
      costPerLead: Number(data.cost_per_lead) || 0,
      leadToWonRate: Number(data.lead_to_won_rate) || 0,
    },
    metrics: {
      spend: { ...DEFAULT_METRICS.spend, ...((data.metrics && data.metrics.spend) || {}) },
      organic: { ...DEFAULT_METRICS.organic, ...((data.metrics && data.metrics.organic) || {}) },
    },
  };
}

export async function saveSettings(
  supabase: SupabaseClient,
  settings: Settings,
  metrics: Metrics,
) {
  const orgId = await getOrgId(supabase);
  const { error } = await supabase.from("app_settings").upsert({
    org_id: orgId,
    jobs_target: settings.jobsTarget,
    revenue_target: settings.revenueTarget,
    lead_time_weeks: settings.leadTimeWeeks,
    cost_per_lead: settings.costPerLead,
    lead_to_won_rate: settings.leadToWonRate,
    metrics,
  });
  if (error) throw error;
}
