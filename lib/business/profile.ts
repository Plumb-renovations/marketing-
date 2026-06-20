// Per-org Business Profile — what kind of service business this org is. Drives
// the AI ad-copy generation and the ad-targeting defaults so Hazel works for any
// local service business, not just renovation. Pure helpers (client + server).

export interface BusinessProfile {
  businessName: string;
  businessType: string; // e.g. "bathroom renovation", "pressure washing", "landscaping"
  services: string[]; // services offered
  serviceAreaLabel: string; // suburbs / region, e.g. "Gold Coast & Northern Rivers"
  serviceAreaLat: number | null; // targeting centre (optional)
  serviceAreaLng: number | null;
  serviceRadiusKm: number;
  sellingPoints: string[]; // key selling points / differentiators
  tone: string; // tone of voice
  offer: string; // current offer / promo
  audienceInterests: string[]; // Meta detailed-targeting interest names
}

// Generic fallback for an org that hasn't filled in its profile yet.
export const DEFAULT_PROFILE: BusinessProfile = {
  businessName: "",
  businessType: "local services",
  services: [],
  serviceAreaLabel: "",
  serviceAreaLat: null,
  serviceAreaLng: null,
  serviceRadiusKm: 25,
  sellingPoints: [],
  tone: "friendly, professional and trustworthy",
  offer: "",
  audienceInterests: [],
};

export function rowToProfile(row: any): BusinessProfile {
  if (!row) return { ...DEFAULT_PROFILE };
  return {
    businessName: row.business_name ?? "",
    businessType: row.business_type || DEFAULT_PROFILE.businessType,
    services: row.services ?? [],
    serviceAreaLabel: row.service_area_label ?? "",
    serviceAreaLat: row.service_area_lat != null ? Number(row.service_area_lat) : null,
    serviceAreaLng: row.service_area_lng != null ? Number(row.service_area_lng) : null,
    serviceRadiusKm: row.service_radius_km ?? DEFAULT_PROFILE.serviceRadiusKm,
    sellingPoints: row.selling_points ?? [],
    tone: row.tone || DEFAULT_PROFILE.tone,
    offer: row.offer ?? "",
    audienceInterests: row.audience_interests ?? [],
  };
}

export function profileToRow(orgId: string, p: BusinessProfile): Record<string, any> {
  return {
    org_id: orgId,
    business_name: p.businessName.trim(),
    business_type: p.businessType.trim(),
    services: clean(p.services),
    service_area_label: p.serviceAreaLabel.trim(),
    service_area_lat: p.serviceAreaLat,
    service_area_lng: p.serviceAreaLng,
    service_radius_km: p.serviceRadiusKm,
    selling_points: clean(p.sellingPoints),
    tone: p.tone.trim(),
    offer: p.offer.trim(),
    audience_interests: clean(p.audienceInterests),
  };
}

const clean = (arr: string[]) => (arr || []).map((s) => s.trim()).filter(Boolean);
