import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { rowToBrand } from "@/lib/business/brand";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { buildQuoteEmail } from "@/lib/quotes/email";
import { publicQuoteUrl } from "@/lib/quotes/publicUrl";

// Send a quote end-to-end: assign its number, mint a public token for the
// tracked link, mark it Sent (+ sent_at), then email the client the branded
// link via Resend. Org-scoped via RLS (the user's client). Resilient — a
// finalised quote is always returned even if the email can't go out, with a
// clear reason so the UI can tell the user what to fix.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const orgId = await getOrgId(supabase);

  const { data: quote, error: qErr } = await supabase
    .from("quote_docs")
    .select("id, quote_number, public_token, client_name, client_email, total")
    .eq("id", id)
    .maybeSingle();
  if (qErr || !quote) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Assign a number from the org's numbering settings (only if not already set).
  let quoteNumber = quote.quote_number as string | null;
  if (!quoteNumber) {
    const { data: prof } = await supabase
      .from("business_profiles")
      .select("quote_number_prefix, quote_next_number")
      .eq("org_id", orgId)
      .maybeSingle();
    const prefix = prof?.quote_number_prefix ?? "Q-";
    const next = Number(prof?.quote_next_number) || 1;
    quoteNumber = `${prefix}${String(next).padStart(4, "0")}`;
    await supabase.from("business_profiles").update({ quote_next_number: next + 1 }).eq("org_id", orgId);
  }

  const publicToken = quote.public_token || crypto.randomBytes(18).toString("base64url");

  const { error: upErr } = await supabase
    .from("quote_docs")
    .update({ quote_number: quoteNumber, status: "sent", sent_at: new Date().toISOString(), public_token: publicToken })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: "update_failed", message: upErr.message }, { status: 502 });

  // Build the tracked client link on the branded domain (NEXT_PUBLIC_APP_URL),
  // falling back to the request origin so it's correct on any deployment.
  const link = publicQuoteUrl(publicToken, new URL(req.url).origin);

  // Email the client the branded link (best-effort; never blocks the send).
  let emailed = false;
  let emailReason: string | undefined;
  const clientEmail = (quote.client_email || "").trim();
  if (!clientEmail) {
    emailReason = "no_client_email";
  } else if (!emailConfigured()) {
    emailReason = "email_not_configured";
  } else {
    try {
      const { data: prof } = await supabase.from("business_profiles").select("*").eq("org_id", orgId).maybeSingle();
      const brand = rowToBrand(prof);
      const businessName = prof?.business_name || "";
      const { subject, html, text } = buildQuoteEmail({
        businessName,
        brand,
        clientName: quote.client_name || "",
        quoteNumber: quoteNumber!,
        link,
      });
      console.log(`[quotes] sending email org=${orgId} id=${id} to=${clientEmail}`);
      await sendEmail(clientEmail, subject, text, {
        html,
        fromName: businessName || undefined,
        replyTo: brand.contactEmail || undefined,
      });
      emailed = true;
      await supabase.from("quote_docs").update({ email_sent_at: new Date().toISOString(), email_to: clientEmail }).eq("id", id);
    } catch (e: any) {
      emailReason = "send_failed";
      console.error(`[quotes] email send failed org=${orgId} id=${id}: ${e?.message || e}`);
    }
  }

  console.log(`[quotes] sent org=${orgId} id=${id} number=${quoteNumber} emailed=${emailed}${emailReason ? ` reason=${emailReason}` : ""}`);
  return NextResponse.json({ ok: true, quoteNumber, publicToken, status: "sent", link, emailed, emailReason });
}
