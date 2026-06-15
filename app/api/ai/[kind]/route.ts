import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runGenerator, VALID_KINDS } from "@/lib/ai/server";
import { rateLimit } from "@/lib/ai/ratelimit";

// Server-side AI generators (Milestone 2). Anthropic is called here with the
// AD_PERSONA system prompt and multimodal photo input; the API key never
// reaches the browser. Auth-gated and rate-limited. On any failure the client
// falls back to the ported templates, so the UI degrades gracefully.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: "unknown_generator" }, { status: 404 });
  }

  // Only authenticated org members can spend AI budget.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(user.id);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const result = await runGenerator(kind, payload);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error(`[ai/${kind}] generation failed:`, e?.message || e);
    // 502 so the client falls back to its template copy.
    return NextResponse.json(
      { error: "ai_unavailable", message: e?.message || "AI request failed" },
      { status: 502 },
    );
  }
}
