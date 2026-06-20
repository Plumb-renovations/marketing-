// Thin Google Business Profile API client. Calls are made with a short-lived
// access token (minted from the per-org refresh token in google/config.ts).
// The Business Profile APIs are split across a few hosts:
//   - Account Management:  mybusinessaccountmanagement.googleapis.com/v1
//   - Business Information: mybusinessbusinessinformation.googleapis.com/v1
//   - Reviews (v4):         mybusiness.googleapis.com/v4   (PR 2)

// Raised when Google rejects the token (expired/revoked/insufficient), so the
// UI can show a "reconnect" state instead of a generic error.
export class GoogleAuthError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "GoogleAuthError";
    this.status = status;
  }
}

export async function gbFetch(token: string, url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const msg = data?.error?.message || `${res.status} ${res.statusText}`;
    if (res.status === 401 || res.status === 403) throw new GoogleAuthError(`Google token rejected: ${msg}`, res.status);
    throw new Error(`Google Business API ${res.status}: ${msg}`);
  }
  return data;
}

export interface GbAccount { name: string; accountName: string }
export interface GbLocation {
  name: string; // "locations/123"
  locationId: string; // "123"
  title: string;
  placeId: string | null;
  reviewUri: string | null;
  address: string | null;
}

// All Business Profile accounts the user can manage.
export async function listAccounts(token: string): Promise<GbAccount[]> {
  const out: GbAccount[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL("https://mybusinessaccountmanagement.googleapis.com/v1/accounts");
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await gbFetch(token, url.toString());
    for (const a of data.accounts || []) out.push({ name: a.name, accountName: a.accountName || a.name });
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

// Locations under an account ("accounts/123"), with the place id + review link.
export async function listLocations(token: string, accountName: string): Promise<GbLocation[]> {
  const out: GbLocation[] = [];
  let pageToken: string | undefined;
  const readMask = "name,title,storefrontAddress,metadata";
  do {
    const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`);
    url.searchParams.set("readMask", readMask);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await gbFetch(token, url.toString());
    for (const l of data.locations || []) {
      const placeId: string | null = l.metadata?.placeId || null;
      out.push({
        name: l.name,
        locationId: String(l.name || "").split("/").pop() || "",
        title: l.title || l.name,
        placeId,
        reviewUri: reviewLink(l.metadata, placeId),
        address: formatAddress(l.storefrontAddress),
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

// Prefer Google's own "new review" short link; fall back to the writereview URL.
export function reviewLink(metadata: any, placeId: string | null): string | null {
  if (metadata?.newReviewUri) return metadata.newReviewUri;
  if (placeId) return `https://search.google.com/local/writereview?placeid=${placeId}`;
  return null;
}

function formatAddress(addr: any): string | null {
  if (!addr) return null;
  const parts = [...(addr.addressLines || []), addr.locality, addr.administrativeArea, addr.postalCode].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
