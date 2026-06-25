import type { MetaClient } from "./client";

// Organic publishing to a Facebook Page.
//   - with an image: POST /{page-id}/photos with the public image URL + caption
//   - text only:     POST /{page-id}/feed with the message
// The client must be bound to a Page access token (see getPageClient).
export async function publishToFacebook(
  page: MetaClient,
  pageId: string,
  opts: { message: string; imageUrl?: string | null },
): Promise<{ id: string }> {
  if (opts.imageUrl) {
    const r: any = await page.post(`${pageId}/photos`, {
      url: opts.imageUrl,
      caption: opts.message || "",
      published: true,
    });
    return { id: String(r?.post_id || r?.id || "") };
  }
  const r: any = await page.post(`${pageId}/feed`, { message: opts.message });
  return { id: String(r?.id || "") };
}

// Organic Facebook Page VIDEO. Meta fetches file_url and transcodes async, so
// this kicks off the upload and returns the video id; poll its status (see
// getVideoStatus) until ready — the post then appears on the Page.
export async function publishVideoToFacebook(
  page: MetaClient,
  pageId: string,
  opts: { description: string; fileUrl: string },
): Promise<{ id: string }> {
  const r: any = await page.post(`${pageId}/videos`, {
    file_url: opts.fileUrl,
    description: opts.description || "",
  });
  const id = String(r?.id || "");
  if (!id) throw new Error("Facebook didn't return a video id. Please try again.");
  return { id };
}

// Turn a raw Graph error into a clearer, actionable message — especially the
// common missing-permission case — so failures aren't cryptic.
export function explainMetaError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("pages_manage_posts") || m.includes("(#200)") || m.includes("(#10)") || m.includes("permission")) {
    return "The Meta connection is missing the 'pages_manage_posts' permission needed to publish to your Page. Reconnect Meta and grant Page posting access.";
  }
  return message;
}
