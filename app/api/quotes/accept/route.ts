import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToBrand } from "@/lib/business/brand";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { computeDeposit, missingInvoiceDetails, buildDepositInvoiceEmail } from "@/lib/quotes/invoice";

// PUBLIC accept endpoint for the tracked quote page. The visitor is anonymous,
// so it MUST write with the service role (the anon client can't pass is_member
// RLS, which is why the previous accept silently failed). Records acceptance,
// flips the linked lead to won, then auto-raises + emails the deposit invoice.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const token = String(body?.token || "");
  const acceptedByName = String(body?.name || "").trim().slice(0, 120);
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const admin = createAdminClient();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const { data: q, error } = await admin
    .from("quote_docs")
    .select("id, org_id, lead_id, status, total, quote_number, client_name, client_email, gst_inclusive")
    .eq("public_token", token)
    .maybeSingle();
  if (error || !q) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Idempotent: if already accepted, don't re-accept or re-invoice.
  const alreadyAccepted = q.status === "accepted";
  if (!alreadyAccepted) {
    const { error: upErr } = await admin
      .from("quote_docs")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by_name: acceptedByName || q.client_name || null,
        accept_method: "online",
        accept_ip: ip,
      })
      .eq("id", q.id);
    if (upErr) return NextResponse.json({ error: "update_failed", message: upErr.message }, { status: 502 });

    // Flip the linked lead to won + record the job value (feeds capacity +
    // cost-per-won-job).
    if (q.lead_id) {
      await admin
        .from("leads")
        .update({ stage: "won", won_quote_id: q.id, job_value: Number(q.total) || 0, lost_reason: null })
        .eq("id", q.lead_id);
    }
    console.log(`[quotes] accepted org=${q.org_id} id=${q.id} number=${q.quote_number}`);
  }

  // Deposit invoice (only on the first accept).
  let invoice: any = { emailed: false };
  if (!alreadyAccepted) invoice = await raiseDepositInvoice(admin, q);

  return NextResponse.json({ ok: true, accepted: true, alreadyAccepted, invoice });
}

async function raiseDepositInvoice(admin: ReturnType<typeof createAdminClient>, q: any) {
  try {
    const { data: prof } = await admin.from("business_profiles").select("*").eq("org_id", q.org_id).maybeSingle();
    const brand = rowToBrand(prof);
    const businessName = prof?.business_name || "";
    const percent = Number(brand.depositPercent) || 5;
    const amounts = computeDeposit(Number(q.total) || 0, percent, brand.gstRegistered);

    // Refuse to email a blank/non-compliant invoice — report what's missing.
    const missing = missingInvoiceDetails(brand);
    const clientEmail = (q.client_email || "").trim();

    // Mint the next invoice number from the org's numbering.
    const prefix = prof?.invoice_number_prefix ?? "INV-";
    const next = Number(prof?.invoice_next_number) || 1;
    const invoiceNumber = `${prefix}${String(next).padStart(4, "0")}`;

    const logBase = {
      org_id: q.org_id,
      quote_id: q.id,
      kind: "deposit",
      invoice_number: invoiceNumber,
      percent,
      subtotal: amounts.subtotal,
      gst_amount: amounts.gstAmount,
      total: amounts.total,
      client_email: clientEmail || null,
    };

    if (missing.length) {
      const message = `Couldn't email the deposit invoice — missing ${missing.join(" and ")}. Add them in Branding & Quotes.`;
      await admin.from("quote_invoices").upsert({ ...logBase, status: "skipped", message }, { onConflict: "quote_id,kind" });
      console.warn(`[quotes] deposit invoice skipped org=${q.org_id} id=${q.id}: ${message}`);
      return { emailed: false, reason: "missing_business_details", missing, invoiceNumber, amount: amounts.total };
    }
    if (!clientEmail) {
      await admin.from("quote_invoices").upsert({ ...logBase, status: "skipped", message: "No client email on the quote." }, { onConflict: "quote_id,kind" });
      return { emailed: false, reason: "no_client_email", invoiceNumber, amount: amounts.total };
    }
    if (!emailConfigured()) {
      await admin.from("quote_invoices").upsert({ ...logBase, status: "skipped", message: "Email (Resend) isn't configured." }, { onConflict: "quote_id,kind" });
      return { emailed: false, reason: "email_not_configured", invoiceNumber, amount: amounts.total };
    }

    const { subject, html, text } = buildDepositInvoiceEmail({
      businessName,
      brand,
      clientName: q.client_name || "",
      clientEmail,
      quoteNumber: q.quote_number || "",
      invoiceNumber,
      amounts,
    });
    await sendEmail(clientEmail, subject, text, { html, fromName: businessName || undefined, replyTo: brand.contactEmail || undefined });

    // Persist: increment the invoice number + log the send.
    await admin.from("business_profiles").update({ invoice_next_number: next + 1 }).eq("org_id", q.org_id);
    await admin.from("quote_invoices").upsert({ ...logBase, status: "sent", message: null, sent_at: new Date().toISOString() }, { onConflict: "quote_id,kind" });
    console.log(`[quotes] deposit invoice ${invoiceNumber} emailed org=${q.org_id} id=${q.id} to=${clientEmail}`);
    return { emailed: true, invoiceNumber, amount: amounts.total, to: clientEmail };
  } catch (e: any) {
    const message = e?.message || "deposit invoice failed";
    await admin
      .from("quote_invoices")
      .upsert({ org_id: q.org_id, quote_id: q.id, kind: "deposit", status: "failed", message }, { onConflict: "quote_id,kind" });
    console.error(`[quotes] deposit invoice FAILED org=${q.org_id} id=${q.id}: ${message}`);
    return { emailed: false, reason: "send_failed", message };
  }
}
