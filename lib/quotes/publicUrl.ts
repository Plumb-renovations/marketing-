// Base URL for CLIENT-FACING quote links (the public /q/<token> share links and
// the links inside quote emails). Prefer the configured app URL so links always
// use the branded custom domain (quotes.plumbrenovations.com.au) regardless of
// which domain the owner happens to be viewing the app on; fall back to the
// request/browser origin so it's still correct on any deployment.
//
// Set NEXT_PUBLIC_APP_URL in Vercel to the custom domain, e.g.
//   NEXT_PUBLIC_APP_URL=https://quotes.plumbrenovations.com.au
export function appBaseUrl(fallbackOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const browser = typeof window !== "undefined" ? window.location.origin : "";
  return (configured || fallbackOrigin || browser || "").replace(/\/+$/, "");
}

// The full public URL a client opens for a quote. `fallbackOrigin` lets server
// routes pass the request origin as the fallback (there's no window there).
export function publicQuoteUrl(token: string, fallbackOrigin?: string): string {
  const base = appBaseUrl(fallbackOrigin);
  return base && token ? `${base}/q/${token}` : "";
}
