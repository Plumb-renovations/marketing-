import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getMetaConfig } from "@/lib/integrations/meta/config";
import { checkMessagingAccess } from "@/lib/inbox/access";

// Honest, LIVE messaging-access status for the inbox banner: is Meta connected,
// and does the token actually hold the messaging permissions + webhook needed to
// pull/reply to FB + IG messages? Never assumed — introspected each load.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const config = await getMetaConfig(orgId);
  if (!config) {
    return NextResponse.json({ connected: false, igLinked: false, access: null });
  }
  try {
    const access = await checkMessagingAccess(config);
    return NextResponse.json({ connected: true, igLinked: !!config.igUserId, access });
  } catch (e: any) {
    return NextResponse.json({ connected: true, igLinked: !!config.igUserId, access: null, error: e?.message });
  }
}
