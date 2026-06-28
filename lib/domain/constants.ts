// Static design tokens, source/stage config, nav, and the seed dashboard
// datasets — transcribed from the prototype. The dashboard datasets remain
// static here in M1; Milestone 8 swaps them for live Supabase-backed data.
import {
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
  Compass,
  MessagesSquare,
  MessageCircle,
  Plug,
  Building2,
  Zap,
  Palette,
  FileText,
  Home,
  Inbox,
  Receipt,
  Trophy,
  Target,
  Settings,
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
export const AI_RECS: { id: string; priority?: boolean; confidence: number; area: string; impact: string; title: string; body: string; estimate: string }[] = [];

export const GOOGLE_TOTALS = { spend: 0, clicks: 0, ctr: "0%", cpc: "$0", conv: "0" };
export const GOOGLE_CAMPAIGNS: { name: string; spend: string; clicks: number; ctr: string; conv: string; status: string }[] = [];
export const GOOGLE_KEYWORDS: { kw: string; type: string; spend: string; clicks: number; ctr: string; status: string; action: string }[] = [];
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
export const GOOGLE_DEVICES: { d: string; spend: string; pct: number }[] = [];
export const GOOGLE_MONTHLY: number[] = [];
export const META: { window: string; currency: string; campaigns: { name: string; status: string; spend: string; leads: number; cpl: string; reach: string; freq: string; impr: string; cpm: string; clicks: number; cpc: string; ctr: string; lf: string }[] } = { window: "", currency: "AUD", campaigns: [] };
export const META_RECS: { status: string; t: string; d: string }[] = [];

/* --------------------------- FUNNEL + COMPS ---------------------------- */
export const FUNNEL: { stage: string; value: number; sub: string }[] = [];
export const FUNNEL_BY_SOURCE: { key: string; leads: number; qualified: number; quoted: number; won: number; rev: string; note: string }[] = [];

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

export const ACTIONS: { id: string; pri: string; text: string; impact: number; diff: number; lift: string }[] = [];

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
// ONE nav structure, rendered two ways (grouped sidebar on desktop, bottom
// tab bar on mobile). Each `item.id` maps directly to a route `/{id}`.
// `tier` drives placement: primary groups sit at the top (and are the mobile
// bottom tabs); secondary + settings sit lower (under "More" on mobile).
export type NavTier = "primary" | "secondary" | "settings";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  id: string; // group key + mobile-tab identity
  label: string;
  icon: LucideIcon; // shown on the mobile tab bar / collapsed states
  tier: NavTier;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    tier: "primary",
    items: [{ id: "home", label: "Home", icon: Home }],
  },
  {
    id: "leads",
    label: "Leads",
    icon: Inbox,
    tier: "primary",
    items: [
      { id: "leads", label: "Inbox", icon: Inbox },
      { id: "sales-coach", label: "Sales Coach", icon: Target },
      { id: "inbox", label: "Messages", icon: MessagesSquare },
      { id: "pipeline", label: "Pipeline", icon: CalendarRange },
      { id: "revenue", label: "Won jobs", icon: Trophy },
    ],
  },
  {
    id: "quotes",
    label: "Quotes",
    icon: FileText,
    tier: "primary",
    items: [
      { id: "quotes", label: "Quotes", icon: FileText },
      { id: "invoices", label: "Invoices", icon: Receipt },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    tier: "primary",
    items: [
      { id: "coach", label: "Marketing Coach", icon: Compass },
      { id: "compare", label: "Performance", icon: Scale },
      { id: "google", label: "Google Ads", icon: Search },
      { id: "meta", label: "Meta Ads", icon: Facebook },
      { id: "content", label: "Content & Social", icon: Sparkles },
      { id: "calendar", label: "Content Calendar", icon: CalendarDays },
      { id: "ads", label: "Ad Creator", icon: Megaphone },
      { id: "seo", label: "SEO", icon: TrendingUp },
      { id: "funnel", label: "Lead Funnel", icon: Filter },
    ],
  },
  {
    id: "reputation",
    label: "Reputation",
    icon: Star,
    tier: "secondary",
    items: [
      { id: "reviews", label: "Reviews", icon: Star },
      { id: "engagement", label: "Comments & Reviews", icon: MessageCircle },
      { id: "competitor", label: "Competitors", icon: Swords },
    ],
  },
  {
    id: "assistant",
    label: "Assistant",
    icon: Bot,
    tier: "secondary",
    items: [
      { id: "assistants", label: "Assistants", icon: Bot },
      { id: "actions", label: "Action Centre", icon: ListChecks },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    tier: "settings",
    items: [
      { id: "business", label: "Business Profile", icon: Building2 },
      { id: "branding", label: "Branding & Quotes", icon: Palette },
      { id: "lead-response", label: "Speed to Lead", icon: Zap },
      { id: "integrations", label: "Integrations", icon: Plug },
    ],
  },
];

// Groups that appear as bottom tabs on mobile; everything else lives in "More".
export const MOBILE_TAB_GROUPS = ["home", "leads", "quotes", "marketing"];

// The route a group tab/header points at (its first item).
export function groupHome(group: NavGroup): string {
  return group.items[0]?.id ?? group.id;
}

// Flat lookup: every nav item by route id (label used for the header title).
export const NAV_ITEMS: Record<string, { label: string; group: NavGroup }> =
  Object.fromEntries(
    NAV.flatMap((g) => g.items.map((i) => [i.id, { label: i.label, group: g }])),
  );

export const TITLES: Record<string, string> = Object.fromEntries(
  Object.entries(NAV_ITEMS).map(([id, v]) => [id, v.label]),
);

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
  // Publish lifecycle (set by the publish path / auto-publish cron).
  processing: { label: "Publishing…", c: "amber" },
  published: { label: "Posted", c: "emerald" },
  failed: { label: "Failed", c: "red" },
};
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const AD_STATUS: Record<string, { label: string; c: string }> = {
  draft: { label: "Draft", c: "slate" },
  live: { label: "Live", c: "emerald" },
  archived: { label: "Archived", c: "amber" },
};
