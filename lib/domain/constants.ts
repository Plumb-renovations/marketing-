// Static design tokens, source/stage config, nav, and the seed dashboard
// datasets — transcribed from the prototype. The dashboard datasets remain
// static here in M1; Milestone 8 swaps them for live Supabase-backed data.
import {
  Workflow,
  Banknote,
  Filter,
  Search,
  Facebook,
  Sparkles,
  TrendingUp,
  Star,
  Swords,
  ListChecks,
  Bot,
  CalendarRange,
  CalendarDays,
  Scale,
  Megaphone,
  Plug,
  Building2,
  type LucideIcon,
} from "lucide-react";

/* ----------------------------- LEADS ----------------------------------- */
export const STAGES = [
  { id: "new", label: "New Leads", accent: "slate" },
  { id: "qualified", label: "Qualified", accent: "cyan" },
  { id: "quote", label: "Quotes", accent: "amber" },
  { id: "won", label: "Quotes Won", accent: "emerald" },
  { id: "lost", label: "Lost", accent: "red" },
] as const;

export const LOST_REASONS = [
  "Price",
  "Timing",
  "Went with competitor",
  "No response",
  "Other",
];

export const JOB_STATUSES = [
  { id: "scheduled", label: "Scheduled", c: "cyan" },
  { id: "in_progress", label: "In progress", c: "amber" },
  { id: "complete", label: "Complete", c: "emerald" },
];

/* ----------------------------- AD DATA --------------------------------- */
export const AI_RECS = [
  {
    id: "r1",
    priority: true,
    confidence: 95,
    area: "Google Ads",
    impact: "high",
    title:
      "Google recorded 0 conversions on $8,722 — yet it drove both jobs you won ($67,111). Fix tracking before you relaunch.",
    body: "Across 12 months every keyword and search term shows 0.00 conversions, so bidding has been flying blind (and CPC roughly tripled). Your lead tracker shows Google produced both won jobs. Install call tracking, a lead-form conversion, and offline import from Tradify so Google can finally optimise toward revenue instead of cheap clicks.",
    estimate:
      "Re-points spend at jobs, not clicks. Should pull CPC back and lift cost-per-won-job further.",
  },
  {
    id: "r2",
    confidence: 90,
    area: "Google Ads",
    impact: "high",
    title:
      "Restructure the broad ‘bathroom renovation price’ keyword — it’s 26% of all spend.",
    body: "$2,297 on a single broad-match price-shopper term is dragging in cheap/budget/out-of-area searches (Brisbane, Logan, Beenleigh). Tighten to phrase/exact and add negatives.",
    estimate: "Reclaims $1,000+ of visible waste to redeploy on converting terms.",
  },
  {
    id: "r3",
    confidence: 78,
    area: "Meta Ads",
    impact: "medium",
    title: "Meta leads aren’t closing — 8 leads, 0 won, 0.78% CTR, NZ$223/lead.",
    body: "The active campaign uses on-Meta instant forms; leads qualify cleanly but none converted to a job in the tracked window, including a $148k quote lost on price. Test sending traffic to a website form, and lift creative CTR.",
    estimate: "Higher-intent leads; better close rate by source.",
  },
  {
    id: "r4",
    confidence: 75,
    area: "Funnel",
    impact: "medium",
    title: "Two deals lost on price. Build a price-justification story.",
    body: "Rivals compete on premium-justified (Kuda) and transparent fixed pricing (Benco, Coastal). Surface QBCC licence, workmanship warranty and a fixed-price promise on quotes and the landing page.",
    estimate: "Defends margin against price-only comparisons.",
  },
];

export const GOOGLE_TOTALS = {
  spend: 8722.22,
  clicks: 1385,
  ctr: "5.97%",
  cpc: "$6.30",
  conv: "0.00",
};
export const GOOGLE_CAMPAIGNS = [
  {
    name: "Visual Empathy | Water Plumb | GC | Renovation",
    spend: "$8,603.29",
    clicks: 1318,
    ctr: "5.96%",
    conv: "0.00",
    status: "paused",
  },
  {
    name: "Visual Empathy | Water Plumb | Bathroom Reno | KW",
    spend: "$118.93",
    clicks: 67,
    ctr: "6.95%",
    conv: "0.00",
    status: "paused",
  },
];
export const GOOGLE_KEYWORDS = [
  { kw: "bathroom renovation price", type: "Broad", spend: "$2,296.68", clicks: 321, ctr: "5.49%", status: "red", action: "Restructure — price-shopper, broad" },
  { kw: "bath renovation", type: "Phrase", spend: "$1,485.48", clicks: 216, ctr: "5.65%", status: "amber", action: "Loose term — tighten" },
  { kw: "bathroom renovations", type: "Exact", spend: "$1,037.46", clicks: 151, ctr: "7.71%", status: "green", action: "Core — keep & scale" },
  { kw: "bathroom renovations", type: "Phrase", spend: "$722.12", clicks: 184, ctr: "7.23%", status: "green", action: "Core" },
  { kw: "bathroom renovation gold coast", type: "Exact", spend: "$710.61", clicks: 70, ctr: "6.19%", status: "green", action: "Geo core — scale" },
  { kw: "bathroom renovation services", type: "Phrase", spend: "$543.21", clicks: 94, ctr: "5.30%", status: "green", action: "Keep" },
  { kw: "bathroom renovations gold coast", type: "Phrase", spend: "$542.98", clicks: 40, ctr: "6.31%", status: "green", action: "Geo core — scale" },
  { kw: "renovations gold coast", type: "Phrase", spend: "$460.47", clicks: 93, ctr: "7.03%", status: "amber", action: "Too broad (all renos)" },
  { kw: "bathroom renovation cost", type: "Exact", spend: "$183.36", clicks: 40, ctr: "5.49%", status: "amber", action: "Cost-shopper — watch" },
  { kw: "cheap bathroom renovations", type: "Phrase", spend: "$128.49", clicks: 27, ctr: "13.50%", status: "red", action: "Pause — bidding on ‘cheap’" },
];
export const SEARCH_TERMS_GOOD = [
  "bathroom renovations gold coast",
  "gold coast bathroom renovations",
  "bathroom renovations near me",
  "laundry renovations gold coast",
  "bathroom renovations burleigh",
  "bathroom renovations currumbin",
  "bathroom renovations southport",
  "bathroom renovations nerang",
];
export const SEARCH_TERMS_BAD = [
  "cheap / affordable / budget",
  "bathroom renovations under $5000",
  "how much to renovate a bathroom",
  "bathroom remodeling",
  "tiler / tiling / bathroom tiler",
  "plumber / plumbing",
  "shower screens",
  "resurfacing / microcement",
  "kitchen renovations",
  "brisbane / logan / beenleigh / browns plains",
  "caboolture / capalaba / ipswich / redcliffe",
  "sunshine coast",
  "reece / highgrove / kuda / benco (brands)",
];
export const GOOGLE_DEVICES = [
  { d: "Mobile phones", spend: "$6,592.50", pct: 76 },
  { d: "Computers", spend: "$2,125.22", pct: 24 },
  { d: "Tablets", spend: "$4.50", pct: 0 },
];
export const GOOGLE_MONTHLY = [747, 911, 911, 1029, 598, 592, 354, 841, 1003, 801, 936];

export const META = {
  window: "15 May – 13 Jun 2026",
  currency: "NZD",
  campaigns: [
    { name: "New Leads Campaign", status: "active", spend: "NZ$1,781.91", leads: 8, cpl: "NZ$222.74", reach: "19,942", freq: "2.56", impr: "51,028", cpm: "NZ$34.92", clicks: 399, cpc: "NZ$4.47", ctr: "0.78%", lf: "On-Meta instant forms" },
    { name: "Ongoing website promotion (waterplumb.com.au)", status: "inactive", spend: "NZ$0", leads: 0, cpl: "—", reach: "0", freq: "0", impr: "0", cpm: "—", clicks: 0, cpc: "—", ctr: "—", lf: "Off" },
  ],
};
export const META_RECS = [
  { status: "amber", t: "Lift creative CTR", d: "0.78% link CTR is low for lead gen. Test before/after video and a sharper offer; aim past 1%." },
  { status: "amber", t: "Test website-form leads vs instant forms", d: "Instant-form leads qualify but aren’t closing. Route a test to a website form with a couple of qualifying questions." },
  { status: "red", t: "Connect Meta leads to job outcomes", d: "0 of 8 tracked Meta leads became jobs. Tag source through to ‘won’ so cost-per-won-job is visible by channel." },
  { status: "amber", t: "Resolve NZD billing", d: "The account bills in NZD for an AU business. Confirm this is intentional — it complicates reporting and FX." },
];

/* --------------------------- FUNNEL + COMPS ---------------------------- */
export const FUNNEL = [
  { stage: "Leads", value: 16, sub: "30 Mar – 21 Apr · 8 Google, 8 Meta" },
  { stage: "Qualified", value: 14, sub: "88% qualified" },
  { stage: "Quotes", value: 9, sub: "quotes with a value issued" },
  { stage: "Won jobs", value: 2, sub: "$67,111 won · avg $33,556" },
];
export const FUNNEL_BY_SOURCE = [
  { key: "google_ads", leads: 8, qualified: 6, quoted: 5, won: 2, rev: "$67,111", note: "Both wins. Two junk leads, but the revenue channel." },
  { key: "meta_ads", leads: 8, qualified: 8, quoted: 4, won: 0, rev: "$0", note: "Cleanest qualification, zero wins yet. Several quotes still open." },
];

export const COMPETITORS = [
  { name: "Only Bathrooms Gold Coast", rating: 5.0, reviews: 107, suburb: "Mudgeeraba", note: "Most-reviewed dedicated reno specialist on the Coast. The main one to watch.", threat: "high" },
  { name: "Kuda Bathrooms", rating: 5.0, reviews: 93, suburb: "Burleigh Heads", note: "Premium-priced — often the dearest of three quotes, but reviewers feel it’s worth it.", threat: "high" },
  { name: "Bespoke Bathrooms", rating: 4.9, reviews: 69, suburb: "Mermaid Waters", note: "Owner-led (Craig). Reputation built on honesty and not over-promising.", threat: "medium" },
  { name: "Benco Bathroom Renovations", rating: 5.0, reviews: 59, suburb: "Burleigh Heads", note: "Family business with a showroom and a detailed, formal quoting process.", threat: "medium" },
  { name: "4D Renovations", rating: 4.9, reviews: 37, suburb: "Southport", note: "Design-led, gets referred by Reece.", threat: "medium" },
  { name: "Varli Building", rating: 4.9, reviews: 30, suburb: "Molendinar", note: "Bathrooms + kitchens; strong on apartment / body-corporate jobs.", threat: "low" },
  { name: "Coastal Bathroom Renovations", rating: 4.8, reviews: 24, suburb: "Robina", note: "Leans hard on transparent, no-surprises up-front pricing.", threat: "low" },
  { name: "Surfers Paradise Bathroom Renovations", rating: 5.0, reviews: 21, suburb: "Surfers Paradise", note: "Does high-rise / apartment work.", threat: "low" },
  { name: "Moriarty", rating: 4.8, reviews: 21, suburb: "Ashmore", note: "Will take smaller jobs and assist DIY renovators.", threat: "low" },
];
export const COMPETITOR_RECS = [
  "Only Bathrooms sits at 107 reviews / 5.0 — review velocity is the visibility game here. Connect your own Google profile so we can benchmark and set a monthly review target.",
  "Kuda Bathrooms shows up in your Google search terms — people search rivals by name. Make sure your brand term is defended and your reviews are front-and-centre.",
  "You lost two deals on price; Kuda wins at a premium and Benco/Coastal win on transparent fixed pricing. Pick your lane and make the justification explicit on quotes and the site.",
  "Rivals cluster in Burleigh Heads, Mermaid, Robina, Southport — the same suburbs as your quoted/won leads. Suburb landing pages are worth building here.",
];

export const ACTIONS = [
  { id: "a1", pri: "high", text: "Install Google conversion tracking (calls + lead form + Tradify offline import) before relaunch", impact: 10, diff: 4, lift: "see revenue" },
  { id: "a2", pri: "high", text: "Restructure broad ‘bathroom renovation price’ keyword ($2,297 / 26% of spend)", impact: 9, diff: 3, lift: "stop the bleed" },
  { id: "a3", pri: "high", text: "Add negatives: cheap / affordable / budget / under $5000 / how much / remodeling / tiler / plumber / kitchen + competitor brands", impact: 8, diff: 2, lift: "save $1,000+/yr" },
  { id: "a4", pri: "high", text: "Restrict location to Gold Coast + NSW border; exclude Brisbane / Logan / Sunshine Coast", impact: 8, diff: 2, lift: "save ~$560" },
  { id: "a5", pri: "med", text: "Fund geo-core terms: ‘bathroom renovations gold coast’, ‘…near me’, ‘laundry renovations gold coast’, suburb terms", impact: 7, diff: 2, lift: "+ qualified leads" },
  { id: "a6", pri: "med", text: "Meta: test website-form leads vs instant forms; lift creative CTR past 1%", impact: 7, diff: 4, lift: "+ lead quality" },
  { id: "a7", pri: "med", text: "Add a price-justification block (QBCC, warranty, fixed price) to quotes + landing page", impact: 7, diff: 3, lift: "win price battles" },
  { id: "a8", pri: "med", text: "Resolve Meta NZD billing / confirm currency handling", impact: 4, diff: 2, lift: "clean reporting" },
  { id: "a9", pri: "low", text: "Build suburb pages: Burleigh, Robina, Nerang, Mudgeeraba, Currumbin", impact: 6, diff: 6, lift: "organic + geo ads" },
  { id: "a10", pri: "low", text: "Connect Google Business Profile and start a review-velocity push toward 107 (Only Bathrooms)", impact: 6, diff: 3, lift: "local visibility" },
];

export const CONTENT_IDEAS = [
  { id: "c1", insight: "Your wins come from high-intent Google searches in Gold Coast suburbs. Make content that ranks and converts there.", project: "Burleigh & Robina won/quoted jobs", headline: "Bathroom renovations in Burleigh — fixed-price, QBCC licensed", post: "A Burleigh bathroom, start to finish. Fixed quote, QBCC licensed, 7-year workmanship warranty. Book a free on-site measure and quote.", caption: "Quality bathroom renovations across the Gold Coast. Fixed pricing, no surprises. Tap to book your quote.", ad: "Search + suburb landing page · CTA ‘Book a free quote’" },
  { id: "c2", insight: "Meta leads aren’t closing — lead with proof and a clear price story, not just a pretty render.", project: "Won jobs: Joanne (Burleigh), Ron", headline: "What a $30k Gold Coast bathroom actually includes", post: "Real project, real fixed price. Here’s exactly what’s included in a quality bathroom renovation — and why ‘cheap’ costs more later.", caption: "Transparent fixed pricing. QBCC licensed. Book a quote and we’ll walk you through every line.", ad: "Before/after video · CTA ‘Get a fixed-price quote’ · website form" },
  { id: "c3", insight: "Two losses on price. A short ‘why we’re not the cheapest’ explainer pre-empts the objection.", project: "Lost: Frank ($148k), Hania ($24k)", headline: "Cheapest quote vs right quote: a Gold Coast guide", post: "Three quotes, big price gap — here’s how to compare them properly so you don’t pay twice.", caption: "Know what you’re paying for. QBCC licensed, fixed price, fully warranted.", ad: "Blog + retargeting · CTA ‘Read the guide’" },
];

export const ASSISTANTS: {
  id: string;
  name: string;
  icon: LucideIcon;
  latest: string;
  qa: { q: string; a: string }[];
}[] = [
  { id: "google", name: "Google Ads Assistant", icon: Search, latest: "0 conversions tracked on $8,722 — yet Google drove both won jobs. Tracking is the whole game right now.", qa: [{ q: "What do I fix first?", a: "Conversion tracking: call tracking, a lead-form conversion, and offline import from Tradify. Until Google can see which clicks became jobs, every other change is a guess." }, { q: "Where’s the money leaking?", a: "‘bathroom renovation price’ on broad match — $2,297, a quarter of your spend — plus cheap/budget terms and out-of-area clicks (Brisbane, Logan, Beenleigh)." }] },
  { id: "meta", name: "Meta Ads Assistant", icon: Facebook, latest: "8 leads, 0 won, 0.78% CTR, NZ$223/lead. Volume’s fine; quality and measurement aren’t.", qa: [{ q: "Why aren’t Meta leads closing?", a: "They’re on-Meta instant forms — low friction, low intent. Test a website form with two qualifying questions, and strengthen the creative/offer." }, { q: "Is the spend efficient?", a: "NZ$223 per lead is high, and it’s billed in NZD for an AU business. Worth confirming the currency setup and tightening targeting." }] },
  { id: "seo", name: "SEO Assistant", icon: TrendingUp, latest: "No rank data connected yet — but your suburbs are clear from won/quoted jobs.", qa: [{ q: "What should I build first?", a: "Suburb pages for Burleigh, Robina, Nerang, Mudgeeraba and Currumbin — exactly where your quoted and won leads are." }] },
  { id: "content", name: "Content Assistant", icon: Sparkles, latest: "Lead with fixed-price + proof. Two deals were lost on price.", qa: [{ q: "What should I post this week?", a: "A ‘what a $30k bathroom includes’ breakdown and a Burleigh before/after — both pre-drafted in the Content Engine." }] },
  { id: "review", name: "Review Assistant", icon: Star, latest: "Top rival Only Bathrooms has 107 reviews at 5.0. Connect your profile to set a target.", qa: [{ q: "How do I catch up?", a: "Ask every completed job within 48 hours of handover. Connect your Google Business Profile and we’ll track velocity against the field." }] },
  { id: "competitor", name: "Competitor Assistant", icon: Swords, latest: "Kuda wins at a premium; Benco/Coastal win on transparent pricing. Pick your lane.", qa: [{ q: "How do I compete on price?", a: "Don’t race to cheapest. Make the value explicit — QBCC, warranty, fixed price — and show it on the quote so a price comparison becomes a value comparison." }] },
];

/* ----------------------------- NAV ------------------------------------- */
export const NAV: {
  group: string;
  items: { id: string; label: string; icon: LucideIcon }[];
}[] = [
  {
    group: "Operations",
    items: [
      { id: "leads", label: "Leads", icon: Workflow },
      { id: "pipeline", label: "Pipeline", icon: CalendarRange },
      { id: "revenue", label: "Job Revenue", icon: Banknote },
    ],
  },
  {
    group: "Marketing",
    items: [
      { id: "funnel", label: "Lead Funnel", icon: Filter },
      { id: "compare", label: "Paid vs Organic", icon: Scale },
      { id: "google", label: "Google Ads", icon: Search },
      { id: "meta", label: "Meta Ads", icon: Facebook },
      { id: "content", label: "Content Engine", icon: Sparkles },
      { id: "calendar", label: "Content Calendar", icon: CalendarDays },
      { id: "ads", label: "Ad Creator", icon: Megaphone },
      { id: "seo", label: "SEO", icon: TrendingUp },
      { id: "reviews", label: "Reviews", icon: Star },
      { id: "competitor", label: "Competitors", icon: Swords },
      { id: "actions", label: "Action Centre", icon: ListChecks },
      { id: "assistants", label: "Assistants", icon: Bot },
    ],
  },
  {
    group: "Settings",
    items: [
      { id: "business", label: "Business Profile", icon: Building2 },
      { id: "integrations", label: "Integrations", icon: Plug },
    ],
  },
];

export const TITLES: Record<string, string> = {
  leads: "Leads",
  pipeline: "Pipeline",
  revenue: "Job Revenue",
  funnel: "Lead Funnel",
  google: "Google Ads",
  meta: "Meta Ads",
  content: "Content Engine",
  seo: "SEO",
  reviews: "Reviews",
  competitor: "Competitors",
  actions: "Action Centre",
  assistants: "Assistants",
  compare: "Paid vs Organic",
  calendar: "Content Calendar",
  ads: "Ad Creator",
  integrations: "Integrations",
  business: "Business Profile",
};

/* --------------------------- STATUS / SOURCES -------------------------- */
type StatusEntry = { dot: string; text: string; chip: string };
export const STATUS: Record<string, StatusEntry> = {
  green: { dot: "bg-emerald-400", text: "text-emerald-400", chip: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  amber: { dot: "bg-amber-400", text: "text-amber-400", chip: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  red: { dot: "bg-red-400", text: "text-red-400", chip: "bg-red-500/10 text-red-300 border-red-500/30" },
  cyan: { dot: "bg-cyan-400", text: "text-cyan-300", chip: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30" },
  slate: { dot: "bg-slate-400", text: "text-slate-300", chip: "bg-slate-700/40 text-slate-300 border-slate-600/50" },
  emerald: { dot: "bg-emerald-400", text: "text-emerald-300", chip: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  paused: { dot: "bg-slate-500", text: "text-slate-400", chip: "bg-slate-700/40 text-slate-400 border-slate-600/50" },
  active: { dot: "bg-emerald-400", text: "text-emerald-300", chip: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  inactive: { dot: "bg-slate-500", text: "text-slate-400", chip: "bg-slate-700/40 text-slate-400 border-slate-600/50" },
  indigo: { dot: "bg-indigo-400", text: "text-indigo-300", chip: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30" },
  sky: { dot: "bg-sky-400", text: "text-sky-300", chip: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
};

type SourceEntry = { label: string; short: string; paid: boolean; chip: string };
export const SOURCES: Record<string, SourceEntry> = {
  google_ads: { label: "Google Ads", short: "Google Ads", paid: true, chip: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
  meta_ads: { label: "Meta Ads", short: "Meta Ads", paid: true, chip: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30" },
  instagram: { label: "Instagram (organic)", short: "Instagram", paid: false, chip: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30" },
  facebook: { label: "Facebook (organic)", short: "Facebook", paid: false, chip: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
  gbp: { label: "Google Business Profile", short: "GBP", paid: false, chip: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  referral: { label: "Referral / word-of-mouth", short: "Referral", paid: false, chip: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  website: { label: "Website (organic)", short: "Website", paid: false, chip: "bg-teal-500/10 text-teal-300 border-teal-500/30" },
};
export const SOURCE_KEYS = Object.keys(SOURCES);
export const PAID_KEYS = SOURCE_KEYS.filter((k) => SOURCES[k].paid);
export const ORGANIC_KEYS = SOURCE_KEYS.filter((k) => !SOURCES[k].paid);

/* --------------------------- CONTENT / ADS ----------------------------- */
export const POST_CHANNELS = ["instagram", "facebook", "gbp"];
export const POST_GOALS = [
  "Book quotes / enquiries",
  "Showcase craftsmanship",
  "Counter price objections",
  "Build trust & reviews",
  "Educate (process / what's included)",
];
export const POST_STATUS: Record<string, { label: string; c: string }> = {
  draft: { label: "Draft", c: "slate" },
  scheduled: { label: "Scheduled", c: "cyan" },
  posted: { label: "Posted", c: "emerald" },
};
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const AD_STATUS: Record<string, { label: string; c: string }> = {
  draft: { label: "Draft", c: "slate" },
  live: { label: "Live", c: "emerald" },
  archived: { label: "Archived", c: "amber" },
};
