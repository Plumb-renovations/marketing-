import { resend } from "@/lib/integrations/env";

export function emailConfigured() {
  return resend.configured;
}

function fromHeader() {
  return resend.fromName ? `${resend.fromName} <${resend.from}>` : resend.from;
}

// Minimal Resend email send via the REST API (no SDK). Server-only. Returns id.
// `opts.html` adds an HTML body; `opts.replyTo` routes replies to the business;
// `opts.fromName` overrides the sender display name (so the email reads as the
// business while still sending from the verified Resend address).
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  opts?: { html?: string; replyTo?: string; fromName?: string },
): Promise<{ id?: string }> {
  if (!resend.configured) throw new Error("Email is not configured");
  const from = opts?.fromName ? `${opts.fromName} <${resend.from}>` : fromHeader();
  const payload: Record<string, any> = { from, to: [to], subject, text };
  if (opts?.html) payload.html = opts.html;
  if (opts?.replyTo) payload.reply_to = opts.replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resend.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error?.message || `Resend ${res.status}`);
  return { id: data?.id };
}
