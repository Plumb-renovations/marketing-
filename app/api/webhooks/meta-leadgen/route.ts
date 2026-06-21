import { NextResponse } from "next/server";
import { meta } from "@/lib/integrations/env";
import { metaClient, verifyWebhookSignature } from "@/lib/integrations/meta/client";
import { getMetaConfigForPage } from "@/lib/integrations/meta/config";
import { fetchLead } from "@/lib/integrations/meta/leads";
import { respondToNewLead } from "@/lib/leads/respond";
import { createAdminClient } from "@/lib/supabase/admin";

// Meta Lead Ads webhook.
//   GET  — subscription verification handshake (hub.challenge).
//   POST — leadgen notifications: fetch each lead via the Graph API with the
//          System User token, and store it in the leads table (idempotent).
// Public route (Meta calls it); secured by the verify token + X-Hub-Signature-256.
export const runtime = "nodejs";
// Never cache: each verify GET carries a unique hub.challenge that must be
// echoed back verbatim. A cached/stale response makes Meta's verify fail even
// though a manual browser GET looks fine.
export const dynamic = "force-dynamic";

// --- Subscription verification ---
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = (url.searchParams.get("hub.verify_token") || "").trim();
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const expected = (process.env.META_WEBHOOK_VERIFY_TOKEN || "").trim();

  if (mode === "subscribe" && expected && token === expected) {
    // Echo the RAW challenge: plain text, 200, no JSON wrapping, no trailing
    // newline, no caching.
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain", "cache-control": "no-store" },
    });
  }
  return new Response("forbidden", { status: 403 });
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

  const supabase = createAdminClient();
  let received = 0;
  const dropped: { pageId?: string; reason: string; leads: number }[] = [];

  // Diagnostics: confirm the webhook was hit and which Pages it carried. Visible
  // in the Vercel function logs for /api/webhooks/meta-leadgen.
  const entries: any[] = Array.isArray(body?.entry) ? body.entry : [];
  console.log(
    "[meta-leadgen] POST received:",
    JSON.stringify({
      object: body?.object,
      entries: entries.length,
      pages: entries.map((e: any) => e?.id).filter(Boolean),
    }),
  );

  // Process per page entry. entry.id is the Page id, which routes the lead to
  // the org that connected that Page (falling back to the default Plumb org's
  // env config). Each org's leads are fetched with that org's own token and
  // stored under that org — no cross-org leakage.
  for (const entry of entries) {
    const leadgenIds = (entry?.changes || [])
      .filter((c: any) => c?.field === "leadgen" && c?.value?.leadgen_id)
      .map((c: any) => String(c.value.leadgen_id));
    const pageId = entry?.id ? String(entry.id) : undefined;
    if (!leadgenIds.length) {
      console.log("[meta-leadgen] entry has no leadgen changes", JSON.stringify({ pageId }));
      continue;
    }

    const config = await getMetaConfigForPage(pageId);
    if (!config) {
      // The Page maps to no connected org AND no env fallback (default org needs
      // META_SYSTEM_USER_TOKEN). The leads are dropped here — this is the most
      // common silent failure after multi-tenancy.
      console.error(
        "[meta-leadgen] DROPPED — no Meta config for page",
        JSON.stringify({ pageId, leads: leadgenIds.length }),
      );
      dropped.push({ pageId, reason: "no_config_for_page", leads: leadgenIds.length });
      continue;
    }
    console.log(
      "[meta-leadgen] page mapped",
      JSON.stringify({ pageId, orgId: config.orgId, source: config.source, leads: leadgenIds.length }),
    );
    const client = metaClient(config);

    for (const leadgenId of leadgenIds) {
      try {
        const lead = await fetchLead(client, leadgenId);
        const leadId = "meta-" + leadgenId;
        // Upsert into leads, deduped by (org_id, external_source, external_id)
        // so re-deliveries don't create duplicates.
        await supabase.from("leads").upsert(
          {
            id: leadId,
            org_id: config.orgId,
            name: lead.name,
            suburb: lead.suburb,
            project: lead.project,
            phone: lead.phone ?? null,
            email: lead.email ?? null,
            source: "meta_ads",
            stage: "new",
            lead_date: new Date().toISOString().slice(0, 10),
            external_source: "meta_leadgen",
            external_id: leadgenId,
            raw: lead.raw as any,
          },
          { onConflict: "org_id,external_source,external_id", ignoreDuplicates: true },
        );
        received += 1;
        console.log("[meta-leadgen] stored lead", JSON.stringify({ leadgenId, orgId: config.orgId, name: lead.name }));

        // Speed-to-lead: instant auto-reply + staff alert (idempotent). In its
        // own try/catch so a send issue is logged distinctly and never marks an
        // already-stored lead as "dropped".
        try {
          await respondToNewLead(config.orgId, leadId);
        } catch (e) {
          console.error("[meta-leadgen] speed-to-lead response failed", leadgenId, (e as Error).message);
        }
      } catch (e) {
        console.error("[meta-leadgen] failed to ingest lead", leadgenId, (e as Error).message);
        dropped.push({ pageId, reason: "fetch_failed", leads: 1 });
      }
    }
  }

  console.log("[meta-leadgen] done:", JSON.stringify({ received, dropped }));
  // Always 200 quickly so Meta doesn't retry/disable the webhook.
  return NextResponse.json({ received, dropped: dropped.length });
}
