-- =============================================================================
-- 0010_social_posts.sql — organic social posting v1
--
-- Adds a PUBLIC storage bucket for post media (Instagram requires a public image
-- URL) and the publishing columns on `posts`. Org-scoping + RLS for `posts`
-- already exist from 0001. Run in the Supabase SQL editor.
-- =============================================================================

-- Public bucket: uploads happen server-side (service role); reads are public so
-- Meta/Instagram can fetch the image by URL.
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

-- Publishing metadata on posts (existing columns: caption, channels[], photo,
-- scheduled_at, status are reused).
alter table posts add column if not exists image_url text;
alter table posts add column if not exists platforms text[] not null default '{}';
alter table posts add column if not exists published_at timestamptz;
alter table posts add column if not exists platform_results jsonb not null default '{}'::jsonb;
