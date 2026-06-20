import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { saveGoogleBusinessIntegration } from "@/lib/integrations/google/config";

// Disconnects this org's Google Business Profile connection.
export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  await saveGoogleBusinessIntegration(orgId, {
    status: "disconnected",
    access_token: null,
    refresh_token: null,
    token_expires_at: null,
    details: {},
  });

  return NextResponse.json({ ok: true });
}
