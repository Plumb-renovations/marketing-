import type { SupabaseClient } from "@supabase/supabase-js";
import { getMetaConfig } from "@/lib/integrations/meta/config";
import { MetaAuthError } from "@/lib/integrations/meta/client";
import { fetchAdTree, fetchAccountWindow, type WindowMetrics } from "@/lib/integrations/meta/insights";
import { calibrateTargets, type ResolvedTargets } from "@/lib/meta/verdict";
import { fetchAdTargets } from "@/lib/data/adTargets";

// Gathers the REAL account data the Marketing Coach reasons over: the live Meta
// ad tree (campaign → ad set → ad with per-node metrics), week-on-week account
// totals, and the leads/won/lost picture. No thresholds from the user — Hazel's
// brain (calibrateTargets/verdictFor) holds all the expertise.

export interface CoachAccount {
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpl: number | null;
  currency: string;
  won: number;
  costPerWon: number | null;
}
export interface CoachAdset {
  id: string;
  name: string;
  campaignId: string;
  status: string | null;
  spend: number;
  leads: number;
  ctr: number;
  frequency: number;
  dailyBudgetMinor: number | null;
  updatedTime: string | null;
  adCount: number;
  activeAdCount: number;
}
export interface CoachWeekly {
  this: WindowMetrics & { cpl: number | null };
  last: WindowMetrics & { cpl: number | null };
  leadsDeltaPct: number | null;
  cplDeltaPct: number | null;
  spendDeltaPct: number | null;
  direction: "up" | "down" | "flat";
}
export interface CoachLeads {
  total: number;
  new: number;
  qualified: number;
  quote: number;
  won: number;
  lost: number;
  thisWeek: number;
  lastWeek: number;
  avgJobValue: number | null;
  lostReasons: { reason: string; count: number }[];
  // Real qualification outcomes (logged via the Sales Coach) so the Marketing
  // Coach can judge lead QUALITY by source, not just lead count.
  outcomeQualified: number;
  outcomeUnqualified: number;
  outcomeNoAnswer: number;
  bySource: { source: string; leads: number; qualified: number; won: number }[];
}
export interface CoachSnapshot {
  meta: {
    connected: boolean;
    reconnect: boolean;
    currency: string;
    account: CoachAccount;
    adsets: CoachAdset[];
    activeAds: number;
    totalAds: number;
    activeAdsets: number;
  };
  weekly: CoachWeekly | null;
  leads: CoachLeads;
  targets: ResolvedTargets;
  confidence: "early" | "building" | "solid";
  lastPostedAt: string | null; // most recent organic post (for "haven't posted" nudge)
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const pct = (cur: number, prev: number): number | null => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
const active = (s?: string | null) => !s || /ACTIVE/i.test(s);

function weekRanges() {
  const now = Date.now();
  const day = 86_400_000;
  return {
    thisSince: ymd(new Date(now - 6 * day)),
    thisUntil: ymd(new Date(now)),
    lastSince: ymd(new Date(now - 13 * day)),
    lastUntil: ymd(new Date(now - 7 * day)),
  };
}

export async function buildSnapshot(supabase: SupabaseClient, orgId: string): Promise<CoachSnapshot> {
  // ---- Leads / won / lost (always available) ----
  const leads: CoachLeads = {
    total: 0, new: 0, qualified: 0, quote: 0, won: 0, lost: 0,
    thisWeek: 0, lastWeek: 0, avgJobValue: null, lostReasons: [],
    outcomeQualified: 0, outcomeUnqualified: 0, outcomeNoAnswer: 0, bySource: [],
  };
  const { thisSince, thisUntil, lastSince, lastUntil } = weekRanges();
  try {
    const { data: rows } = await supabase
      .from("leads")
      .select("stage, lead_date, job_value, lost_reason, contact_outcome, source")
      .eq("org_id", orgId)
      .is("archived_at", null);
    const lostTally: Record<string, number> = {};
    const bySrc: Record<string, { leads: number; qualified: number; won: number }> = {};
    let wonValueSum = 0;
    let wonValueCount = 0;
    for (const l of rows || []) {
      leads.total++;
      const stage = String((l as any).stage || "");
      if (stage in leads) (leads as any)[stage]++;
      const d = String((l as any).lead_date || "");
      if (d && d >= thisSince) leads.thisWeek++;
      else if (d && d >= lastSince && d <= lastUntil) leads.lastWeek++;
      if (stage === "won") {
        const v = Number((l as any).job_value) || 0;
        if (v > 0) { wonValueSum += v; wonValueCount++; }
      }
      if (stage === "lost") {
        const r = String((l as any).lost_reason || "Unspecified");
        lostTally[r] = (lostTally[r] || 0) + 1;
      }
      // Qualification outcomes + per-source quality.
      const outcome = String((l as any).contact_outcome || "");
      if (outcome === "qualified") leads.outcomeQualified++;
      else if (outcome === "unqualified") leads.outcomeUnqualified++;
      else if (outcome === "no_answer") leads.outcomeNoAnswer++;
      const src = String((l as any).source || "other");
      const s = (bySrc[src] = bySrc[src] || { leads: 0, qualified: 0, won: 0 });
      s.leads++;
      if (outcome === "qualified" || ["qualified", "quote", "won"].includes(stage)) s.qualified++;
      if (stage === "won") s.won++;
    }
    leads.avgJobValue = wonValueCount > 0 ? Math.round(wonValueSum / wonValueCount) : null;
    leads.lostReasons = Object.entries(lostTally).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
    leads.bySource = Object.entries(bySrc).map(([source, v]) => ({ source, ...v })).sort((a, b) => b.leads - a.leads);
  } catch {
    /* leads table issue — coach still runs on best-effort */
  }

  // ---- Last organic post (for the "haven't posted in a while" nudge) ----
  let lastPostedAt: string | null = null;
  try {
    const { data: posted } = await supabase
      .from("posts")
      .select("published_at, scheduled_at, status")
      .eq("org_id", orgId)
      .in("status", ["posted", "published"])
      .order("published_at", { ascending: false })
      .limit(20);
    for (const p of posted || []) {
      const when = (p as any).published_at || (p as any).scheduled_at || null;
      if (when && (!lastPostedAt || when > lastPostedAt)) lastPostedAt = when;
    }
  } catch {
    /* posts table issue — skip the nudge */
  }

  // ---- Meta (may be unconnected) ----
  const emptyAccount: CoachAccount = { spend: 0, leads: 0, impressions: 0, clicks: 0, ctr: 0, cpl: null, currency: "AUD", won: 0, costPerWon: null };
  const config = await getMetaConfig(orgId);
  if (!config) {
    return {
      meta: { connected: false, reconnect: false, currency: "AUD", account: emptyAccount, adsets: [], activeAds: 0, totalAds: 0, activeAdsets: 0 },
      weekly: null,
      leads,
      targets: calibrateTargets({ spend: 0, leads: 0, costPerWon: null }, {}),
      confidence: "early",
      lastPostedAt,
    };
  }

  let reconnect = false;
  let tree;
  try {
    tree = await fetchAdTree(config);
  } catch (e) {
    reconnect = e instanceof MetaAuthError;
    tree = null;
  }

  if (!tree) {
    return {
      meta: { connected: true, reconnect, currency: "AUD", account: emptyAccount, adsets: [], activeAds: 0, totalAds: 0, activeAdsets: 0 },
      weekly: null,
      leads,
      targets: calibrateTargets({ spend: 0, leads: 0, costPerWon: null }, await fetchAdTargets(supabase)),
      confidence: "early",
      lastPostedAt,
    };
  }

  // Won-job attribution per campaign (Meta leads marked won) → account cost/won.
  let accountWon = 0;
  try {
    const { data: wonLeads } = await supabase
      .from("leads")
      .select("ad_campaign_id")
      .eq("org_id", orgId)
      .eq("ad_platform", "meta")
      .eq("stage", "won")
      .is("archived_at", null);
    accountWon = (wonLeads || []).filter((l: any) => l.ad_campaign_id).length;
  } catch {
    /* leads.ad_campaign_id may not exist yet */
  }
  const accountCostPerWon = accountWon > 0 ? tree.account.spend / accountWon : null;

  // Account roll-up (sum campaign metrics for impressions/clicks/ctr).
  let impressions = 0, clicks = 0;
  const adsets: CoachAdset[] = [];
  let totalAds = 0, activeAds = 0, activeAdsets = 0;
  for (const c of tree.campaigns) {
    impressions += c.impressions;
    clicks += c.clicks;
    for (const s of c.adsets) {
      if (active(s.status)) activeAdsets++;
      const activeAdCount = s.ads.filter((a) => active(a.status)).length;
      totalAds += s.ads.length;
      activeAds += activeAdCount;
      adsets.push({
        id: s.id, name: s.name, campaignId: c.id, status: s.status,
        spend: s.spend, leads: s.leads, ctr: s.ctr, frequency: s.frequency,
        dailyBudgetMinor: s.dailyBudgetMinor, updatedTime: s.updatedTime,
        adCount: s.ads.length, activeAdCount,
      });
    }
  }
  const account: CoachAccount = {
    spend: tree.account.spend,
    leads: tree.account.leads,
    impressions,
    clicks,
    ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
    cpl: tree.account.leads > 0 ? Math.round((tree.account.spend / tree.account.leads) * 100) / 100 : null,
    currency: tree.currency,
    won: accountWon,
    costPerWon: accountCostPerWon ? Math.round(accountCostPerWon) : null,
  };

  // Week-on-week windows (best-effort).
  let weekly: CoachWeekly | null = null;
  try {
    const [tw, lw] = await Promise.all([
      fetchAccountWindow(config, thisSince, thisUntil),
      fetchAccountWindow(config, lastSince, lastUntil),
    ]);
    const twCpl = tw.leads > 0 ? Math.round((tw.spend / tw.leads) * 100) / 100 : null;
    const lwCpl = lw.leads > 0 ? Math.round((lw.spend / lw.leads) * 100) / 100 : null;
    const leadsDeltaPct = pct(tw.leads, lw.leads);
    weekly = {
      this: { ...tw, cpl: twCpl },
      last: { ...lw, cpl: lwCpl },
      leadsDeltaPct,
      cplDeltaPct: twCpl != null && lwCpl != null ? pct(twCpl, lwCpl) : null,
      spendDeltaPct: pct(tw.spend, lw.spend),
      direction: leadsDeltaPct == null ? "flat" : leadsDeltaPct >= 15 ? "up" : leadsDeltaPct <= -15 ? "down" : "flat",
    };
  } catch {
    /* windowed insights unavailable — weekly stays null */
  }

  const targets = calibrateTargets(
    { spend: account.spend, leads: account.leads, costPerWon: account.costPerWon },
    await fetchAdTargets(supabase),
  );

  const confidence: CoachSnapshot["confidence"] =
    account.spend < 100 || account.leads < 5 ? "early" : account.leads < 30 || account.won < 3 ? "building" : "solid";

  return {
    meta: { connected: true, reconnect, currency: account.currency, account, adsets, activeAds, totalAds, activeAdsets },
    weekly,
    leads,
    targets,
    confidence,
    lastPostedAt,
  };
}
