-- =============================================================================
-- 0012_quote_docs.sql — rich Quote documents (builder + branded preview).
--
-- Separate from the legacy lead-estimate `quotes`/`quote_line_items` tables
-- (which the lead drawer + markWon use live) so the rich quotes never collide
-- with the legacy delete-reinsert save path. Linked to a lead via lead_id.
-- Org-scoped via is_member() RLS. Run in the Supabase SQL editor.
-- =============================================================================

create table if not exists quote_docs (
  id              text primary key default (gen_random_uuid())::text,
  org_id          uuid not null references orgs(id) on delete cascade,
  lead_id         text references leads(id) on delete set null,  -- nullable: standalone quotes
  quote_number    text,
  reference       text,
  status          text not null default 'draft', -- draft|sent|viewed|accepted|declined|expired
  -- client snapshot
  client_name     text default '',
  client_email    text default '',
  client_phone    text default '',
  client_address  text default '',
  project_name    text default '',
  site_address    text default '',
  -- body
  quote_date      date not null default current_date,
  valid_until     date,
  scope_description text default '',
  intro_note      text default '',
  terms           text default '',
  inclusions      text default '',
  exclusions      text default '',
  -- totals
  gst_inclusive   boolean not null default false,
  subtotal        numeric not null default 0,
  gst_amount      numeric not null default 0,
  total           numeric not null default 0,
  -- lifecycle
  sent_at         timestamptz,
  viewed_at       timestamptz,
  view_count      int not null default 0,
  accepted_at     timestamptz,
  accepted_by_name text,
  accept_method   text,
  accept_signature text,
  accept_ip       text,
  public_token    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists quote_docs_org_idx on quote_docs(org_id, created_at desc);
create index if not exists quote_docs_lead_idx on quote_docs(lead_id);
create unique index if not exists quote_docs_token_idx on quote_docs(public_token) where public_token is not null;

create table if not exists quote_doc_sections (
  id         text primary key default (gen_random_uuid())::text,
  quote_id   text not null references quote_docs(id) on delete cascade,
  org_id     uuid not null references orgs(id) on delete cascade,
  name       text not null default '',
  sort_order int not null default 0
);
create index if not exists quote_doc_sections_quote_idx on quote_doc_sections(quote_id);

create table if not exists quote_doc_items (
  id          text primary key default (gen_random_uuid())::text,
  quote_id    text not null references quote_docs(id) on delete cascade,
  org_id      uuid not null references orgs(id) on delete cascade,
  section_id  text,                       -- nullable; groups into a section/stage
  description text not null default '',
  detail      text default '',
  qty         numeric not null default 1,
  unit        text not null default 'ea',
  unit_price  numeric not null default 0,
  amount      numeric not null default 0,
  unit_cost   numeric,                     -- INTERNAL ONLY — never on the client doc/PDF
  sort_order  int not null default 0
);
create index if not exists quote_doc_items_quote_idx on quote_doc_items(quote_id);

create table if not exists quote_doc_stages (
  id            text primary key default (gen_random_uuid())::text,
  quote_id      text not null references quote_docs(id) on delete cascade,
  org_id        uuid not null references orgs(id) on delete cascade,
  label         text not null default '',
  milestone_note text,
  percent       numeric,                  -- percent OR fixed_amount
  fixed_amount  numeric,
  amount        numeric not null default 0,
  status        text not null default 'pending', -- pending|invoiced|paid
  sort_order    int not null default 0
);
create index if not exists quote_doc_stages_quote_idx on quote_doc_stages(quote_id);

-- RLS — org members manage their own org's rows.
do $$
declare t text;
begin
  foreach t in array array['quote_docs','quote_doc_sections','quote_doc_items','quote_doc_stages'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_member on %1$s;', t);
    execute format('create policy %1$s_member on %1$s using (is_member(org_id)) with check (is_member(org_id));', t);
  end loop;
end $$;

drop trigger if exists trg_quote_docs_updated on quote_docs;
create trigger trg_quote_docs_updated before update on quote_docs
  for each row execute function set_updated_at();
