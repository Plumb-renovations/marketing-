import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId } from "@/lib/data/org";
import { getMetaConfig } from "@/lib/integrations/meta/config";
import { getPageClient } from "@/lib/integrations/meta/page";
import { MetaAuthError } from "@/lib/integrations/meta/client";
import { checkMessagingAccess } from "@/lib/inbox/access";
import { sendMessage } from "@/lib/integrations/meta/messaging";

// Reply to a FB/IG conversation from inside Hazel. GATED: only proceeds when the
// token actually holds the messaging permission — otherwise returns a clear
// "not approved yet" so the UI keeps the read-only + link-out behaviour.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }
  const channel = body?.channel === "instagram" ? "instagram" : "facebook";
  const recipientId = String(body?.recipientId || body?.threadId || "");
  const text = String(body?.text || "").trim();
  if (!recipientId || !text) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const orgId = await getOrgId(supabase);
  const config = await getMetaConfig(orgId);
  if (!config) return NextResponse.json({ error: "meta_not_connected", message: "Connect Meta in Settings → Integrations first." }, { status: 412 });

  const access = await checkMessagingAccess(config);
  if (!access.canReply) {
    return NextResponse.json(
      { error: "messaging_not_approved", message: access.note },
      { status: 403 },
    );
  }

  try {
    const page = await getPageClient(config);
    const r = await sendMessage(page, recipientId, text);
    // Record our reply so it shows in the thread.
    try {
      await createAdminClient().from("inbox_messages").upsert(
        {
          org_id: orgId, channel, external_message_id: r.id || `out:${recipientId}:${Date.now()}`,
          thread_id: recipientId, sender_id: config.pageId || null, direction: "out", body: text,
          sent_at: new Date().toISOString(),
        },
        { onConflict: "org_id,channel,external_message_id", ignoreDuplicates: true },
      );
    } catch { /* table may not be migrated — reply still sent */ }
    return NextResponse.json({ ok: true, id: r.id });
  } catch (e) {
    if (e instanceof MetaAuthError) {
      return NextResponse.json({ error: "reconnect", message: "Meta connection expired — reconnect in Settings → Integrations." }, { status: 401 });
    }
    return NextResponse.json({ error: "send_failed", message: (e as Error).message }, { status: 502 });
  }
}
