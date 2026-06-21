import { metaClient, type MetaClient } from "./client";
import type { MetaConfig } from "./config";

// A metaClient bound to the PAGE access token derived from the org's token.
// Page feed/photos and Instagram content-publishing all require a Page-scoped
// token; we mint one from /{page-id}?fields=access_token using the org token,
// falling back to the org token if that read isn't permitted (some system-user
// setups can post directly).
export async function getPageClient(config: MetaConfig): Promise<MetaClient> {
  const base = metaClient(config);
  if (!config.pageId) return base;
  try {
    const res: any = await base.get(`${config.pageId}`, { fields: "access_token" });
    if (res?.access_token) {
      return metaClient({ token: res.access_token, pageId: config.pageId, igUserId: config.igUserId });
    }
  } catch {
    // fall back to the caller token
  }
  return base;
}
