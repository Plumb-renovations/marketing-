import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { saveGoogleBusinessIntegration } from "@/lib/integrations/google/config";
import { GOOGLE_BUSINESS_SCOPE, exchangeGoogleCode } from "@/lib/integrations/google/oauth";

// OAuth callback: validate state, exchange the code for access + refresh tokens,
// store them (status 'pending' until a location is chosen), then return to
// Settings → Integrations to finish.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const back = (q: string) => NextResponse.redirect(`${origin}/integrations?${q}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const cookieState = req.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith("google_oauth_state="))
    ?.split("=")[1];

  if (oauthError) return back(`google_error=${encodeURIComponent(oauthError)}`);
  if (!code || !state || !cookieState || state !== cookieState) {
    return back("google_error=invalid_state");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  let orgId: string;
  try {
    orgId = await getOrgId(supabase);
  } catch {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const t = await exchangeGoogleCode(code);
    if (!t.refreshToken) {
      // Google only returns a refresh token on first consent; prompt=consent
      // should force it. If missing, ask the user to reconnect.
      return back("google_error=no_refresh_token");
    }
    await saveGoogleBusinessIntegration(orgId, {
      status: "pending",
      refresh_token: t.refreshToken,
      access_token: t.accessToken,
      token_expires_at: new Date(Date.now() + (t.expiresIn ?? 3600) * 1000).toISOString(),
      scopes: [GOOGLE_BUSINESS_SCOPE],
      // Clear any stale selection from a previous connection.
      details: {},
      connected_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[google-oauth] token exchange failed:", (e as Error).message);
    return back("google_error=token_exchange_failed");
  }

  const res = back("google_connected=1");
  res.cookies.delete("google_oauth_state");
  return res;
}
