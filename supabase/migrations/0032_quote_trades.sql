-- =============================================================================
-- 0032_quote_trades.sql — quote-by-trade structure.
--
-- The user builds a quote from individual components but the CLIENT sees ONE
-- consolidated line per trade (e.g. three "carpentry …" components → a single
-- "Carpentry — $total" line). To do that we tag each line item with:
--   * trade       — the trade/category it belongs to (Plumbing, Carpentry, Wall
--                    lining, Tiling, Waterproofing, Painting, Electrical, …).
--                    Free text so the list stays editable/extendable.
--   * trade_type  — 'in_house' or 'sub_trade'. Stored now for a LATER
--                    back-costing feature (in-house = track labour + materials
--                    actuals; sub-trade = track the sub's invoice). No costing
--                    logic yet — it's just a flag.
-- Price-list items also carry a trade so picking one suggests it.
--
-- Org-scoped via the existing is_member() RLS on these tables (no policy
-- change). Additive + idempotent — safe to run repeatedly, and the app tolerates
-- these columns being absent until this runs. Run in the Supabase SQL editor.
-- =============================================================================

alter table quote_doc_items   add column if not exists trade       text;
alter table quote_doc_items   add column if not exists trade_type  text;  -- 'in_house' | 'sub_trade' | null

alter table price_list_items  add column if not exists trade       text;

notify pgrst, 'reload schema';
