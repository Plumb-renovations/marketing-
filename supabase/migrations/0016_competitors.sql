-- =============================================================================
-- 0016_competitors.sql — Competitor Intelligence v1.
--
-- Per-org list of competitors (name + their Facebook Page URL/@handle) used to
-- deep-link into the public Meta Ad Library and to feed the "paste & beat" AI
-- flow. Org-scoped via the same is_member() RLS as the rest of the app.
-- Idempotent. Run in the Supabase SQL editor.
-- =============================================================================

create table if not exists competitors (
  id         text primary key default (gen_random_uuid())::text,
  org_id     uuid not null references orgs(id) on delete cascade,
  name       text not null default '',
  fb_url     text,                       -- Facebook Page URL or @handle (raw input)
  notes      text,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists competitors_org_idx on competitors(org_id, sort_order);

alter table competitors enable row level security;
drop policy if exists competitors_member on competitors;
create policy competitors_member on competitors
  using (is_member(org_id)) with check (is_member(org_id));

drop trigger if exists trg_competitors_updated on competitors;
create trigger trg_competitors_updated before update on competitors
  for each row execute function set_updated_at();
