import type { SupabaseClient } from "@supabase/supabase-js";
import type { Post } from "@/lib/domain/types";
import { getOrgId } from "@/lib/data/org";

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
    mediaType: row.media_type ?? "image",
    videoUrl: row.video_url ?? null,
    autoPublish: row.auto_publish ?? false,
    planCategory: row.plan_category ?? null,
  };
}

function postRow(post: Post, orgId: string) {
  return {
    id: post.id,
    org_id: orgId,
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
    media_type: post.mediaType ?? "image",
    video_url: post.videoUrl ?? null,
    auto_publish: post.autoPublish ?? false,
    plan_category: post.planCategory ?? null,
  };
}

export async function fetchPosts(supabase: SupabaseClient): Promise<Post[]> {
  const { data, error } = await supabase.from("posts").select("*");
  if (error) throw error;
  return (data || []).map(mapPost);
}

export async function upsertPost(supabase: SupabaseClient, post: Post) {
  const orgId = await getOrgId(supabase);
  const { error } = await supabase.from("posts").upsert(postRow(post, orgId));
  if (error) throw error;
}

export async function deletePost(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw error;
}
