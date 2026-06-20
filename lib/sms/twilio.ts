import { twilio } from "@/lib/integrations/env";

// Minimal Twilio SMS send via the REST API (no SDK). Server-only — credentials
// come from env and never reach the browser.
export async function sendSms(to: string, body: string): Promise<void> {
  if (!twilio.configured) throw new Error("SMS is not configured");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`;
  const auth = Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: twilio.from!, Body: body }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Twilio error ${res.status}`);
  }
}
