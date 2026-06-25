-- =============================================================================
-- 0021_ad_creative_reviews.sql — AI creative reviewer: per-image scroll-stopper
-- verdicts + the learning loop that ties each image to its REAL ad performance.
--
-- Hazel scores any ad photo BEFORE money is spent (vision model) and stores that
-- prediction here, keyed by a content fingerprint (sha256 of the downscaled
-- image). Once an ad using that image has run, the app joins the image back to
-- its Meta results — ad_image_reviews (sha256) ↔ ads.photo ↔ published_ads
-- (ad_id → external_ad_id) ↔ live Meta insights — and writes the actuals here.
-- Over time Hazel learns which photo STYLES win for THIS account and feeds that
-- back into future verdicts (generic best-practice → this-business truth).
--
-- One table, org-scoped via is_member() RLS, idempotent. The app writes with the
-- authenticated client (members can only touch their own org's rows). Run in the
-- Supabase SQL editor.
-- =============================================================================

create table if not exists ad_image_reviews (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references orgs(id) on delete cascade,
  image_sha256       text not null,            -- fingerprint of the downscaled image bytes

  -- ---- Prediction (upload time, before spend) ----
  verdict            text,                     -- 'strong' | 'ok' | 'weak'
  score              int,                      -- 0-100 predicted scroll-stopping power
  style              text,                     -- classified style tag (before/after, hero, fixture, …)
  review             jsonb not null default '{}'::jsonb,  -- full verdict (reasons, fixes, wow, confidence)
  model              text,                     -- vision model id used
  thumb              text,                     -- small data-URL preview for the "predicted vs actual" surface

  -- ---- Actuals (filled once an ad with this image has run; from Meta) ----
  ads_count          int,                      -- how many live ads used this image
  impressions        bigint,
  clicks             bigint,
  spend              numeric,
  leads              int,
  ctr                numeric,                  -- % (clicks / impressions)
  cost_per_lead      numeric,                  -- spend / leads (AUD)
  won_jobs           int,                      -- reserved: cost-per-won-job attribution (nullable until built)
  cost_per_won       numeric,
  results_updated_at timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id, image_sha256)
);

create index if not exists ad_image_reviews_org_idx on ad_image_reviews(org_id);
create index if not exists ad_image_reviews_org_style_idx on ad_image_reviews(org_id, style);

-- Org-scoped RLS (same idiom as meta_entities / competitors / etc.).
do $$
declare t text;
begin
  foreach t in array array['ad_image_reviews'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_member on %1$s;', t);
    execute format('create policy %1$s_member on %1$s using (is_member(org_id)) with check (is_member(org_id));', t);
  end loop;
end $$;

-- Keep updated_at fresh (set_updated_at() is defined by an earlier migration).
drop trigger if exists trg_ad_image_reviews_updated on ad_image_reviews;
create trigger trg_ad_image_reviews_updated before update on ad_image_reviews
  for each row execute function set_updated_at();

-- Make PostgREST pick up the new table immediately.
notify pgrst, 'reload schema';
