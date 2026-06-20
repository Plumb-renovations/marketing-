import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ID as DEFAULT_ORG_ID } from "@/lib/domain/seed";
import { meta } from "../env";
import type { MetaCreds } from "./client";

// Resolves the Meta credentials to use for a given org.
//
//   1. A connected org_integrations row (the user's own connected account) wins.
//   2. Otherwise, the DEFAULT (Plumb) org falls back to the env System-User
//      values, so the existing live setup keeps working with no DB row.
//
// Tokens are read with the service-role admin client (server-only).

export interface MetaConfig extends MetaCreds {
  orgId: string;
  source: "org" | "env";
}

function rowToConfig(row: any): MetaConfig {
  return {
    orgId: row.org_id,
    source: "org",
    token: row.access_token,
    adAccountId: row.ad_account_id || undefined,
    pageId: row.page_id || undefined,
    igUserId: row.ig_user_id || undefined,
  };
}

function envConfig(orgId: string): MetaConfig | null {
  if (!meta.systemUserToken) return null;
  return {
    orgId,
    source: "env",
    token: meta.systemUserToken,
    adAccountId: meta.adAccountId,
    pageId: meta.pageId,
    igUserId: meta.igUserId,
  };
}

function isExpired(row: any): boolean {
  return !!row.token_expires_at && new Date(row.token_expires_at).getTime() < Date.now();
}

// The Meta config for an org, or null if it has no usable connection.
export async function getMetaConfig(orgId: string): Promise<MetaConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_integrations")
    .select("*")
    .eq("org_id", orgId)
    .eq("provider", "meta")
    .maybeSingle();

  if (data?.access_token && data.status === "connected" && !isExpired(data)) {
    return rowToConfig(data);
  }

  // No usable org connection → env fallback for the default (Plumb) org only.
  if (orgId === DEFAULT_ORG_ID) return envConfig(orgId);
  return null;
}

// Route an inbound webhook (which carries a Page id) to the owning org's config.
// Falls back to the default org's env config so the existing Plumb webhook works.
export async function getMetaConfigForPage(
  pageId?: string,
): Promise<MetaConfig | null> {
  if (pageId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("org_integrations")
      .select("*")
      .eq("provider", "meta")
      .eq("page_id", pageId)
      .eq("status", "connected")
      .maybeSingle();
    if (data?.access_token && !isExpired(data)) return rowToConfig(data);
  }
  return getMetaConfig(DEFAULT_ORG_ID);
}

// Raw integration row for an org (server-only; includes the token). Used by the
// OAuth/status/picker routes — never returned to the browser verbatim.
export async function getMetaIntegrationRow(orgId: string): Promise<any | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_integrations")
    .select("*")
    .eq("org_id", orgId)
    .eq("provider", "meta")
    .maybeSingle();
  return data ?? null;
}

// Create/update an org's Meta integration row.
export async function saveMetaIntegration(orgId: string, patch: Record<string, any>): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("org_integrations")
    .upsert({ org_id: orgId, provider: "meta", ...patch }, { onConflict: "org_id,provider" });
  if (error) throw error;
}

// Mark an org's Meta connection as expired (called when a token is rejected).
export async function markMetaExpired(orgId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("org_integrations")
    .update({ status: "expired" })
    .eq("org_id", orgId)
    .eq("provider", "meta")
    .eq("status", "connected");
}
