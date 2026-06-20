import crypto from "crypto";
import { meta } from "../env";

// Thin Meta Graph API client. The access token is now supplied per call (per
// org) rather than read from a single env var — see metaClient() below. The app
// secret + Graph version still come from env, since every token belongs to the
// same Meta app. Tokens never leave the server.
const base = () => `https://graph.facebook.com/${meta.graphVersion}`;

// Raised when Meta rejects the token itself (expired / revoked / invalid), so
// callers + the UI can show a "reconnect" state instead of a generic failure.
export class MetaAuthError extends Error {
  code?: number;
  subcode?: number;
  constructor(message: string, code?: number, subcode?: number) {
    super(message);
    this.name = "MetaAuthError";
    this.code = code;
    this.subcode = subcode;
  }
}

function appSecretProof(token: string) {
  if (!meta.appSecret) return undefined;
  return crypto.createHmac("sha256", meta.appSecret).update(token).digest("hex");
}

// An OAuth/token problem (vs. a normal parameter error) — code 190, or the
// OAuthException type with a session/access-token subcode.
function isAuthError(error: any): boolean {
  if (!error) return false;
  if (Number(error.code) === 190) return true;
  if (error.type === "OAuthException" && [102, 463, 467, 492].includes(Number(error.error_subcode))) return true;
  return false;
}

async function call(
  token: string,
  method: "GET" | "POST",
  path: string,
  params: Record<string, any> = {},
) {
  if (!token) throw new MetaAuthError("No Meta access token for this org", 190);

  const search = new URLSearchParams();
  search.set("access_token", token);
  const proof = appSecretProof(token);
  if (proof) search.set("appsecret_proof", proof);

  let url = `${base()}/${path.replace(/^\//, "")}`;
  const init: RequestInit = { method };

  if (method === "GET") {
    for (const [k, v] of Object.entries(params)) {
      search.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    url += `?${search.toString()}`;
  } else {
    const form = new URLSearchParams(search);
    for (const [k, v] of Object.entries(params)) {
      form.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    init.body = form;
    init.headers = { "Content-Type": "application/x-www-form-urlencoded" };
  }

  const res = await fetch(url, init);
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const err = data?.error || {};
    const msg = err.message || `${res.status} ${res.statusText}`;
    if (isAuthError(err)) {
      throw new MetaAuthError(`Meta token rejected: ${msg}`, Number(err.code), Number(err.error_subcode));
    }
    throw new Error(`Meta Graph ${method} /${path} failed: ${msg}`);
  }
  return data;
}

// Credentials for one org's Meta connection.
export interface MetaCreds {
  token: string;
  adAccountId?: string; // digits only, no act_ prefix
  pageId?: string;
  igUserId?: string;
}

export interface MetaClient {
  get: (path: string, params?: Record<string, any>) => Promise<any>;
  post: (path: string, params?: Record<string, any>) => Promise<any>;
  adAccountPath: () => string;
  token: string;
  pageId?: string;
  igUserId?: string;
}

// Bind a token (+ account/page) into a small client used by the Meta libs.
export function metaClient(creds: MetaCreds): MetaClient {
  return {
    get: (path, params) => call(creds.token, "GET", path, params),
    post: (path, params) => call(creds.token, "POST", path, params),
    adAccountPath: () => `act_${creds.adAccountId}`,
    token: creds.token,
    pageId: creds.pageId,
    igUserId: creds.igUserId,
  };
}

// Verify the X-Hub-Signature-256 header on inbound webhooks.
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!meta.appSecret || !signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", meta.appSecret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
