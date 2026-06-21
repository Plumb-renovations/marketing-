import { metaClient, type MetaClient } from "./client";

// Subscribes the app to a Page's webhook fields so lead notifications actually
// flow. The OAuth connect flow grants the token + picks a Page, but Meta only
// delivers leadgen events once the app is added to the Page's `subscribed_apps`
// (with the `leadgen` field). This closes that gap.
//
// `subscribed_apps` needs a Page-scoped token; we derive one from the connected
// user/system token via /{page}?fields=access_token, falling back to the caller
// token if that read isn't permitted.

async function pageScopedClient(client: MetaClient, pageId: string): Promise<MetaClient> {
  try {
    const res: any = await client.get(`${pageId}`, { fields: "access_token" });
    if (res?.access_token) return metaClient({ token: res.access_token });
  } catch {
    // fall back to the caller's token (works for a page/system-user token w/ perms)
  }
  return client;
}

export async function subscribePageLeadgen(
  client: MetaClient,
  pageId: string,
): Promise<{ ok: boolean; via: "page_token" | "caller_token" }> {
  const pc = await pageScopedClient(client, pageId);
  await pc.post(`${pageId}/subscribed_apps`, { subscribed_fields: "leadgen" });
  return { ok: true, via: pc === client ? "caller_token" : "page_token" };
}

export async function getPageLeadgenSubscription(
  client: MetaClient,
  pageId: string,
): Promise<{ subscribed: boolean; apps: any[] }> {
  const pc = await pageScopedClient(client, pageId);
  const res: any = await pc.get(`${pageId}/subscribed_apps`);
  const apps: any[] = Array.isArray(res?.data) ? res.data : [];
  const subscribed = apps.some((a) => (a?.subscribed_fields || []).includes("leadgen"));
  return { subscribed, apps };
}
