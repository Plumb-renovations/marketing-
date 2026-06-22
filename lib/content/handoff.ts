// Lightweight copy hand-off: stash a draft so another screen can pick it up on
// mount. Used to send AI-generated copy "straight into" the right composer
// without a backend round-trip — the organic Content & Social composer, or the
// paid Ad Creator (Meta ad studio).
const COMPOSER_KEY = "hazel:composerDraft";
const AD_KEY = "hazel:adDraft";

function stash(key: string, text: string): void {
  try {
    sessionStorage.setItem(key, text);
  } catch {}
}

// Read and clear a pending draft (one-shot).
function take(key: string): string | null {
  try {
    const v = sessionStorage.getItem(key);
    if (v) sessionStorage.removeItem(key);
    return v;
  } catch {
    return null;
  }
}

// Organic post copy → Content & Social composer.
export const setComposerDraft = (text: string) => stash(COMPOSER_KEY, text);
export const takeComposerDraft = () => take(COMPOSER_KEY);

// Paid ad copy → Ad Creator (Meta ad studio).
export const setAdDraft = (text: string) => stash(AD_KEY, text);
export const takeAdDraft = () => take(AD_KEY);
