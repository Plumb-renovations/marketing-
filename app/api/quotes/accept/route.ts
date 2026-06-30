import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToBrand } from "@/lib/business/brand";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { computeDeposit, missingInvoiceDetails, buildDepositInvoiceEmail } from "@/lib/quotes/invoice";
import { computeTotals, priceableItems } from "@/lib/quotes/model";

const isUndefinedColumn = (e: any) =>
  e?.code === "42703" || /column .* does not exist|could not find/i.test(e?.message || "");

// PUBLIC accept endpoint for the tracked quote page. The visitor is anonymous,
// so EVERY write here (accept + lead-won + deposit invoice) uses the service-role
// admin client — the anon client can't pass is_member RLS. Records acceptance,
// flips the linked lead to won, then ALWAYS ensures the deposit invoice exists
// (created, listed, emailed) — even on a re-accept of an already-accepted quote,
// so a quote accepted before the invoice table existed still recovers.
export const runtime = "nodejs";
export const maxDuration = 60;

type Admin = ReturnType<typeof createAdminClient>;

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

  // Select with the tier columns; fall back if 0033 isn't applied (so accept
  // never breaks for normal quotes pre-migration).
  let { data: q, error } = await admin
    .from("quote_docs")
    .select("id, org_id, lead_id, status, subtotal, gst_amount, total, quote_number, client_name, client_email, gst_inclusive, tiered, accepted_tier")
    .eq("public_token", token)
    .maybeSingle();
  if (error && isUndefinedColumn(error)) {
    ({ data: q, error } = await admin
      .from("quote_docs")
      .select("id, org_id, lead_id, status, subtotal, gst_amount, total, quote_number, client_name, client_email, gst_inclusive")
      .eq("public_token", token)
      .maybeSingle());
  }
  if (error || !q) return NextResponse.json({ error: "not_found" }, { status: 404 });

  console.log(`[quotes] accept request quote=${q.id} number=${q.quote_number} status=${q.status} total=${q.total}`);

  // Resolve the accepted tier (tiered quotes) and the client's chosen fixtures,
  // then recompute the total so the accept record, the lead's job value and the
  // deposit invoice reflect the option + fixtures the client actually chose.
  // The total counts the build scope for the tier PLUS only the SELECTED
  // allowance option per group (never the sum of fixture alternatives).
  let acceptedTier: string | null = (q as any).accepted_tier || null;
  const chosenFixtures: string[] | null = Array.isArray(body?.fixtures) ? body.fixtures.map((x: any) => String(x)) : null;

  if ((q as any).tiered) {
    const reqTier = ["good", "better", "best"].includes(String(body?.tier)) ? String(body.tier) : null;
    const tier = acceptedTier || reqTier;
    if (!tier) return NextResponse.json({ error: "missing_tier", message: "Please choose an option to accept." }, { status: 400 });
    acceptedTier = tier;
  }

  if ((q as any).tiered || chosenFixtures) {
    const { data: prof } = await admin.from("business_profiles").select("gst_registered").eq("org_id", q.org_id).maybeSingle();
    const gstRegistered = (prof as any)?.gst_registered ?? true;

    // Fetch items with allowance fields; fall back if 0035/0036 aren't applied.
    let itemRows: any[] | null = null;
    {
      let res: any = await admin.from("quote_doc_items").select("id, qty, unit_price, tier, allowance, allowance_group, allowance_selected").eq("quote_id", q.id);
      if (res.error && isUndefinedColumn(res.error)) res = await admin.from("quote_doc_items").select("id, qty, unit_price, tier").eq("quote_id", q.id);
      itemRows = res.data || [];
    }
    const items = (itemRows || []).map((r: any) => ({
      id: r.id, qty: Number(r.qty) || 0, unitPrice: Number(r.unit_price) || 0, tier: r.tier ?? null,
      allowance: r.allowance ?? false, allowanceGroup: r.allowance_group ?? null,
      // Apply the client's selection when provided, else the stored default.
      allowanceSelected: chosenFixtures ? chosenFixtures.includes(r.id) : (r.allowance_selected ?? false),
    }));
    const t = computeTotals(priceableItems(items as any, (q as any).tiered ? (acceptedTier as any) : null), gstRegistered, (q as any).gst_inclusive);
    q.subtotal = t.subtotal; q.gst_amount = t.gstAmount; q.total = t.total;
    console.log(`[quotes] accept recompute quote=${q.id} tier=${acceptedTier || "—"} fixtures=${chosenFixtures ? chosenFixtures.length : "default"} total=${q.total}`);

    // Capture the client's fixture selections on the line items (best-effort).
    if (chosenFixtures) {
      try {
        await admin.from("quote_doc_items").update({ allowance_selected: false }).eq("quote_id", q.id).eq("allowance", true);
        if (chosenFixtures.length) await admin.from("quote_doc_items").update({ allowance_selected: true }).in("id", chosenFixtures);
      } catch (e) {
        console.warn(`[quotes] could not capture fixture selections quote=${q.id}: ${(e as Error).message}`);
      }
    }
  }

  // 1) Record acceptance (only if not already accepted) + flip the lead to won.
  const alreadyAccepted = q.status === "accepted";
  if (!alreadyAccepted) {
    const update: Record<string, any> = {
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by_name: acceptedByName || q.client_name || null,
      accept_method: "online",
      accept_ip: ip,
    };
    // Lock in the chosen tier + its totals as the agreed quote.
    if ((q as any).tiered) {
      update.accepted_tier = acceptedTier;
      update.subtotal = q.subtotal;
      update.gst_amount = q.gst_amount;
      update.total = q.total;
    }
    let { error: upErr } = await admin.from("quote_docs").update(update).eq("id", q.id);
    if (upErr && isUndefinedColumn(upErr)) {
      const { accepted_tier, ...legacy } = update;
      ({ error: upErr } = await admin.from("quote_docs").update(legacy).eq("id", q.id));
    }
    if (upErr) return NextResponse.json({ error: "update_failed", message: upErr.message }, { status: 502 });

    if (q.lead_id) {
      await admin
        .from("leads")
        .update({ stage: "won", won_quote_id: q.id, job_value: Number(q.total) || 0, lost_reason: null })
        .eq("id", q.lead_id);
    }
    console.log(`[quotes] accept recorded quote=${q.id} number=${q.quote_number}${q.lead_id ? ` lead=${q.lead_id}->won` : ""}`);
  } else {
    console.log(`[quotes] already accepted quote=${q.id} — ensuring deposit invoice exists`);
  }

  // 2) ALWAYS ensure the deposit invoice (idempotent), regardless of the accept gate.
  const invoice = await ensureDepositInvoice(admin, q);

  return NextResponse.json({ ok: true, accepted: true, alreadyAccepted, invoice });
}

// Upsert a quote_invoices row; surface a clear reason when the table is missing
// (migration 0018 not applied) rather than failing silently.
async function logInvoice(admin: Admin, row: Record<string, any>): Promise<string | null> {
  const { error } = await admin.from("quote_invoices").upsert(row, { onConflict: "quote_id,kind" });
  if (error) {
    const missingTable = /schema cache|does not exist|could not find/i.test(error.message || "");
    console.error(`[quotes] deposit invoice WRITE FAILED quote=${row.quote_id}: ${error.message}${missingTable ? " (run migration 0018_quote_deposit.sql)" : ""}`);
    return missingTable ? "invoice_table_missing" : error.message;
  }
  return null;
}

async function ensureDepositInvoice(admin: Admin, q: any) {
  const total = Number(q.total) || 0;

  // $0 quote → never raise a zero-dollar invoice.
  if (total <= 0) {
    console.log(`[quotes] deposit invoice skipped quote=${q.id} reason=zero_total`);
    return { emailed: false, reason: "zero_total" };
  }

  // Already have a SENT deposit invoice? Don't re-send (idempotent). A prior
  // skipped/failed row (or none) is (re)attempted below so it can recover.
  let existingNumber: string | null = null;
  try {
    const { data: existing } = await admin
      .from("quote_invoices")
      .select("invoice_number, status")
      .eq("quote_id", q.id)
      .eq("kind", "deposit")
      .maybeSingle();
    if (existing?.status === "sent") {
      console.log(`[quotes] deposit invoice already sent quote=${q.id} number=${existing.invoice_number}`);
      return { emailed: true, alreadySent: true, invoiceNumber: existing.invoice_number };
    }
    existingNumber = existing?.invoice_number || null;
  } catch {
    // table may not exist yet; logInvoice below surfaces it
  }

  const { data: prof } = await admin.from("business_profiles").select("*").eq("org_id", q.org_id).maybeSingle();
  const brand = rowToBrand(prof);
  const businessName = prof?.business_name || "";
  const percent = Number(brand.depositPercent) || 5;
  const amounts = computeDeposit(total, percent, brand.gstRegistered);
  console.log(`[quotes] deposit quote=${q.id} total=${total} percent=${percent}% deposit=${amounts.total}`);

  // Reuse a previously-reserved number; otherwise mint from the org's numbering.
  const prefix = prof?.invoice_number_prefix ?? "INV-";
  const next = Number(prof?.invoice_next_number) || 1;
  const mintedNew = !existingNumber;
  const invoiceNumber = existingNumber || `${prefix}${String(next).padStart(4, "0")}`;
  const clientEmail = (q.client_email || "").trim();

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

  // Non-compliant invoice → log which field is missing; don't email a blank one.
  const missing = missingInvoiceDetails(brand);
  if (missing.length) {
    const message = `Missing ${missing.join(" and ")} — add them in Branding & Quotes.`;
    const wErr = await logInvoice(admin, { ...logBase, status: "skipped", message });
    console.warn(`[quotes] deposit invoice skipped quote=${q.id} reason=missing_details (${missing.join(", ")})`);
    return { emailed: false, reason: wErr || "missing_business_details", missing, invoiceNumber, amount: amounts.total };
  }
  if (!clientEmail) {
    const wErr = await logInvoice(admin, { ...logBase, status: "skipped", message: "No client email on the quote." });
    return { emailed: false, reason: wErr || "no_client_email", invoiceNumber, amount: amounts.total };
  }
  if (!emailConfigured()) {
    const wErr = await logInvoice(admin, { ...logBase, status: "skipped", message: "Email (Resend) isn't configured." });
    return { emailed: false, reason: wErr || "email_not_configured", invoiceNumber, amount: amounts.total };
  }

  try {
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
    console.log(`[quotes] deposit invoice email sent quote=${q.id} number=${invoiceNumber} to=${clientEmail}`);

    const wErr = await logInvoice(admin, { ...logBase, status: "sent", message: null, sent_at: new Date().toISOString() });
    if (wErr) return { emailed: true, reason: wErr, invoiceNumber, amount: amounts.total, to: clientEmail };

    // Consume the invoice number only when we actually minted + sent a fresh one.
    if (mintedNew) await admin.from("business_profiles").update({ invoice_next_number: next + 1 }).eq("org_id", q.org_id);
    console.log(`[quotes] deposit invoice created quote=${q.id} number=${invoiceNumber} status=sent`);
    return { emailed: true, invoiceNumber, amount: amounts.total, to: clientEmail };
  } catch (e: any) {
    const message = e?.message || "email send failed";
    await logInvoice(admin, { ...logBase, status: "failed", message });
    console.error(`[quotes] deposit invoice email FAILED quote=${q.id}: ${message}`);
    return { emailed: false, reason: "send_failed", message, invoiceNumber, amount: amounts.total };
  }
}
