import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawComment } from "@/lib/integrations/meta/comments";
import type { RawReview } from "@/lib/integrations/google/reviews";

// Persist + read engagement items (FB/IG comments, Google reviews). Upserts use
// ignoreDuplicates so re-syncing never clobbers an existing draft/approval.

export interface EngagementItem {
  id: string;
  channel: "facebook" | "instagram" | "google";
  kind: "comment" | "review";
  externalId: string;
  parentRef: string | null;
  permalink: string | null;
  author: string | null;
  text: string;
  rating: number | null;
  sentiment: string | null;
  status: string;
  draftReply: string | null;
  flagged: boolean;
  flagReason: string | null;
  itemAt: string | null;
}

function mapRow(r: any): EngagementItem {
  return {
    id: r.id, channel: r.channel, kind: r.kind, externalId: r.external_id,
    parentRef: r.parent_ref ?? null, permalink: r.permalink ?? null, author: r.author_name ?? null,
    text: r.text ?? "", rating: r.rating ?? null, sentiment: r.sentiment ?? null,
    status: r.status ?? "new", draftReply: r.draft_reply ?? null, flagged: !!r.flagged,
    flagReason: r.flag_reason ?? null, itemAt: r.item_at ?? null,
  };
}

export async function storeComments(admin: SupabaseClient, orgId: string, comments: RawComment[]): Promise<number> {
  if (!comments.length) return 0;
  const rows = comments.map((c) => ({
    org_id: orgId, channel: c.channel, kind: "comment", external_id: c.externalId,
    parent_ref: c.parentRef, permalink: c.permalink, author_name: c.author, text: c.text, item_at: c.itemAt,
  }));
  const { error } = await admin.from("engagement_items").upsert(rows, { onConflict: "org_id,channel,external_id", ignoreDuplicates: true });
  if (error) { console.error("[engagement] storeComments failed:", error.message); return 0; }
  return rows.length;
}

export async function storeReviews(admin: SupabaseClient, orgId: string, reviews: RawReview[]): Promise<number> {
  if (!reviews.length) return 0;
  const rows = reviews.map((r) => ({
    org_id: orgId, channel: "google", kind: "review", external_id: r.externalId,
    permalink: r.permalink, author_name: r.author, text: r.text, rating: r.rating, item_at: r.itemAt,
  }));
  const { error } = await admin.from("engagement_items").upsert(rows, { onConflict: "org_id,channel,external_id", ignoreDuplicates: true });
  if (error) { console.error("[engagement] storeReviews failed:", error.message); return 0; }
  return rows.length;
}

export async function fetchEngagementItems(supabase: SupabaseClient): Promise<EngagementItem[]> {
  const { data, error } = await supabase
    .from("engagement_items")
    .select("*")
    .order("item_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data.map(mapRow);
}

export async function getEngagementItem(supabase: SupabaseClient, orgId: string, id: string): Promise<EngagementItem | null> {
  const { data } = await supabase.from("engagement_items").select("*").eq("org_id", orgId).eq("id", id).maybeSingle();
  return data ? mapRow(data) : null;
}
