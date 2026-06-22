import type { MetaClient } from "./client";

// Organic publishing to an Instagram Business/Creator account via the Instagram
// Graph API. Instagram processes media asynchronously, so the flow is:
//   1. resolve the IG user id from the connected Facebook Page
//   2. create a media container (image_url + caption)
//   3. poll the container until status_code = FINISHED
//   4. publish the container
// The client must be bound to the PAGE access token (see getPageClient) — the
// same token used for Facebook publishing.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const NO_IG_ACCOUNT =
  "No Instagram Business or Creator account is linked to your Facebook Page. Link one in Meta Business settings, then try again.";

// Step 1 — resolve the IG Business Account id from the Page. Absent → clear error.
export async function resolveInstagramUserId(page: MetaClient, pageId: string): Promise<string> {
  const res: any = await page.get(`${pageId}`, { fields: "instagram_business_account" });
  const id = res?.instagram_business_account?.id;
  if (!id) throw new Error(NO_IG_ACCOUNT);
  return String(id);
}

export async function publishToInstagram(
  page: MetaClient,
  pageId: string,
  opts: { caption: string; imageUrl: string },
): Promise<{ id: string }> {
  if (!opts.imageUrl) {
    throw new Error("Instagram needs an image. Add a photo to your post, then publish.");
  }

  // 1. IG user id from the Page.
  const igUserId = await resolveInstagramUserId(page, pageId);

  // 2. Create the media container.
  const container: any = await page.post(`${igUserId}/media`, {
    image_url: opts.imageUrl,
    caption: opts.caption || "",
  });
  const creationId = String(container?.id || "");
  if (!creationId) throw new Error("Instagram didn't return a media container id. Please try again.");

  // 3. Poll the container until processing finishes (~2s × up to 30s).
  const deadline = Date.now() + 30_000;
  let finished = false;
  while (Date.now() < deadline) {
    const st: any = await page.get(`${creationId}`, { fields: "status_code,status" });
    const code = String(st?.status_code || "");
    if (code === "FINISHED") {
      finished = true;
      break;
    }
    if (code === "ERROR" || code === "EXPIRED") {
      // Pass Instagram's own reason through (commonly a format/aspect-ratio reject).
      throw new Error(
        `Instagram couldn't process the image${st?.status ? `: ${st.status}` : ""}. It must be a JPG or PNG with an aspect ratio between 4:5 and 1.91:1.`,
      );
    }
    await sleep(2000);
  }
  if (!finished) {
    throw new Error("Instagram is still processing the image after 30 seconds. Please try publishing again in a moment.");
  }

  // 4. Publish the container.
  const pub: any = await page.post(`${igUserId}/media_publish`, { creation_id: creationId });
  const id = String(pub?.id || "");
  if (!id) throw new Error("Instagram didn't return a published media id. Please try again.");
  return { id };
}

// Turn a raw Graph error into a clearer, actionable message — especially the
// missing-permission case. Already-friendly messages (e.g. no linked account)
// pass straight through.
export function explainInstagramError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("instagram_content_publish") || m.includes("(#10)") || m.includes("(#200)") || m.includes("permission")) {
    return "The Meta connection is missing the 'instagram_content_publish' permission needed to publish to Instagram. Reconnect Meta and grant Instagram publishing access.";
  }
  return message;
}
