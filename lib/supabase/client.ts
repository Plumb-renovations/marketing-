"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client. Uses only the public anon key; all access is
// constrained by Row Level Security (org membership).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
