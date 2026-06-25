import type { MetaClient } from "./client";

// Meta video helpers. Videos are handed to Meta as a hosted URL (our public
// post-media bucket); Meta fetches + transcodes them asynchronously, so callers
// upload, then poll status until "ready" before attaching to an ad.

// Upload a video to the AD ACCOUNT (for ads). Returns the advideo id.
export async function uploadAdVideo(client: MetaClient, fileUrl: string, name?: string): Promise<string> {
  const r: any = await client.post(`${client.adAccountPath()}/advideos`, {
    file_url: fileUrl,
    ...(name ? { name } : {}),
  });
  const id = String(r?.id || "");
  if (!id) throw new Error("Meta didn't return a video id from /advideos.");
  return id;
}

export type VideoStatus = "processing" | "ready" | "error";

// Normalised processing status for an uploaded video (ad or page video).
export async function getVideoStatus(client: MetaClient, videoId: string): Promise<{ status: VideoStatus; detail?: string }> {
  const r: any = await client.get(`${videoId}`, { fields: "status" });
  // Graph returns either status.video_status, or a bare status string.
  const raw = String(r?.status?.video_status || r?.status || "processing").toLowerCase();
  if (raw === "ready") return { status: "ready" };
  if (raw === "error" || raw === "failed") return { status: "error", detail: r?.status?.error?.message };
  return { status: "processing", detail: r?.status?.processing_phase?.status };
}

// Upload a poster/first-frame (base64 data URL) as an ad image; returns its
// hash, used as the video creative's required thumbnail (video_data.image_hash).
export async function uploadAdImageDataUrl(client: MetaClient, dataUrl: string): Promise<string | undefined> {
  const base64 = (dataUrl || "").replace(/^data:[^;]+;base64,/, "");
  if (!base64) return undefined;
  const r: any = await client.post(`${client.adAccountPath()}/adimages`, { bytes: base64 });
  const images = r?.images || {};
  const k = Object.keys(images)[0];
  return k ? images[k]?.hash : undefined;
}

// Fallback thumbnail: the default frame Meta generated for an uploaded ad video.
export async function getAdVideoThumbnail(client: MetaClient, videoId: string): Promise<string | undefined> {
  try {
    const r: any = await client.get(`${videoId}/thumbnails`, {});
    const list = r?.data || [];
    const chosen = list.find((t: any) => t?.is_preferred) || list[0];
    return chosen?.uri ? String(chosen.uri) : undefined;
  } catch {
    return undefined;
  }
}
