import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getMetaConfig } from "@/lib/integrations/meta/config";
import { MetaAuthError } from "@/lib/integrations/meta/client";
import { setAdSetDailyBudget, setEntityStatus } from "@/lib/integrations/meta/insights";

// Confirm-gated live writes to Meta (the UI shows a "Increase budget to $X/day?"
// confirm before calling this). Reuses the per-org token write path. Auth-gated.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const type = String(body?.type || "");
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const orgId = await getOrgId(supabase);
  const config = await getMetaConfig(orgId);
  if (!config) return NextResponse.json({ error: "meta_not_connected", message: "Connect Meta in Settings → Integrations first." }, { status: 412 });

  try {
    if (type === "budget") {
      const dailyMinor = Math.round(Number(body?.dailyMinor) || 0);
      if (dailyMinor <= 0) return NextResponse.json({ error: "bad_budget" }, { status: 400 });
      await setAdSetDailyBudget(config, id, dailyMinor);
      console.log(`[meta] action budget org=${orgId} adset=${id} dailyMinor=${dailyMinor}`);
      return NextResponse.json({ ok: true, type, id, dailyMinor });
    }
    if (type === "pause" || type === "resume") {
      const status = type === "pause" ? "PAUSED" : "ACTIVE";
      await setEntityStatus(config, id, status);
      console.log(`[meta] action ${type} org=${orgId} id=${id}`);
      return NextResponse.json({ ok: true, type, id, status });
    }
    return NextResponse.json({ error: "unknown_type" }, { status: 400 });
  } catch (e) {
    if (e instanceof MetaAuthError) {
      return NextResponse.json({ error: "reconnect", message: "Meta connection expired — reconnect in Settings → Integrations." }, { status: 401 });
    }
    console.error(`[meta] action FAILED org=${orgId} type=${type} id=${id}: ${(e as Error).message}`);
    return NextResponse.json({ error: "action_failed", message: (e as Error).message }, { status: 502 });
  }
}
