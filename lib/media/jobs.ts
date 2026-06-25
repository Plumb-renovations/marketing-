import type { SupabaseClient } from "@supabase/supabase-js";
import { getMetaConfig, markMetaExpired } from "@/lib/integrations/meta/config";
import { metaClient, MetaAuthError } from "@/lib/integrations/meta/client";
import { getPageClient } from "@/lib/integrations/meta/page";
import { getVideoStatus } from "@/lib/integrations/meta/video";
import {
  resolveInstagramUserId,
  createInstagramReelContainer,
  getContainerStatus,
  publishInstagramContainer,
  explainInstagramError,
} from "@/lib/integrations/meta/publishInstagram";
import { finishMetaVideoAd, type VideoAdContext } from "@/lib/integrations/meta/publish";

// Drives the async video publish flow (Meta video ads + IG Reels + FB Page
// video). A job is created once we've handed Meta the video URL; the client then
// polls /api/media-jobs/{id}, which advances this state machine one step per
// call until the media is published or fails. Everything needed to finish lives
// in `config`, so advancing is stateless across requests.

export type JobKind = "fb" | "ig" | "ad";
export type JobState = "processing" | "published" | "failed";

export interface MediaJob {
  id: string;
  org_id: string;
  kind: JobKind;
  state: JobState;
  video_id: string | null;
  container_id: string | null;
  result_id: string | null;
  config: any;
  error: string | null;
  attempts: number;
}

export async function createJob(
  supabase: SupabaseClient,
  orgId: string,
  fields: { kind: JobKind; video_id?: string | null; container_id?: string | null; config?: any },
): Promise<MediaJob> {
  const { data, error } = await supabase
    .from("media_jobs")
    .insert({
      org_id: orgId,
      kind: fields.kind,
      state: "processing",
      video_id: fields.video_id ?? null,
      container_id: fields.container_id ?? null,
      config: fields.config ?? {},
    })
    .select("*")
    .single();
  if (error) throw new Error(`Couldn't create media job: ${error.message}`);
  return data as MediaJob;
}

export async function getJob(supabase: SupabaseClient, orgId: string, id: string): Promise<MediaJob | null> {
  const { data } = await supabase.from("media_jobs").select("*").eq("org_id", orgId).eq("id", id).maybeSingle();
  return (data as MediaJob) || null;
}

async function patch(supabase: SupabaseClient, job: MediaJob, fields: Partial<MediaJob>): Promise<MediaJob> {
  const next = { ...fields, attempts: (job.attempts || 0) + 1 };
  const { data } = await supabase.from("media_jobs").update(next).eq("id", job.id).select("*").single();
  return (data as MediaJob) || { ...job, ...next };
}

const failed = (supabase: SupabaseClient, job: MediaJob, error: string) =>
  patch(supabase, job, { state: "failed", error });

const published = (supabase: SupabaseClient, job: MediaJob, resultId: string) =>
  patch(supabase, job, { state: "published", result_id: resultId, error: null });

// Update the parent post's per-platform result (best-effort; organic only).
async function recordPostResult(supabase: SupabaseClient, job: MediaJob, result: any) {
  const postId = job.config?.postId;
  const platform = job.config?.platform;
  if (!postId || !platform) return;
  try {
    const { data: row } = await supabase.from("posts").select("platform_results").eq("id", postId).maybeSingle();
    const results = { ...(row?.platform_results || {}), [platform]: result };
    const anyPublished = Object.values(results).some((r: any) => r?.status === "published");
    await supabase
      .from("posts")
      .update({
        platform_results: results,
        status: anyPublished ? "published" : "failed",
        ...(result.status === "published" ? { published_at: new Date().toISOString() } : {}),
      })
      .eq("id", postId);
  } catch {
    /* best-effort */
  }
}

// Advance one step. Safe to call repeatedly; a no-op once terminal.
export async function advanceJob(supabase: SupabaseClient, orgId: string, job: MediaJob): Promise<MediaJob> {
  if (job.state !== "processing") return job;

  const config = await getMetaConfig(orgId);
  if (!config) return failed(supabase, job, "Meta isn't connected. Connect it in Settings → Integrations.");

  try {
    if (job.kind === "fb") {
      const page = await getPageClient(config);
      const s = await getVideoStatus(page, job.video_id!);
      if (s.status === "ready") {
        await recordPostResult(supabase, job, { status: "published", id: job.video_id });
        return published(supabase, job, job.video_id!);
      }
      if (s.status === "error") {
        await recordPostResult(supabase, job, { status: "failed", error: "Facebook couldn't process the video." });
        return failed(supabase, job, "Facebook couldn't process the video.");
      }
      return patch(supabase, job, {}); // still processing
    }

    if (job.kind === "ig") {
      const page = await getPageClient(config);
      const igUserId = job.config?.igUserId || (config.pageId ? await resolveInstagramUserId(page, config.pageId) : "");
      if (!igUserId) return failed(supabase, job, "No linked Instagram account.");

      if (!job.container_id) {
        const cid = await createInstagramReelContainer(page, igUserId, {
          videoUrl: job.config?.videoUrl,
          caption: job.config?.caption || "",
        });
        return patch(supabase, job, { container_id: cid });
      }
      const code = await getContainerStatus(page, job.container_id);
      if (code === "FINISHED") {
        const r = await publishInstagramContainer(page, igUserId, job.container_id);
        await recordPostResult(supabase, job, { status: "published", id: r.id });
        return published(supabase, job, r.id);
      }
      if (code === "ERROR" || code === "EXPIRED") {
        const msg = "Instagram couldn't process the video. Reels must be MP4/MOV, 3–90s, aspect ratio between 0.01:1 and 10:1.";
        await recordPostResult(supabase, job, { status: "failed", error: msg });
        return failed(supabase, job, msg);
      }
      return patch(supabase, job, {}); // still processing
    }

    if (job.kind === "ad") {
      const client = metaClient(config);
      const ctx = job.config as VideoAdContext & { localAdId?: string };
      const s = await getVideoStatus(client, job.video_id!);
      if (s.status === "ready") {
        const { externalAdId, externalCreativeId } = await finishMetaVideoAd(client, ctx);
        // Flip the local draft live (when launching) + best-effort audit row.
        if (ctx.localAdId && ctx.mode === "launch") {
          await supabase.from("ads").update({ status: "live" }).eq("id", ctx.localAdId);
        }
        try {
          await supabase.from("published_ads").insert({
            org_id: orgId,
            ad_id: ctx.localAdId ?? null,
            platform: "meta",
            external_campaign_id: ctx.externalCampaignId,
            external_adset_id: ctx.externalAdsetId,
            external_ad_id: externalAdId,
            external_creative_id: externalCreativeId,
            status: ctx.mode === "launch" ? "active" : "paused",
            request: { campaignName: ctx.campaignName, mode: ctx.mode, media: "video" },
            response: { ids: { externalAdId, externalCreativeId, videoId: ctx.videoId } },
          });
        } catch {
          /* published_ads not migrated — fine */
        }
        return published(supabase, job, externalAdId);
      }
      if (s.status === "error") return failed(supabase, job, "Meta couldn't process the ad video.");
      return patch(supabase, job, {}); // still processing
    }

    return job;
  } catch (e) {
    if (e instanceof MetaAuthError) {
      await markMetaExpired(orgId);
      return failed(supabase, job, "Your Meta connection expired. Reconnect it in Settings → Integrations.");
    }
    const msg = job.kind === "ig" ? explainInstagramError((e as Error).message) : (e as Error).message;
    return failed(supabase, job, msg);
  }
}
