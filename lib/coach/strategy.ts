import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessProfile } from "@/lib/business/profile";
import { buildSnapshot } from "./snapshot";
import { computeSignals, prioritise } from "./signals";
import { buildLearnedSummary } from "@/lib/ads/creativeReview";

// A compact, DETERMINISTIC strategy brief the Ad Creator consumes so copy
// executes the coach's current thinking — no extra AI round-trip. Channel-
// agnostic (no Meta-only fields in the brief/angles) so it extends to Google.
// Reuses the same brain: snapshot + signals + the creative learning loop.

export interface StrategyBrief {
  brief: string; // short strategy context for prompts + a UI note
  angles: string[]; // recommended ad angles to turn into drafts
  perf: { spend: number; leads: number; cpl: number | null; won: number; currency: string; connected: boolean };
  learned: string;
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export async function buildStrategyBrief(supabase: SupabaseClient, orgId: string, profile: BusinessProfile): Promise<StrategyBrief> {
  const snapshot = await buildSnapshot(supabase, orgId);
  const signals = prioritise(computeSignals(snapshot), 8);
  const learned = await buildLearnedSummary(supabase, orgId);

  // Angles derived from REAL signals + this business's positioning.
  const angles: string[] = [];
  const priceLost = snapshot.leads.lostReasons.find((r) => /price|expensive|cost|cheap|budget/i.test(r.reason));
  if (priceLost) angles.push(`Counter the price objection — show what a quality job includes and why cheapest costs more (${priceLost.count} lost on price).`);
  if (snapshot.leads.won === 0 && snapshot.leads.total >= 8) angles.push("Lead with proof and trust (reviews, licensed, warranty) — leads aren't converting to jobs yet.");
  if (signals.some((s) => s.area === "Ad fatigue")) angles.push("Fresh creative angle — the current ad is fatiguing; test a new hook.");
  if (learned) angles.push(`Lean into what's working for you: ${learned}`);
  if (profile.offer) angles.push(`Feature your current offer: ${profile.offer}.`);
  if (profile.sellingPoints?.length) angles.push(`Make your differentiators explicit: ${profile.sellingPoints.slice(0, 3).join(", ")}.`);
  angles.push("Show a before/after transformation — the clearest proof of the result.");
  const uniqueAngles = Array.from(new Set(angles)).slice(0, 5);

  const a = snapshot.meta.account;
  const parts: string[] = [`Data confidence: ${snapshot.confidence}.`];
  if (snapshot.meta.connected && !snapshot.meta.reconnect) {
    parts.push(`Performance: ${a.leads} leads at ${a.cpl != null ? money(a.cpl) + "/lead" : "n/a"}, ${a.won} won${a.costPerWon != null ? ` (${money(a.costPerWon)}/won job)` : ""}; healthy target < ${money(snapshot.targets.healthyCpl)}/lead.`);
    const top = signals.slice(0, 3).map((s) => s.title);
    if (top.length) parts.push(`Right now: ${top.join("; ")}.`);
  } else {
    parts.push("Meta not connected for live performance — leaning on best practice + your won/lost history.");
  }
  if (learned) parts.push(`Creative that performs: ${learned}`);

  return {
    brief: parts.join(" "),
    angles: uniqueAngles,
    perf: { spend: a.spend, leads: a.leads, cpl: a.cpl, won: a.won, currency: a.currency, connected: snapshot.meta.connected },
    learned,
  };
}
