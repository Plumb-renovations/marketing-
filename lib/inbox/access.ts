import { meta } from "@/lib/integrations/env";
import { metaClient } from "@/lib/integrations/meta/client";
import { getPageSubscribedFields } from "@/lib/integrations/meta/subscribe";
import type { MetaConfig } from "@/lib/integrations/meta/config";

// Honest, LIVE check of whether this org's Meta token can actually do messaging.
// Introspects the token's granted scopes (debug_token) + whether the Page is
// subscribed to the `messages` webhook field. Drives the in-app banner so we
// never claim the inbox is live when it isn't.

export interface MessagingAccess {
  scopes: string[];
  pagesMessaging: boolean; // FB Page messages permission
  instagramMessages: boolean; // IG DM permission
  pageSubscribedMessages: boolean; // Page subscribed to the messages webhook
  canReply: boolean; // permission present → can send
  canReceive: boolean; // permission + webhook subscription → messages flow in
  note: string;
}

export async function checkMessagingAccess(config: MetaConfig): Promise<MessagingAccess> {
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
    /* introspection is best-effort */
  }

  const pagesMessaging = scopes.includes("pages_messaging");
  const instagramMessages = scopes.includes("instagram_manage_messages");

  let pageSubscribedMessages = false;
  if (config.pageId && (pagesMessaging || instagramMessages)) {
    try {
      const fields = await getPageSubscribedFields(metaClient(config), config.pageId);
      pageSubscribedMessages = fields.includes("messages");
    } catch {
      /* ignore */
    }
  }

  const canReply = pagesMessaging || instagramMessages;
  const canReceive = canReply && pageSubscribedMessages;
  const note = !canReply
    ? "Messaging permission not granted yet — pending Meta App Review (pages_messaging / instagram_manage_messages)."
    : !pageSubscribedMessages
      ? "Permission granted, but the Page isn't subscribed to the messages webhook yet."
      : "Messaging connected — messages flow in and replies can be sent from Hazel.";

  return { scopes, pagesMessaging, instagramMessages, pageSubscribedMessages, canReply, canReceive, note };
}
