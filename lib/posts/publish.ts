import type { SupabaseClient } from "@supabase/supabase-js";
import { markMetaExpired, type MetaConfig } from "@/lib/integrations/meta/config";
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

// Shared organic publish core — FB Page + Instagram, image / text / video.
// Returns per-platform results WITHOUT touching the posts table, so callers
// decide whether to INSERT a new row (manual "publish now") or UPDATE an
// existing calendar row (scheduled auto-publish). Reuses the media_jobs async
// flow for video. Channel-agnostic shape (extendable beyond Meta later).

export type PublishResultItem = { status: "published" | "failed" | "pending" | "processing"; id?: string; jobId?: string; error?: string; note?: string };
export interface PublishOutcome {
  status: "published" | "failed" | "pending" | "processing";
  platform_results: Record<string, PublishResultItem>;
}

export async function publishOrganic(
  supabase: SupabaseClient,
  orgId: string,
  config: MetaConfig,
  opts: { postId: string; caption: string; imageUrl?: string | null; videoUrl?: string | null; platforms: string[] },
): Promise<PublishOutcome> {
  const { postId, caption, imageUrl = null, videoUrl = null, platforms } = opts;
  const pageId = config.pageId!;
  const platform_results: Record<string, PublishResultItem> = {};

  // ---- Video: kick the async upload→process→publish flow (media_jobs) ----
  if (videoUrl) {
    let page: Awaited<ReturnType<typeof getPageClient>> | null = null;
    try { page = await getPageClient(config); } catch { /* per-platform below */ }
    for (const platform of platforms) {
      try {
        if (!page) throw new Error("Couldn't get a Meta Page token. Reconnect Meta in Settings → Integrations.");
        if (platform === "facebook") {
          const r = await publishVideoToFacebook(page, pageId, { description: caption, fileUrl: videoUrl });
          const job = await createJob(supabase, orgId, { kind: "fb", video_id: r.id, config: { postId, platform } });
          platform_results.facebook = { status: "processing", jobId: job.id, note: "Facebook is processing your video…" };
        } else if (platform === "instagram") {
          const igUserId = await resolveInstagramUserId(page, pageId);
          const cid = await createInstagramReelContainer(page, igUserId, { videoUrl, caption });
          const job = await createJob(supabase, orgId, { kind: "ig", container_id: cid, config: { postId, platform, igUserId, videoUrl, caption } });
          platform_results.instagram = { status: "processing", jobId: job.id, note: "Instagram is processing your Reel…" };
        }
      } catch (e) {
        if (e instanceof MetaAuthError) { await markMetaExpired(orgId); platform_results[platform] = { status: "failed", error: "Meta connection expired — reconnect in Settings → Integrations." }; }
        else platform_results[platform] = { status: "failed", error: platform === "instagram" ? explainInstagramError((e as Error).message) : explainMetaError((e as Error).message) };
      }
    }
    return { status: "processing", platform_results };
  }

  // ---- Image / text (immediate) ----
  if (platforms.includes("facebook")) {
    try {
      const page = await getPageClient(config);
      const r = await publishToFacebook(page, pageId, { message: caption, imageUrl });
      platform_results.facebook = { status: "published", id: r.id };
    } catch (e) {
      if (e instanceof MetaAuthError) { await markMetaExpired(orgId); platform_results.facebook = { status: "failed", error: "Meta connection expired — reconnect in Settings → Integrations." }; }
      else platform_results.facebook = { status: "failed", error: explainMetaError((e as Error).message) };
    }
  }
  if (platforms.includes("instagram")) {
    if (!imageUrl) {
      platform_results.instagram = { status: "failed", error: "Instagram needs an image. Add a photo to this post." };
    } else {
      try {
        const page = await getPageClient(config);
        const r = await publishToInstagram(page, pageId, { caption, imageUrl });
        platform_results.instagram = { status: "published", id: r.id };
      } catch (e) {
        if (e instanceof MetaAuthError) { await markMetaExpired(orgId); platform_results.instagram = { status: "failed", error: "Meta connection expired — reconnect in Settings → Integrations." }; }
        else platform_results.instagram = { status: "failed", error: explainInstagramError((e as Error).message) };
      }
    }
  }

  const results = Object.values(platform_results);
  const status = results.some((r) => r.status === "published") ? "published" : results.some((r) => r.status === "failed") ? "failed" : "pending";
  return { status, platform_results };
}
