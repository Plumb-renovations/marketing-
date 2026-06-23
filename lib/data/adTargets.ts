import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";
import type { TargetOverrides } from "@/lib/meta/verdict";

// Optional advanced overrides for Hazel's auto-tuned targets. Everything is
// nullable — null means "use Hazel's default, auto-tuned from your data".
// Resilient: returns {} if the table/migration isn't there yet.
export async function fetchAdTargets(supabase: SupabaseClient): Promise<TargetOverrides> {
  try {
    const orgId = await getOrgId(supabase);
    const { data, error } = await supabase.from("ad_targets").select("*").eq("org_id", orgId).maybeSingle();
    if (error || !data) return {};
    return {
      targetCpl: data.target_cpl != null ? Number(data.target_cpl) : null,
      concerningCpl: data.concerning_cpl != null ? Number(data.concerning_cpl) : null,
      targetCostPerWon: data.target_cost_per_won != null ? Number(data.target_cost_per_won) : null,
      budgetStepPct: data.budget_step_pct != null ? Number(data.budget_step_pct) : null,
    };
  } catch {
    return {};
  }
}

export async function saveAdTargets(supabase: SupabaseClient, o: TargetOverrides): Promise<void> {
  const orgId = await getOrgId(supabase);
  const { error } = await supabase.from("ad_targets").upsert(
    {
      org_id: orgId,
      target_cpl: o.targetCpl ?? null,
      concerning_cpl: o.concerningCpl ?? null,
      target_cost_per_won: o.targetCostPerWon ?? null,
      budget_step_pct: o.budgetStepPct ?? null,
    },
    { onConflict: "org_id" },
  );
  if (error) throw error;
}
