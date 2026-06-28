// Server-side AI generation. Calls the Anthropic API with the AD_PERSONA system
// prompt, multimodal photo input, JSON parsing and retries. The API key and
// model id come from env — neither is ever exposed to the browser.
import Anthropic from "@anthropic-ai/sdk";
import type { Lead } from "@/lib/domain/types";
import type { BusinessProfile } from "@/lib/business/profile";
import {
  adPersona,
  postPrompt,
  contentPlanPrompt,
  ideasPrompt,
  metaAdPrompt,
  googleAdPrompt,
  strategyAdsPrompt,
  competitorBeatPrompt,
  campaignPlanPrompt,
  creativeReviewPrompt,
  creativeVideoReviewPrompt,
  coachSystemPrompt,
  coachPrompt,
  coachAskPrompt,
} from "@/lib/ai/persona";

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ANTHROPIC_MODEL;

function getClient() {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  if (!model) throw new Error("ANTHROPIC_MODEL is not set");
  return new Anthropic({ apiKey });
}

const dataUrlParts = (u?: string | null) => {
  const m = /^data:(.+?);base64,(.*)$/.exec(u || "");
  return m ? { media_type: m[1], data: m[2] } : null;
};

const parseJSON = (t: string) =>
  JSON.parse((t || "").replace(/```json/gi, "").replace(/```/g, "").trim());

// One Anthropic call: persona system prompt + a single multimodal user turn.
async function callClaude(content: any[], maxTokens: number, system: string) {
  const client = getClient();
  const res = await client.messages.create({
    model: model!,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content }],
  });
  return (res.content || [])
    .map((b: any) => (b.type === "text" ? b.text : ""))
    .join("");
}

// Call + parse with one retry (the model occasionally wraps JSON in prose).
async function callJSON(content: any[], maxTokens: number, system: string) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callClaude(content, maxTokens, system);
    try {
      return parseJSON(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Failed to parse AI JSON");
}

function buildContent(prompt: string, photoDataUrl?: string | null) {
  const content: any[] = [];
  const parts = dataUrlParts(photoDataUrl);
  if (parts) content.push({ type: "image", source: { type: "base64", media_type: parts.media_type, data: parts.data } });
  content.push({ type: "text", text: prompt });
  return content;
}

// Multi-image user turn: each image labelled by index so the model can rank
// them, then the prompt. Used by the creative reviewer.
function buildMultiImageContent(prompt: string, images: string[]) {
  const content: any[] = [];
  images.forEach((url, i) => {
    const parts = dataUrlParts(url);
    if (parts) {
      content.push({ type: "text", text: `Image ${i}:` });
      content.push({ type: "image", source: { type: "base64", media_type: parts.media_type, data: parts.data } });
    }
  });
  content.push({ type: "text", text: prompt });
  return content;
}

interface Payload {
  photoDataUrl?: string | null;
  images?: string[];
  learned?: string;
  media?: string; // 'image' | 'video' (creative-review)
  context?: string; // 'paid' | 'organic' (creative-review framing)
  frameTimes?: number[];
  durationSec?: number;
  channels?: string[];
  goal?: string;
  leads?: Lead[];
  competitorAds?: string;
  competitorName?: string;
  platform?: string;
  format?: string;
  dataBlock?: string; // coach / coach-ask account summary
  question?: string; // coach-ask
  strategy?: string; // coach strategy fed into ad copy
  imageDescription?: string; // creative reviewer's description of the attached media
  imageKeyPoints?: string[]; // creative reviewer's selling points
  angles?: string[]; // strategy-ads: angles to turn into drafts
  planDays?: number; // content-plan window length
  postsPerWeek?: number; // content-plan cadence
  startDate?: string; // content-plan start (YYYY-MM-DD)
}

// Dispatch a generator by kind. The org's Business Profile drives the system
// prompt + business context so copy fits any service business. Returns the
// parsed JSON the client expects.
export async function runGenerator(kind: string, payload: Payload, profile: BusinessProfile) {
  const leads = payload.leads || [];
  const isCoach = kind === "coach" || kind === "coach-ask";
  const sys = isCoach ? coachSystemPrompt(profile) : adPersona(profile);
  switch (kind) {
    case "coach":
      return callJSON(buildContent(coachPrompt(profile, payload.dataBlock || "")), 1600, sys);
    case "coach-ask":
      return callJSON(buildContent(coachAskPrompt(profile, payload.dataBlock || "", payload.question || "")), 1000, sys);
    case "post":
      return callJSON(buildContent(postPrompt(profile, payload.channels || [], payload.goal || "", leads), payload.photoDataUrl), 1024, sys);
    case "ideas":
      return callJSON(buildContent(ideasPrompt(profile, leads)), 700, sys);
    case "content-plan":
      return callJSON(
        buildContent(contentPlanPrompt(profile, leads, {
          days: payload.planDays || 30,
          postsPerWeek: payload.postsPerWeek || 3,
          startDate: payload.startDate || new Date().toISOString().slice(0, 10),
        })),
        4000,
        sys,
      );
    case "meta-ad": {
      const opts = { strategy: payload.strategy, imageDescription: payload.imageDescription, imageKeyPoints: payload.imageKeyPoints };
      return callJSON(buildContent(metaAdPrompt(profile, payload.goal || "", leads, opts), payload.photoDataUrl), 1400, sys);
    }
    case "google-ad": {
      const opts = { strategy: payload.strategy, imageDescription: payload.imageDescription, imageKeyPoints: payload.imageKeyPoints };
      return callJSON(buildContent(googleAdPrompt(profile, payload.goal || "", leads, !!payload.photoDataUrl, opts), payload.photoDataUrl), 1800, sys);
    }
    case "strategy-ads":
      return callJSON(
        buildContent(
          strategyAdsPrompt(profile, payload.strategy || "", payload.angles || [], {
            imageDescription: payload.imageDescription,
            imageKeyPoints: payload.imageKeyPoints,
          }),
          payload.photoDataUrl,
        ),
        1800,
        sys,
      );
    case "competitor-beat":
      return callJSON(buildContent(competitorBeatPrompt(profile, payload.competitorAds || "", payload.competitorName || "", payload.platform || "facebook", payload.format || "post", leads)), 1400, sys);
    case "campaign-plan":
      return callJSON(buildContent(campaignPlanPrompt(profile, payload.goal || "")), 600, sys);
    case "creative-review": {
      const images = (payload.images || []).filter(Boolean).slice(0, 6);
      if (!images.length) return null;
      const ctx = payload.context === "organic" ? "organic" : "paid";
      const prompt =
        payload.media === "video"
          ? creativeVideoReviewPrompt(profile, payload.durationSec || 0, payload.frameTimes || [], payload.learned || "", ctx)
          : creativeReviewPrompt(profile, images.length, payload.learned || "", ctx);
      return callJSON(buildMultiImageContent(prompt, images), 2000, sys);
    }
    default:
      return null;
  }
}

export const VALID_KINDS = ["post", "ideas", "content-plan", "meta-ad", "google-ad", "strategy-ads", "competitor-beat", "campaign-plan", "creative-review", "coach", "coach-ask"];
