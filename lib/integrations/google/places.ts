import { googlePlaces } from "../env";

// Google Places API (New) client — server-only. Used by Competitor Intelligence
// to find the top local rivals in a trade + area, and to read their ratings and
// recent reviews. The API key never reaches the browser.

export interface PlaceLite {
  placeId: string;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  address: string;
}

export function placesConfigured(): boolean {
  return googlePlaces.configured;
}

function mapPlace(p: any): PlaceLite {
  return {
    placeId: String(p?.id || ""),
    name: p?.displayName?.text || "",
    rating: typeof p?.rating === "number" ? p.rating : null,
    reviewCount: typeof p?.userRatingCount === "number" ? p.userRatingCount : null,
    address: p?.formattedAddress || "",
  };
}

// Text search (e.g. "bathroom renovation in Gold Coast & Northern Rivers").
export async function textSearchPlaces(query: string, max = 20): Promise<PlaceLite[]> {
  if (!googlePlaces.apiKey) throw new Error("GOOGLE_PLACES_API_KEY is not set");
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": googlePlaces.apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: Math.min(20, Math.max(1, max)), regionCode: "AU" }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Places searchText ${res.status}`);
  return (data.places || []).map(mapPlace).filter((p: PlaceLite) => p.placeId && p.name);
}

// Place details with a sample of recent review texts (up to `maxReviews`).
export async function placeReviews(placeId: string, maxReviews = 5): Promise<string[]> {
  if (!googlePlaces.apiKey) throw new Error("GOOGLE_PLACES_API_KEY is not set");
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": googlePlaces.apiKey,
      "X-Goog-FieldMask": "id,reviews",
    },
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Places details ${res.status}`);
  return (data.reviews || [])
    .map((r: any) => (r?.text?.text || r?.originalText?.text || "").trim())
    .filter(Boolean)
    .slice(0, maxReviews);
}
