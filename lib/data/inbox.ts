import type { SupabaseClient } from "@supabase/supabase-js";

// Read + group stored messages into conversation threads (newest first).
// Resilient: returns [] if the table isn't migrated yet, so the inbox shell
// renders its "pending" state rather than erroring.

export interface InboxMessage {
  id: string;
  channel: "facebook" | "instagram";
  direction: "in" | "out";
  body: string;
  senderName: string | null;
  senderId: string | null;
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

export async function fetchInboxThreads(supabase: SupabaseClient): Promise<InboxThread[]> {
  const { data, error } = await supabase
    .from("inbox_messages")
    .select("*")
    .order("sent_at", { ascending: true })
    .limit(1000);
  if (error || !data) return [];

  const map = new Map<string, InboxThread>();
  for (const r of data as any[]) {
    const key = `${r.channel}:${r.thread_id}`;
    let t = map.get(key);
    if (!t) {
      t = { key, threadId: r.thread_id, channel: r.channel, senderName: r.sender_name || null, leadId: r.lead_id || null, lastAt: r.sent_at, lastSnippet: "", messages: [] };
      map.set(key, t);
    }
    if (r.sender_name && !t.senderName) t.senderName = r.sender_name;
    if (r.lead_id && !t.leadId) t.leadId = r.lead_id;
    t.lastAt = r.sent_at;
    t.lastSnippet = r.body || (Array.isArray(r.attachments) && r.attachments.length ? "[attachment]" : "");
    t.messages.push({
      id: r.id, channel: r.channel, direction: r.direction, body: r.body || "",
      senderName: r.sender_name, senderId: r.sender_id, sentAt: r.sent_at,
    });
  }
  return Array.from(map.values()).sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || ""));
}
