import { metaClient } from "./client";
import type { MetaConfig } from "./config";

// Pulls the full Meta ad tree (campaign → ad set → ad) with per-level insights
// via the org's token, and performs the budget/pause writes (same client the
// ad creation uses). Read-only insights + targeted writes; no bulk mutation.

export interface NodeMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number; // %
  reach: number;
  frequency: number;
  leads: number;
}
export interface AdNode extends NodeMetrics {
  id: string;
  name: string;
  status: string | null;
  updatedTime: string | null;
}
export interface AdSetNode extends AdNode {
  dailyBudgetMinor: number | null;
  lifetimeBudgetMinor: number | null;
  ads: AdNode[];
}
export interface CampaignNode extends AdNode {
  objective: string | null;
  adsets: AdSetNode[];
}
export interface AdTree {
  currency: string;
  account: { spend: number; leads: number };
  campaigns: CampaignNode[];
}

const num = (v: any) => Number(v) || 0;

// Leads = the Meta "lead" action (instant forms / leadgen), largest lead-type.
function leadsFromActions(actions: any): number {
  if (!Array.isArray(actions)) return 0;
  let best = 0;
  for (const a of actions) {
    const type = String(a?.action_type || "");
    if (/lead/i.test(type)) best = Math.max(best, num(a?.value));
  }
  return best;
}

function emptyMetrics(): NodeMetrics {
  return { spend: 0, impressions: 0, clicks: 0, ctr: 0, reach: 0, frequency: 0, leads: 0 };
}
function rowToMetrics(r: any): NodeMetrics {
  return {
    spend: num(r?.spend),
    impressions: num(r?.impressions),
    clicks: num(r?.clicks),
    ctr: num(r?.ctr),
    reach: num(r?.reach),
    frequency: num(r?.frequency),
    leads: leadsFromActions(r?.actions),
  };
}

const INSIGHT_FIELDS = "spend,impressions,clicks,ctr,reach,frequency,actions";

// Pull insights for a level and key them by that level's object id.
async function insightsByObject(client: ReturnType<typeof metaClient>, acct: string, level: "campaign" | "adset" | "ad") {
  const idField = `${level}_id`;
  const res: any = await client.get(`${acct}/insights`, {
    level,
    fields: `${INSIGHT_FIELDS},${idField}`,
    date_preset: "maximum",
    limit: 500,
  });
  const map = new Map<string, NodeMetrics>();
  for (const r of res?.data || []) {
    const id = String(r?.[idField] || "");
    if (id) map.set(id, rowToMetrics(r));
  }
  return map;
}

export async function fetchAdTree(config: MetaConfig): Promise<AdTree> {
  const client = metaClient(config);
  const acct = client.adAccountPath();

  const [acctInfo, campRes, setRes, adRes, campIns, setIns, adIns] = await Promise.all([
    client.get(acct, { fields: "currency" }),
    client.get(`${acct}/campaigns`, { fields: "id,name,effective_status,objective,updated_time", limit: 200 }),
    client.get(`${acct}/adsets`, { fields: "id,name,effective_status,campaign_id,daily_budget,lifetime_budget,updated_time", limit: 500 }),
    client.get(`${acct}/ads`, { fields: "id,name,effective_status,adset_id,campaign_id,updated_time", limit: 1000 }),
    insightsByObject(client, acct, "campaign"),
    insightsByObject(client, acct, "adset"),
    insightsByObject(client, acct, "ad"),
  ]);

  const currency = acctInfo?.currency || "AUD";

  const adsByAdset = new Map<string, AdNode[]>();
  for (const a of adRes?.data || []) {
    const node: AdNode = {
      id: String(a.id),
      name: a.name || "Ad",
      status: a.effective_status || null,
      updatedTime: a.updated_time || null,
      ...(adIns.get(String(a.id)) || emptyMetrics()),
    };
    const key = String(a.adset_id || "");
    (adsByAdset.get(key) || adsByAdset.set(key, []).get(key)!).push(node);
  }

  const setsByCampaign = new Map<string, AdSetNode[]>();
  for (const s of setRes?.data || []) {
    const node: AdSetNode = {
      id: String(s.id),
      name: s.name || "Ad set",
      status: s.effective_status || null,
      updatedTime: s.updated_time || null,
      dailyBudgetMinor: s.daily_budget != null ? num(s.daily_budget) : null,
      lifetimeBudgetMinor: s.lifetime_budget != null ? num(s.lifetime_budget) : null,
      ads: adsByAdset.get(String(s.id)) || [],
      ...(setIns.get(String(s.id)) || emptyMetrics()),
    };
    const key = String(s.campaign_id || "");
    (setsByCampaign.get(key) || setsByCampaign.set(key, []).get(key)!).push(node);
  }

  const campaigns: CampaignNode[] = (campRes?.data || []).map((c: any) => ({
    id: String(c.id),
    name: c.name || "Campaign",
    status: c.effective_status || null,
    objective: c.objective || null,
    updatedTime: c.updated_time || null,
    adsets: setsByCampaign.get(String(c.id)) || [],
    ...(campIns.get(String(c.id)) || emptyMetrics()),
  }));

  const account = campaigns.reduce(
    (acc, c) => ({ spend: acc.spend + c.spend, leads: acc.leads + c.leads }),
    { spend: 0, leads: 0 },
  );

  return { currency, account, campaigns };
}

// Account-level totals for a date window (for week-on-week deltas). leads come
// from the Meta "lead" action; cpl is derived. Used by the Marketing Coach.
export interface WindowMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
}
export async function fetchAccountWindow(config: MetaConfig, since: string, until: string): Promise<WindowMetrics> {
  const client = metaClient(config);
  const res: any = await client.get(`${client.adAccountPath()}/insights`, {
    level: "account",
    fields: "spend,impressions,clicks,actions",
    time_range: { since, until },
  });
  const r = res?.data?.[0] || {};
  return { spend: num(r.spend), impressions: num(r.impressions), clicks: num(r.clicks), leads: leadsFromActions(r.actions) };
}

// ---- Writes (reuse the metaClient token write path) ------------------------
export async function setAdSetDailyBudget(config: MetaConfig, adsetId: string, dailyMinor: number) {
  return metaClient(config).post(adsetId, { daily_budget: String(Math.round(dailyMinor)) });
}
export async function setEntityStatus(config: MetaConfig, id: string, status: "ACTIVE" | "PAUSED") {
  return metaClient(config).post(id, { status });
}
