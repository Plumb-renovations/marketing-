import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId } from "@/lib/data/org";
import { getMetaConfig, markMetaExpired } from "@/lib/integrations/meta/config";
import { MetaAuthError } from "@/lib/integrations/meta/client";
import { getPageClient } from "@/lib/integrations/meta/page";
import { publishToFacebook, publishVideoToFacebook, explainMetaError } from "@/lib/integrations/meta/publishPost";
import {
  publishToInstagram,
  resolveInstagramUserId,
  createInstagramReelContainer,
  explainInstagramError,
} from "@/lib/integrations/meta/publishInstagram";
import { createJob } from "@/lib/media/jobs";

// Publish an organic social post now — to the Facebook Page and/or the linked
// Instagram Business account. Each platform publishes independently so one
// failure never blocks the other. Org-scoped; every attempt is logged (see
// Vercel logs, filter `[social]`).
export const runtime = "nodejs";
export const maxDuration = 60;

type Result = { status: "published" | "failed" | "pending" | "processing"; id?: string; jobId?: string; error?: string; note?: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const caption = String(body?.caption || "").trim();
  const imageUrl = body?.imageUrl ? String(body.imageUrl) : null;
  const videoUrl = body?.videoUrl ? String(body.videoUrl) : null;
  const isVideo = !!videoUrl;
  const platforms: string[] = Array.isArray(body?.platforms) ? body.platforms.map(String) : [];

  if (!platforms.length) return NextResponse.json({ error: "no_platform", message: "Select Facebook or Instagram." }, { status: 400 });
  if (!caption && !imageUrl && !videoUrl) return NextResponse.json({ error: "empty", message: "Add a caption, image or video." }, { status: 400 });

  const orgId = await getOrgId(supabase);
  const config = await getMetaConfig(orgId);
  if (!config?.pageId) {
    return NextResponse.json(
      { error: "meta_not_connected", message: "Connect a Meta Page in Settings → Integrations first." },
      { status: 412 },
    );
  }

  // ---- Video: kick the async upload→process→publish flow, return jobs ----
  // FB Page video + IG Reels both process at Meta after we hand off the URL; the
  // client polls the returned jobIds. (Reuses the same media URL via file_url /
  // video_url — no re-upload.)
  if (isVideo) {
    const id = "post-" + crypto.randomUUID();
    const platform_results: Record<string, Result> = {};
    let page: Awaited<ReturnType<typeof getPageClient>> | null = null;
    try {
      page = await getPageClient(config);
    } catch {
      /* per-platform failure recorded below */
    }

    for (const platform of platforms) {
      try {
        if (!page) throw new Error("Couldn't get a Meta Page token. Reconnect Meta in Settings → Integrations.");
        if (platform === "facebook") {
          const r = await publishVideoToFacebook(page, config.pageId, { description: caption, fileUrl: videoUrl! });
          const job = await createJob(supabase, orgId, { kind: "fb", video_id: r.id, config: { postId: id, platform } });
          platform_results.facebook = { status: "processing", jobId: job.id, note: "Facebook is processing your video…" };
          console.log(`[social] facebook video kicked org=${orgId} post=${id} videoId=${r.id} job=${job.id}`);
        } else if (platform === "instagram") {
          const igUserId = await resolveInstagramUserId(page, config.pageId);
          const cid = await createInstagramReelContainer(page, igUserId, { videoUrl: videoUrl!, caption });
          const job = await createJob(supabase, orgId, { kind: "ig", container_id: cid, config: { postId: id, platform, igUserId, videoUrl, caption } });
          platform_results.instagram = { status: "processing", jobId: job.id, note: "Instagram is processing your Reel…" };
          console.log(`[social] instagram reel kicked org=${orgId} post=${id} container=${cid} job=${job.id}`);
        }
      } catch (e) {
        if (e instanceof MetaAuthError) {
          await markMetaExpired(orgId);
          platform_results[platform] = { status: "failed", error: "Meta connection expired — reconnect in Settings → Integrations." };
        } else {
          platform_results[platform] = {
            status: "failed",
            error: platform === "instagram" ? explainInstagramError((e as Error).message) : explainMetaError((e as Error).message),
          };
        }
        console.error(`[social] ${platform} video kick FAILED org=${orgId} post=${id}: ${(e as Error).message}`);
      }
    }

    const admin = createAdminClient();
    const { error: insErr } = await admin.from("posts").insert({
      id,
      org_id: orgId,
      caption,
      image_url: null,
      video_url: videoUrl,
      media_type: "video",
      channels: platforms,
      platforms,
      status: "processing",
      platform_results,
    });
    if (insErr) console.error(`[social] video post record insert failed org=${orgId} post=${id}: ${insErr.message}`);

    return NextResponse.json({ ok: true, id, status: "processing", platform_results });
  }

  const id = "post-" + crypto.randomUUID();
  const platform_results: Record<string, Result> = {};

  // --- Facebook (now) ---
  if (platforms.includes("facebook")) {
    try {
      const page = await getPageClient(config);
      const r = await publishToFacebook(page, config.pageId, { message: caption, imageUrl });
      platform_results.facebook = { status: "published", id: r.id };
      console.log(`[social] facebook published org=${orgId} post=${id} fbId=${r.id} image=${imageUrl ? "yes" : "no"}`);
    } catch (e) {
      if (e instanceof MetaAuthError) {
        await markMetaExpired(orgId);
        platform_results.facebook = { status: "failed", error: "Meta connection expired — reconnect in Settings → Integrations." };
      } else {
        platform_results.facebook = { status: "failed", error: explainMetaError((e as Error).message) };
      }
      console.error(`[social] facebook publish FAILED org=${orgId} post=${id}: ${(e as Error).message}`);
    }
  }

  // --- Instagram (now) ---
  if (platforms.includes("instagram")) {
    if (!imageUrl) {
      // Instagram has no text-only post — an image is required.
      platform_results.instagram = { status: "failed", error: "Instagram needs an image. Add a photo to your post, then publish." };
      console.warn(`[social] instagram skipped (no image) org=${orgId} post=${id}`);
    } else {
      try {
        const page = await getPageClient(config);
        const r = await publishToInstagram(page, config.pageId, { caption, imageUrl });
        platform_results.instagram = { status: "published", id: r.id };
        console.log(`[social] instagram published org=${orgId} post=${id} igId=${r.id}`);
      } catch (e) {
        if (e instanceof MetaAuthError) {
          await markMetaExpired(orgId);
          platform_results.instagram = { status: "failed", error: "Meta connection expired — reconnect in Settings → Integrations." };
        } else {
          platform_results.instagram = { status: "failed", error: explainInstagramError((e as Error).message) };
        }
        console.error(`[social] instagram publish FAILED org=${orgId} post=${id}: ${(e as Error).message}`);
      }
    }
  }

  const results = Object.values(platform_results);
  const anyPublished = results.some((r) => r.status === "published");
  const anyFailed = results.some((r) => r.status === "failed");
  const status = anyPublished ? "published" : anyFailed ? "failed" : "pending";

  // Record the post (service role; org-scoped). channels mirrors platforms so the
  // existing Calendar UI shows it.
  const admin = createAdminClient();
  const { error: insErr } = await admin.from("posts").insert({
    id,
    org_id: orgId,
    caption,
    image_url: imageUrl,
    channels: platforms,
    platforms,
    status,
    published_at: anyPublished ? new Date().toISOString() : null,
    platform_results,
  });
  if (insErr) console.error(`[social] post record insert failed org=${orgId} post=${id}: ${insErr.message}`);

  // 200 when anything published; 502 when every selected platform failed.
  return NextResponse.json(
    { ok: anyPublished, id, status, platform_results },
    { status: anyPublished ? 200 : anyFailed ? 502 : 200 },
  );
}
