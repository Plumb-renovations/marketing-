// Client calls for the comment + review responder.

export interface CommentAccess {
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
export interface EngagementItem {
  id: string;
  channel: "facebook" | "instagram" | "google";
  kind: "comment" | "review";
  externalId: string;
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
export interface EngagementData {
  items: EngagementItem[];
  meta: { connected: boolean; access: CommentAccess | null };
  google: { connected: boolean };
}

export async function fetchEngagement(): Promise<EngagementData> {
  const res = await fetch("/api/engagement", { cache: "no-store" });
  if (!res.ok) return { items: [], meta: { connected: false, access: null }, google: { connected: false } };
  return res.json();
}

export async function syncEngagement(): Promise<{ ok: boolean; counts?: any }> {
  const res = await fetch("/api/engagement/sync", { method: "POST" });
  try { return await res.json(); } catch { return { ok: false }; }
}

export async function draftEngagement(id: string): Promise<{ action: "reply" | "flag"; reply: string; reason: string; sentiment: string | null } | null> {
  const res = await fetch("/api/engagement/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  if (!res.ok) return null;
  return res.json();
}

export async function replyEngagement(id: string, text: string): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch("/api/engagement/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, text }) });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, message: j?.message };
}
