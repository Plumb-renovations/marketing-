import { NextResponse } from "next/server";
import { logQuoteView } from "@/lib/quotes/publicServer";
import { createClient } from "@/lib/supabase/server";

// Public open-tracking beacon. The /q/[token] page calls this once on load to
// record that the CLIENT opened the quote. No auth is required (the token is the
// secret); best-effort — always returns ok.
//
// IMPORTANT: an authenticated OWNER previewing their own quote via the public
// link must NOT be counted as a client open (it would fire a false "client
// viewed your quote" signal). We detect this by reading the quote through the
// caller's cookie-bound session: org RLS (is_member) lets a member read the row
// by token, while a genuine anonymous client cannot — so a successful read means
// the caller is an owner and we skip logging.
export const runtime = "nodejs";

export async function POST(req: Request) {
  let token = "";
  try {
    const body = await req.json();
    token = String(body?.token || "");
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });

  // Is the caller an authenticated member of the quote's org (i.e. the owner)?
  let isOwner = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // RLS: a member can read their org's quote by token; an anon/non-member
      // gets nothing. A returned row therefore means this is an internal view.
      const { data } = await supabase
        .from("quote_docs")
        .select("id")
        .eq("public_token", token)
        .maybeSingle();
      isOwner = !!data;
    }
  } catch {
    // If the session lookup fails, fall through and treat it as a client open
    // (best-effort tracking; never block the public page).
  }

  if (isOwner) {
    // Owner/internal preview — do not record a client open or notify.
    return NextResponse.json({ ok: true, counted: false });
  }

  try {
    await logQuoteView(token, {
      userAgent: req.headers.get("user-agent") || undefined,
      referer: req.headers.get("referer") || undefined,
    });
  } catch (e: any) {
    console.error(`[quotes] track view failed: ${e?.message || e}`);
  }
  return NextResponse.json({ ok: true, counted: true });
}
