-- =============================================================================
-- 0024_creative_description.sql — store the Creative Reviewer's plain-English
-- DESCRIPTION of each image/video + the KEY SELLING POINTS it extracts, so the
-- Ad Creator (and coach) can write copy about what's ACTUALLY in the creative.
-- Adds two columns to the existing ad_image_reviews table (0021). Idempotent.
-- Run in the Supabase SQL editor.
-- =============================================================================

alter table ad_image_reviews add column if not exists description text;            -- what's in the image/video
alter table ad_image_reviews add column if not exists key_points jsonb not null default '[]'::jsonb; -- selling points to lead with

notify pgrst, 'reload schema';
