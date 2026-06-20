import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getGoogleBusinessRow } from "@/lib/integrations/google/config";
import { googleBusiness } from "@/lib/integrations/env";
import { ORG_ID as DEFAULT_ORG_ID } from "@/lib/domain/seed";

// Redacted Google Business Profile status for Settings → Integrations. Never
// returns the token.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const row = await getGoogleBusinessRow(orgId);

  if (row?.refresh_token && row.status !== "disconnected") {
    const d = row.details || {};
    return NextResponse.json({
      provider: "google_business",
      source: "org",
      status: row.status, // 'pending' | 'connected' | 'expired'
      title: d.title ?? null,
      address: d.address ?? null,
      locationName: d.locationName ?? null,
      reviewUri: d.reviewUri ?? null,
    });
  }

  // Default (Plumb) org env fallback.
  if (orgId === DEFAULT_ORG_ID && googleBusiness.refreshToken && googleBusiness.oauthConfigured) {
    return NextResponse.json({
      provider: "google_business",
      source: "system_user",
      status: "connected",
      locationName: googleBusiness.locationId ?? null,
    });
  }

  return NextResponse.json({ provider: "google_business", source: "none", status: "disconnected" });
}
