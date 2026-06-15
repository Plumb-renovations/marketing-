// Server-side AI generation. Calls the Anthropic API with the AD_PERSONA system
// prompt, multimodal photo input, JSON parsing and retries. The API key and
// model id come from env — neither is ever exposed to the browser.
import Anthropic from "@anthropic-ai/sdk";
import type { Lead } from "@/lib/domain/types";
import {
  AD_PERSONA,
  postPrompt,
  ideasPrompt,
  metaAdPrompt,
  googleAdPrompt,
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
async function callClaude(content: any[], maxTokens: number) {
  const client = getClient();
  const res = await client.messages.create({
    model: model!,
    max_tokens: maxTokens,
    system: AD_PERSONA,
    messages: [{ role: "user", content }],
  });
  return (res.content || [])
    .map((b: any) => (b.type === "text" ? b.text : ""))
    .join("");
}

// Call + parse with one retry (the model occasionally wraps JSON in prose).
async function callJSON(content: any[], maxTokens: number) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callClaude(content, maxTokens);
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

interface Payload {
  photoDataUrl?: string | null;
  channels?: string[];
  goal?: string;
  leads?: Lead[];
}

// Dispatch a generator by kind. Returns the parsed JSON the client expects.
export async function runGenerator(kind: string, payload: Payload) {
  const leads = payload.leads || [];
  switch (kind) {
    case "post":
      return callJSON(buildContent(postPrompt(payload.channels || [], payload.goal || "", leads), payload.photoDataUrl), 1024);
    case "ideas":
      return callJSON(buildContent(ideasPrompt(leads)), 700);
    case "meta-ad":
      return callJSON(buildContent(metaAdPrompt(payload.goal || "", leads), payload.photoDataUrl), 1400);
    case "google-ad":
      return callJSON(buildContent(googleAdPrompt(payload.goal || "", leads, !!payload.photoDataUrl), payload.photoDataUrl), 1800);
    default:
      return null;
  }
}

export const VALID_KINDS = ["post", "ideas", "meta-ad", "google-ad"];
