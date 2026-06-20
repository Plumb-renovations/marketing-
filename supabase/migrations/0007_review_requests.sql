-- =============================================================================
-- 0007_review_requests.sql — log of review requests sent to customers
--
-- A simple per-org record of who was asked for a Google review, via which
-- channel, and when. Org-scoped via the same is_member() RLS as the rest of the
-- app. Apply by running this file in the Supabase SQL editor (same as 0006).
-- =============================================================================

create table if not exists review_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  customer_name text,
  channel       text not null,                 -- 'sms' | 'email'
  destination   text,                          -- phone number or email address
  status        text not null default 'sent',  -- 'sent' | 'failed'
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists review_requests_org_idx on review_requests(org_id, created_at desc);

alter table review_requests enable row level security;

drop policy if exists review_requests_member on review_requests;
create policy review_requests_member on review_requests
  using (is_member(org_id)) with check (is_member(org_id));
