// Real seed data, ported from the prototype. Loaded into Supabase by
// `npm run db:seed`, and used as an empty-state fallback in the UI.
import type { Lead, Post, Settings, Metrics, Quote } from "./types";
import { plusDays } from "./format";

// Seeded quote: stored total stays GST-inclusive (matches the recorded amount).
const seededQuote = (id: string, total: number, date: string): Quote => ({
  id,
  status: "sent",
  createdAt: date,
  lineItems: [
    { id: id + "-1", desc: "Renovation works (as previously quoted)", qty: 1, unitPrice: total / 1.1 },
  ],
});

export const SEED_LEADS: Lead[] = [
  { id: "l1", date: "2026-04-12", name: "Simpson", suburb: "—", source: "google_ads", project: "Bathroom", stage: "new", quotes: [] },
  { id: "l2", date: "2026-04-12", name: "Cheryl", suburb: "—", source: "google_ads", project: "Bathroom", stage: "new", quotes: [] },

  { id: "l3", date: "2026-04-05", name: "Jo Casey", suburb: "Tweed", source: "meta_ads", project: "Renovation", stage: "qualified", quotes: [] },
  { id: "l4", date: "2026-04-12", name: "Elize", suburb: "Kingscliff", source: "meta_ads", project: "Bathroom", stage: "qualified", quotes: [] },
  { id: "l5", date: "2026-04-20", name: "Reece", suburb: "Kingscliff", source: "meta_ads", project: "Bathroom", stage: "qualified", quotes: [] },
  { id: "l6", date: "2026-04-20", name: "Julie", suburb: "Kingscliff", source: "meta_ads", project: "Bathroom", stage: "qualified", quotes: [] },
  { id: "l7", date: "2026-04-21", name: "Anun", suburb: "Banora", source: "google_ads", project: "Rumpus", stage: "qualified", quotes: [] },

  { id: "l8", date: "2026-03-30", name: "Frances", suburb: "Evans Head", source: "meta_ads", project: "Bathroom", stage: "quote", quotes: [seededQuote("q8", 36487, "2026-03-30")] },
  { id: "l9", date: "2026-03-31", name: "Lama", suburb: "Mudgeeraba", source: "google_ads", project: "Leaking bathroom", stage: "quote", quotes: [seededQuote("q9", 29800, "2026-03-31")] },
  { id: "l10", date: "2026-04-04", name: "Kelly", suburb: "Nerang", source: "google_ads", project: "2 bathrooms", stage: "quote", quotes: [seededQuote("q10", 52429.3, "2026-04-04")] },
  { id: "l11", date: "2026-04-09", name: "Nick", suburb: "Tallebudgera", source: "meta_ads", project: "Laundry & bathroom", stage: "quote", quotes: [seededQuote("q11", 60951, "2026-04-09")] },
  { id: "l12", date: "2026-04-12", name: "Kaycee", suburb: "Robina", source: "meta_ads", project: "Bathroom", stage: "quote", quotes: [seededQuote("q12", 32766, "2026-04-12")] },

  { id: "l13", date: "2026-04-01", name: "Joanne", suburb: "Burleigh", source: "google_ads", project: "Bathroom", stage: "won", quotes: [seededQuote("q13", 30955.1, "2026-04-01")], wonQuoteId: "q13", tradify: "", startDate: "2026-07-07", durationWeeks: 3, jobStatus: "scheduled" },
  { id: "l14", date: "2026-04-10", name: "Ron", suburb: "Springwood", source: "google_ads", project: "Bathroom", stage: "won", quotes: [seededQuote("q14", 36156, "2026-04-10")], wonQuoteId: "q14", tradify: "", startDate: "2026-08-04", durationWeeks: 2, jobStatus: "scheduled" },

  { id: "l15", date: "2026-03-31", name: "Frank", suburb: "Clear Island", source: "meta_ads", project: "Renovation", stage: "lost", quotes: [seededQuote("q15", 148131.5, "2026-03-31")], lostReason: "Price" },
  { id: "l16", date: "2026-04-03", name: "Hania", suburb: "Merrimac", source: "google_ads", project: "Bathroom", stage: "lost", quotes: [seededQuote("q16", 24464, "2026-04-03")], lostReason: "Price" },
];

export const SEED_POSTS: Post[] = [
  { id: "p1", photo: null, caption: "Fixed-price bathroom reno in Burleigh — demo to handover, no surprises. QBCC licensed, with a workmanship warranty.", hashtags: "#goldcoastbathrooms #bathroomrenovation #burleighheads #fixedprice #qbcc #renovation", cta: "", channels: ["instagram", "facebook"], scheduledAt: plusDays(2) + "T18:00", status: "draft", reach: null, engagement: null, why: "" },
  { id: "p2", photo: null, caption: "Cheapest quote vs the right quote — here's what a proper fixed price actually includes on a Gold Coast bathroom.", hashtags: "#bathroomrenovation #goldcoast #renovationtips #fixedprice", cta: "", channels: ["instagram"], scheduledAt: plusDays(6) + "T19:00", status: "scheduled", reach: null, engagement: null, why: "" },
];

export const DEFAULT_SETTINGS: Settings = {
  jobsTarget: 3,
  revenueTarget: 0,
  leadTimeWeeks: 7,
  costPerLead: 205,
  leadToWonRate: 12.5,
};

export const DEFAULT_METRICS: Metrics = {
  spend: { google_ads: 800, meta_ads: 1639 },
  organic: { ig_reach: 0, ig_eng: 0, fb_reach: 0, fb_eng: 0, gbp_views: 0, gbp_calls: 0 },
};

export const ORG_ID = "00000000-0000-0000-0000-000000000001";
