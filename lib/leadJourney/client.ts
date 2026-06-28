import type { JourneyLead } from "./model";

// Client calls for the Lead Journey Sales Coach.

export interface JourneyEvent {
  id: string;
  kind: string;
  channel: string | null;
  source: string;
  body: string | null;
  extracted: any;
  created_at: string;
}
export interface JourneyDetail {
  lead: JourneyLead;
  briefing: any | null;
  events: JourneyEvent[];
}

export async function fetchJourney(leadId: string): Promise<JourneyDetail | null> {
  try {
    const res = await fetch(`/api/leads/${leadId}/journey`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function journeyAction(leadId: string, body: Record<string, any>): Promise<any> {
  const res = await fetch(`/api/leads/${leadId}/journey`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.message || j?.error || `Failed (${res.status})`);
  return j;
}

export interface SalesQueueItem {
  id: string;
  name: string;
  project?: string;
  action: { title: string; detail: string; channel: string; urgency: string };
  waitingMin?: number | null;
  step?: number;
}
export interface SalesCoachData {
  callNow: SalesQueueItem[];
  cold: SalesQueueItem[];
  patterns: {
    confidence: "early" | "building" | "solid";
    decided: number; won: number; lost: number;
    lossByReason: { reason: string; label: string; count: number }[];
    topLeak: { label: string; count: number } | null;
    priceLossesBigJobs: number;
    insights: string[];
  };
  openCount: number;
}

export async function fetchSalesCoach(): Promise<SalesCoachData | null> {
  try {
    const res = await fetch("/api/sales-coach", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
