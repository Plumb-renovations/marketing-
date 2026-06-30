-- =============================================================================
-- 0041_pc_cost_markup.sql — COST → MARKUP → SELL pricing for PC items.
--
-- PC items (price_list_items.kind = 'pc') are bought from a supplier at a COST
-- price, marked up, and sold to the client at a SELL price. The client only ever
-- sees the sell price (price_list_items.unit_price); cost + markup are INTERNAL.
--
--   price_list_items.cost_price   — what the business pays the supplier (internal)
--   price_list_items.markup_pct   — per-item markup % override (null → use the
--                                   org default below). sell = cost × (1 + m/100),
--                                   or set directly via unit_price.
--   business_profiles.default_pc_markup_pct — the org's default markup applied to
--                                   PC items that don't override it.
--
-- (Category already exists as price_list_items.category — free text — so no
-- column is needed for the category feature.)
--
-- Internal-only: cost_price + markup_pct are never selected for the client doc /
-- public link. Org-scoped via the existing is_member() RLS (no policy change).
-- Additive + idempotent — the app tolerates these columns being absent until this
-- runs. Run in the Supabase SQL editor.
-- =============================================================================

alter table price_list_items  add column if not exists cost_price            numeric;
alter table price_list_items  add column if not exists markup_pct            numeric;

alter table business_profiles add column if not exists default_pc_markup_pct numeric;

notify pgrst, 'reload schema';
