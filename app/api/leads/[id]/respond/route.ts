import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { respondToNewLead } from "@/lib/leads/respond";

// Trigger the instant speed-to-lead response (auto-reply + staff alert) for a
// lead from any source — e.g. a manually-added or website lead. Idempotent.
export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  // RLS-scoped existence check ensures the lead belongs to the caller's org.
  const { data: lead } = await supabase.from("leads").select("id").eq("id", id).maybeSingle();
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  await respondToNewLead(orgId, id);
  return NextResponse.json({ ok: true });
}
