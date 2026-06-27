import type { SupabaseClient } from "@supabase/supabase-js";
import { ORG_ID } from "@/lib/domain/seed";
import { getMetaConfigForPage } from "@/lib/integrations/meta/config";
import { metaClient } from "@/lib/integrations/meta/client";

// Parse + store Facebook Page + Instagram messaging webhook events into
// inbox_messages. Best-effort and defensive: anything that throws is swallowed
// so it can never affect the (critical) leadgen webhook it rides alongside.
// NOTE: nothing flows here until the messaging permissions are approved and the
// Page is subscribed to the `messages` field — by design (no fake messages).

async function resolveOrgId(admin: SupabaseClient, channel: string, pageOrIgId: string): Promise<string> {
  try {
    const col = channel === "instagram" ? "ig_user_id" : "page_id";
    const { data } = await admin
      .from("org_integrations")
      .select("org_id")
      .eq("provider", "meta")
      .eq(col, pageOrIgId)
      .eq("status", "connected")
      .maybeSingle();
    if ((data as any)?.org_id) return (data as any).org_id;
  } catch {
    /* fall through */
  }
  return ORG_ID;
}

// Resolve the human name behind a sender id (needs the messaging permission, so
// this only succeeds once approval lands — exactly when messages start flowing).
async function resolveSenderName(pageOrIgId: string, channel: string, senderId: string): Promise<string | null> {
  try {
    const config = await getMetaConfigForPage(pageOrIgId);
    if (!config) return null;
    const fields = channel === "instagram" ? "name,username" : "name";
    const res: any = await metaClient(config).get(`${senderId}`, { fields });
    return res?.name || res?.username || null;
  } catch {
    return null;
  }
}

async function matchLead(admin: SupabaseClient, orgId: string, name: string | null): Promise<string | null> {
  if (!name) return null;
  try {
    const { data } = await admin
      .from("leads")
      .select("id")
      .eq("org_id", orgId)
      .ilike("name", name)
      .is("archived_at", null)
      .limit(1);
    return (data as any)?.[0]?.id || null;
  } catch {
    return null;
  }
}

export async function ingestMetaMessaging(admin: SupabaseClient, body: any): Promise<number> {
  const object = String(body?.object || "");
  if (object !== "page" && object !== "instagram") return 0;
  const channel = object === "instagram" ? "instagram" : "facebook";

  let stored = 0;
  for (const entry of body?.entry || []) {
    const pageOrIgId = String(entry?.id || "");
    const events = Array.isArray(entry?.messaging) ? entry.messaging : [];
    for (const ev of events) {
      const msg = ev?.message;
      if (!msg) continue; // skip delivery/read receipts + postbacks in the shell
      const isEcho = !!msg?.is_echo;
      const senderId = String(ev?.sender?.id || "");
      const recipientId = String(ev?.recipient?.id || "");
      const mid = String(msg?.mid || `${senderId}:${ev?.timestamp || ""}`);
      const orgId = await resolveOrgId(admin, channel, pageOrIgId || recipientId);

      // The customer side of the conversation (for inbound it's the sender; for
      // our own echoed reply it's the recipient).
      const customerId = isEcho ? recipientId : senderId;
      const senderName = isEcho ? null : await resolveSenderName(pageOrIgId || recipientId, channel, customerId);
      const leadId = await matchLead(admin, orgId, senderName);

      const row = {
        org_id: orgId,
        channel,
        external_message_id: mid,
        thread_id: customerId,
        sender_id: senderId,
        sender_name: senderName,
        direction: isEcho ? "out" : "in",
        body: String(msg?.text || ""),
        attachments: msg?.attachments || [],
        lead_id: leadId,
        sent_at: ev?.timestamp ? new Date(Number(ev.timestamp)).toISOString() : new Date().toISOString(),
        raw: ev,
      };

      try {
        const { error } = await admin
          .from("inbox_messages")
          .upsert(row, { onConflict: "org_id,channel,external_message_id", ignoreDuplicates: true });
        if (!error) stored++;
      } catch {
        /* table not migrated yet — ignore */
      }
    }
  }
  return stored;
}
