import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";

// Per-org competitor records (name + Facebook Page URL/@handle). Org-scoped via
// getOrgId + RLS, consistent with the rest of the data layer.
export interface Competitor {
  id: string;
  name: string;
  fbUrl: string;
  notes: string;
  sortOrder: number;
}

function mapRow(row: any): Competitor {
  return {
    id: row.id,
    name: row.name ?? "",
    fbUrl: row.fb_url ?? "",
    notes: row.notes ?? "",
    sortOrder: row.sort_order ?? 0,
  };
}

// Resilient: returns [] if the table/migration isn't there yet.
export async function listCompetitors(supabase: SupabaseClient): Promise<Competitor[]> {
  const { data, error } = await supabase
    .from("competitors")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[competitors] list:", error.message);
    return [];
  }
  return (data || []).map(mapRow);
}

export async function upsertCompetitor(supabase: SupabaseClient, c: Competitor): Promise<void> {
  const orgId = await getOrgId(supabase);
  const { error } = await supabase.from("competitors").upsert({
    id: c.id,
    org_id: orgId,
    name: c.name.trim(),
    fb_url: c.fbUrl.trim() || null,
    notes: c.notes.trim() || null,
    sort_order: c.sortOrder,
  });
  if (error) throw error;
}

export async function deleteCompetitor(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("competitors").delete().eq("id", id);
  if (error) throw error;
}
