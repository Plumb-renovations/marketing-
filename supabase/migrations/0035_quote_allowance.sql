-- =============================================================================
-- 0035_quote_allowance.sql — "PC Items & Tiles" / Tile & Fixture Allowance.
--
-- Fixtures + tiles are a SEPARATE, flexible layer that is NOT locked to the
-- build tier — the user toggles which PC items / tiles apply to this bathroom
-- and they form an itemised allowance section on the quote, decoupled from the
-- (single-price OR Good/Better/Best) build pricing.
--
--   quote_doc_items.allowance             — true → this line is part of the Tile
--                                           & Fixture Allowance section (not the
--                                           build scope). Always tier-decoupled.
--   quote_doc_items.source_price_item_id  — the price_list_items.id this line was
--                                           toggled on from (so the PC selector
--                                           knows what's currently included).
--   quote_docs.allowance_note             — editable framing text shown atop the
--                                           allowance section (per quote).
--   business_profiles.default_allowance_note — the org's saved default framing
--                                           text that new quotes auto-fill from.
--
-- Org-scoped via the existing is_member() RLS (no policy change). Additive +
-- idempotent — the app tolerates these columns being absent until this runs.
-- Run in the Supabase SQL editor.
-- =============================================================================

alter table quote_doc_items   add column if not exists allowance            boolean not null default false;
alter table quote_doc_items   add column if not exists source_price_item_id text;

alter table quote_docs        add column if not exists allowance_note        text;

alter table business_profiles add column if not exists default_allowance_note text;

notify pgrst, 'reload schema';
