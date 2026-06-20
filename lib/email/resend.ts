import { resend } from "@/lib/integrations/env";

// Minimal Resend email send via the REST API (no SDK). Server-only.
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!resend.configured) throw new Error("Email is not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: resend.from, to: [to], subject, text }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Resend error ${res.status}`);
  }
}
