import { meta } from "@/lib/integrations/env";
import type { MetaConfig } from "@/lib/integrations/meta/config";

// Honest, LIVE check of what the org's Meta token can do with COMMENTS.
// Reading/replying to Page-post + IG comments needs scopes beyond the current
// ads/leads set (pages_read_engagement, pages_manage_engagement,
// instagram_manage_comments) — which require Meta App Review. We introspect the
// token (debug_token) rather than assume, so the banner tells the truth.

export interface CommentAccess {
  scopes: string[];
  pagesReadEngagement: boolean;
  pagesManageEngagement: boolean;
  instagramComments: boolean;
  canReadFb: boolean;
  canReplyFb: boolean;
  canReadIg: boolean;
  canReplyIg: boolean;
  canRead: boolean;
  canReply: boolean;
  note: string;
}

export async function checkCommentAccess(config: MetaConfig): Promise<CommentAccess> {
  let scopes: string[] = [];
  try {
    if (meta.appId && meta.appSecret) {
      const appToken = `${meta.appId}|${meta.appSecret}`;
      const url = `https://graph.facebook.com/${meta.graphVersion}/debug_token?input_token=${encodeURIComponent(config.token)}&access_token=${encodeURIComponent(appToken)}`;
      const res = await fetch(url);
      const j: any = await res.json().catch(() => ({}));
      scopes = Array.isArray(j?.data?.scopes) ? j.data.scopes.map(String) : [];
    }
  } catch {
    /* best-effort */
  }

  const pagesReadEngagement = scopes.includes("pages_read_engagement") || scopes.includes("pages_read_user_content");
  const pagesManageEngagement = scopes.includes("pages_manage_engagement");
  const instagramComments = scopes.includes("instagram_manage_comments");

  const canReadFb = pagesReadEngagement;
  const canReplyFb = pagesManageEngagement;
  const canReadIg = instagramComments && !!config.igUserId;
  const canReplyIg = instagramComments && !!config.igUserId;
  const canRead = canReadFb || canReadIg;
  const canReply = canReplyFb || canReplyIg;

  const note = !canRead
    ? "Reading & replying to comments needs Meta permissions (pages_read_engagement, pages_manage_engagement, instagram_manage_comments) the app doesn't hold yet — pending Meta App Review."
    : !canReply
      ? "Comments can be read, but replying needs pages_manage_engagement / instagram_manage_comments (pending approval)."
      : "Connected — comments flow in and Hazel's approved replies can be posted.";

  return { scopes, pagesReadEngagement, pagesManageEngagement, instagramComments, canReadFb, canReplyFb, canReadIg, canReplyIg, canRead, canReply, note };
}
