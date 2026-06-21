-- =============================================================================
-- 0011_quote_branding.sql — Quotes/Invoices foundation: per-org branding,
-- numbering, defaults + the saved-line-item library + a public logo bucket.
--
-- These columns live on the existing per-org business_profiles row (extended,
-- column-scoped — they don't clash with the AI/targeting fields). The rich
-- quote/invoice tables themselves land in the next PR. Org-scoped via the same
-- is_member() RLS. Run in the Supabase SQL editor.
-- =============================================================================

-- Branding + tax/currency + numbering + document defaults on business_profiles.
alter table business_profiles add column if not exists logo_url text;
alter table business_profiles add column if not exists brand_color text not null default '#B8763E';
alter table business_profiles add column if not exists brand_color2 text;
alter table business_profiles add column if not exists doc_contact_name text;
alter table business_profiles add column if not exists doc_contact_phone text;
alter table business_profiles add column if not exists doc_contact_email text;
alter table business_profiles add column if not exists doc_address text;
alter table business_profiles add column if not exists abn text;
alter table business_profiles add column if not exists licence_no text;
alter table business_profiles add column if not exists bank_details text;
alter table business_profiles add column if not exists gst_registered boolean not null default true;
alter table business_profiles add column if not exists currency text not null default 'AUD';
alter table business_profiles add column if not exists quote_number_prefix text not null default 'Q-';
alter table business_profiles add column if not exists quote_next_number int not null default 1;
alter table business_profiles add column if not exists invoice_number_prefix text not null default 'INV-';
alter table business_profiles add column if not exists invoice_next_number int not null default 1;
alter table business_profiles add column if not exists default_terms text not null default '';
-- [{label, percent}] — the business's default progress schedule (e.g. 5/30/30/30/5)
alter table business_profiles add column if not exists default_payment_schedule jsonb not null default '[]'::jsonb;

-- Per-org reusable line-item library (one-tap insert into a quote).
create table if not exists saved_line_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  description text not null default '',
  detail      text default '',
  default_qty numeric not null default 1,
  unit        text not null default 'ea',
  unit_price  numeric not null default 0,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists saved_line_items_org_idx on saved_line_items(org_id, sort_order);
alter table saved_line_items enable row level security;
drop policy if exists saved_line_items_member on saved_line_items;
create policy saved_line_items_member on saved_line_items
  using (is_member(org_id)) with check (is_member(org_id));

-- Public bucket for business logos (the client-facing quote/invoice documents
-- need a public image URL). Uploads happen server-side (service role).
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;
