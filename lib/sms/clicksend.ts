import { clicksend } from "@/lib/integrations/env";

export function smsConfigured() {
  return clicksend.configured;
}

export interface SmsResult {
  sid?: string; // ClickSend message_id
  status?: string; // per-message status (e.g. "SUCCESS")
}

// Minimal ClickSend SMS send via the REST API (no SDK). Server-only —
// credentials come from env and never reach the browser. `from` is the sender
// ID / number configured in Speed-to-Lead settings (optional: ClickSend falls
// back to a shared number when omitted). Returns the ClickSend message id.
export async function sendSms(to: string, body: string, from?: string): Promise<SmsResult> {
  if (!clicksend.configured) throw new Error("SMS is not configured");
  const auth = Buffer.from(`${clicksend.username}:${clicksend.apiKey}`).toString("base64");

  const message: Record<string, string> = { source: "hazel", body, to };
  const sender = (from || "").trim();
  if (sender) message.from = sender;

  const res = await fetch("https://rest.clicksend.com/v3/sms/send", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [message] }),
  });
  const data: any = await res.json().catch(() => ({}));
  const msg = data?.data?.messages?.[0];

  // ClickSend signals request-level success with response_code === "SUCCESS",
  // then a per-message status. Treat anything else (HTTP error, rejected
  // request, or a per-message status other than SUCCESS) as a failure.
  if (!res.ok) throw new Error(data?.response_msg || `ClickSend HTTP ${res.status}`);
  if (data?.response_code && data.response_code !== "SUCCESS") {
    throw new Error(data?.response_msg || `ClickSend ${data.response_code}`);
  }
  const status = msg?.status;
  if (status && status !== "SUCCESS") {
    throw new Error(`ClickSend message ${status}`);
  }
  return { sid: msg?.message_id ? String(msg.message_id) : undefined, status };
}

// Best-effort E.164 normalisation. ClickSend wants E.164; we prefix a default
// country code for plainly-local AU mobile numbers (04xx -> +614xx).
export function normalisePhone(raw: string | null | undefined, defaultCc = "+61"): string | null {
  if (!raw) return null;
  let s = raw.replace(/[\s()-]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return "+" + s.slice(2);
  if (s.startsWith("0")) return defaultCc + s.slice(1); // 04xx -> +614xx
  if (/^\d{6,15}$/.test(s)) return "+" + s;
  return null;
}
