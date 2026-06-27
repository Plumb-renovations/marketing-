import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchInboxThreads } from "@/lib/data/inbox";

// The unified inbox list (FB Page messages + IG DMs), grouped into threads,
// newest first. Empty until messaging is approved + flowing — the UI shows a
// clear "pending" state, never fake messages. Auth-gated (RLS scopes to org).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const threads = await fetchInboxThreads(supabase);
  return NextResponse.json({ threads });
}
