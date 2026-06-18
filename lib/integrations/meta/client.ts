import crypto from "crypto";
import { meta } from "../env";

// Thin Meta Graph API client. Uses the long-lived System User token from env;
// the token never leaves the server.
const base = () => `https://graph.facebook.com/${meta.graphVersion}`;

function appSecretProof(token: string) {
  if (!meta.appSecret) return undefined;
  return crypto.createHmac("sha256", meta.appSecret).update(token).digest("hex");
}

async function call(method: "GET" | "POST", path: string, params: Record<string, any> = {}) {
  const token = meta.systemUserToken;
  if (!token) throw new Error("META_SYSTEM_USER_TOKEN is not set");

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
    const msg = data?.error?.message || `${res.status} ${res.statusText}`;
    throw new Error(`Meta Graph ${method} /${path} failed: ${msg}`);
  }
  return data;
}

export const graphGet = (path: string, params?: Record<string, any>) => call("GET", path, params);
export const graphPost = (path: string, params?: Record<string, any>) => call("POST", path, params);

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

export const adAccountPath = () => `act_${meta.adAccountId}`;
