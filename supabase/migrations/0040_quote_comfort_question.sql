-- =============================================================================
-- 0040_quote_comfort_question.sql — the gentle "comfort question" shown under
-- the client configurator's combined total.
--
-- The interactive quote lets the client pick a construction level + a fixtures
-- level and see their combined total. Underneath that total we show a soft,
-- reassuring prompt that gives them permission to quietly adjust their selections
-- to suit their budget — reducing the awkwardness that makes clients ghost when
-- a price feels too high.
--
--   quote_docs.comfort_question              — the reassurance text (per quote).
--   business_profiles.default_comfort_question — the org's saved default that new
--                                              quotes auto-fill from.
--
-- Org-scoped via the existing is_member() RLS (no policy change). Additive +
-- idempotent — the app tolerates these columns being absent until this runs.
-- Run in the Supabase SQL editor.
-- =============================================================================

alter table quote_docs        add column if not exists comfort_question         text;

alter table business_profiles add column if not exists default_comfort_question text;

notify pgrst, 'reload schema';
