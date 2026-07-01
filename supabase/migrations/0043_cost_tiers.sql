-- =============================================================================
-- 0043_cost_tiers.sql — multiple COST TIERS per PC item + an active-tier toggle.
--
-- Some suppliers ship the same catalogue at more than one trade tier (e.g.
-- Millennium's "-46" and "-49" price lists — identical products/RRP, only the
-- NETT cost differs). We store every tier's cost on the item and flip which one
-- is live via a per-supplier setting — so confirming a tier is a ONE-CLICK
-- change, not a re-import.
--
--   price_list_items.cost_tiers  — jsonb map of tier label → cost (ex-GST),
--                                  e.g. {"46": 63.29, "49": 60.77}. INTERNAL.
--   supplier_settings.active_tier — which tier's cost is currently live for a
--                                  supplier (its cost_price is set from this).
--
-- Generic (any supplier can have any tier labels). The client never sees cost /
-- tiers. Org-scoped via the existing is_member() RLS. Additive + idempotent —
-- tolerated absent until applied. Run in the Supabase SQL editor.
-- =============================================================================

alter table price_list_items add column if not exists cost_tiers  jsonb;

alter table supplier_settings add column if not exists active_tier text;

notify pgrst, 'reload schema';
