import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ID as DEFAULT_ORG_ID } from "@/lib/domain/seed";
import { googleBusiness } from "../env";
import { refreshGoogleToken } from "./oauth";

// Resolves a usable Google Business Profile access token for an org.
//   1. A connected/pending org_integrations row (the org's own connection) wins.
//   2. The DEFAULT (Plumb) org falls back to the env GBP refresh token.
// Google access tokens are short-lived, so we mint a fresh one from the stored
// refresh token whenever the cached access token is missing/expired, and persist
// the new access token back to the row.
const PROVIDER = "google_business";

export interface GoogleBusinessConfig {
  orgId: string;
  source: "org" | "env";
  accessToken: string;
  accountName?: string | null; // "accounts/123"
  locationName?: string | null; // "locations/456"
  locationId?: string | null;
  placeId?: string | null;
  reviewUri?: string | null;
  title?: string | null;
}

export async function getGoogleBusinessRow(orgId: string): Promise<any | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_integrations")
    .select("*")
    .eq("org_id", orgId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  return data ?? null;
}

export async function saveGoogleBusinessIntegration(orgId: string, patch: Record<string, any>): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("org_integrations")
    .upsert({ org_id: orgId, provider: PROVIDER, ...patch }, { onConflict: "org_id,provider" });
  if (error) throw error;
}

export async function markGoogleBusinessExpired(orgId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("org_integrations")
    .update({ status: "expired" })
    .eq("org_id", orgId)
    .eq("provider", PROVIDER)
    .neq("status", "disconnected");
}

function cachedTokenValid(row: any): boolean {
  return !!row?.access_token && !!row?.token_expires_at && new Date(row.token_expires_at).getTime() > Date.now() + 60_000;
}

// A fresh access token for the org, refreshing from the refresh token if needed.
// Returns null (and flags the row 'expired') when there's no usable connection.
export async function getGoogleAccessToken(orgId: string): Promise<{ accessToken: string; source: "org" | "env" } | null> {
  const row = await getGoogleBusinessRow(orgId);

  if (row?.refresh_token && row.status !== "disconnected") {
    if (cachedTokenValid(row)) return { accessToken: row.access_token, source: "org" };
    try {
      const t = await refreshGoogleToken(row.refresh_token);
      await saveGoogleBusinessIntegration(orgId, {
        access_token: t.accessToken,
        token_expires_at: new Date(Date.now() + (t.expiresIn ?? 3600) * 1000).toISOString(),
      });
      return { accessToken: t.accessToken, source: "org" };
    } catch {
      await markGoogleBusinessExpired(orgId);
      return null;
    }
  }

  // Env fallback for the default (Plumb) org.
  if (orgId === DEFAULT_ORG_ID && googleBusiness.refreshToken && googleBusiness.oauthConfigured) {
    try {
      const t = await refreshGoogleToken(googleBusiness.refreshToken);
      return { accessToken: t.accessToken, source: "env" };
    } catch {
      return null;
    }
  }

  return null;
}

// The full Business Profile config (token + chosen location), or null. Used by
// the reviews + review-request features once a location is selected.
export async function getGoogleBusinessConfig(orgId: string): Promise<GoogleBusinessConfig | null> {
  const row = await getGoogleBusinessRow(orgId);
  const tok = await getGoogleAccessToken(orgId);
  if (!tok) return null;

  if (tok.source === "org" && row?.details) {
    const d = row.details;
    if (!d.locationName) return null; // not finished picking a location
    return {
      orgId,
      source: "org",
      accessToken: tok.accessToken,
      accountName: d.accountName ?? null,
      locationName: d.locationName ?? null,
      locationId: d.locationId ?? null,
      placeId: d.placeId ?? null,
      reviewUri: d.reviewUri ?? null,
      title: d.title ?? null,
    };
  }

  if (tok.source === "env") {
    const accountName = normalize(googleBusiness.accountId, "accounts");
    const locationName = normalize(googleBusiness.locationId, "locations");
    if (!locationName) return null;
    return {
      orgId,
      source: "env",
      accessToken: tok.accessToken,
      accountName,
      locationName,
      locationId: locationName?.split("/").pop() ?? null,
      placeId: null,
      reviewUri: null,
      title: null,
    };
  }

  return null;
}

function normalize(value: string | undefined, prefix: string): string | null {
  if (!value) return null;
  return value.includes("/") ? value : `${prefix}/${value}`;
}
