import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessProfile } from "@/lib/business/profile";
import { runGenerator } from "@/lib/ai/server";
import { getMetaConfig } from "@/lib/integrations/meta/config";
import { MetaAuthError } from "@/lib/integrations/meta/client";
import { fetchAdTree, type AdTree } from "@/lib/integrations/meta/insights";
import { calibrateTargets, verdictFor, type ResolvedTargets, type NodeInput, type TargetOverrides } from "@/lib/meta/verdict";
import { analyseCreatives, creativeSetSummary } from "@/lib/meta/creatives";
import { fetchAdTargets } from "@/lib/data/adTargets";

// The Meta Ads Coach orchestrator: real ad data (fetchAdTree) → deterministic
// creative flags + set verdicts (Hazel's brain) → a lean data block → an expert,
// framework-driven answer (Anthropic). Timeout-safe: the AI call runs under an
// abort deadline below the serverless limit, and if it doesn't finish we return
// a deterministic read built from the numbers — it never 504s.

const round = (n: number) => Math.round(n);
const money = (n: number, ccy = "AUD") => {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(Number(n) || 0); }
  catch { return "$" + round(Number(n) || 0); }
};
const daysSince = (iso?: string | null) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
};
const cpl = (spend: number, leads: number) => (leads > 0 ? money(spend / leads) : "—");

function toInput(node: any, level: "campaign" | "adset" | "ad"): NodeInput {
  return { level, status: node.status, spend: node.spend, leads: node.leads, ctr: node.ctr, dailyBudgetMinor: node.dailyBudgetMinor ?? null, updatedTime: node.updatedTime, costPerWon: null, wonJobs: 0 };
}

// Compact, lean text of the account → campaigns → ad sets → individual ads, with
// per-set verdicts and per-creative flags. Capped so the payload stays small.
export function buildMetaAdsDataBlock(tree: AdTree, targets: ResolvedTargets): string {
  const ccy = tree.currency;
  const L: string[] = [];
  L.push(`ACCOUNT (${ccy}): spend ${money(tree.account.spend)}, leads ${tree.account.leads}, cost/lead ${cpl(tree.account.spend, tree.account.leads)}. Targets — healthy CPL ~${money(targets.healthyCpl)}, concerning ~${money(targets.concerningCpl)}. ${targets.basis}`);
  let adBudget = 40; // cap total ads listed to keep the payload lean
  for (const c of tree.campaigns) {
    L.push(`CAMPAIGN "${c.name}" [${c.objective || "?"}, ${c.status || "?"}]: spend ${money(c.spend)}, leads ${c.leads}, cpl ${cpl(c.spend, c.leads)}.`);
    for (const s of c.adsets) {
      const v = verdictFor(toInput(s, "adset"), targets);
      const age = daysSince(s.updatedTime);
      const budget = s.dailyBudgetMinor ? `${money(s.dailyBudgetMinor / 100)}/day` : (s.lifetimeBudgetMinor ? `${money(s.lifetimeBudgetMinor / 100)} lifetime` : "—");
      L.push(`  AD SET "${s.name}" (${s.status || "?"}${age != null ? `, last changed ${age}d ago` : ""}): spend ${money(s.spend)}, leads ${s.leads}, cpl ${cpl(s.spend, s.leads)}, freq ${s.frequency.toFixed(1)}, CTR ${s.ctr.toFixed(2)}%, budget ${budget} → verdict: ${v.label} — ${v.reason}`);
      const insights = analyseCreatives(s.ads, targets, ccy);
      if (insights.length) L.push(`    Creatives read: ${creativeSetSummary(insights)}`);
      for (const i of insights) {
        if (adBudget-- <= 0) { L.push("    …(more ads omitted to keep it lean)"); break; }
        const m = i.metrics;
        L.push(`    AD "${i.name}" [${i.flag}${i.isTop ? ", TOP" : ""}${i.isWorst ? ", WORST" : ""}]: spend ${money(m.spend)}, impressions ${m.impressions.toLocaleString()}, reach ${m.reach.toLocaleString()}, freq ${m.frequency.toFixed(1)}, CTR ${m.ctr.toFixed(2)}%, leads ${m.leads}, cpl ${m.cpl != null ? money(m.cpl) : "—"} — ${i.headline}`);
      }
    }
  }
  return L.join("\n");
}

// Deterministic answer used when the AI is unavailable or times out — built from
// the same numbers so the coach never returns nothing (or a 504).
function fallbackAnswer(tree: AdTree, targets: ResolvedTargets): string {
  const parts: string[] = [];
  for (const c of tree.campaigns) {
    for (const s of c.adsets) {
      const insights = analyseCreatives(s.ads, targets, tree.currency);
      const sum = creativeSetSummary(insights);
      if (sum && !/nothing to change|no ads/i.test(sum)) parts.push(`• "${s.name}": ${sum}`);
    }
  }
  if (!parts.length) return "I can see your account, but there isn't enough signal yet to make a confident call — let it keep running and gather more leads first. Ask me again once there's more data, or ask about a specific ad set.";
  return `Here's the read straight from your numbers:\n\n${parts.join("\n")}\n\n(That's the deterministic read — my full reasoning wasn't available just now; try again in a moment for the detailed answer.)`;
}

export interface MetaCoachAnswer {
  connected: boolean;
  reconnect?: boolean;
  answer: string;
  topic: string;
  followups: string[];
  grounded: boolean;
}

export async function askMetaAdsCoach(
  supabase: SupabaseClient,
  orgId: string,
  profile: BusinessProfile,
  question: string,
  history?: { q: string; a: string }[],
): Promise<MetaCoachAnswer> {
  const config = await getMetaConfig(orgId);
  if (!config) {
    return { connected: false, answer: "Connect your Meta ad account first (Integrations → Meta) and I'll coach you on your real campaigns, ad sets and individual ads.", topic: "setup", followups: [], grounded: false };
  }

  let tree: AdTree;
  try {
    tree = await fetchAdTree(config);
  } catch (e) {
    if (e instanceof MetaAuthError) return { connected: true, reconnect: true, answer: "Your Meta connection needs reconnecting (Integrations → Meta) before I can read your ads.", topic: "setup", followups: [], grounded: false };
    return { connected: true, answer: "I couldn't reach Meta just now to read your ads — give it a moment and ask again.", topic: "general", followups: [], grounded: false };
  }

  let overrides: TargetOverrides = {};
  try { overrides = (await fetchAdTargets(supabase)) || {}; } catch { /* defaults */ }
  const targets = calibrateTargets({ spend: tree.account.spend, leads: tree.account.leads, costPerWon: null }, overrides);
  const dataBlock = buildMetaAdsDataBlock(tree, targets);

  let answer = "";
  let topic = "general";
  let followups: string[] = [];
  const aiConfigured = !!process.env.ANTHROPIC_API_KEY && !!process.env.ANTHROPIC_MODEL;
  if (aiConfigured) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 50_000);
    try {
      const ai: any = await runGenerator("meta-coach", { dataBlock, question, history }, profile, ctrl.signal);
      answer = String(ai?.answer || "").trim();
      topic = String(ai?.topic || "general");
      followups = Array.isArray(ai?.followups) ? ai.followups.slice(0, 3).map(String) : [];
    } catch (e: any) {
      console.error("[meta-coach] AI unavailable:", e?.message || e);
    } finally {
      clearTimeout(timer);
    }
  }
  if (!answer) answer = fallbackAnswer(tree, targets);

  // Log the Q&A for a future Marketing Head to aggregate (best-effort).
  try {
    await supabase.from("coach_qa").insert({ org_id: orgId, coach: "meta_ads", question: question.slice(0, 2000), answer: answer.slice(0, 8000), topic });
  } catch { /* table may not exist yet (0046) */ }

  return { connected: true, answer, topic, followups, grounded: true };
}
