import type { SupabaseClient } from "@supabase/supabase-js";

// Resolves the signed-in user's org from their membership, so every read/write
// is scoped to the caller's own tenant instead of a hard-coded org id.
//
// In the multi-tenant model a user belongs to exactly one org (created on
// signup); if that ever becomes many, this returns the earliest membership.
// The result is cached per Supabase client so we resolve it once per session.

const cache = new WeakMap<SupabaseClient, Promise<string>>();

export function getOrgId(supabase: SupabaseClient): Promise<string> {
  let pending = cache.get(supabase);
  if (!pending) {
    pending = resolveOrgId(supabase).catch((e) => {
      cache.delete(supabase); // don't cache failures — allow a retry
      throw e;
    });
    cache.set(supabase, pending);
  }
  return pending;
}

async function resolveOrgId(supabase: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("memberships")
    .select("org_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No org membership for the current user");
  return data.org_id as string;
}
