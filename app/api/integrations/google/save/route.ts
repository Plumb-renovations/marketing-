import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getGoogleBusinessRow, saveGoogleBusinessIntegration } from "@/lib/integrations/google/config";

// Saves the chosen Business Profile location, completing the connection.
export const runtime = "nodejs";

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

  const accountName = String(body?.accountName || "").trim();
  const locationName = String(body?.locationName || "").trim();
  if (!accountName || !locationName) {
    return NextResponse.json({ error: "a location is required" }, { status: 400 });
  }

  const orgId = await getOrgId(supabase);
  const row = await getGoogleBusinessRow(orgId);
  if (!row?.refresh_token) {
    return NextResponse.json({ error: "not_connected" }, { status: 412 });
  }

  await saveGoogleBusinessIntegration(orgId, {
    status: "connected",
    details: {
      ...(row.details || {}),
      accountName,
      locationName,
      locationId: body?.locationId ? String(body.locationId) : locationName.split("/").pop(),
      title: body?.title ?? null,
      placeId: body?.placeId ?? null,
      reviewUri: body?.reviewUri ?? null,
      address: body?.address ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
