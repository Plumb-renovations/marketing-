import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoachAlert } from "@/lib/coach/alerts";
import { fetchJourneyLeads, fetchUpcomingVisits } from "./data";
import { needsCallNow, isCold, effectiveStage, visitState } from "./coach";

// Sales-coach alerts for the proactive strip: leads to call NOW + deals going
// cold. Aggregated (count + a few names) so the strip stays tight; the Sales
// Coach page has the full worklist.
export async function journeyAlerts(supabase: SupabaseClient, orgId: string): Promise<CoachAlert[]> {
  let leads;
  try { leads = await fetchJourneyLeads(supabase, orgId); } catch { return []; }
  const open = leads.filter((l) => !["won", "lost"].includes(effectiveStage(l)));
  const callNow = open.filter(needsCallNow);
  const cold = open.filter((l) => isCold(l));
  const names = (ls: typeof open) => ls.map((l) => l.name).slice(0, 3).join(", ") + (ls.length > 3 ? ` +${ls.length - 3}` : "");

  const out: CoachAlert[] = [];

  // Imminent quote visits — surface the prep prominently when one is happening
  // now / within the hour ("here's how to win it"). Timezone-agnostic (keys on
  // minutes-until, not a calendar day).
  try {
    const visits = await fetchUpcomingVisits(supabase);
    const soon = visits.filter((v) => visitState(v.lead).state === "soon");
    if (soon.length) {
      const first = soon[0];
      out.push({
        key: "sc-visit-soon",
        severity: "high",
        area: "Quote visit",
        title: soon.length === 1 ? `Quote visit with ${first.lead.name} coming up` : `${soon.length} quote visits coming up`,
        detail: soon.length === 1
          ? `Your quote visit with ${first.lead.name} is about to start. Open the pre-quote briefing so you walk in knowing how to win it.`
          : `${names(soon.map((v) => v.lead))} — visits are about to start. Open the prep for each so you walk in ready.`,
        link: { href: "/sales-coach", label: "See the prep" },
      });
    }
  } catch { /* visits optional (pre-0030) — never block the strip */ }

  if (callNow.length) {
    out.push({
      key: "sc-call-now",
      severity: "high",
      area: "Hot leads",
      title: `${callNow.length} new lead${callNow.length === 1 ? "" : "s"} to call now`,
      detail: `Speed wins jobs — ${names(callNow)} ${callNow.length === 1 ? "hasn't" : "haven't"} been contacted yet. Call now while they're hot.`,
      link: { href: "/sales-coach", label: "Sales Coach" },
    });
  }
  if (cold.length) {
    out.push({
      key: "sc-cold",
      severity: "high",
      area: "Deals going cold",
      title: `${cold.length} quote${cold.length === 1 ? "" : "s"} going cold`,
      detail: `Follow-up is due on ${names(cold)} — don't let a sent quote go silent. Hazel can write the message.`,
      link: { href: "/sales-coach", label: "Chase deals" },
    });
  }
  return out;
}
