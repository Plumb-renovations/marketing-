// The AD_PERSONA system prompt + the business/ad context builders and
// per-generator prompt text. These are now driven by the org's Business Profile
// so the copy fits any local service business (not just renovation). Server-only:
// this and the prompts it builds are sent to Anthropic from the server route.
import type { Lead } from "@/lib/domain/types";
import { SOURCES } from "@/lib/domain/constants";
import type { BusinessProfile } from "@/lib/business/profile";

export const META_CTAS = ["Book Now", "Get Quote", "Learn More", "Contact Us", "Send Message", "Sign Up"];

const businessName = (p: BusinessProfile) => p.businessName?.trim() || "this business";
const businessType = (p: BusinessProfile) => p.businessType?.trim() || "local services";
const area = (p: BusinessProfile) => p.serviceAreaLabel?.trim();

// The system prompt — a world-class direct-response marketer briefed on THIS
// org's business. Parameterised from the profile (business type, area, tone).
export function adPersona(p: BusinessProfile): string {
  return `You are a world-class direct-response marketer for ${businessName(p)}, a ${businessType(p)} business${area(p) ? ` serving ${area(p)}` : ""}. Your single job is to turn every piece of content into a lead — an enquiry or quote request. This is not brand fluff: every caption, post and ad must move a high-intent local customer to take one clear action.
For everything you write:
- Open with a hook that stops someone who needs this service.
- Speak to the real desire and the real objections for this kind of job — the outcome they want, against the worries of cost, hassle, disruption and trusting the wrong provider.
- Use proven direct-response structure (problem–agitate–solve, or hook–value–offer). Be specific and concrete, never generic.
- Build trust and lower risk using the business's own selling points, and counter price objections with value — price is a common reason service deals are lost.
- End with ONE clear, low-friction call to action that captures a lead. Make the next step effortless.
- Match the platform: punchy and visual-first for Instagram/Facebook, benefit-and-trust-led within character limits for Google Search, scroll-stopping for paid.
- Sound like the trusted local expert, never a hypey ad — anything that reads as spam erodes trust.
- Use the business's own data and positioning provided to you to angle every message at what actually converts.
${p.tone ? `- Voice/tone: ${p.tone}\n` : ""}Always optimise for the enquiry. Before returning anything, ask yourself: would this make a customer reach out? If not, rewrite it until it would.
When asked for JSON, return only valid JSON with no markdown or commentary.`;
}

// Business description for prompts — built from the profile + live lead data.
export function bizContext(p: BusinessProfile, leads: Lead[]) {
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
    `Business: ${businessName(p)} — ${businessType(p)}${area(p) ? ` serving ${area(p)}` : ""}.`,
    p.services.length ? `Services offered: ${p.services.join(", ")}.` : "",
    p.sellingPoints.length ? `Key selling points: ${p.sellingPoints.join("; ")}.` : "",
    p.offer ? `Current offer/promo to feature: ${p.offer}.` : "",
    suburbs.length ? `Recent won jobs in: ${suburbs.join(", ")}.` : "",
    conv.length ? `Channels converting to won jobs: ${conv.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

// Adds generic paid-media guidance on top of the business context.
export function adContext(p: BusinessProfile, leads: Lead[]) {
  const svc = p.services[0] || businessType(p);
  return [
    bizContext(p, leads),
    `Lean into high-intent, geo-specific search terms${area(p) ? ` (e.g. "${svc} ${area(p)}", "${svc} near me")` : ` (e.g. "${svc} near me")`} that signal someone ready to buy.`,
    "Avoid bidding into cheap/price-shopper intent and out-of-area or off-offering searches — exclude them as negatives.",
    p.sellingPoints.length
      ? `Counter price objections with value: ${p.sellingPoints.join(", ")}.`
      : "Counter price objections with concrete value and trust signals.",
  ].join(" ");
}

// ---- Per-generator prompt text -----------------------------------------
export function postPrompt(p: BusinessProfile, channels: string[], goal: string, leads: Lead[]) {
  const chLabels = channels.map((c) => SOURCES[c]?.label || c).join(", ") || "Instagram";
  return `Write ONE high-performing organic post to go WITH the attached photo (you are NOT generating an image — the user supplies the photo). Business + conversion context: ${bizContext(p, leads)} Channel(s): ${chLabels}. Primary goal: ${goal}. Apply local-service social best practice: open with a hook, use concrete specifics, light proof, one clear CTA. Instagram/Facebook get a warm caption plus relevant hashtags; Google Business Profile gets a short post with no hashtags.

Return ONLY valid JSON, no markdown, exactly these keys:
{"caption": string, "hashtags": string[] (8-12 tags WITH leading #, empty array if GBP only), "cta": string, "suggestedTime": string (day + time window in AEST for this audience), "why": string (one sentence on why it should perform)}`;
}

export function ideasPrompt(p: BusinessProfile, leads: Lead[]) {
  return `${bizContext(p, leads)}

Suggest 5 organic social post ideas likely to perform for this business — especially ones that counter price objections and showcase quality (before/afters, "what's included" breakdowns, suburb spotlights, process). Return ONLY valid JSON: {"ideas":[{"title": string, "why": string}]}`;
}

export function metaAdPrompt(p: BusinessProfile, goal: string, leads: Lead[]) {
  return `Task: write a paid Meta (Facebook/Instagram) ad to run WITH the attached photo (you do NOT generate the image). Goal: ${goal}.
Business + ad-performance context: ${adContext(p, leads)}
Produce 2-3 distinct variations to A/B test, each a different angle. Stay within Meta's recommended lengths: primary text <= 125 characters, headline <= 40 characters, link description <= 30 characters. Pick a call-to-action button from exactly this list: ${META_CTAS.join(", ")}.
Return ONLY valid JSON: {"variations":[{"primaryText":string,"headline":string,"description":string,"cta":string}]}`;
}

export function googleAdPrompt(p: BusinessProfile, goal: string, leads: Lead[], withAssets: boolean) {
  return `Task: create Google Ads copy for this business. Goal: ${goal}.
Business + ad-performance context: ${adContext(p, leads)}
1) A Responsive Search Ad: up to 15 headlines, each a HARD MAX of 30 characters, and up to 4 descriptions, each a HARD MAX of 90 characters. Never exceed these limits — count characters.
2) 8-12 suggested keywords (high-intent, local/geo, lean into what converts) and 8-12 negative keywords (cheap/price-shopper, out-of-area, off-offering terms to exclude).
3) Ad extensions: 4-6 callouts (each <= 25 chars) and 4 sitelinks (each with short link text <= 25 chars and a one-line description <= 35 chars).${withAssets ? "\n4) Performance Max / Display assets: 5 short headlines (<= 30 chars), 1 long headline (<= 90 chars) and 3-4 descriptions (<= 90 chars)." : ""}
Return ONLY valid JSON: {"headlines":string[],"descriptions":string[],"keywords":string[],"negatives":string[],"callouts":string[],"sitelinks":[{"text":string,"description":string}]${withAssets ? ',"pmax":{"shortHeadlines":string[],"longHeadline":string,"descriptions":string[]}' : ""}}`;
}

// Suggests the campaign + ad-set SETUP (not copy) for a new Meta lead campaign:
// objective, a sensible starting daily budget, audience interests and names.
export function campaignPlanPrompt(p: BusinessProfile, goal: string) {
  return `Plan a new Meta (Facebook/Instagram) ad campaign setup for this business. Goal: ${goal || "book quotes / enquiries"}.
Business: ${bizContext(p, [])}
You are choosing the campaign STRUCTURE, not the ad copy. Apply lead-gen best practice for a local service business:
- Objective: pick from exactly this list (OUTCOME_LEADS, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT, OUTCOME_AWARENESS, OUTCOME_SALES). For a tradie chasing enquiries this is almost always OUTCOME_LEADS.
- Daily budget (AUD): a sensible, conservative STARTING budget for one ad set in a single metro service area (typically $20–$60/day) — enough to exit Meta's learning phase without overspending while testing.
- Interests: 4–6 Meta detailed-targeting interest names matched to this business's likely buyers.
- Names: a short campaign name and ad-set name a tradie would recognise.
Return ONLY valid JSON: {"objective": string, "dailyBudgetAud": number, "interests": string[], "campaignName": string, "adSetName": string, "rationale": string (one plain-English line on why this budget + objective)}`;
}

// "Paste & beat": analyse a competitor's pasted live ad(s), then out-position
// them with stronger, differentiated copy in our voice for the chosen target.
export function competitorBeatPrompt(
  p: BusinessProfile,
  competitorAds: string,
  competitorName: string,
  platform: string,
  format: string,
  leads: Lead[],
) {
  const plat = platform === "instagram" ? "Instagram" : "Facebook";
  const wantsTags = format === "post";
  return `You are given one or more LIVE ADS from a competitor${competitorName ? ` (${competitorName})` : ""}, copied from the Meta Ad Library.

COMPETITOR AD(S):
"""
${(competitorAds || "").slice(0, 4000)}
"""

Our business + conversion context: ${format === "ad" ? adContext(p, leads) : bizContext(p, leads)}
Target to produce: a ${plat} ${format}.

Do two things:
1) Briefly analyse what the competitor is doing — the main angles, hooks and offers they use, and any weakness we can exploit. 3-5 short, concrete bullets.
2) Write differentiated, STRONGER copy for OUR business that out-positions them — in our voice, leaning on our real differentiators (e.g. fixed-price, licensed, workmanship warranty, winning suburbs, current offer). Do NOT copy their wording: beat it with a sharper hook, clearer value and ONE low-friction call to action.${format === "ad" ? " Keep the primary text around 125 characters where you can." : ""}

Return ONLY valid JSON, exactly these keys:
{"analysis": string[], "positioning": string (one line on how we win against them), "caption": string (the ready-to-use ${format} text), "hashtags": string[] (${wantsTags ? "6-10 relevant tags WITH leading #" : "empty array"}), "cta": string, "variations": string[] (1-2 alternative versions of the caption)}`;
}
