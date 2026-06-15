import { NextResponse } from "next/server";

// Placeholder for the server-side AI generators. Milestone 2 implements these
// (Anthropic API with ANTHROPIC_API_KEY, AD_PERSONA system prompt, multimodal
// photo input, JSON parsing + retries + rate limiting). Until then this returns
// 501 and the client falls back to the ported templates.
export async function POST(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  return NextResponse.json(
    { error: "not_implemented", message: `AI generator '${kind}' arrives in Milestone 2.` },
    { status: 501 },
  );
}
