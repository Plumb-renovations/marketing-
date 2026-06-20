import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { saveMetaIntegration } from "@/lib/integrations/meta/config";

// Disconnects this org's Meta connection: clears the token + selection so Meta
// calls fall back to "not connected" (the default Plumb org reverts to env).
export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  await saveMetaIntegration(orgId, {
    status: "disconnected",
    access_token: null,
    token_expires_at: null,
    ad_account_id: null,
    page_id: null,
    ig_user_id: null,
  });

  return NextResponse.json({ ok: true });
}
