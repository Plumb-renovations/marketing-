-- =============================================================================
-- 0015_quote_send_tracking.sql — quote email delivery + open tracking.
--
-- Records the email delivery on the quote and logs every time the client opens
-- the tracked public link. (quote_docs already has public_token, sent_at,
-- viewed_at, view_count + status from 0012.) Org-scoped via is_member() RLS.
-- View inserts happen server-side (service role) from the public /q page.
-- Idempotent. Run in the Supabase SQL editor.
-- =============================================================================

alter table quote_docs add column if not exists email_sent_at timestamptz;
alter table quote_docs add column if not exists email_to text;

-- One row per open of the tracked link.
create table if not exists quote_views (
  id         text primary key default (gen_random_uuid())::text,
  org_id     uuid not null references orgs(id) on delete cascade,
  quote_id   text not null references quote_docs(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  user_agent text,
  referer    text
);
create index if not exists quote_views_quote_idx on quote_views(quote_id, viewed_at);

alter table quote_views enable row level security;
drop policy if exists quote_views_member on quote_views;
create policy quote_views_member on quote_views
  using (is_member(org_id)) with check (is_member(org_id));
