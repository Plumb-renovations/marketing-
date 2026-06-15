# Integration: Anthropic (server-side AI generation)

Wired in Milestone 2. Powers the AI post studio, idea starters, and the Meta/
Google ad creators.

## Auth flow & where keys live

- Server-only. The browser calls our own routes at `POST /api/ai/{kind}`
  (`kind` ∈ `post | ideas | meta-ad | google-ad`). Those routes call Anthropic
  with `ANTHROPIC_API_KEY` from the server environment. **The key never reaches
  the browser.**
- Model is configured via `ANTHROPIC_MODEL` (no model id is hardcoded in the
  repo). Set it to the current Claude model id in `.env.local` and in Vercel.
- The `AD_PERSONA` system prompt is reused **verbatim** from the prototype
  (`lib/ai/persona.ts`). Prompt construction (business/ad context, per-channel
  copy rules, character limits) runs server-side.

## Request shape

```
POST /api/ai/post        { photoDataUrl?, channels[], goal, leads[] }
POST /api/ai/ideas       { leads[] }
POST /api/ai/meta-ad     { photoDataUrl?, goal, leads[] }
POST /api/ai/google-ad   { photoDataUrl?, goal, leads[] }
```

- **Multimodal:** when `photoDataUrl` (a downscaled base64 data URL) is present,
  it's sent as an image content block alongside the text prompt.
- **JSON + retries:** the persona instructs JSON-only output; the server strips
  any markdown fences and retries the parse once before failing.
- Each route returns the parsed JSON the client expects, or a non-200 — on which
  the client falls back to the ported template copy (no hard failure in the UI).

## Scopes / approval

- No OAuth or review process — a standard Anthropic API key. Create one at
  the Anthropic Console and add billing. No long lead time (unlike Meta/Google).

## Auth gating & rate limits

- Routes require an authenticated org member (`supabase.auth.getUser()` →
  membership via RLS). Unauthenticated calls get `401`.
- In-memory sliding-window limiter (`lib/ai/ratelimit.ts`): **12 requests / 60s
  per user**, returns `429` with `Retry-After`. For multi-instance production,
  swap the in-memory Map for Upstash/Redis — the call sites don't change.
- Anthropic's own API rate limits apply per account/tier; the SDK retries 429/5xx
  with backoff automatically.

## Cost note

Each generation is one Messages API call (max_tokens 700–1800). Photos are
downscaled client-side (≤1024px, ~100–300 KB) before upload to keep image-token
cost down.
