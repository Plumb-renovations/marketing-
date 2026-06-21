import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link / email-OTP confirmation (SSR-safe). The email template points here
// with ?token_hash=...&type=...; we verify the token server-side, which sets the
// session cookies, then redirect into the app. Unlike PKCE code-exchange, this
// works even when the link is opened on a different device/browser.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/home";

  if (token_hash && type) {
    const supabase = await createClient();
    // Try the template's type first; fall back to the sibling email type so the
    // route works whether the template says type=email or type=magiclink.
    const candidates: EmailOtpType[] = [type, type === "email" ? "magiclink" : "email"];
    let lastError = "";
    for (const t of candidates) {
      const { error } = await supabase.auth.verifyOtp({ type: t, token_hash });
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      lastError = error.message;
    }
    console.error("[auth/confirm] verifyOtp failed:", lastError);
  } else {
    console.error("[auth/confirm] missing token_hash or type", { token_hash: !!token_hash, type });
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
