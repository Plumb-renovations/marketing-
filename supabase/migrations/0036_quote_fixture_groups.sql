-- =============================================================================
-- 0036_quote_fixture_groups.sql — grouped fixture/tile allowance with a single
-- client-selected option per group.
--
-- Fixtures are grouped by type (e.g. "Tapware", "Vanity"). Where the user has
-- several versions of an item, they're OPTIONS within one group and the client
-- picks ONE — so the allowance total only ever counts the selected option per
-- group, never the sum of the alternatives (the bug this fixes).
--
--   quote_doc_items.allowance_group     — the group this allowance option belongs
--                                         to (null/'' = its own one-option group).
--   quote_doc_items.allowance_selected  — true → the selected option for its
--                                         group (the build-time default, and the
--                                         client's chosen option captured on
--                                         accept). Only counts toward the total.
--
-- Org-scoped via the existing is_member() RLS (no policy change). Additive +
-- idempotent — the app tolerates these columns being absent until this runs.
-- Run in the Supabase SQL editor.
-- =============================================================================

alter table quote_doc_items add column if not exists allowance_group    text;
alter table quote_doc_items add column if not exists allowance_selected boolean not null default false;

notify pgrst, 'reload schema';
