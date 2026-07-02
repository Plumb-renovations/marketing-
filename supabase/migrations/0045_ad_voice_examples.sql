-- =============================================================================
-- 0045_ad_voice_examples.sql — saved brand-voice example ads for Hazel's
-- interview-then-write ad flow.
--
-- Hazel interviews the user about a project, then writes a top-class, human-
-- sounding ad set from their real answers. To match the business's own voice,
-- the user can save example ads they like; Hazel writes in that style. The
-- brand voice/tone itself already lives on business_profiles.tone.
--
--   business_profiles.ad_examples — jsonb array of 1-3 example ad texts the
--                                   business likes, used to steer Hazel's voice.
--
-- Org-scoped via the existing is_member() RLS. Additive + idempotent — tolerated
-- absent until applied. Run in the Supabase SQL editor.
-- =============================================================================

alter table business_profiles add column if not exists ad_examples jsonb;

notify pgrst, 'reload schema';
