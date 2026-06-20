import { resend } from "@/lib/integrations/env";

export function emailConfigured() {
  return resend.configured;
}

function fromHeader() {
  return resend.fromName ? `${resend.fromName} <${resend.from}>` : resend.from;
}

// Minimal Resend email send via the REST API (no SDK). Server-only. Returns id.
export async function sendEmail(to: string, subject: string, text: string): Promise<{ id?: string }> {
  if (!resend.configured) throw new Error("Email is not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resend.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromHeader(), to: [to], subject, text }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error?.message || `Resend ${res.status}`);
  return { id: data?.id };
}
