import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoachSignal } from "./signals";

// Proactive alerts = the deterministic coach signals, minus what the user has
// snoozed. No AI call (fast + cheap) so they can power a persistent briefing
// strip on every page. The full /coach page keeps the AI-synthesised version.

export interface CoachAlert {
  key: string;
  severity: "high" | "medium" | "low";
  area: string;
  title: string;
  detail: string;
  action?: CoachSignal["action"];
  link?: CoachSignal["link"];
}

export function toAlert(sig: CoachSignal): CoachAlert {
  return { key: sig.id, severity: sig.severity, area: sig.area, title: sig.title, detail: sig.detail, action: sig.action, link: sig.link };
}

// Keys currently hidden (snoozed into the future). Resilient: no table → none.
export async function fetchActiveDismissals(supabase: SupabaseClient, orgId: string): Promise<Set<string>> {
  try {
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("alert_dismissals")
      .select("alert_key, snoozed_until")
      .eq("org_id", orgId);
    const out = new Set<string>();
    for (const r of data || []) {
      const until = (r as any).snoozed_until;
      if (!until || until > nowIso) out.add((r as any).alert_key); // null = hidden, future = still snoozed
    }
    return out;
  } catch {
    return new Set();
  }
}

export async function snoozeAlert(supabase: SupabaseClient, orgId: string, key: string, days: number): Promise<void> {
  const snoozedUntil = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
  await supabase.from("alert_dismissals").upsert(
    { org_id: orgId, alert_key: key, snoozed_until: snoozedUntil, dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { onConflict: "org_id,alert_key" },
  );
}
