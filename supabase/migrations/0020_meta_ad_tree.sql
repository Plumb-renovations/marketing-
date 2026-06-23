-- =============================================================================
-- 0020_meta_ad_tree.sql — full Meta ad-manager tree + insights + (optional)
-- auto-tuned targets. Lets Hazel show Campaign → Ad set → Ad with per-level
-- metrics and store the latest snapshot, so it can (a) drill the whole tree,
-- (b) anchor verdicts to cost-per-won-job, and (c) re-calibrate its guard rails
-- from THIS account's real data. The app reads insights live via the org's Meta
-- token and upserts here (service role); members read their own org's rows via
-- is_member() RLS. Idempotent. Run in the Supabase SQL editor.
-- =============================================================================

-- The ad tree: one row per Meta object (campaign | adset | ad).
create table if not exists meta_entities (
  org_id          uuid not null references orgs(id) on delete cascade,
  id              text not null,                -- Meta object id
  level           text not null,               -- 'campaign' | 'adset' | 'ad'
  parent_id       text,                         -- adset's campaign / ad's adset
  campaign_id     text,                         -- denormalised for grouping
  name            text default '',
  status          text,                         -- effective_status (ACTIVE/PAUSED/…)
  daily_budget    numeric,                      -- minor units (cents), adset only
  lifetime_budget numeric,
  updated_time    timestamptz,                  -- Meta's last-edit time (learning-reset window)
  synced_at       timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists meta_entities_org_level_idx on meta_entities(org_id, level);

-- Latest insights per object (any level).
create table if not exists meta_insights (
  org_id      uuid not null references orgs(id) on delete cascade,
  level       text not null,
  object_id   text not null,
  spend       numeric not null default 0,
  impressions bigint  not null default 0,
  clicks      bigint  not null default 0,
  ctr         numeric not null default 0,       -- %
  reach       bigint  not null default 0,
  frequency   numeric not null default 0,
  leads       int     not null default 0,
  date_start  date,
  date_stop   date,
  synced_at   timestamptz not null default now(),
  primary key (org_id, object_id)
);

-- OPTIONAL advanced overrides for Hazel's targets. Everything is nullable: when
-- null, Hazel uses its built-in home-reno defaults, auto-tuned from this
-- account's own data. The user never has to set these — they exist only so an
-- advanced user can pin a target.
create table if not exists ad_targets (
  org_id              uuid primary key references orgs(id) on delete cascade,
  target_cpl          numeric,   -- override "healthy" cost-per-lead
  concerning_cpl      numeric,   -- override "pause" cost-per-lead
  target_cost_per_won numeric,   -- override cost-per-won-job anchor
  budget_step_pct     int,       -- override the scale step (default 25)
  updated_at          timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['meta_entities','meta_insights','ad_targets'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_member on %1$s;', t);
    execute format('create policy %1$s_member on %1$s using (is_member(org_id)) with check (is_member(org_id));', t);
  end loop;
end $$;

drop trigger if exists trg_ad_targets_updated on ad_targets;
create trigger trg_ad_targets_updated before update on ad_targets
  for each row execute function set_updated_at();
