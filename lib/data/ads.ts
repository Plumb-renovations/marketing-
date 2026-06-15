import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ad } from "@/lib/domain/types";
import { ORG_ID } from "@/lib/domain/seed";

function mapAd(row: any): Ad {
  return {
    id: row.id,
    type: row.kind,
    goal: row.goal ?? "",
    photo: row.photo ?? null,
    status: row.status ?? "draft",
    createdAt: row.created_at,
    content: row.content ?? {},
  };
}

function adRow(ad: Ad) {
  return {
    id: ad.id,
    org_id: ORG_ID,
    kind: ad.type,
    goal: ad.goal,
    photo: ad.photo,
    status: ad.status,
    content: ad.content ?? {},
  };
}

export async function fetchAds(supabase: SupabaseClient): Promise<Ad[]> {
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapAd);
}

export async function upsertAd(supabase: SupabaseClient, ad: Ad) {
  const { error } = await supabase.from("ads").upsert(adRow(ad));
  if (error) throw error;
}

export async function deleteAd(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("ads").delete().eq("id", id);
  if (error) throw error;
}
