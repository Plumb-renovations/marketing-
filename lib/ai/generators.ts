// Client-side AI generators. These POST to our own server routes (wired up in
// Milestone 2 — they call Anthropic server-side so no key ever reaches the
// browser). Until then the routes return 501 and the UI falls back to the
// templates ported from the prototype.
import type { Lead } from "@/lib/domain/types";
import { SOURCES, SEARCH_TERMS_GOOD, CONTENT_IDEAS } from "@/lib/domain/constants";

async function callAi(path: string, payload: any) {
  const res = await fetch(`/api/ai/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // Surface the server's reason (e.g. "ANTHROPIC_MODEL is not set",
    // "rate_limited") instead of a bare status, so failures are diagnosable.
    let detail = "";
    try {
      const e = await res.json();
      detail = e?.message || e?.error || "";
    } catch {}
    throw new Error(`AI request failed (${res.status})${detail ? ": " + detail : ""}`);
  }
  return res.json();
}

// Shrink an uploaded image to a base64 data URL before sending it on.
export function downscaleImage(file: File, maxDim = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (Math.max(width, height) > maxDim) {
          const r = maxDim / Math.max(width, height);
          width = Math.round(width * r);
          height = Math.round(height * r);
        }
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        c.getContext("2d")!.drawImage(img, 0, 0, width, height);
        try {
          resolve(c.toDataURL("image/jpeg", quality));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ---- Live generators (server-backed) -----------------------------------
export async function generatePost(args: {
  photoDataUrl: string | null;
  channels: string[];
  goal: string;
  leads: Lead[];
}) {
  const j = await callAi("post", args);
  return {
    caption: j.caption || "",
    hashtags: Array.isArray(j.hashtags) ? j.hashtags.join(" ") : j.hashtags || "",
    cta: j.cta || "",
    suggestedTime: j.suggestedTime || "",
    why: j.why || "",
  };
}

export async function generateIdeas(args: { leads: Lead[] }) {
  const j = await callAi("ideas", args);
  return (j.ideas || []).slice(0, 6);
}

export async function generateMetaAd(args: {
  photoDataUrl: string | null;
  goal: string;
  leads: Lead[];
}) {
  const j = await callAi("meta-ad", args);
  return { variations: (j.variations || []).slice(0, 3) };
}

export async function generateGoogleAd(args: {
  photoDataUrl: string | null;
  goal: string;
  leads: Lead[];
}) {
  const j = await callAi("google-ad", args);
  return {
    headlines: (j.headlines || []).slice(0, 15),
    descriptions: (j.descriptions || []).slice(0, 4),
    keywords: j.keywords || [],
    negatives: j.negatives || [],
    callouts: j.callouts || [],
    sitelinks: j.sitelinks || [],
    pmax: j.pmax || null,
  };
}

// Suggest the campaign + ad-set setup (objective, budget, interests, names).
export async function generateCampaignPlan(args: { goal: string }) {
  const j = await callAi("campaign-plan", args);
  return {
    objective: j.objective || "OUTCOME_LEADS",
    dailyBudgetAud: Number(j.dailyBudgetAud) || 0,
    interests: Array.isArray(j.interests) ? j.interests : [],
    campaignName: j.campaignName || "",
    adSetName: j.adSetName || "",
    rationale: j.rationale || "",
  };
}

// Analyse pasted competitor ad(s) and generate stronger, differentiated copy.
export async function generateCompetitorBeat(args: {
  competitorAds: string;
  competitorName?: string;
  platform: string;
  format: string;
  leads: Lead[];
}) {
  const j = await callAi("competitor-beat", args);
  return {
    analysis: Array.isArray(j.analysis) ? j.analysis : [],
    positioning: j.positioning || "",
    caption: j.caption || "",
    hashtags: Array.isArray(j.hashtags) ? j.hashtags : [],
    cta: j.cta || "",
    variations: Array.isArray(j.variations) ? j.variations : [],
  };
}

// ---- Offline template fallbacks (ported verbatim) ----------------------
const GOAL_LINE: Record<string, string> = {
  "Book quotes / enquiries": "Ready to start yours? Book a free on-site measure and fixed-price quote.",
  "Showcase craftsmanship": "Every detail done properly — tiling, waterproofing and a finish you can rely on.",
  "Counter price objections": "The cheapest quote is rarely the cheapest job. Here's what a proper fixed price includes.",
  "Build trust & reviews": "Another happy Gold Coast homeowner — QBCC licensed, fully warranted, no surprises.",
  "Educate (process / what's included)": "From demo to handover, here's exactly what's included in a quality bathroom renovation.",
};

export function fallbackPost({ channels, goal, leads }: { channels: string[]; goal: string; leads: Lead[] }) {
  const won = leads.filter((l) => l.stage === "won");
  const suburb = (won.find((l) => l.suburb && l.suburb !== "—") || ({} as Lead)).suburb || "the Gold Coast";
  const gbpOnly = channels.length === 1 && channels[0] === "gbp";
  return {
    caption: `${GOAL_LINE[goal] || GOAL_LINE["Book quotes / enquiries"]} A recent fixed-price bathroom in ${suburb} — QBCC licensed, workmanship warranty, no surprises.`,
    hashtags: gbpOnly ? "" : "#goldcoastbathrooms #bathroomrenovation #goldcoastbuilder #bathroomdesign #qbcc #fixedprice #renovation #bathroominspo",
    cta: "Book your free quote — link in bio.",
    suggestedTime: "Thursday 7:00–8:00 pm AEST",
    why: "(Offline template) Live AI was unavailable — using a proven template.",
  };
}

export const FALLBACK_IDEAS = CONTENT_IDEAS.map((c) => ({ title: c.headline, why: c.insight }));

export function fallbackMetaAd({ goal, leads }: { goal: string; leads: Lead[] }) {
  const won = leads.filter((l) => l.stage === "won");
  const suburb = (won.find((l) => l.suburb && l.suburb !== "—") || ({} as Lead)).suburb || "the Gold Coast";
  return {
    _offline: true,
    variations: [
      { primaryText: `Dreaming of a new bathroom but dread the cost and mess? Fixed-price Gold Coast renos — QBCC licensed, fully warranted, no surprises.`, headline: "Fixed-Price Bathroom Renos", description: "Free quote · QBCC licensed", cta: "Get Quote" },
      { primaryText: `Tired of the dated, leaking bathroom? We renovate it properly for a fixed price — no blowouts. See recent ${suburb} transformations.`, headline: "Renovate With Confidence", description: "No-surprise fixed pricing", cta: "Learn More" },
      { primaryText: `Cheapest quote isn't the cheapest job. Get a transparent fixed-price quote from a QBCC-licensed team you can trust. Book today.`, headline: "A Fair, Fixed Quote", description: "Workmanship warranty", cta: "Book Now" },
    ],
  };
}

export function fallbackGoogleAd({ photoDataUrl }: { photoDataUrl: string | null }) {
  const base: any = {
    _offline: true,
    headlines: ["Gold Coast Bathroom Renos", "Fixed-Price Bathrooms", "Free Bathroom Quote", "QBCC Licensed Builder", "No-Surprise Fixed Pricing", "Bathroom Renovations GC", "Quality Bathroom Reno", "Book A Free Quote", "Workmanship Warranty", "Burleigh Bathroom Renos", "Ensuite & Laundry Renos", "Renovate With Confidence", "Local Bathroom Experts", "Free On-Site Quote", "Fixed Quote, No Surprises"],
    descriptions: ["Fixed-price Gold Coast bathroom renovations. QBCC licensed and fully warranted. Free quote.", "From demo to handover with no surprises. Transparent fixed pricing — book your free quote.", "Quality bathrooms done right by a QBCC-licensed team with a workmanship warranty.", "See why locals choose us. Free on-site measure and a fixed-price quote — book today."],
    keywords: SEARCH_TERMS_GOOD.slice(0, 10),
    negatives: ["cheap", "budget", "affordable", "under $5000", "how much", "diy", "remodeling", "brisbane", "logan", "sunshine coast"],
    callouts: ["Fixed-Price Quotes", "QBCC Licensed", "Workmanship Warranty", "Free On-Site Quote", "Local Gold Coast Team"],
    sitelinks: [{ text: "Free Quote", description: "Book an on-site measure" }, { text: "Our Work", description: "Recent bathroom transformations" }, { text: "Bathroom Renos", description: "Full bathroom renovations" }, { text: "Reviews", description: "What Gold Coast clients say" }],
    pmax: null,
  };
  if (photoDataUrl)
    base.pmax = {
      shortHeadlines: ["Fixed-Price Bathrooms", "Gold Coast Bathroom Renos", "Free Bathroom Quote", "QBCC Licensed Builder", "No-Surprise Pricing"],
      longHeadline: "Quality fixed-price bathroom renovations across the Gold Coast — QBCC licensed",
      descriptions: ["Fixed-price bathroom renovations with no surprises. QBCC licensed, fully warranted.", "From demo to handover by a trusted local team. Book a free on-site quote today.", "End the dated, leaking bathroom. Transparent fixed pricing and a workmanship warranty."],
    };
  return base;
}
