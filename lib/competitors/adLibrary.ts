// Deep-links into the PUBLIC Meta Ad Library (the web UI a user reads manually).
// We never call the Ad Library API — it doesn't return AU commercial ads — so
// this is purely a read-only link to the competitor's currently-active ads.

// Pull a numeric Page ID out of a Facebook URL if one is literally present
// (profile.php?id=…, view_all_page_id=…, or a pasted numeric id). Vanity
// handles can't be resolved to a Page ID without the Graph API, so those fall
// back to a keyword search by name.
export function extractPageId(fbUrl?: string | null): string | null {
  if (!fbUrl) return null;
  const s = fbUrl.trim();
  const id = s.match(/[?&]id=(\d{5,})/) || s.match(/view_all_page_id=(\d{5,})/);
  if (id) return id[1];
  if (/^\d{5,}$/.test(s)) return s;
  return null;
}

// Build the Ad Library URL: active ads, all ad types, the business's country
// (default AU). Link by page when a Page ID is resolvable, else keyword-search
// the competitor's name.
export function adLibraryUrl(opts: { name: string; fbUrl?: string | null; country?: string }): string {
  const country = (opts.country || "AU").toUpperCase();
  const params = new URLSearchParams({
    active_status: "active",
    ad_type: "all",
    country,
    media_type: "all",
  });
  const pageId = extractPageId(opts.fbUrl);
  if (pageId) {
    params.set("view_all_page_id", pageId);
    params.set("search_type", "page");
  } else {
    params.set("q", (opts.name || "").trim());
    params.set("search_type", "keyword_unordered");
  }
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

// Whether "View live ads" can produce a useful link (needs a name or a URL).
export function canLinkAdLibrary(c: { name: string; fbUrl?: string | null }): boolean {
  return !!(c.name.trim() || extractPageId(c.fbUrl));
}
