// Client calls for the Marketing Coach.

export interface CoachInsight {
  severity: "high" | "medium" | "low";
  area: string;
  title: string;
  why: string;
  action: string;
  signalId: string | null;
  signalAction?: { type: "budget" | "pause"; level: "adset" | "ad"; id: string; name: string; dailyMinor?: number; label?: string };
}
export interface CoachWeekly {
  this: { spend: number; leads: number; cpl: number | null };
  last: { spend: number; leads: number; cpl: number | null };
  leadsDeltaPct: number | null;
  spendDeltaPct: number | null;
  direction: "up" | "down" | "flat";
}
export interface NotWorking {
  title: string;
  why: string;
  recommendation: string;
}
export interface CoachReport {
  connected: boolean;
  reconnect: boolean;
  confidence: "early" | "building" | "solid";
  headline: string;
  insights: CoachInsight[];
  whatsNotWorking: NotWorking[];
  weekly: CoachWeekly | null;
  account: { spend: number; leads: number; cpl: number | null; won: number; costPerWon: number | null; currency: string };
  leads: { total: number; won: number; thisWeek: number; lastWeek: number };
  aiError?: string;
}

// Proactive alerts for the briefing strip.
export interface CoachAlert {
  key: string;
  severity: "high" | "medium" | "low";
  area: string;
  title: string;
  detail: string;
  action?: { type: "budget" | "pause"; level: "adset" | "ad"; id: string; name: string; dailyMinor?: number; label?: string };
  link?: { href: string; label: string };
}
export async function fetchAlerts(): Promise<{ alerts: CoachAlert[]; total: number; confidence: string }> {
  try {
    const res = await fetch("/api/coach/alerts", { cache: "no-store" });
    if (!res.ok) return { alerts: [], total: 0, confidence: "early" };
    return await res.json();
  } catch {
    return { alerts: [], total: 0, confidence: "early" };
  }
}
export async function dismissAlert(key: string, snoozeDays = 7): Promise<void> {
  try {
    await fetch("/api/coach/alerts/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, snoozeDays }) });
  } catch { /* best-effort; UI hides it regardless */ }
}

export async function fetchCoach(): Promise<CoachReport> {
  const res = await fetch("/api/coach", { cache: "no-store" });
  if (!res.ok) {
    let detail = "";
    try { const e = await res.json(); detail = e?.message || e?.error || ""; } catch {}
    throw new Error(`Coach unavailable${detail ? ": " + detail : ""}`);
  }
  return res.json();
}

export async function askHazel(question: string): Promise<{ answer: string; followups: string[] }> {
  const res = await fetch("/api/coach/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    let detail = "";
    try { const e = await res.json(); detail = e?.message || e?.error || ""; } catch {}
    throw new Error(`Hazel couldn't answer${detail ? ": " + detail : ""}`);
  }
  return res.json();
}

// Confirm-gated Meta write (reuses the ad-manager action endpoint).
export async function runCoachAction(a: { type: "budget" | "pause"; id: string; dailyMinor?: number }): Promise<boolean> {
  const res = await fetch("/api/meta/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(a),
  });
  return res.ok;
}

export const SUGGESTED_QUESTIONS = [
  "What should I do this week?",
  "How many ads should I be running?",
  "Is my cost per lead any good?",
  "Which ad should I turn off?",
  "Am I spending enough?",
  "Why aren't my leads becoming jobs?",
  "What's a good cost per lead for bathroom renos?",
  "Should I run more ads?",
];
