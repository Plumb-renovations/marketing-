import { NextResponse } from "next/server";
import { meta } from "@/lib/integrations/env";
import { verifyWebhookSignature } from "@/lib/integrations/meta/client";
import { fetchLead } from "@/lib/integrations/meta/leads";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ID } from "@/lib/domain/seed";

// Meta Lead Ads webhook.
//   GET  — subscription verification handshake (hub.challenge).
//   POST — leadgen notifications: fetch each lead via the Graph API with the
//          System User token, and store it in the leads table (idempotent).
// Public route (Meta calls it); secured by the verify token + X-Hub-Signature-256.
export const runtime = "nodejs";

// --- Subscription verification ---
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === meta.webhookVerifyToken) {
    // Echo the challenge back as plain text with a 200.
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// --- Leadgen events ---
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");

  // Enforce the HMAC signature when the app secret is configured. (Meta always
  // signs; if META_APP_SECRET is unset we can't verify — log and proceed so the
  // webhook still works in early testing.)
  if (meta.appSecret) {
    if (!verifyWebhookSignature(raw, sig)) {
      return new NextResponse("invalid signature", { status: 401 });
    }
  } else {
    console.warn("[meta-leadgen] META_APP_SECRET not set — skipping signature check");
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  // Collect leadgen_ids from all page entries.
  const leadgenIds: string[] = [];
  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      if (change?.field === "leadgen" && change?.value?.leadgen_id) {
        leadgenIds.push(String(change.value.leadgen_id));
      }
    }
  }

  const supabase = createAdminClient();

  for (const leadgenId of leadgenIds) {
    try {
      const lead = await fetchLead(leadgenId);
      // Store the same way the lead integration does: upsert into leads,
      // deduped by (org_id, external_source, external_id) so re-deliveries
      // don't create duplicates.
      await supabase.from("leads").upsert(
        {
          id: "meta-" + leadgenId,
          org_id: ORG_ID,
          name: lead.name,
          suburb: lead.suburb,
          project: lead.project,
          source: "meta_ads",
          stage: "new",
          lead_date: new Date().toISOString().slice(0, 10),
          external_source: "meta_leadgen",
          external_id: leadgenId,
          raw: lead.raw as any,
        },
        { onConflict: "org_id,external_source,external_id", ignoreDuplicates: true },
      );
    } catch (e) {
      console.error("[meta-leadgen] failed to ingest lead", leadgenId, (e as Error).message);
    }
  }

  // Always 200 quickly so Meta doesn't retry/disable the webhook.
  return NextResponse.json({ received: leadgenIds.length });
}
