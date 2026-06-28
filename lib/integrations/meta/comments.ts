import { getPageClient } from "./page";
import { resolveInstagramUserId } from "./publishInstagram";
import type { MetaConfig } from "./config";

// Read + reply to comments on the business's FB Page posts and IG media.
// Requires pages_read_engagement / pages_manage_engagement (FB) and
// instagram_manage_comments (IG) — callers gate on checkCommentAccess.

export interface RawComment {
  channel: "facebook" | "instagram";
  externalId: string;
  parentRef: string;
  permalink: string | null;
  author: string | null;
  text: string;
  itemAt: string | null;
}

export async function fetchPageComments(config: MetaConfig, limitPosts = 10): Promise<RawComment[]> {
  if (!config.pageId) return [];
  const page = await getPageClient(config);
  const res: any = await page.get(`${config.pageId}/posts`, {
    fields: "id,permalink_url,comments.limit(25){id,message,from,created_time,permalink_url}",
    limit: limitPosts,
  });
  const out: RawComment[] = [];
  for (const post of res?.data || []) {
    for (const c of post?.comments?.data || []) {
      if (String(c?.from?.id || "") === String(config.pageId)) continue; // skip our own
      const text = String(c?.message || "");
      if (!text.trim()) continue;
      out.push({
        channel: "facebook", externalId: String(c.id), parentRef: String(post.id),
        permalink: c?.permalink_url || post?.permalink_url || null, author: c?.from?.name || null,
        text, itemAt: c?.created_time || null,
      });
    }
  }
  return out;
}

export async function fetchIgComments(config: MetaConfig, limitMedia = 10): Promise<RawComment[]> {
  if (!config.pageId) return [];
  const page = await getPageClient(config);
  let igUserId = config.igUserId || "";
  if (!igUserId) { try { igUserId = await resolveInstagramUserId(page, config.pageId); } catch { return []; } }
  if (!igUserId) return [];
  const res: any = await page.get(`${igUserId}/media`, {
    fields: "id,permalink,comments.limit(25){id,text,username,timestamp}",
    limit: limitMedia,
  });
  const out: RawComment[] = [];
  for (const m of res?.data || []) {
    for (const c of m?.comments?.data || []) {
      const text = String(c?.text || "");
      if (!text.trim()) continue;
      out.push({
        channel: "instagram", externalId: String(c.id), parentRef: String(m.id),
        permalink: m?.permalink || null, author: c?.username || null, text, itemAt: c?.timestamp || null,
      });
    }
  }
  return out;
}

// Reply to a comment. FB: POST /{comment-id}/comments; IG: POST /{comment-id}/replies.
export async function replyToComment(config: MetaConfig, channel: "facebook" | "instagram", commentId: string, message: string): Promise<{ id: string }> {
  const page = await getPageClient(config);
  const edge = channel === "instagram" ? "replies" : "comments";
  const r: any = await page.post(`${commentId}/${edge}`, { message });
  return { id: String(r?.id || "") };
}
