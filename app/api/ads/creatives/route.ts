import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getBusinessProfile } from "@/lib/business/profileServer";
import { rateLimit } from "@/lib/ai/ratelimit";
import { runGenerator } from "@/lib/ai/server";
import { calibrateTargets } from "@/lib/meta/verdict";
import { analyseCreatives, creativeSetSummary } from "@/lib/meta/creatives";

// Per-CREATIVE analysis of the ads inside one ad set: deterministic frequency/
// cost-per-lead flags + ranking (always produced from the numbers the client
// already holds), enriched with an AI diagnosis/recommendation. Timeout-safe:
// the AI call runs under an abort deadline below the serverless limit, and if it
// doesn't finish we return the deterministic analysis — never a 504.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const ads = Array.isArray(body?.ads) ? body.ads : [];
  const currency = String(body?.currency || "AUD");
  const setName = String(body?.setName || "this ad set");
  const account = { spend: Number(body?.account?.spend) || 0, leads: Number(body?.account?.leads) || 0, costPerWon: body?.account?.costPerWon != null ? Number(body.account.costPerWon) : null };
  const overrides = body?.overrides || {};

  // Deterministic backbone — always available.
  const targets = calibrateTargets(account, overrides);
  const insights = analyseCreatives(ads, targets, currency);
  let summary = creativeSetSummary(insights);
  let aiUsed = false;

  // AI enrichment (skipped if not configured), under a hard abort deadline so a
  // slow model can't run us into the function timeout.
  const aiConfigured = !!process.env.ANTHROPIC_API_KEY && !!process.env.ANTHROPIC_MODEL;
  if (aiConfigured && insights.length && rateLimit(user.id).ok) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 50_000);
    try {
      const orgId = await getOrgId(supabase);
      const profile = await getBusinessProfile(orgId);
      const ctx = {
        setName,
        currency,
        targets: { healthyCpl: targets.healthyCpl, concerningCpl: targets.concerningCpl },
        ads: insights.map((i) => ({ id: i.id, name: i.name, flag: i.flag, rank: i.rank, isTop: i.isTop, isWorst: i.isWorst, ...i.metrics })),
      };
      const ai: any = await runGenerator("creative-analysis", { creatives: ctx }, profile, ctrl.signal);
      const byId = new Map<string, any>((ai?.items || []).map((x: any) => [String(x.id), x]));
      for (const ins of insights) {
        const a = byId.get(ins.id);
        if (!a) continue;
        if (a.diagnosis) ins.diagnosis = String(a.diagnosis);
        if (a.recommendation) ins.recommendation = String(a.recommendation);
        if (a.working) ins.working = String(a.working);
        if (a.change) ins.change = String(a.change);
      }
      if (ai?.summary) summary = String(ai.summary);
      aiUsed = true;
    } catch (e: any) {
      // Deterministic analysis already populated — return it rather than 504.
      console.error("[ads/creatives] AI enrichment skipped:", e?.message || e);
    } finally {
      clearTimeout(timer);
    }
  }

  return NextResponse.json({ items: insights, summary, aiUsed });
}
