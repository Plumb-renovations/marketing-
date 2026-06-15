// The AD_PERSONA system prompt — ported VERBATIM from the prototype — plus the
// business/ad context builders and per-generator prompt text. Server-only:
// this and the prompts it builds are sent to Anthropic from the server route.
import type { Lead } from "@/lib/domain/types";
import { SOURCES, SEARCH_TERMS_GOOD, SEARCH_TERMS_BAD } from "@/lib/domain/constants";

export const AD_PERSONA = `You are a world-class direct-response marketer for a Gold Coast bathroom renovation company. Your single job is to turn every piece of content into a lead — an enquiry or quote request. This is not brand fluff: every caption, post and ad must move a high-intent local homeowner to take one clear action.
For everything you write:
- Open with a hook that stops a homeowner who's thinking about renovating.
- Speak to the real desire and the real objections — a beautiful, functional bathroom and an end to the dated or leaking one, against the worries of cost, mess, disruption and trusting the wrong tradie.
- Use proven direct-response structure (problem–agitate–solve, or hook–value–offer). Be specific and concrete, never generic.
- Build trust and lower risk using the business's edge — transparent fixed pricing, QBCC licence, workmanship warranty, real before/afters — and counter price objections with value, since price is the top reason deals are lost.
- End with ONE clear, low-friction call to action that captures a lead (e.g. 'DM BATHROOM for a free fixed-price quote', 'Book your free design consult'). Make the next step effortless.
- Match the platform: punchy and visual-first for Instagram/Facebook, benefit-and-trust-led within character limits for Google Search, scroll-stopping for paid.
- Sound like the trusted local expert, never a hypey ad — anything that reads as spam erodes trust with a big-ticket buyer.
- Use the business's own data and competitor positioning provided to you to angle every message at what actually converts.
Always optimise for the enquiry. Before returning anything, ask yourself: would this make a homeowner reach out? If not, rewrite it until it would.
When asked for JSON, return only valid JSON with no markdown or commentary.`;

export const META_CTAS = ["Book Now", "Get Quote", "Learn More", "Contact Us", "Send Message", "Sign Up"];

export function bizContext(leads: Lead[]) {
  const won = leads.filter((l) => l.stage === "won");
  const suburbs = Array.from(new Set(won.map((l) => l.suburb).filter((s) => s && s !== "—"))).slice(0, 5);
  const bySrc: Record<string, { leads: number; won: number }> = {};
  leads.forEach((l) => {
    bySrc[l.source] = bySrc[l.source] || { leads: 0, won: 0 };
    bySrc[l.source].leads++;
    if (l.stage === "won") bySrc[l.source].won++;
  });
  const conv = Object.entries(bySrc)
    .filter(([, v]) => v.won > 0)
    .map(([k, v]) => `${SOURCES[k]?.label || k}: ${v.won}/${v.leads}`);
  return [
    "Business: Plumb Renovations — quality (not budget) bathroom, ensuite and laundry renovations on the Gold Coast, Australia.",
    "Positioning vs competitors: premium-justified quality, transparent fixed pricing (no surprises), QBCC licensed, workmanship warranty. Not the cheapest — the right quote.",
    suburbs.length ? `Recent won jobs in: ${suburbs.join(", ")}.` : "",
    conv.length ? `Channels converting to won jobs: ${conv.join("; ")}.` : "",
    "Audience: mid-to-high-end owner-occupier homeowners, often 45+.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function adContext(leads: Lead[]) {
  return [
    bizContext(leads),
    "Ad-performance learnings from this account: Google Ads conversion tracking has been broken (0 conversions recorded on ~$8.7k spend) yet Google still drove the only won jobs — so lean into high-intent, geo-specific terms that convert and stop wasting budget on price-shoppers.",
    "The single biggest paid waste was the broad keyword 'bathroom renovation price' (price-shopper intent) — avoid bidding into cheap/price-shopping intent.",
    "High-intent terms that work: " + SEARCH_TERMS_GOOD.join(", ") + ".",
    "Treat these as negatives / avoid: " + SEARCH_TERMS_BAD.join(", ") + ".",
    "Two recent deals were lost on price, so counter price with value (fixed price, QBCC licence, workmanship warranty).",
  ].join(" ");
}

// ---- Per-generator prompt text (ported from the prototype) -------------
export function postPrompt(channels: string[], goal: string, leads: Lead[]) {
  const chLabels = channels.map((c) => SOURCES[c]?.label || c).join(", ") || "Instagram";
  return `Write ONE high-performing organic post to go WITH the attached photo (you are NOT generating an image — the user supplies the photo). Business + conversion context: ${bizContext(leads)} Channel(s): ${chLabels}. Primary goal: ${goal}. Apply bathroom-reno social best practice: open with a hook, use concrete specifics, light proof, one clear CTA. Instagram/Facebook get a warm caption plus relevant hashtags; Google Business Profile gets a short post with no hashtags.

Return ONLY valid JSON, no markdown, exactly these keys:
{"caption": string, "hashtags": string[] (8-12 tags WITH leading #, empty array if GBP only), "cta": string, "suggestedTime": string (day + time window in AEST for this audience), "why": string (one sentence on why it should perform)}`;
}

export function ideasPrompt(leads: Lead[]) {
  return `${bizContext(leads)}

Suggest 5 organic social post ideas likely to perform for this business — especially ones that counter price objections and showcase quality (before/afters, "what's included" breakdowns, suburb spotlights, process). Return ONLY valid JSON: {"ideas":[{"title": string, "why": string}]}`;
}

export function metaAdPrompt(goal: string, leads: Lead[]) {
  return `Task: write a paid Meta (Facebook/Instagram) ad to run WITH the attached photo (you do NOT generate the image). Goal: ${goal}.
Business + ad-performance context: ${adContext(leads)}
Produce 2-3 distinct variations to A/B test, each a different angle. Stay within Meta's recommended lengths: primary text <= 125 characters, headline <= 40 characters, link description <= 30 characters. Pick a call-to-action button from exactly this list: ${META_CTAS.join(", ")}.
Return ONLY valid JSON: {"variations":[{"primaryText":string,"headline":string,"description":string,"cta":string}]}`;
}

export function googleAdPrompt(goal: string, leads: Lead[], withAssets: boolean) {
  return `Task: create Google Ads copy for this business. Goal: ${goal}.
Business + ad-performance context: ${adContext(leads)}
1) A Responsive Search Ad: up to 15 headlines, each a HARD MAX of 30 characters, and up to 4 descriptions, each a HARD MAX of 90 characters. Never exceed these limits — count characters.
2) 8-12 suggested keywords (high-intent, local/geo, lean into what converts) and 8-12 negative keywords (cheap/price-shopper, out-of-area, off-offering terms to exclude).
3) Ad extensions: 4-6 callouts (each <= 25 chars) and 4 sitelinks (each with short link text <= 25 chars and a one-line description <= 35 chars).${withAssets ? "\n4) Performance Max / Display assets: 5 short headlines (<= 30 chars), 1 long headline (<= 90 chars) and 3-4 descriptions (<= 90 chars)." : ""}
Return ONLY valid JSON: {"headlines":string[],"descriptions":string[],"keywords":string[],"negatives":string[],"callouts":string[],"sitelinks":[{"text":string,"description":string}]${withAssets ? ',"pmax":{"shortHeadlines":string[],"longHeadline":string,"descriptions":string[]}' : ""}}`;
}
