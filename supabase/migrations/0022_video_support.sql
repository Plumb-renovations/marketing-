-- =============================================================================
-- 0022_video_support.sql — video for paid ads + organic social.
--
-- Adds media-type + video-url columns to ads / posts (and the creative reviewer
-- so it can store a video verdict), a `media_jobs` table that tracks the async
-- video upload→process→ready→publish flow (Meta video ads + IG Reels + FB Page
-- video), and widens the existing public `post-media` bucket to accept video.
-- Org-scoped via is_member() RLS. Idempotent — safe to run more than once.
-- Run in the Supabase SQL editor.
-- =============================================================================

-- ---- Media type on the things that carry media ----
alter table ads add column if not exists media_type text not null default 'image';   -- 'image' | 'video'
alter table ads add column if not exists video_url  text;                             -- public URL of the uploaded video

alter table posts add column if not exists media_type text not null default 'image';
alter table posts add column if not exists video_url  text;

-- The creative reviewer (0021) can now also judge a video.
alter table ad_image_reviews add column if not exists media_type text not null default 'image';

-- ---- Async publish jobs: video processes at Meta after we hand off the URL ----
-- One row per (platform) publish that can't finish in a single request. The
-- client polls /api/media-jobs/{id}; the server advances the state machine
-- (poll Meta processing → publish when ready). config holds everything needed
-- to finish the job statelessly.
create table if not exists media_jobs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  kind         text not null,                       -- 'fb' | 'ig' | 'ad'
  state        text not null default 'processing',  -- 'processing' | 'published' | 'failed'
  video_id     text,                                -- Meta advideo id / FB Page video id
  container_id text,                                -- IG media container (creation) id
  result_id    text,                                -- final published id (ad id / ig media id / fb video id)
  config       jsonb not null default '{}'::jsonb,  -- caption / creative / ids needed to complete
  error        text,
  attempts     int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists media_jobs_org_idx on media_jobs(org_id, state);

-- Org-scoped RLS (same idiom as meta_entities / ad_image_reviews).
do $$
declare t text;
begin
  foreach t in array array['media_jobs'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_member on %1$s;', t);
    execute format('create policy %1$s_member on %1$s using (is_member(org_id)) with check (is_member(org_id));', t);
  end loop;
end $$;

drop trigger if exists trg_media_jobs_updated on media_jobs;
create trigger trg_media_jobs_updated before update on media_jobs
  for each row execute function set_updated_at();

-- ---- Let the existing public media bucket carry video (≤300 MB) ----
update storage.buckets
set public = true,
    file_size_limit = 314572800,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/gif',
      'video/mp4','video/quicktime'
    ]
where id = 'post-media';

notify pgrst, 'reload schema';
