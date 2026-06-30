-- =============================================================================
-- 0042_supplier_import.sql — bulk supplier IMPORT for PC items.
--
-- PC price-list items can be bulk-imported from a supplier spreadsheet (first
-- supplier: Naga). The import is supplier-aware: each supplier has its own
-- column mapping, category rule and pricing rule (in code), plus a per-org TRADE
-- DISCOUNT setting that drives the derived internal cost — so the user can change
-- the discount and recalculate every supplier cost WITHOUT re-importing.
--
-- price_list_items (new columns — all internal except the existing unit_price
-- which stays the SELL price the client sees):
--   supplier   — e.g. 'naga' (which supplier this item came from)
--   code       — the supplier product code / SKU (used to match on re-import)
--   rrp_inc    — the supplier RRP, GST-INCLUSIVE (the sell basis; INTERNAL ref)
--   width_mm / depth_mm / height_mm — product dimensions
--   (cost_price + markup_pct already exist from 0041; cost is derived from
--    rrp_inc and the supplier trade discount for derive-cost suppliers.)
--
-- supplier_settings — per-org, per-supplier knobs (the trade discount). Changing
--   trade_discount_pct + recomputing updates costs/margins with no re-import.
--
-- Org-scoped via the existing is_member() RLS. Additive + idempotent — the app
-- tolerates these being absent until this runs. Run in the Supabase SQL editor.
-- =============================================================================

alter table price_list_items add column if not exists supplier   text;
alter table price_list_items add column if not exists code       text;
alter table price_list_items add column if not exists rrp_inc    numeric;
alter table price_list_items add column if not exists width_mm   numeric;
alter table price_list_items add column if not exists depth_mm   numeric;
alter table price_list_items add column if not exists height_mm  numeric;

create index if not exists price_list_items_supplier_idx on price_list_items(org_id, supplier);

create table if not exists supplier_settings (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references orgs(id) on delete cascade,
  supplier           text not null,
  trade_discount_pct numeric not null default 0,
  created_at         timestamptz not null default now(),
  unique (org_id, supplier)
);
create index if not exists supplier_settings_org_idx on supplier_settings(org_id);
alter table supplier_settings enable row level security;
drop policy if exists supplier_settings_member on supplier_settings;
create policy supplier_settings_member on supplier_settings
  using (is_member(org_id)) with check (is_member(org_id));

notify pgrst, 'reload schema';
