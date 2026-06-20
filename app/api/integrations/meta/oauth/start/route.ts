import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { meta } from "@/lib/integrations/env";
import { metaAuthDialogUrl } from "@/lib/integrations/meta/oauth";

// Kicks off the Facebook Login for Business OAuth flow. Auth-gated; sets a
// short-lived signed state cookie (CSRF), then redirects to Meta's dialog.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  if (!meta.appId || !meta.appSecret) {
    return NextResponse.redirect(`${origin}/integrations?error=meta_app_not_configured`);
  }

  // Make sure the caller actually belongs to an org before sending them off.
  try {
    await getOrgId(supabase);
  } catch {
    return NextResponse.redirect(`${origin}/login`);
  }

  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(metaAuthDialogUrl(state));
  res.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
