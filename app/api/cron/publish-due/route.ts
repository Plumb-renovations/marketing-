import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMetaConfig } from "@/lib/integrations/meta/config";
import { publishOrganic } from "@/lib/posts/publish";
import { advanceJob, type MediaJob } from "@/lib/media/jobs";

// Auto-publish due scheduled posts (the AI content calendar's go-live path) and
// nudge any in-flight video jobs to completion. Runs on a schedule (Vercel cron
// → see vercel.json) authenticated with CRON_SECRET; also callable by an authed
// user for a manual flush. Reuses the shared publishOrganic core + media_jobs.
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request, user: unknown): boolean {
  const secret = process.env.CRON_SECRET;
  if (user) return true; // signed-in member triggering a manual flush
  if (!secret) return false;
  const url = new URL(req.url);
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const key = url.searchParams.get("key") || req.headers.get("x-cron-secret") || bearer;
  return key === secret;
}

const PLATFORMS = ["facebook", "instagram"];

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!authorized(req, user)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const nowMin = new Date().toISOString().slice(0, 16); // matches scheduled_at 'YYYY-MM-DDTHH:mm'
  const out = { published: 0, failed: 0, processing: 0, advancedJobs: 0 };

  // 1) Due, approved posts that haven't gone out yet.
  let due: any[] = [];
  try {
    const { data } = await admin
      .from("posts")
      .select("*")
      .eq("status", "scheduled")
      .eq("auto_publish", true)
      .is("published_at", null)
      .lte("scheduled_at", nowMin)
      .limit(50);
    due = data || [];
  } catch (e) {
    console.error("[cron/publish-due] query failed:", (e as Error).message);
  }

  for (const p of due) {
    const orgId = p.org_id as string;
    const platforms = (Array.isArray(p.platforms) && p.platforms.length ? p.platforms : p.channels || []).filter((c: string) => PLATFORMS.includes(c));
    if (!platforms.length) continue;

    const config = await getMetaConfig(orgId);
    if (!config?.pageId) {
      await admin.from("posts").update({ status: "failed", platform_results: { error: "Meta not connected" } }).eq("id", p.id);
      out.failed++;
      continue;
    }

    const outcome = await publishOrganic(admin, orgId, config, {
      postId: p.id, caption: p.caption || "", imageUrl: p.image_url || null, videoUrl: p.video_url || null, platforms,
    });
    const anyPublished = Object.values(outcome.platform_results).some((r: any) => r.status === "published");
    const status = outcome.status === "published" ? "posted" : outcome.status === "processing" ? "processing" : anyPublished ? "posted" : "failed";
    await admin.from("posts").update({
      status,
      platform_results: outcome.platform_results,
      published_at: anyPublished ? new Date().toISOString() : null,
    }).eq("id", p.id);

    if (status === "posted") out.published++;
    else if (status === "processing") out.processing++;
    else out.failed++;
    console.log(`[cron/publish-due] post=${p.id} org=${orgId} → ${status}`);
  }

  // 2) Advance in-flight video jobs (no client is polling them in cron context).
  try {
    const { data: jobs } = await admin.from("media_jobs").select("*").eq("state", "processing").limit(50);
    for (const j of jobs || []) {
      await advanceJob(admin, (j as MediaJob).org_id, j as MediaJob);
      out.advancedJobs++;
    }
  } catch (e) {
    console.error("[cron/publish-due] job advance failed:", (e as Error).message);
  }

  return NextResponse.json({ ok: true, ...out });
}
