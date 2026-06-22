// Lightweight copy hand-off: stash a draft caption so another screen (the
// Content & Social composer) can pick it up on mount. Used to send AI-generated
// copy "straight into the composer" without a backend round-trip.
const KEY = "hazel:composerDraft";

export function setComposerDraft(text: string): void {
  try {
    sessionStorage.setItem(KEY, text);
  } catch {}
}

// Read and clear the pending draft (one-shot).
export function takeComposerDraft(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
