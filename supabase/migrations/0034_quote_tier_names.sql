-- =============================================================================
-- 0034_quote_tier_names.sql — editable display names for Good/Better/Best tiers.
--
-- The three tiers keep their internal identity (good/better/best — cheapest/
-- middle/dearest, and the stored accepted_tier). This adds an OPTIONAL per-quote
-- map of DISPLAY labels so the user can rename them (e.g. Essential / Premium /
-- Luxury, or "Classic Bathroom / Designer Bathroom / Luxury Bathroom").
--
--   quote_docs.tier_names — jsonb { "good": "...", "better": "...", "best": "..." }
--                           null/absent → the app shows the defaults
--                           (Essential / Premium / Luxury).
--
-- Org-scoped via the existing is_member() RLS (no policy change). Additive +
-- idempotent — the app tolerates this column being absent until this runs.
-- Run in the Supabase SQL editor.
-- =============================================================================

alter table quote_docs add column if not exists tier_names jsonb;

notify pgrst, 'reload schema';
