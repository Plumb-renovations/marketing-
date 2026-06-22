import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { refreshCompetitorReviews } from "@/lib/competitors/reviews";

// On-demand refresh of the caller's "Why they're winning" snapshot (the Refresh
// button). Auth-gated; org-scoped via getOrgId.
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const result = await refreshCompetitorReviews(orgId);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
