// Client calls for the unified inbox.

export interface InboxAccess {
  pagesMessaging: boolean;
  instagramMessages: boolean;
  pageSubscribedMessages: boolean;
  canReply: boolean;
  canReceive: boolean;
  note: string;
}
export interface InboxStatus {
  connected: boolean;
  igLinked: boolean;
  access: InboxAccess | null;
}
export interface InboxMessage {
  id: string;
  channel: "facebook" | "instagram";
  direction: "in" | "out";
  body: string;
  senderName: string | null;
  sentAt: string;
}
export interface InboxThread {
  key: string;
  threadId: string;
  channel: "facebook" | "instagram";
  senderName: string | null;
  leadId: string | null;
  lastAt: string;
  lastSnippet: string;
  messages: InboxMessage[];
}

export async function fetchInboxStatus(): Promise<InboxStatus> {
  const res = await fetch("/api/inbox/status", { cache: "no-store" });
  if (!res.ok) return { connected: false, igLinked: false, access: null };
  return res.json();
}

export async function fetchInbox(): Promise<InboxThread[]> {
  const res = await fetch("/api/inbox", { cache: "no-store" });
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j.threads) ? j.threads : [];
}

export async function replyToThread(t: { threadId: string; channel: string; text: string }): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch("/api/inbox/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipientId: t.threadId, channel: t.channel, text: t.text }),
  });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, message: j?.message };
}
