import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";

// Finalise + "send" a quote: assign its number from the business's numbering
// settings (incrementing next_number), set status=sent + sent_at, and mint a
// public token for the tracked link. Org-scoped via RLS (the user's client).
// The public client page + PDF + email delivery land in the next PR; this
// finalises the record so it's ready to deliver.
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
    .select("id, quote_number, public_token")
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

  console.log(`[quotes] sent org=${orgId} id=${id} number=${quoteNumber}`);
  return NextResponse.json({ ok: true, quoteNumber, publicToken, status: "sent" });
}
