import { twilio } from "@/lib/integrations/env";

export function smsConfigured() {
  return twilio.configured;
}

// Minimal Twilio SMS send via the REST API (no SDK). Server-only — credentials
// come from env and never reach the browser. Returns the message SID.
export async function sendSms(to: string, body: string): Promise<{ sid?: string }> {
  if (!twilio.configured) throw new Error("SMS is not configured");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`;
  const auth = Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: twilio.from!, Body: body }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Twilio error ${res.status}`);
  return { sid: data?.sid };
}

// Best-effort E.164-ish normalisation. Twilio requires E.164; we only prefix a
// default country code for plainly-local AU mobile numbers.
export function normalisePhone(raw: string | null | undefined, defaultCc = "+61"): string | null {
  if (!raw) return null;
  let s = raw.replace(/[\s()-]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return "+" + s.slice(2);
  if (s.startsWith("0")) return defaultCc + s.slice(1); // 04xx -> +614xx
  if (/^\d{6,15}$/.test(s)) return "+" + s;
  return null;
}
