-- =============================================================================
-- 0013_signals_foundation.sql — Signals engine, Part A (data foundation).
--
-- Captures what the capacity/Signals engine will read, even before the engine
-- (Part B) exists: per-org capacity settings, won-job value + ad/campaign
-- attribution on leads, ad-performance and post-performance tables. Org-scoped
-- via is_member() RLS. Idempotent — safe to re-run. Run in the SQL editor.
-- =============================================================================

-- 1) Won jobs / pipeline: capture the accepted-quote value + ad attribution on
--    the lead. (start_date, duration_weeks, job_status already exist from 0001.)
alter table leads add column if not exists job_value numeric;         -- = accepted quote total
alter table leads add column if not exists ad_platform text;          -- 'google' | 'meta'
alter table leads add column if not exists ad_campaign_id text;       -- external campaign id

-- 2) Capacity settings — one row per org.
create table if not exists org_capacity (
  org_id            uuid primary key references orgs(id) on delete cascade,
  concurrent_jobs   int     not null default 1,   -- crews / job slots running at once
  typical_job_weeks numeric not null default 2,   -- default job length
  healthy_min_weeks numeric not null default 4,   -- "booked range" lower bound
  healthy_max_weeks numeric not null default 8,   -- upper bound
  updated_at        timestamptz not null default now()
);

-- 3) Ad performance per campaign — spend + leads generated, by period.
--    (Populated from the Google/Meta integrations when those land; schema now so
--    cost-per-lead AND cost-per-won-job per campaign are computable.)
create table if not exists ad_performance (
  id                  text primary key default (gen_random_uuid())::text,
  org_id              uuid not null references orgs(id) on delete cascade,
  platform            text not null,              -- 'google' | 'meta'
  external_campaign_id text,
  campaign_name       text default '',
  spend               numeric not null default 0,
  leads_count         int     not null default 0,
  period_start        date,
  period_end          date,
  updated_at          timestamptz not null default now(),
  unique (org_id, platform, external_campaign_id, period_start)
);
create index if not exists ad_perf_org_idx on ad_performance(org_id);

-- 4) Content/post performance — per organic post (reach/impressions/engagement/
--    clicks + attributed leads). Populated when posting insights are built.
create table if not exists post_performance (
  id                text primary key default (gen_random_uuid())::text,
  org_id            uuid not null references orgs(id) on delete cascade,
  post_id           text references posts(id) on delete cascade,
  reach             int not null default 0,
  impressions       int not null default 0,
  engagement        int not null default 0,
  link_clicks       int not null default 0,
  attributed_leads  int not null default 0,
  captured_at       timestamptz not null default now(),
  unique (org_id, post_id)
);
create index if not exists post_perf_org_idx on post_performance(org_id);

-- RLS — org members manage their own org's rows.
do $$
declare t text;
begin
  foreach t in array array['org_capacity','ad_performance','post_performance'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_member on %1$s;', t);
    execute format('create policy %1$s_member on %1$s using (is_member(org_id)) with check (is_member(org_id));', t);
  end loop;
end $$;

drop trigger if exists trg_org_capacity_updated on org_capacity;
create trigger trg_org_capacity_updated before update on org_capacity
  for each row execute function set_updated_at();
