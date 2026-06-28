-- =============================================================================
-- 0025_content_plan.sql — AI auto content calendar. Hazel plans + writes a
-- month of organic posts; approved ones auto-publish on schedule via cron.
--
-- Reuses the existing `posts` table (each planned post is a row). Adds:
--   auto_publish  — the owner approved this post to publish automatically.
--   plan_category — the content-mix slot Hazel chose (before/after, tip, …).
-- Idempotent. (image_url / video_url / media_type / platforms / published_at /
-- platform_results already exist from 0010 + 0022.) Run in the Supabase SQL editor.
-- =============================================================================

alter table posts add column if not exists auto_publish  boolean not null default false;
alter table posts add column if not exists plan_category text;

-- Cron finds due posts quickly: scheduled + approved + not yet published.
create index if not exists posts_due_idx on posts(org_id, status, auto_publish, scheduled_at);

notify pgrst, 'reload schema';
