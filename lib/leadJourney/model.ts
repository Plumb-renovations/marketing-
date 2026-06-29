// Lead Journey types + the fixed sales playbook (stages, follow-up cadence, loss
// reasons). Pure data — shared by the deterministic coach, the AI prompts and
// the UI.

export type JourneyStage = "new" | "contacted" | "qualified" | "quote_sent" | "following_up" | "won" | "lost";
export type ContactOutcome = "no_answer" | "qualified" | "unqualified";

export interface LeadQual {
  budgetAud?: number | null;
  jobSizeEstimate?: number | null; // Hazel's rough $ estimate of the job
  timeline?: string | null;
  motivation?: string | null; // their WHY
  vision?: string | null; // what they want it to look/feel like
  concerns?: string[]; // worries (cost, mess, trust, timing…)
  competingQuotes?: number | null; // how many other quotes they're getting
  decisionStyle?: string | null; // 'emotional' | 'budget' | 'value' | 'resale' | 'forever-home' | …
  visionClarity?: "clear" | "unsure" | null;
}

// What the coach functions need from a lead (DB-agnostic).
export interface JourneyLead {
  id: string;
  name: string;
  project?: string | null;
  createdAt?: string | null;
  leadDate?: string | null;
  stage: string; // existing board stage
  journeyStage?: JourneyStage | null;
  contactOutcome?: ContactOutcome | null;
  contactedAt?: string | null;
  quoteSentAt?: string | null;
  followupStep?: number;
  followupDue?: string | null;
  lastTouchAt?: string | null;
  qual?: LeadQual;
  lostReason?: string | null;
  lostDetail?: string | null;
  source?: string;
  phone?: string | null;
  visitAt?: string | null; // booked quote/site-visit datetime (ISO)
  visitNotes?: string | null; // optional notes for the visit
}

export const STAGE_LABEL: Record<JourneyStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  quote_sent: "Quote sent",
  following_up: "Following up",
  won: "Won",
  lost: "Lost",
};

// Follow-up cadence after a quote is sent: escalate gentle → final, alternating
// channel so a silent quote is never forgotten.
export const CADENCE: { day: number; tone: string; channel: "text" | "call" }[] = [
  { day: 2, tone: "gentle check-in", channel: "text" },
  { day: 5, tone: "friendly nudge", channel: "call" },
  { day: 10, tone: "firm but warm", channel: "text" },
  { day: 17, tone: "final / break-up", channel: "call" },
];

export const LOSS_REASONS: { id: string; label: string }[] = [
  { id: "no_response", label: "No response after quote (ghosted)" },
  { id: "price", label: "Lost on price" },
  { id: "competitor", label: "Went with someone else" },
  { id: "timing", label: "Bad timing / postponed" },
  { id: "changed_mind", label: "Changed their mind / didn't proceed" },
  { id: "unqualified", label: "Wasn't a real fit" },
  { id: "other", label: "Other" },
];

export const lossLabel = (id?: string | null) => LOSS_REASONS.find((r) => r.id === id)?.label || id || "Unspecified";
