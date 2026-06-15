// Formatting + small domain helpers, ported verbatim from the prototype.
import type { Lead, Quote } from "./types";

export const audFmt = (n: number, cents = false) =>
  "$" +
  Number(n || 0).toLocaleString("en-AU", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });

export const nzdFmt = (n: number, cents = false) =>
  "NZ$" +
  Number(n || 0).toLocaleString("en-NZ", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });

export const quoteTotals = (q?: { lineItems?: Quote["lineItems"] } | null) => {
  const sub = (q?.lineItems || []).reduce(
    (s, li) => s + (Number(li.qty) || 0) * (Number(li.unitPrice) || 0),
    0,
  );
  return { sub, gst: sub * 0.1, total: sub * 1.1 };
};

export const leadQuote = (lead: Lead): Quote | null => {
  if (!lead.quotes || !lead.quotes.length) return null;
  if (lead.wonQuoteId)
    return (
      lead.quotes.find((q) => q.id === lead.wonQuoteId) ||
      lead.quotes[lead.quotes.length - 1]
    );
  return lead.quotes[lead.quotes.length - 1];
};

export const leadValue = (lead: Lead) => {
  const q = leadQuote(lead);
  return q ? quoteTotals(q).total : 0;
};

export const monthKey = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d)
    ? "—"
    : d.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
};

export const uid = () => Math.random().toString(36).slice(2, 9);

export const firstOfNextMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
};

export const next12 = () => {
  const n = new Date();
  const b = new Date(n.getFullYear(), n.getMonth(), 1);
  return Array.from(
    { length: 12 },
    (_, i) => new Date(b.getFullYear(), b.getMonth() + i, 1),
  );
};

export const sameMonth = (iso: string | undefined, d: Date) => {
  if (!iso) return false;
  const x = new Date(iso);
  return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
};

export const monthShort = (d: Date) =>
  d.toLocaleDateString("en-AU", { month: "short", year: "numeric" });

export const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const defaultSchedule = () => plusDays(1) + "T18:00";

export const fmtWhen = (s: string) => {
  const d = new Date(s);
  return isNaN(+d)
    ? s || "—"
    : d.toLocaleString("en-AU", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      });
};

export const today = () => new Date().toISOString().slice(0, 10);
