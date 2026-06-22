import { NextResponse } from "next/server";
import { logQuoteView } from "@/lib/quotes/publicServer";

// Public open-tracking beacon. The /q/[token] page calls this once on load to
// record that the client opened the quote. No auth (the token is the secret);
// best-effort — always returns ok.
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

  try {
    await logQuoteView(token, {
      userAgent: req.headers.get("user-agent") || undefined,
      referer: req.headers.get("referer") || undefined,
    });
  } catch (e: any) {
    console.error(`[quotes] track view failed: ${e?.message || e}`);
  }
  return NextResponse.json({ ok: true });
}
