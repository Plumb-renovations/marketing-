import type { MetaClient } from "./client";

// Send a reply to a Facebook Page conversation or an Instagram DM. Both go via
// the Page-scoped token on /me/messages with the customer's id as recipient.
// Requires pages_messaging / instagram_manage_messages — callers gate on that.
// Meta's standard messaging window is 24h after the customer's last message.
export async function sendMessage(page: MetaClient, recipientId: string, text: string): Promise<{ id: string }> {
  const res: any = await page.post(`me/messages`, {
    recipient: { id: recipientId },
    message: { text },
    messaging_type: "RESPONSE",
  });
  return { id: String(res?.message_id || res?.id || "") };
}
