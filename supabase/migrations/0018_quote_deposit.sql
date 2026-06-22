-- =============================================================================
-- 0018_quote_deposit.sql — online accept → auto deposit invoice.
--
-- Adds the configurable deposit percentage (business setting, default 5%) and a
-- per-org log of invoices raised against a quote (the deposit invoice now; the
-- progress-claim invoices later). Org-scoped via is_member() RLS. The accept +
-- invoice writes happen server-side with the service role (anonymous client on
-- the public quote page). Idempotent. Run in the Supabase SQL editor.
-- =============================================================================

-- Deposit % charged on acceptance (lock-in deposit), per business.
alter table business_profiles add column if not exists deposit_percent numeric not null default 5;

-- Invoices raised against a quote (kind='deposit' now). Logged so each send is
-- tracked; one deposit per quote (unique).
create table if not exists quote_invoices (
  id             text primary key default (gen_random_uuid())::text,
  org_id         uuid not null references orgs(id) on delete cascade,
  quote_id       text not null references quote_docs(id) on delete cascade,
  kind           text not null default 'deposit',     -- 'deposit' | 'progress'
  invoice_number text,
  percent        numeric,
  subtotal       numeric not null default 0,
  gst_amount     numeric not null default 0,
  total          numeric not null default 0,
  client_email   text,
  status         text not null default 'sent',        -- 'sent' | 'failed' | 'skipped'
  message        text,
  sent_at        timestamptz,
  created_at     timestamptz not null default now(),
  unique (quote_id, kind)
);
create index if not exists quote_invoices_org_idx on quote_invoices(org_id, created_at desc);

alter table quote_invoices enable row level security;
drop policy if exists quote_invoices_member on quote_invoices;
create policy quote_invoices_member on quote_invoices
  using (is_member(org_id)) with check (is_member(org_id));
