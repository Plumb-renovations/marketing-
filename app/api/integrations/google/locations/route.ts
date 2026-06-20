import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getGoogleAccessToken, markGoogleBusinessExpired } from "@/lib/integrations/google/config";
import { listAccounts, listLocations, GoogleAuthError } from "@/lib/integrations/google/business";

// Lists the connected user's Business Profile locations so they can pick one.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const tok = await getGoogleAccessToken(orgId);
  if (!tok) return NextResponse.json({ error: "not_connected" }, { status: 412 });

  try {
    const accounts = await listAccounts(tok.accessToken);
    const locations: any[] = [];
    for (const acct of accounts) {
      const locs = await listLocations(tok.accessToken, acct.name);
      for (const l of locs) {
        locations.push({
          accountName: acct.name,
          locationName: l.name,
          locationId: l.locationId,
          title: l.title,
          address: l.address,
          placeId: l.placeId,
          reviewUri: l.reviewUri,
        });
      }
    }
    return NextResponse.json({ locations });
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      await markGoogleBusinessExpired(orgId);
      return NextResponse.json({ error: "reconnect_required" }, { status: 412 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
