import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId } from "@/lib/data/org";
import { ORG_ID } from "@/lib/domain/seed";
import { getBusinessProfile } from "@/lib/business/profileServer";
import { buildCoachReport, buildWeeklyEmail } from "@/lib/coach/coach";
import { sendEmail, emailConfigured } from "@/lib/email/send";

// The weekly report: WHAT happened (facts) + Hazel's recommendations (the coach).
// Two ways in:
//   • an authed user (manual "email me this week's report" / preview), or
//   • a scheduled cron carrying CRON_SECRET (?key= or x-cron-secret header).
// ?send=1 emails it; otherwise it returns the built report for preview.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const send = url.searchParams.get("send") === "1";

  const cronSecret = process.env.CRON_SECRET;
  const key = url.searchParams.get("key") || req.headers.get("x-cron-secret");
  const isCron = !!cronSecret && key === cronSecret;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !isCron) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Cron runs without a user → service-role client + default org.
  const db = user ? supabase : createAdminClient();
  const orgId = user ? await getOrgId(supabase) : ORG_ID;

  try {
    const profile = await getBusinessProfile(orgId);
    const report = await buildCoachReport(db, orgId, profile);
    const email = buildWeeklyEmail(report, profile.businessName || "your business");

    let sent: { ok: boolean; to?: string; error?: string } | null = null;
    if (send) {
      // Recipient: explicit ?to=, else the authed user, else the staff alert email.
      let to = url.searchParams.get("to") || user?.email || "";
      if (!to) {
        try {
          const { data } = await db.from("lead_response_settings").select("staff_alert_email").eq("org_id", orgId).maybeSingle();
          to = (data as any)?.staff_alert_email || "";
        } catch { /* table may be absent */ }
      }
      if (!emailConfigured()) sent = { ok: false, error: "Email isn't configured (RESEND_API_KEY)." };
      else if (!to) sent = { ok: false, error: "No recipient — set a staff alert email in Speed to Lead, or pass ?to=." };
      else {
        try {
          await sendEmail(to, email.subject, email.text, { html: email.html, fromName: "Hazel" });
          sent = { ok: true, to };
          console.log(`[coach/weekly] sent org=${orgId} to=${to}`);
        } catch (e) {
          sent = { ok: false, to, error: (e as Error).message };
        }
      }
    }

    return NextResponse.json({ report, email: { subject: email.subject, text: email.text }, sent });
  } catch (e: any) {
    console.error("[coach/weekly] failed:", e?.message || e);
    return NextResponse.json({ error: "weekly_failed", message: e?.message || "Weekly report failed" }, { status: 502 });
  }
}
