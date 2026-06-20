import { googleBusiness, app } from "../env";

// Google OAuth for the Business Profile (reviews) API. The connecting user
// grants `business.manage`; we keep the returned refresh token per-org and mint
// short-lived access tokens from it on demand (see google/config.ts).
export const GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";

export function googleRedirectUri(): string {
  return `${app.url.replace(/\/$/, "")}/api/integrations/google/oauth/callback`;
}

// Consent dialog URL. access_type=offline + prompt=consent so Google always
// returns a refresh token (it omits it on subsequent silent grants otherwise).
export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: googleBusiness.clientId || "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_BUSINESS_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number; // seconds
}

async function tokenRequest(body: URLSearchParams): Promise<GoogleToken> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(data?.error_description || data?.error || `token request failed (${res.status})`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ? Number(data.expires_in) : undefined,
  };
}

// Exchange the consent `code` for access + refresh tokens.
export function exchangeGoogleCode(code: string): Promise<GoogleToken> {
  return tokenRequest(
    new URLSearchParams({
      code,
      client_id: googleBusiness.clientId || "",
      client_secret: googleBusiness.clientSecret || "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  );
}

// Mint a fresh access token from a stored refresh token.
export function refreshGoogleToken(refreshToken: string): Promise<GoogleToken> {
  return tokenRequest(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: googleBusiness.clientId || "",
      client_secret: googleBusiness.clientSecret || "",
      grant_type: "refresh_token",
    }),
  );
}
