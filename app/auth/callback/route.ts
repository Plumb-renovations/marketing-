import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PKCE code-exchange — kept for OAuth (e.g. future Google sign-in). Email magic
// links use /auth/confirm (token_hash + verifyOtp) instead, which is SSR-safe
// and works across devices.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/leads";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  } else {
    console.error("[auth/callback] no code in callback");
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
