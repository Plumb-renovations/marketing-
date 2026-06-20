import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getGoogleBusinessConfig, markGoogleBusinessExpired } from "@/lib/integrations/google/config";
import { listReviews, replyToReview } from "@/lib/integrations/google/reviews";
import { GoogleAuthError } from "@/lib/integrations/google/business";

// Reads (GET) and replies to (POST) the connected location's Google reviews.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const config = await getGoogleBusinessConfig(orgId);
  if (!config || !config.accountName || !config.locationName) {
    return NextResponse.json({ connected: false });
  }

  try {
    const data = await listReviews(config.accessToken, config.accountName, config.locationName);
    return NextResponse.json({ connected: true, reviewUri: config.reviewUri ?? null, ...data });
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      await markGoogleBusinessExpired(orgId);
      return NextResponse.json({ connected: false, error: "reconnect_required" }, { status: 412 });
    }
    return NextResponse.json({ connected: true, error: (e as Error).message }, { status: 502 });
  }
}

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
  const reviewName = String(body?.reviewName || "").trim();
  const comment = String(body?.comment || "").trim();
  if (!reviewName || !comment) return NextResponse.json({ error: "reviewName and comment required" }, { status: 400 });

  const orgId = await getOrgId(supabase);
  const config = await getGoogleBusinessConfig(orgId);
  if (!config) return NextResponse.json({ error: "not_connected" }, { status: 412 });

  try {
    await replyToReview(config.accessToken, reviewName, comment);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      await markGoogleBusinessExpired(orgId);
      return NextResponse.json({ error: "reconnect_required" }, { status: 412 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
