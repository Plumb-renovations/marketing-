import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId } from "@/lib/data/org";
import { getMetaConfig } from "@/lib/integrations/meta/config";
import { publishOrganic } from "@/lib/posts/publish";

// Publish an organic social post NOW — to the Facebook Page and/or the linked
// Instagram account. Delegates to the shared publishOrganic core (same one the
// auto-publish cron uses) and records a fresh post row. Org-scoped; logs under
// `[social]`.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const caption = String(body?.caption || "").trim();
  const imageUrl = body?.imageUrl ? String(body.imageUrl) : null;
  const videoUrl = body?.videoUrl ? String(body.videoUrl) : null;
  const platforms: string[] = Array.isArray(body?.platforms) ? body.platforms.map(String) : [];

  if (!platforms.length) return NextResponse.json({ error: "no_platform", message: "Select Facebook or Instagram." }, { status: 400 });
  if (!caption && !imageUrl && !videoUrl) return NextResponse.json({ error: "empty", message: "Add a caption, image or video." }, { status: 400 });

  const orgId = await getOrgId(supabase);
  const config = await getMetaConfig(orgId);
  if (!config?.pageId) {
    return NextResponse.json({ error: "meta_not_connected", message: "Connect a Meta Page in Settings → Integrations first." }, { status: 412 });
  }

  const id = "post-" + crypto.randomUUID();
  const outcome = await publishOrganic(supabase, orgId, config, { postId: id, caption, imageUrl, videoUrl, platforms });
  const anyPublished = Object.values(outcome.platform_results).some((r) => r.status === "published");

  // Record the post (service role; org-scoped). channels mirrors platforms so
  // the Calendar shows it.
  const admin = createAdminClient();
  const { error: insErr } = await admin.from("posts").insert({
    id,
    org_id: orgId,
    caption,
    image_url: imageUrl,
    video_url: videoUrl,
    media_type: videoUrl ? "video" : "image",
    channels: platforms,
    platforms,
    status: outcome.status,
    published_at: anyPublished ? new Date().toISOString() : null,
    platform_results: outcome.platform_results,
  });
  if (insErr) console.error(`[social] post record insert failed org=${orgId} post=${id}: ${insErr.message}`);

  console.log(`[social] publish org=${orgId} post=${id} status=${outcome.status} ${JSON.stringify(Object.keys(outcome.platform_results))}`);
  return NextResponse.json(
    { ok: anyPublished || outcome.status === "processing", id, status: outcome.status, platform_results: outcome.platform_results },
    { status: anyPublished || outcome.status === "processing" ? 200 : 502 },
  );
}
