import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getJob, advanceJob } from "@/lib/media/jobs";

// Poll + advance an async media (video) publish job. The client calls this every
// few seconds while a video processes at Meta; each call nudges the state
// machine (poll processing → publish when ready) and returns the live state.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const job = await getJob(supabase, orgId, id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const advanced = job.state === "processing" ? await advanceJob(supabase, orgId, job) : job;
  return NextResponse.json({
    id: advanced.id,
    kind: advanced.kind,
    state: advanced.state,
    resultId: advanced.result_id,
    error: advanced.error,
  });
}
