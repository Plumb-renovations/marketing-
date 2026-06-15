import type { SupabaseClient } from "@supabase/supabase-js";
import type { Post } from "@/lib/domain/types";
import { ORG_ID } from "@/lib/domain/seed";

function mapPost(row: any): Post {
  return {
    id: row.id,
    photo: row.photo ?? null,
    caption: row.caption ?? "",
    hashtags: row.hashtags ?? "",
    cta: row.cta ?? "",
    channels: row.channels ?? [],
    scheduledAt: row.scheduled_at ?? "",
    status: row.status ?? "draft",
    reach: row.reach ?? null,
    engagement: row.engagement ?? null,
    why: row.why ?? "",
  };
}

function postRow(post: Post) {
  return {
    id: post.id,
    org_id: ORG_ID,
    photo: post.photo,
    caption: post.caption ?? "",
    hashtags: post.hashtags ?? "",
    cta: post.cta ?? "",
    channels: post.channels ?? [],
    scheduled_at: post.scheduledAt ?? "",
    status: post.status,
    reach: post.reach,
    engagement: post.engagement,
    why: post.why ?? "",
  };
}

export async function fetchPosts(supabase: SupabaseClient): Promise<Post[]> {
  const { data, error } = await supabase.from("posts").select("*");
  if (error) throw error;
  return (data || []).map(mapPost);
}

export async function upsertPost(supabase: SupabaseClient, post: Post) {
  const { error } = await supabase.from("posts").upsert(postRow(post));
  if (error) throw error;
}

export async function deletePost(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw error;
}
