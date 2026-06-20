-- =============================================================================
-- 0008_business_profiles.sql — per-org Business Profile
--
-- Describes each org's service business so the AI ad-copy + ad-targeting
-- defaults are per-org (not hardcoded to renovation). Org-scoped via the same
-- is_member() RLS as the rest of the app. The existing Plumb org is seeded with
-- its current renovation settings so nothing changes for it.
--
-- (Numbered 0008 to sit after the in-flight Google Business Profile migrations
--  0006/0007. Apply order is by number; run in the Supabase SQL editor.)
-- =============================================================================

create table if not exists business_profiles (
  org_id             uuid primary key references orgs(id) on delete cascade,
  business_name      text not null default '',
  business_type      text not null default '',
  services           text[] not null default '{}',
  service_area_label text not null default '',
  service_area_lat   numeric,
  service_area_lng   numeric,
  service_radius_km  int not null default 25,
  selling_points     text[] not null default '{}',
  tone               text not null default '',
  offer              text not null default '',
  audience_interests text[] not null default '{}',
  updated_at         timestamptz not null default now()
);

alter table business_profiles enable row level security;

drop policy if exists business_profiles_member on business_profiles;
create policy business_profiles_member on business_profiles
  using (is_member(org_id)) with check (is_member(org_id));

drop trigger if exists trg_business_profiles_updated on business_profiles;
create trigger trg_business_profiles_updated
  before update on business_profiles
  for each row execute function set_updated_at();

-- Pre-fill the existing Plumb org with its current renovation settings, so the
-- AI copy + targeting behave exactly as before.
insert into business_profiles (
  org_id, business_name, business_type, services, service_area_label,
  service_area_lat, service_area_lng, service_radius_km,
  selling_points, tone, offer, audience_interests
) values (
  '00000000-0000-0000-0000-000000000001',
  'Plumb Renovations',
  'bathroom, ensuite & laundry renovation',
  array['Bathroom renovations','Ensuite renovations','Laundry renovations'],
  'Gold Coast & Northern Rivers',
  -28.17, 153.54, 50,
  array[
    'Transparent fixed pricing — no surprises',
    'QBCC licensed',
    'Workmanship warranty',
    'Premium-justified quality (not the cheapest, the right quote)',
    'Real before/after results'
  ],
  'The trusted local expert — warm, concrete and reassuring, never hypey.',
  '',
  array['Home improvement','Home Ownership','Renovation','Interior design','Bathroom']
)
on conflict (org_id) do nothing;
