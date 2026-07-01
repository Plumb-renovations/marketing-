-- =============================================================================
-- 0044_quote_last_viewed.sql — surface client open activity (Tradify-style).
--
-- Client opens are already tracked: quote_docs.viewed_at (FIRST open) +
-- view_count (how many), and a quote_views row per open (timestamp + UA +
-- referer). Owner/authenticated views are excluded upstream (the track route).
-- This adds the LAST-opened timestamp so the quotes list can show
-- "Opened 3× · last opened 2 Jul 2026, 4:15pm" without aggregating quote_views.
--
--   quote_docs.last_viewed_at — the most recent CLIENT open (updated each open).
--
-- Org-scoped via the existing is_member() RLS. Additive + idempotent — tolerated
-- absent until applied. Run in the Supabase SQL editor.
-- =============================================================================

alter table quote_docs add column if not exists last_viewed_at timestamptz;

notify pgrst, 'reload schema';
