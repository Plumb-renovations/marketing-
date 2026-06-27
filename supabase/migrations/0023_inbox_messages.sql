-- =============================================================================
-- 0023_inbox_messages.sql — unified inbox: Facebook Page messages + Instagram
-- DMs stored alongside leads, so no enquiry is missed across two apps.
--
-- IMPORTANT: reading/sending these messages needs Meta messaging permissions
-- (pages_messaging, instagram_manage_messages) the app does NOT yet hold — they
-- require Meta App Review. This table is the store that fills once those land +
-- the Page is subscribed to the `messages` webhook field. Until then the inbox
-- shows a "pending Meta approval" state, never fake messages.
--
-- Org-scoped via is_member() RLS. Idempotent. Run in the Supabase SQL editor.
-- =============================================================================

create table if not exists inbox_messages (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references orgs(id) on delete cascade,
  channel             text not null,                      -- 'facebook' | 'instagram'
  external_message_id text not null,                      -- Meta message id (mid)
  thread_id           text,                               -- conversation/sender id (PSID / IG-scoped id)
  sender_id           text,
  sender_name         text,
  direction           text not null default 'in',         -- 'in' (from customer) | 'out' (our reply)
  body                text,
  attachments         jsonb not null default '[]'::jsonb, -- images/links Meta delivers
  lead_id             text references leads(id) on delete set null, -- tied to a lead when matched
  sent_at             timestamptz,
  raw                 jsonb,
  created_at          timestamptz not null default now(),
  unique (org_id, channel, external_message_id)
);

create index if not exists inbox_messages_org_recent_idx on inbox_messages(org_id, sent_at desc);
create index if not exists inbox_messages_thread_idx on inbox_messages(org_id, channel, thread_id);

do $$
declare t text;
begin
  foreach t in array array['inbox_messages'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_member on %1$s;', t);
    execute format('create policy %1$s_member on %1$s using (is_member(org_id)) with check (is_member(org_id));', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
