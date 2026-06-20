import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { saveMetaIntegration } from "@/lib/integrations/meta/config";
import {
  META_SCOPES,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchMetaUser,
} from "@/lib/integrations/meta/oauth";

// OAuth callback: validates state, exchanges the code for a long-lived token,
// stores it (status 'pending' until the user picks an ad account + Page), then
// returns to Settings → Integrations to finish the connection.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LONG_LIVED_SECONDS = 60 * 24 * 60 * 60; // ~60 days

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
    .find((c) => c.startsWith("meta_oauth_state="))
    ?.split("=")[1];

  if (oauthError) return back(`error=${encodeURIComponent(oauthError)}`);
  if (!code || !state || !cookieState || state !== cookieState) {
    return back("error=invalid_state");
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
    const short = await exchangeCodeForToken(code);
    const long = await exchangeForLongLivedToken(short.token);
    const expiresIn = long.expiresIn ?? DEFAULT_LONG_LIVED_SECONDS;
    const me = await fetchMetaUser(long.token);

    await saveMetaIntegration(orgId, {
      status: "pending", // becomes 'connected' once an account + Page are chosen
      access_token: long.token,
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      scopes: META_SCOPES,
      external_user_id: me.id || null,
      details: { userName: me.name ?? null },
      // Clear any stale selection from a previous connection.
      ad_account_id: null,
      page_id: null,
      ig_user_id: null,
      connected_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[meta-oauth] token exchange failed:", (e as Error).message);
    return back("error=token_exchange_failed");
  }

  const res = back("connected=1");
  res.cookies.delete("meta_oauth_state");
  return res;
}
