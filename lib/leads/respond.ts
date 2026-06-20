import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessProfile } from "@/lib/business/profileServer";
import { sendSms, smsConfigured, normalisePhone } from "@/lib/sms/twilio";
import { sendEmail, emailConfigured } from "@/lib/email/send";
import { SOURCES } from "@/lib/domain/constants";
import {
  rowToSettings,
  buildAckMessage,
  type LeadResponseSettings,
} from "@/lib/leads/responseSettings";

type Admin = ReturnType<typeof createAdminClient>;

export async function getResponseSettings(orgId: string): Promise<LeadResponseSettings> {
  const admin = createAdminClient();
  const { data } = await admin.from("lead_response_settings").select("*").eq("org_id", orgId).maybeSingle();
  return rowToSettings(data);
}

// Append a message to a lead's thread (best-effort; never throws to the caller).
export async function logLeadMessage(
  admin: Admin,
  orgId: string,
  leadId: string,
  m: { direction: "in" | "out"; channel: "sms" | "email"; body: string; from?: string; to?: string; externalId?: string; status?: string },
): Promise<void> {
  try {
    await admin.from("lead_messages").insert({
      org_id: orgId,
      lead_id: leadId,
      direction: m.direction,
      channel: m.channel,
      body: m.body,
      from_addr: m.from ?? null,
      to_addr: m.to ?? null,
      external_id: m.externalId ?? null,
      status: m.status ?? null,
    });
  } catch (e) {
    console.error("[respond] logLeadMessage failed", (e as Error).message);
  }
}

const sourceLabel = (s: string) => SOURCES[s]?.label || s;

// Instant response to a brand-new lead: SMS + email acknowledgement (asking for
// a preferred call time) + a "call now" staff alert. Idempotent — the auto-reply
// is claimed atomically so webhook re-deliveries don't double-send.
export async function respondToNewLead(orgId: string, leadId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: lead } = await admin.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return;

  // Claim the auto-reply (only the first caller proceeds).
  const { data: claimed } = await admin
    .from("leads")
    .update({ auto_reply_sent_at: new Date().toISOString() })
    .eq("id", leadId)
    .is("auto_reply_sent_at", null)
    .select("id");
  if (!claimed || !claimed.length) return; // already responded

  const [profile, settings] = await Promise.all([getBusinessProfile(orgId), getResponseSettings(orgId)]);
  const phone = normalisePhone(lead.phone);
  const email = (lead.email || "").trim();

  // --- Acknowledgement to the lead ---
  if (settings.replySmsEnabled && smsConfigured() && phone) {
    const body = buildAckMessage(profile, settings, lead.name, "sms");
    try {
      const r = await sendSms(phone, body);
      await logLeadMessage(admin, orgId, leadId, { direction: "out", channel: "sms", body, to: phone, externalId: r.sid, status: "sent" });
    } catch (e) {
      await logLeadMessage(admin, orgId, leadId, { direction: "out", channel: "sms", body, to: phone, status: "failed: " + (e as Error).message });
    }
  }
  if (settings.replyEmailEnabled && emailConfigured() && email) {
    const body = buildAckMessage(profile, settings, lead.name, "email");
    const subject = `Thanks for contacting ${profile.businessName || "us"}`;
    try {
      const r = await sendEmail(email, subject, body);
      await logLeadMessage(admin, orgId, leadId, { direction: "out", channel: "email", body, to: email, externalId: r.id, status: "sent" });
    } catch (e) {
      await logLeadMessage(admin, orgId, leadId, { direction: "out", channel: "email", body, to: email, status: "failed: " + (e as Error).message });
    }
  }

  // --- Staff "call now" alert ---
  await alertStaff(orgId, lead, settings, null);
}

// Alert the org's staff to call a lead now. When `preferredTime` is supplied
// (after the lead replies), it's included.
export async function alertStaff(
  orgId: string,
  lead: any,
  settings: LeadResponseSettings,
  preferredTime: string | null,
): Promise<void> {
  const phone = normalisePhone(lead.phone);
  const parts = [
    preferredTime ? `Lead replied — prefers ${preferredTime}.` : "New lead — call now.",
    lead.name,
    phone ? phone : "",
    `(${sourceLabel(lead.source)})`,
    lead.email ? lead.email : "",
  ].filter(Boolean);
  const text = parts.join(" · ");

  const alertPhone = normalisePhone(settings.staffAlertPhone);
  if (settings.alertSmsEnabled && smsConfigured() && alertPhone) {
    try {
      await sendSms(alertPhone, text);
    } catch (e) {
      console.error("[respond] staff SMS alert failed", (e as Error).message);
    }
  }
  if (settings.alertEmailEnabled && emailConfigured() && settings.staffAlertEmail) {
    try {
      await sendEmail(settings.staffAlertEmail, `${preferredTime ? "Lead replied" : "New lead"}: ${lead.name}`, text);
    } catch (e) {
      console.error("[respond] staff email alert failed", (e as Error).message);
    }
  }
}
