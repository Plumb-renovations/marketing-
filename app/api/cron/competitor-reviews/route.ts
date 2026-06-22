import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { app } from "@/lib/integrations/env";
import { refreshCompetitorReviews } from "@/lib/competitors/reviews";

// Weekly refresh of every org's "Why they're winning" snapshot. Triggered by
// Vercel Cron (see vercel.json) and guarded by CRON_SECRET. Refreshes only orgs
// that have a Business Profile (so it knows the trade + area to search).
export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  if (!app.cronSecret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${app.cronSecret}`) return true;
  const secret = new URL(req.url).searchParams.get("secret");
  return secret === app.cronSecret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: orgs, error } = await admin.from("business_profiles").select("org_id");
  if (error) return NextResponse.json({ error: "db_error", message: error.message }, { status: 502 });

  const ids = (orgs || []).map((o: any) => o.org_id);
  let ok = 0;
  let failed = 0;
  for (const orgId of ids) {
    const r = await refreshCompetitorReviews(orgId);
    r.ok ? ok++ : failed++;
  }
  console.log(`[cron/competitor-reviews] done orgs=${ids.length} ok=${ok} failed=${failed}`);
  return NextResponse.json({ ok: true, orgs: ids.length, refreshed: ok, failed });
}
