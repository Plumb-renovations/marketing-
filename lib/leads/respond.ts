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
//
// Every decision is logged (visible in the function logs as `[speed-to-lead]`)
// so a non-send is never silent: missing key, no settings row, no recipient, a
// burned idempotency claim, or the actual Resend error all show up.
export async function respondToNewLead(orgId: string, leadId: string): Promise<void> {
  const admin = createAdminClient();
  const tag = `[speed-to-lead] lead=${leadId} org=${orgId}`;

  const { data: lead, error: leadErr } = await admin.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (leadErr) {
    console.error(`${tag} could not load lead: ${leadErr.message}`);
    return;
  }
  if (!lead) {
    console.warn(`${tag} lead not found — skipping`);
    return;
  }

  // Claim the auto-reply (only the first caller proceeds). Surface DB errors and
  // the "already responded" re-delivery case instead of returning silently.
  const { data: claimed, error: claimErr } = await admin
    .from("leads")
    .update({ auto_reply_sent_at: new Date().toISOString() })
    .eq("id", leadId)
    .is("auto_reply_sent_at", null)
    .select("id");
  if (claimErr) {
    console.error(`${tag} idempotency claim failed: ${claimErr.message}`);
    return;
  }
  if (!claimed || !claimed.length) {
    console.log(`${tag} already responded (auto_reply_sent_at set) — skipping. Test with a NEW lead to re-trigger.`);
    return;
  }

  const profile = await getBusinessProfile(orgId);
  // Read the settings row directly so we can warn when it's missing — the most
  // common cause of a silent no-send after multi-tenancy (settings saved under a
  // different org than the one this lead was ingested under).
  const { data: settingsRow } = await admin
    .from("lead_response_settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!settingsRow) {
    console.warn(
      `${tag} no lead_response_settings row for this org — using defaults (staff alert email EMPTY). ` +
        `If you configured Speed-to-Lead in the app, it was saved under a different org than the one this lead landed in.`,
    );
  }
  const settings = rowToSettings(settingsRow);

  const phone = normalisePhone(lead.phone);
  const email = (lead.email || "").trim();
  const emailOk = emailConfigured();
  const smsOk = smsConfigured();

  const willReplyEmail = settings.replyEmailEnabled && emailOk && !!email;
  const willStaffEmail = settings.alertEmailEnabled && emailOk && !!settings.staffAlertEmail;
  const willReplySms = settings.replySmsEnabled && smsOk && !!phone;
  const willStaffSms = settings.alertSmsEnabled && smsOk && !!normalisePhone(settings.staffAlertPhone);
  const emailCount = (willReplyEmail ? 1 : 0) + (willStaffEmail ? 1 : 0);

  console.log(
    `${tag} speed-to-lead: sending ${emailCount} emails for lead ${leadId} ` +
      JSON.stringify({
        emailConfigured: emailOk, // RESEND_API_KEY present (separate from Supabase auth email)
        smsConfigured: smsOk,
        replyEmail: willReplyEmail,
        staffEmail: willStaffEmail,
        replySms: willReplySms,
        staffSms: willStaffSms,
        leadEmail: email ? "present" : "missing",
        leadPhone: phone ? "present" : "missing",
        staffAlertEmail: settings.staffAlertEmail ? "set" : "empty",
      }),
  );

  // --- Acknowledgement to the lead ---
  if (settings.replySmsEnabled && smsOk && phone) {
    const body = buildAckMessage(profile, settings, lead.name, "sms");
    try {
      const r = await sendSms(phone, body);
      await logLeadMessage(admin, orgId, leadId, { direction: "out", channel: "sms", body, to: phone, externalId: r.sid, status: "sent" });
    } catch (e) {
      console.error(`${tag} customer auto-reply SMS FAILED: ${(e as Error).message}`);
      await logLeadMessage(admin, orgId, leadId, { direction: "out", channel: "sms", body, to: phone, status: "failed: " + (e as Error).message });
    }
  } else if (settings.replySmsEnabled) {
    console.log(`${tag} customer SMS skipped (${!smsOk ? "SMS not configured" : "lead has no phone"})`);
  }

  if (willReplyEmail) {
    const body = buildAckMessage(profile, settings, lead.name, "email");
    const subject = `Thanks for contacting ${profile.businessName || "us"}`;
    try {
      const r = await sendEmail(email, subject, body);
      console.log(`${tag} customer auto-reply email sent (id=${r.id}) to ${email}`);
      await logLeadMessage(admin, orgId, leadId, { direction: "out", channel: "email", body, to: email, externalId: r.id, status: "sent" });
    } catch (e) {
      console.error(`${tag} customer auto-reply email FAILED to ${email}: ${(e as Error).message}`);
      await logLeadMessage(admin, orgId, leadId, { direction: "out", channel: "email", body, to: email, status: "failed: " + (e as Error).message });
    }
  } else if (settings.replyEmailEnabled) {
    console.log(`${tag} customer email skipped (${!emailOk ? "RESEND_API_KEY not set" : "lead has no email"})`);
  }

  // --- Staff "call now" alert (must fire for every new lead) ---
  await alertStaff(orgId, lead, settings, null);
}

// Alert the org's staff to call a lead now. When `preferredTime` is supplied
// (after the lead replies), it's included. Logs why it does/doesn't send.
export async function alertStaff(
  orgId: string,
  lead: any,
  settings: LeadResponseSettings,
  preferredTime: string | null,
): Promise<void> {
  const tag = `[speed-to-lead] lead=${lead.id} org=${orgId}`;
  const phone = normalisePhone(lead.phone);
  const parts = [
    preferredTime ? `Lead replied — prefers ${preferredTime}.` : "New lead — call now.",
    lead.name,
    phone ? phone : "",
    `(${sourceLabel(lead.source)})`,
    lead.email ? lead.email : "",
  ].filter(Boolean);
  const text = parts.join(" · ");

  const emailOk = emailConfigured();
  const smsOk = smsConfigured();
  const alertPhone = normalisePhone(settings.staffAlertPhone);

  if (settings.alertSmsEnabled && smsOk && alertPhone) {
    try {
      await sendSms(alertPhone, text);
      console.log(`${tag} staff SMS alert sent to ${alertPhone}`);
    } catch (e) {
      console.error(`${tag} staff SMS alert FAILED: ${(e as Error).message}`);
    }
  } else if (settings.alertSmsEnabled) {
    console.log(`${tag} staff SMS alert skipped (${!smsOk ? "SMS not configured" : "no staff alert phone"})`);
  }

  if (settings.alertEmailEnabled && emailOk && settings.staffAlertEmail) {
    try {
      const r = await sendEmail(settings.staffAlertEmail, `${preferredTime ? "Lead replied" : "New lead"}: ${lead.name}`, text);
      console.log(`${tag} staff email alert sent (id=${r.id}) to ${settings.staffAlertEmail}`);
    } catch (e) {
      console.error(`${tag} staff email alert FAILED to ${settings.staffAlertEmail}: ${(e as Error).message}`);
    }
  } else if (settings.alertEmailEnabled) {
    console.warn(
      `${tag} staff email alert skipped (${!emailOk ? "RESEND_API_KEY not set" : "no staff_alert_email configured for THIS org"})`,
    );
  }
}
