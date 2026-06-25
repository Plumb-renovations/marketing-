import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ad } from "@/lib/domain/types";
import { getOrgId } from "@/lib/data/org";

function mapAd(row: any): Ad {
  return {
    id: row.id,
    type: row.kind,
    goal: row.goal ?? "",
    photo: row.photo ?? null,
    status: row.status ?? "draft",
    createdAt: row.created_at,
    content: row.content ?? {},
    mediaType: row.media_type ?? "image",
    videoUrl: row.video_url ?? null,
  };
}

function adRow(ad: Ad, orgId: string) {
  return {
    id: ad.id,
    org_id: orgId,
    kind: ad.type,
    goal: ad.goal,
    photo: ad.photo,
    status: ad.status,
    content: ad.content ?? {},
    media_type: ad.mediaType ?? "image",
    video_url: ad.videoUrl ?? null,
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
  const orgId = await getOrgId(supabase);
  const { error } = await supabase.from("ads").upsert(adRow(ad, orgId));
  if (error) throw error;
}

export async function deleteAd(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("ads").delete().eq("id", id);
  if (error) throw error;
}
