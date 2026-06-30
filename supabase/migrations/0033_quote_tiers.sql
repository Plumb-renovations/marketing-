-- =============================================================================
-- 0033_quote_tiers.sql — tiered "Good / Better / Best" quotes.
--
-- ONE quote can present three price options. Most of the job is SHARED (the base
-- build); only the FINISHES change per tier (fixtures/PC items, tiles, tile
-- coverage). So we tag each line item with a tier and each tier's total =
-- shared base + that tier's finishes.
--
--   quote_doc_items.tier   — null = SHARED (in every tier); 'good' | 'better' |
--                            'best' = that tier's finishes only.
--   quote_docs.tiered      — is this a tiered quote? (default false → normal
--                            single-price quote, unchanged.)
--   quote_docs.accepted_tier — which tier the client accepted ('good'|'better'|
--                            'best'); that tier becomes the agreed quote and its
--                            total drives the deposit invoice.
--
-- Org-scoped via the existing is_member() RLS (no policy change). Additive +
-- idempotent — the app tolerates these columns being absent until this runs.
-- Run in the Supabase SQL editor.
-- =============================================================================

alter table quote_docs       add column if not exists tiered        boolean not null default false;
alter table quote_docs       add column if not exists accepted_tier text;   -- 'good' | 'better' | 'best'

alter table quote_doc_items  add column if not exists tier          text;   -- null = shared; else 'good'|'better'|'best'

notify pgrst, 'reload schema';
