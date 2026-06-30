-- =============================================================================
-- 0039_quote_configurator_intro.sql — the client-facing quote configurator's
-- intro framing message.
--
-- The public quote is an interactive configurator: the client picks a
-- construction level and a PC (fixtures & tiles) level and watches a live
-- combined total update. An intro message frames the quote as something they
-- TAILOR ("Your quote, your way…") rather than a fixed price to compare.
--
--   quote_docs.configurator_intro              — the framing message shown atop
--                                                the configurator (per quote).
--   business_profiles.default_configurator_intro — the org's saved default that
--                                                new quotes auto-fill from.
--
-- Org-scoped via the existing is_member() RLS (no policy change). Additive +
-- idempotent — the app tolerates these columns being absent until this runs.
-- Run in the Supabase SQL editor.
-- =============================================================================

alter table quote_docs        add column if not exists configurator_intro         text;

alter table business_profiles add column if not exists default_configurator_intro text;

notify pgrst, 'reload schema';
