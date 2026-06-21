import type { BusinessProfile } from "@/lib/business/profile";

// Per-org lead-response configuration (auto-reply + staff alerts + missed-call
// text-back). Pure helpers shared by client + server.
export interface LeadResponseSettings {
  replySmsEnabled: boolean;
  replyEmailEnabled: boolean;
  replyMessage: string; // "" => use the generated default
  alertSmsEnabled: boolean;
  alertEmailEnabled: boolean;
  staffAlertPhone: string;
  staffAlertEmail: string;
  forwardingNumber: string;
  twilioNumber: string;
}

export const DEFAULT_RESPONSE_SETTINGS: LeadResponseSettings = {
  replySmsEnabled: true,
  replyEmailEnabled: true,
  replyMessage: "",
  alertSmsEnabled: true,
  alertEmailEnabled: true,
  staffAlertPhone: "",
  staffAlertEmail: "",
  forwardingNumber: "",
  twilioNumber: "",
};

export function rowToSettings(row: any): LeadResponseSettings {
  if (!row) return { ...DEFAULT_RESPONSE_SETTINGS };
  return {
    replySmsEnabled: row.reply_sms_enabled ?? true,
    replyEmailEnabled: row.reply_email_enabled ?? true,
    replyMessage: row.reply_message ?? "",
    alertSmsEnabled: row.alert_sms_enabled ?? true,
    alertEmailEnabled: row.alert_email_enabled ?? true,
    staffAlertPhone: row.staff_alert_phone ?? "",
    staffAlertEmail: row.staff_alert_email ?? "",
    forwardingNumber: row.forwarding_number ?? "",
    twilioNumber: row.twilio_number ?? "",
  };
}

export function settingsToRow(orgId: string, s: LeadResponseSettings): Record<string, any> {
  return {
    org_id: orgId,
    reply_sms_enabled: s.replySmsEnabled,
    reply_email_enabled: s.replyEmailEnabled,
    reply_message: s.replyMessage.trim(),
    alert_sms_enabled: s.alertSmsEnabled,
    alert_email_enabled: s.alertEmailEnabled,
    staff_alert_phone: s.staffAlertPhone.trim() || null,
    staff_alert_email: s.staffAlertEmail.trim() || null,
    forwarding_number: s.forwardingNumber.trim() || null,
    twilio_number: s.twilioNumber.trim() || null,
  };
}

const firstName = (name: string) => (name || "").trim().split(/\s+/)[0] || "there";

// The instant acknowledgement: thanks + ask for a preferred call time. Business
// name comes from the Business Profile; the template can be overridden per org.
export function buildAckMessage(
  profile: BusinessProfile,
  settings: LeadResponseSettings,
  leadName: string,
  channel: "sms" | "email",
): string {
  const business = profile.businessName?.trim() || "us";
  const base =
    settings.replyMessage?.trim() ||
    "Hi {name}, thanks for contacting {business}! When's a good time to call you back — morning, afternoon or evening? (or reply with a time that suits)";
  const body = base.replaceAll("{name}", firstName(leadName)).replaceAll("{business}", business);
  const optOut = channel === "sms" ? "\nReply STOP to opt out." : "\n\n(Reply STOP or let us know if you'd prefer we don't contact you.)";
  return body + optOut;
}

// Free-text reply → a coarse preferred call-time bucket (or the trimmed text).
export function parsePreferredTime(text: string): string | null {
  const t = (text || "").toLowerCase();
  if (/\bmorning|\bam\b|before noon|9 ?am|10 ?am|11 ?am/.test(t)) return "Morning";
  if (/afternoon|after lunch|1 ?pm|2 ?pm|3 ?pm|4 ?pm/.test(t)) return "Afternoon";
  if (/evening|tonight|after work|after 5|5 ?pm|6 ?pm|7 ?pm/.test(t)) return "Evening";
  if (/\basap|now|any ?time|whenever/.test(t)) return "ASAP / anytime";
  const trimmed = (text || "").trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}
