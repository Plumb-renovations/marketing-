// Pure helpers (no server deps — safe in client bundles) to surface the full
// Meta lead-form submission that the leadgen webhook stores on a lead's `raw`
// jsonb column. Meta hands us answers as
//   field_data: [{ name: "what_is_your_budget?", values: ["$20k–$30k"] }, ...]
// We expose phone/email prominently and EVERY question/answer pair exactly as
// submitted (not a mapped subset), so the operator sees precisely what the lead
// filled in.

export interface LeadFormField {
  key: string; // exact field name as submitted (e.g. "what_is_your_budget?")
  label: string; // lightly humanised for display
  value: string;
}

// Meta stores answers under raw.field_data; older/seeded leads may not have it.
function fieldData(raw: any): any[] {
  const fd = raw?.field_data;
  return Array.isArray(fd) ? fd : [];
}

// Join all non-empty values for a field (most are single-valued).
function joinValues(item: any): string {
  const vals = Array.isArray(item?.values) ? item.values : [];
  return vals
    .filter((v: any) => v != null && String(v).trim())
    .map((v: any) => String(v).trim())
    .join(", ");
}

// Turn a Meta field key into a readable question label.
function humanise(key: string): string {
  const cleaned = key.replace(/[_-]+/g, " ").replace(/\?+\s*$/g, "").trim();
  if (!cleaned) return key;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function findValue(raw: any, matches: (name: string) => boolean): string | undefined {
  for (const item of fieldData(raw)) {
    const name = String(item?.name || "").toLowerCase();
    if (matches(name)) {
      const v = joinValues(item);
      if (v) return v;
    }
  }
  return undefined;
}

export function extractEmail(raw: any): string | undefined {
  const fromForm = findValue(raw, (n) => n.includes("email"));
  if (fromForm) return fromForm;
  if (typeof raw?.email === "string" && raw.email.trim()) return raw.email.trim();
  return undefined;
}

const PHONE_HINTS = ["phone", "mobile", "tel", "contact_number", "phone_number", "cell"];

export function extractPhone(raw: any): string | undefined {
  const fromForm = findValue(raw, (n) => PHONE_HINTS.some((h) => n.includes(h)));
  if (fromForm) return fromForm;
  if (typeof raw?.phone === "string" && raw.phone.trim()) return raw.phone.trim();
  return undefined;
}

// A `tel:` href stripped to + and digits, safe for click-to-call.
export function telHref(phone: string): string {
  return "tel:" + phone.replace(/[^+\d]/g, "");
}

// Every question/answer pair exactly as submitted, in form order. Nothing is
// dropped or remapped — even name/email/phone stay in the list so the operator
// sees the literal submission.
export function extractFormFields(raw: any): LeadFormField[] {
  const out: LeadFormField[] = [];
  for (const item of fieldData(raw)) {
    const key = typeof item?.name === "string" ? item.name : "";
    if (!key) continue;
    const value = joinValues(item);
    if (!value) continue;
    out.push({ key, label: humanise(key), value });
  }
  return out;
}
