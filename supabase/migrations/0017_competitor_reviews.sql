-- =============================================================================
-- 0017_competitor_reviews.sql — Competitor Intelligence Section 1 ("Why they're
-- winning"): per-org snapshot of top local rivals (Google Places ratings +
-- reviews) and the AI analysis. Refreshed weekly by cron (service role writes);
-- org members read their own org's rows via is_member() RLS. Idempotent.
-- Run in the Supabase SQL editor.
-- =============================================================================

-- One row per discovered competitor for an org (latest snapshot).
create table if not exists competitor_insights (
  id           text primary key default (gen_random_uuid())::text,
  org_id       uuid not null references orgs(id) on delete cascade,
  name         text not null default '',
  place_id     text,
  rating       numeric,
  review_count int,
  address      text,
  why_ahead    text,        -- AI: why they're ahead of us
  how_to_beat  text,        -- AI: how to out-position them
  rank         int not null default 0,
  updated_at   timestamptz not null default now()
);
create index if not exists competitor_insights_org_idx on competitor_insights(org_id, rank);

-- One row per org: the overall "pattern across your market" summary + run status.
create table if not exists competitor_reports (
  org_id         uuid primary key references orgs(id) on delete cascade,
  market_summary text,
  status         text not null default 'ok',   -- 'ok' | 'error'
  message        text,
  generated_at   timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['competitor_insights','competitor_reports'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_member on %1$s;', t);
    execute format('create policy %1$s_member on %1$s using (is_member(org_id)) with check (is_member(org_id));', t);
  end loop;
end $$;
