import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessProfile } from "@/lib/business/profileServer";
import { runGenerator } from "@/lib/ai/server";
import { placesConfigured, textSearchPlaces, placeReviews, type PlaceLite } from "@/lib/integrations/google/places";

type Admin = ReturnType<typeof createAdminClient>;

// Defaults so it generalises for other Hazel customers before they fill in a
// profile (and matches the original Plumb "why they're winning" view).
const DEFAULT_TRADE = "bathroom renovation";
const DEFAULT_AREA = "Gold Coast & Northern Rivers";

async function saveReport(admin: Admin, orgId: string, status: string, opts: { summary?: string; message?: string }) {
  await admin.from("competitor_reports").upsert({
    org_id: orgId,
    market_summary: opts.summary ?? null,
    status,
    message: opts.message ?? null,
    generated_at: new Date().toISOString(),
  });
}

// Refresh Section 1 for one org: find the top local rivals via Google Places,
// pull their reviews, run the AI analysis, and store the snapshot. Resilient —
// records an error status (visible in the UI) instead of throwing to the caller.
export async function refreshCompetitorReviews(
  orgId: string,
): Promise<{ ok: boolean; count: number; message?: string }> {
  const admin = createAdminClient();
  const tag = `[competitors] org=${orgId}`;

  if (!placesConfigured()) {
    await saveReport(admin, orgId, "error", { message: "Google Places isn't configured yet — set GOOGLE_PLACES_API_KEY." });
    console.warn(`${tag} places not configured`);
    return { ok: false, count: 0, message: "places_not_configured" };
  }

  try {
    const profile = await getBusinessProfile(orgId);
    const trade = profile.businessType?.trim() || DEFAULT_TRADE;
    const areaLabel = profile.serviceAreaLabel?.trim() || DEFAULT_AREA;
    const ownName = profile.businessName?.trim().toLowerCase() || "";
    const query = `${trade} in ${areaLabel}`;

    console.log(`${tag} searching "${query}"`);
    const found = await textSearchPlaces(query, 20);

    // Rank by rating × review count (trust × volume); drop the user's own listing.
    const score = (p: PlaceLite) => (Number(p.rating) || 0) * (Number(p.reviewCount) || 0);
    const ranked = found
      .filter((p) => !ownName || !p.name.toLowerCase().includes(ownName))
      .sort((a, b) => score(b) - score(a))
      .slice(0, 10);

    // Pull a sample of recent reviews for each (best-effort).
    const withReviews: (PlaceLite & { reviews: string[] })[] = [];
    for (const p of ranked) {
      let reviews: string[] = [];
      try {
        reviews = await placeReviews(p.placeId, 5);
      } catch (e) {
        console.warn(`${tag} reviews failed for ${p.name}: ${(e as Error).message}`);
      }
      withReviews.push({ ...p, reviews });
    }

    if (withReviews.length === 0) {
      await saveReport(admin, orgId, "error", { message: `No competitors found for "${query}". Check the trade + service area on your Business Profile.` });
      return { ok: false, count: 0, message: "no_results" };
    }

    // AI analysis (existing pipeline).
    const analysis: any = await runGenerator(
      "competitor-reviews",
      { competitors: withReviews.map((p) => ({ name: p.name, rating: p.rating, reviewCount: p.reviewCount, reviews: p.reviews })) },
      profile,
    );
    const byName = new Map<string, any>();
    for (const c of analysis?.competitors || []) byName.set(String(c.name || "").toLowerCase(), c);

    // Replace the org's snapshot.
    await admin.from("competitor_insights").delete().eq("org_id", orgId);
    const rows = withReviews.map((p, i) => {
      const a = byName.get(p.name.toLowerCase()) || {};
      return {
        org_id: orgId,
        name: p.name,
        place_id: p.placeId,
        rating: p.rating,
        review_count: p.reviewCount,
        address: p.address || null,
        why_ahead: a.whyAhead ?? null,
        how_to_beat: a.howToBeat ?? null,
        rank: i,
      };
    });
    const { error: insErr } = await admin.from("competitor_insights").insert(rows);
    if (insErr) throw new Error(insErr.message);

    await saveReport(admin, orgId, "ok", { summary: analysis?.marketSummary || "" });
    console.log(`${tag} refreshed ${rows.length} competitors`);
    return { ok: true, count: rows.length };
  } catch (e: any) {
    const message = e?.message || "refresh failed";
    await saveReport(admin, orgId, "error", { message });
    console.error(`${tag} refresh FAILED: ${message}`);
    return { ok: false, count: 0, message };
  }
}
