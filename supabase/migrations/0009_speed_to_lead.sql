-- =============================================================================
-- 0009_speed_to_lead.sql — speed-to-lead foundation
--
-- Adds contact + conversation fields to leads, a per-lead message thread, and
-- per-org lead-response settings (auto-reply + staff alerts + missed-call
-- text-back). Org-scoped via the same is_member() RLS as the rest of the app.
-- Run in the Supabase SQL editor.
-- =============================================================================

-- Contact + conversation columns on leads.
alter table leads add column if not exists phone text;
alter table leads add column if not exists email text;
alter table leads add column if not exists preferred_call_time text; -- "morning" | free text
alter table leads add column if not exists contacted_at timestamptz;
alter table leads add column if not exists auto_reply_sent_at timestamptz; -- idempotency claim

-- Per-lead SMS/email thread (inbound + outbound).
create table if not exists lead_messages (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  lead_id     text not null references leads(id) on delete cascade,
  direction   text not null,            -- 'in' | 'out'
  channel     text not null,            -- 'sms' | 'email'
  body        text not null default '',
  from_addr   text,
  to_addr     text,
  external_id text,                      -- Twilio SID / Resend id
  status      text,                      -- provider status / 'failed'
  created_at  timestamptz not null default now()
);
create index if not exists lead_messages_lead_idx on lead_messages(lead_id, created_at);
create index if not exists lead_messages_org_idx on lead_messages(org_id, created_at desc);

alter table lead_messages enable row level security;
drop policy if exists lead_messages_member on lead_messages;
create policy lead_messages_member on lead_messages
  using (is_member(org_id)) with check (is_member(org_id));

-- Per-org lead-response configuration.
create table if not exists lead_response_settings (
  org_id              uuid primary key references orgs(id) on delete cascade,
  reply_sms_enabled   boolean not null default true,
  reply_email_enabled boolean not null default true,
  reply_message       text not null default '',  -- '' = use generated default
  alert_sms_enabled   boolean not null default true,
  alert_email_enabled boolean not null default true,
  staff_alert_phone   text,                       -- where "call now" SMS goes
  staff_alert_email   text,                       -- where "call now" email goes
  forwarding_number   text,                       -- real business line (missed-call text-back)
  twilio_number       text,                       -- this org's Twilio number (inbound routing)
  updated_at          timestamptz not null default now()
);

alter table lead_response_settings enable row level security;
drop policy if exists lead_response_settings_member on lead_response_settings;
create policy lead_response_settings_member on lead_response_settings
  using (is_member(org_id)) with check (is_member(org_id));

drop trigger if exists trg_lead_response_settings_updated on lead_response_settings;
create trigger trg_lead_response_settings_updated
  before update on lead_response_settings
  for each row execute function set_updated_at();

-- Live updates for the unified inbox.
do $$
begin
  alter publication supabase_realtime add table lead_messages;
exception when duplicate_object then null;
end $$;
