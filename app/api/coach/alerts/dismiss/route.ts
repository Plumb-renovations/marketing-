import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { snoozeAlert } from "@/lib/coach/alerts";

// Snooze a proactive alert (default 7 days, so brutal truths re-surface rather
// than vanish). Auth-gated. Best-effort — never blocks the UI hiding it.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }
  const key = String(body?.key || "");
  if (!key) return NextResponse.json({ error: "missing_key" }, { status: 400 });
  const days = Number.isFinite(Number(body?.snoozeDays)) ? Number(body.snoozeDays) : 7;

  try {
    const orgId = await getOrgId(supabase);
    await snoozeAlert(supabase, orgId, key, days);
  } catch (e) {
    console.error("[coach/alerts/dismiss] failed:", (e as Error).message);
  }
  return NextResponse.json({ ok: true });
}
