-- =============================================================================
-- Marketing Command Centre — initial schema (Milestone 1)
-- Single-business app, org-scoped for safety + future-proofing.
-- RLS denies by default; access requires org membership.
-- Third-party API tokens are NEVER stored here (they live in env / Vault).
-- =============================================================================

create extension if not exists pgcrypto;

-- The single business org. A fixed id so seeding + the new-user trigger agree.
-- (Multi-org is possible later; today every authenticated staff member joins this one.)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_stage') then
    create type lead_stage  as enum ('new','qualified','quote','won','lost');
  end if;
  if not exists (select 1 from pg_type where typname = 'lead_source') then
    create type lead_source as enum ('google_ads','meta_ads','instagram','facebook','gbp','referral','website');
  end if;
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status  as enum ('scheduled','in_progress','complete');
  end if;
end $$;

-- ============================ ORG / MEMBERSHIP ===============================
create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Plumb Renovations',
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  org_id  uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role    text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Membership check used by every policy (definer = bypasses RLS on memberships).
create or replace function is_member(p_org uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from memberships m
                 where m.org_id = p_org and m.user_id = auth.uid());
$$;

-- Seed the single org with a fixed id.
insert into orgs (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Plumb Renovations')
on conflict (id) do nothing;

-- ============================ CORE: LEADS / QUOTES ==========================
-- App-authored entities (leads, quotes, line items, posts, ads) use TEXT ids so
-- the ported UI keeps its own id scheme verbatim and persistence is a plain upsert.
create table if not exists leads (
  id text primary key default (gen_random_uuid())::text,
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  suburb text,
  project text,
  source lead_source not null default 'website',
  stage  lead_stage  not null default 'new',
  lead_date date not null default current_date,
  lost_reason text,
  won_quote_id text,                 -- soft ref to quotes.id
  tradify text,
  start_date date,
  duration_weeks int,
  job_status job_status,
  -- provenance for live sync (M4)
  external_source text,
  external_id text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, external_source, external_id)
);
create index if not exists leads_org_stage_idx on leads(org_id, stage);

create table if not exists quotes (
  id text primary key default (gen_random_uuid())::text,
  org_id uuid not null references orgs(id) on delete cascade,
  lead_id text not null references leads(id) on delete cascade,
  status text not null default 'draft',      -- 'draft' | 'sent'
  created_at date not null default current_date,
  position int not null default 0
);
create index if not exists quotes_lead_idx on quotes(lead_id);

create table if not exists quote_line_items (
  id text primary key default (gen_random_uuid())::text,
  quote_id text not null references quotes(id) on delete cascade,
  description text not null default '',
  qty numeric not null default 1,
  unit_price numeric not null default 0,     -- GST-exclusive; 10% GST applied in app
  position int not null default 0
);
create index if not exists qli_quote_idx on quote_line_items(quote_id);

-- ============================ CONTENT / ADS =================================
create table if not exists posts (
  id text primary key default (gen_random_uuid())::text,
  org_id uuid not null references orgs(id) on delete cascade,
  caption text default '',
  hashtags text default '',
  cta text,
  why text default '',
  channels text[] not null default '{}',     -- 'instagram' | 'facebook' | 'gbp'
  photo text,                                -- data URL for now; Storage path in M2
  scheduled_at text,                         -- 'YYYY-MM-DDTHH:mm' (matches UI input)
  status text not null default 'draft',      -- 'draft' | 'scheduled' | 'posted'
  reach int,
  engagement int,
  external_post_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_org_idx on posts(org_id);

create table if not exists ads (
  id text primary key default (gen_random_uuid())::text,
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null,                        -- 'meta' | 'google'
  goal text,
  photo text,                                -- data URL for now; Storage path in M2
  status text not null default 'draft',      -- 'draft' | 'live' | 'archived'
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ads_org_idx on ads(org_id);

-- ============================ SETTINGS / METRICS ============================
-- One row per org: pipeline capacity settings (columns) + manual metrics (jsonb).
create table if not exists app_settings (
  org_id uuid primary key references orgs(id) on delete cascade,
  jobs_target int not null default 3,
  revenue_target numeric not null default 0,
  lead_time_weeks int not null default 7,
  cost_per_lead numeric not null default 205,
  lead_to_won_rate numeric not null default 12.5,
  metrics jsonb not null default
    '{"spend":{"google_ads":800,"meta_ads":1639},"organic":{"ig_reach":0,"ig_eng":0,"fb_reach":0,"fb_eng":0,"gbp_views":0,"gbp_calls":0}}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into app_settings (org_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (org_id) do nothing;

-- ============================ LIVE AD/INSIGHT DATA (M3–M5) ==================
-- Created now so the schema is complete; populated in later milestones.
create table if not exists fx_rates (
  rate_date date not null,
  base char(3) not null,
  quote char(3) not null,
  rate numeric not null,
  primary key (rate_date, base, quote)
);

create table if not exists ad_spend_daily (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  channel text not null,                     -- 'google_ads' | 'meta_ads'
  spend_date date not null,
  amount_aud numeric not null,
  amount_orig numeric,
  currency_orig char(3),
  fx_rate numeric,
  campaign_external_id text,
  raw jsonb,
  unique (org_id, channel, spend_date, campaign_external_id)
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  channel text not null,
  external_id text not null,
  name text,
  status text,
  metrics jsonb,
  updated_at timestamptz not null default now(),
  unique (org_id, channel, external_id)
);

create table if not exists keywords (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  keyword text not null,
  match_type text,
  spend numeric, clicks int, ctr numeric, conversions numeric,
  status text, action text,
  updated_at timestamptz not null default now()
);

create table if not exists channel_insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  channel text not null,                     -- 'instagram' | 'facebook' | 'gbp'
  insight_date date not null,
  reach int, engagement int, views int, calls int,
  raw jsonb,
  unique (org_id, channel, insight_date)
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  external_id text not null,
  author text, rating int, comment text, review_time timestamptz,
  reply text, raw jsonb,
  unique (org_id, external_id)
);

create table if not exists conversions_uploaded (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  lead_id text references leads(id) on delete set null,
  conversion_value numeric,
  currency char(3) default 'AUD',
  status text not null default 'pending',
  response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  source_path text not null,
  status text not null default 'uploaded',
  transcript jsonb,
  edit_plan jsonb,
  output_path text,
  cost_cents int,
  post_id text references posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================ updated_at TRIGGER ============================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['leads','posts','app_settings','campaigns','keywords','videos']
  loop
    execute format('drop trigger if exists trg_%1$s_updated on %1$s;', t);
    execute format(
      'create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- ============================ NEW-USER BOOTSTRAP ============================
-- Every staff member who signs in joins the single org automatically.
-- (A later milestone can swap this for an email allowlist.)
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into memberships (org_id, user_id)
  values ('00000000-0000-0000-0000-000000000001', new.id)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================ RLS ==========================================
do $$
declare t text;
begin
  foreach t in array array[
    'orgs','memberships','leads','quotes','quote_line_items','posts','ads',
    'app_settings','fx_rates','ad_spend_daily','campaigns','keywords',
    'channel_insights','reviews','conversions_uploaded','videos']
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- Org-scoped tables: members get full access.
do $$
declare t text;
begin
  foreach t in array array[
    'leads','posts','ads','app_settings','ad_spend_daily','campaigns',
    'keywords','channel_insights','reviews','conversions_uploaded','videos']
  loop
    execute format('drop policy if exists %1$s_member on %1$s;', t);
    execute format(
      'create policy %1$s_member on %1$s
         using (is_member(org_id)) with check (is_member(org_id));', t);
  end loop;
end $$;

drop policy if exists orgs_member on orgs;
create policy orgs_member on orgs
  using (is_member(id)) with check (is_member(id));

drop policy if exists memberships_self on memberships;
create policy memberships_self on memberships
  using (user_id = auth.uid() or is_member(org_id));

-- Child tables scoped through their parent.
drop policy if exists quotes_member on quotes;
create policy quotes_member on quotes
  using (is_member(org_id)) with check (is_member(org_id));

drop policy if exists qli_member on quote_line_items;
create policy qli_member on quote_line_items
  using (exists (select 1 from quotes q where q.id = quote_id and is_member(q.org_id)))
  with check (exists (select 1 from quotes q where q.id = quote_id and is_member(q.org_id)));

-- Reference data: readable by any authenticated user.
drop policy if exists fx_read on fx_rates;
create policy fx_read on fx_rates for select using (auth.role() = 'authenticated');

-- ============================ STORAGE ======================================
insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', false), ('videos', 'videos', false)
on conflict (id) do nothing;

drop policy if exists "post-photos member access" on storage.objects;
create policy "post-photos member access" on storage.objects
  for all to authenticated
  using (bucket_id = 'post-photos' and is_member('00000000-0000-0000-0000-000000000001'))
  with check (bucket_id = 'post-photos' and is_member('00000000-0000-0000-0000-000000000001'));

drop policy if exists "videos member access" on storage.objects;
create policy "videos member access" on storage.objects
  for all to authenticated
  using (bucket_id = 'videos' and is_member('00000000-0000-0000-0000-000000000001'))
  with check (bucket_id = 'videos' and is_member('00000000-0000-0000-0000-000000000001'));

-- ============================ REALTIME =====================================
do $$
begin
  alter publication supabase_realtime add table leads;
  alter publication supabase_realtime add table quotes;
  alter publication supabase_realtime add table posts;
  alter publication supabase_realtime add table ad_spend_daily;
  alter publication supabase_realtime add table channel_insights;
  alter publication supabase_realtime add table reviews;
  alter publication supabase_realtime add table videos;
exception when duplicate_object then null;
end $$;
