import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { googleBusiness } from "@/lib/integrations/env";
import { googleAuthUrl } from "@/lib/integrations/google/oauth";

// Starts Google Business Profile OAuth (business.manage). Auth-gated; sets a
// short-lived CSRF state cookie, then redirects to Google's consent screen.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  if (!googleBusiness.oauthConfigured) {
    return NextResponse.redirect(`${origin}/integrations?google_error=google_app_not_configured`);
  }

  try {
    await getOrgId(supabase);
  } catch {
    return NextResponse.redirect(`${origin}/login`);
  }

  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(googleAuthUrl(state));
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
