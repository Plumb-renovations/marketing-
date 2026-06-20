import { meta, app } from "../env";
import { metaClient } from "./client";

// Facebook Login for Business OAuth helpers. The connecting user grants the app
// the permissions below; we exchange the returned code for a long-lived user
// token, which is then stored per-org (server-only).
//
// These are the permissions the app actually uses:
//   - ads_management        — create campaigns/ad sets/creatives/ads, upload images
//   - leads_retrieval       — read leads delivered by the leadgen webhook
//   - pages_show_list       — list the user's Pages (to pick one)
//   - pages_manage_metadata — subscribe the app to the Page's leadgen webhook
export const META_SCOPES = [
  "ads_management",
  "leads_retrieval",
  "pages_show_list",
  "pages_manage_metadata",
];

const gv = () => meta.graphVersion;

export function metaRedirectUri(): string {
  return `${app.url.replace(/\/$/, "")}/api/integrations/meta/oauth/callback`;
}

// The login dialog URL. Uses a Login-for-Business configuration id when one is
// set (META_LOGIN_CONFIG_ID), else a scope-based dialog with the same perms.
export function metaAuthDialogUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: meta.appId || "",
    redirect_uri: metaRedirectUri(),
    state,
    response_type: "code",
  });
  if (meta.loginConfigId) {
    params.set("config_id", meta.loginConfigId);
  } else {
    params.set("scope", META_SCOPES.join(","));
  }
  return `https://www.facebook.com/${gv()}/dialog/oauth?${params.toString()}`;
}

interface TokenResult {
  token: string;
  expiresIn?: number; // seconds
}

async function tokenRequest(params: URLSearchParams): Promise<TokenResult> {
  const url = `https://graph.facebook.com/${gv()}/oauth/access_token?${params.toString()}`;
  const res = await fetch(url, { method: "GET" });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message || `token request failed (${res.status})`);
  }
  return { token: data.access_token, expiresIn: data.expires_in ? Number(data.expires_in) : undefined };
}

// Exchange the dialog `code` for a (short-lived) user access token.
export function exchangeCodeForToken(code: string): Promise<TokenResult> {
  return tokenRequest(
    new URLSearchParams({
      client_id: meta.appId || "",
      client_secret: meta.appSecret || "",
      redirect_uri: metaRedirectUri(),
      code,
    }),
  );
}

// Exchange a short-lived token for a long-lived (~60 day) user token. Also used
// to refresh a still-valid long-lived token (re-exchange extends the window).
export function exchangeForLongLivedToken(shortToken: string): Promise<TokenResult> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: meta.appId || "",
      client_secret: meta.appSecret || "",
      fb_exchange_token: shortToken,
    }),
  );
}

// The id/name of the user who authorised (for display + provenance).
export async function fetchMetaUser(token: string): Promise<{ id: string; name?: string }> {
  const me: any = await metaClient({ token }).get("me", { fields: "id,name" });
  return { id: String(me?.id || ""), name: me?.name };
}
