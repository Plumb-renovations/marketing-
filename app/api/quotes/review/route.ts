import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ai/ratelimit";
import { getOrgId } from "@/lib/data/org";
import { getBusinessProfile } from "@/lib/business/profileServer";
import { runGenerator } from "@/lib/ai/server";
import { fetchPriceList } from "@/lib/data/priceList";
import { money } from "@/lib/quotes/model";
import {
  analysePricing, detectScopeFlags, fallbackHeadline,
  type ReviewLine, type ReviewQuote, type PriceRef,
} from "@/lib/quotes/review";

// "Review with Hazel" — reviews a quote BEFORE it's sent. The pricing sanity
// check (vs the price list + per-line cost/margin) and the keyword/scope flags
// are computed DETERMINISTICALLY here (reliable, fast); the AI layer adds the
// wording-to-close suggestions. Reads only — it never changes the quote.
//
// Multi-tenant: price list is read via RLS (no org_id filter); the linked
// lead's briefing is read by its unique id (RLS). No new columns/tables, so
// nothing here can error before a migration — there's no migration for this.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = rateLimit(user.id);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }
  const quote: ReviewQuote = body?.quote || {};
  const items: ReviewLine[] = Array.isArray(quote.items) ? quote.items : [];

  try {
    const orgId = await getOrgId(supabase);
    const [profile, priceRows] = await Promise.all([
      getBusinessProfile(orgId),
      fetchPriceList(supabase).catch(() => []),
    ]);
    const priceList: PriceRef[] = priceRows.map((p) => ({ name: p.name, unit: p.unit, unitPrice: p.unitPrice }));

    // Pull the linked lead's pre-quote briefing (motivation/vision/concerns) so
    // the wording leans on what we know. By unique id + RLS — no org filter, no
    // side effects.
    let briefing: any = null;
    let qual: any = null;
    if (quote.leadId) {
      const { data } = await supabase.from("leads").select("briefing, qual").eq("id", quote.leadId).maybeSingle();
      briefing = (data as any)?.briefing ?? null;
      qual = (data as any)?.qual ?? null;
    }

    // ---- Deterministic checks ----
    const pricing = analysePricing(items, priceList);
    const keywords = detectScopeFlags(quote);

    // ---- AI wording-to-close ----
    const itemsText = items
      .map((it, i) => `  [${i + 1}] ${it.description || "(unnamed)"} · ${Number(it.qty) || 0} ${it.unit || "ea"} · ${money(Number(it.unitPrice) || 0)}${it.unitCost != null ? ` · [cost ${money(Number(it.unitCost))}, margin ${Number(it.unitPrice) > 0 ? Math.round(((Number(it.unitPrice) - Number(it.unitCost)) / Number(it.unitPrice)) * 100) : 0}%]` : ""}`)
      .join("\n");
    const briefingText = [
      qual?.motivation ? `motivation: ${qual.motivation}` : "",
      qual?.vision ? `vision: ${qual.vision}` : "",
      Array.isArray(qual?.concerns) && qual.concerns.length ? `concerns: ${qual.concerns.join(", ")}` : "",
      qual?.timeline ? `timeline: ${qual.timeline}` : "",
      qual?.decisionStyle ? `decision style: ${qual.decisionStyle}` : "",
      briefing?.why ? `why: ${briefing.why}` : "",
      briefing?.leadWith ? `lead with: ${briefing.leadWith}` : "",
    ].filter(Boolean).join("; ");
    const pricingText = pricing.length
      ? pricing.map((p) => `${p.description} — ${p.verdict.replace("_", " ")}: ${p.reason}`).join(" | ")
      : "";
    const keywordText = keywords.length ? keywords.map((k) => `${k.label} ("${k.phrase}"): ${k.note}`).join(" | ") : "";

    let ai: any = null;
    try {
      ai = await runGenerator("quote-review", {
        quoteReview: {
          project: quote.projectName || quote.reference || "",
          scope: quote.scopeDescription || "",
          itemsText,
          inclusions: quote.inclusions || "",
          exclusions: quote.exclusions || "",
          total: typeof body?.total === "number" ? money(body.total) : "",
          briefingText,
          pricingText,
          keywordText,
        },
      }, profile);
    } catch (e) {
      console.error("[quote-review] AI wording failed:", (e as Error).message);
    }

    // Map each AI wording suggestion to the exact line it targets so the client
    // can one-click apply it precisely. line = [n] index (1-based) of the line
    // item, or null for the overall scope description. Out-of-range → advisory
    // only (no apply target).
    const wording = (Array.isArray(ai?.wording) ? ai.wording : [])
      .map((w: any) => {
        const suggestion = String(w?.suggestion || "").trim();
        if (!suggestion) return null;
        const n = Number(w?.line);
        const idx = Number.isInteger(n) ? n - 1 : -1;
        const line = idx >= 0 && idx < items.length ? items[idx] : null;
        const isScope = w?.line == null || n === 0;
        return {
          lineId: line ? line.id : null,
          field: line ? "description" : (isScope ? "scope" : null),
          target: line ? (line.description?.trim() || `Line ${idx + 1}`) : (isScope ? "Overall scope" : "This quote"),
          suggestion,
          why: String(w?.why || ""),
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      headline: (ai?.headline && String(ai.headline)) || fallbackHeadline(pricing, keywords),
      wording,
      closeTips: Array.isArray(ai?.closeTips) ? ai.closeTips : [],
      pricing,
      keywords,
      aiAvailable: !!ai,
    });
  } catch (e: any) {
    console.error("[quote-review] failed:", e?.message || e);
    return NextResponse.json({ error: "review_failed", message: e?.message || "Couldn't review the quote." }, { status: 502 });
  }
}
