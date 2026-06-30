-- =============================================================================
-- 0037_quote_pc_tiers.sql — PC Items & Tiles as a PARALLEL tier choice + a
-- visible journey roadmap. (Supersedes the grouped-fixture-selection approach.)
--
-- The client makes TWO independent choices:
--   1. CONSTRUCTION tier (Essential/Premium/Luxury) — the build level (existing).
--   2. PC ITEMS tier (Standard/Premium/Luxury) — the fixture/tile allowance level
--      (NEW, parallel). Each allowance line is tagged to a PC tier exactly like a
--      build line is tagged to a construction tier; a PC tier = the shared PC
--      lines + that tier's fixtures, shown as covered items + ONE combined total.
--   Price = chosen construction tier (build) + chosen PC tier (allowance). They
--   mix freely. The deposit is based on the CONSTRUCTION total only.
--
--   quote_doc_items.pc_tier   — null = shared across PC tiers; else good/better/
--                               best (the PC level this fixture belongs to).
--   quote_docs.pc_tiered      — is the PC-tier choice offered? (default false)
--   quote_docs.accepted_pc_tier — the PC tier the client accepted.
--   quote_docs.pc_tier_names  — editable PC-tier labels (default Standard/
--                               Premium/Luxury).
--   quote_docs.journey        — jsonb [{label, note}] roadmap shown on the quote.
--
-- Org-scoped via the existing is_member() RLS (no policy change). Additive +
-- idempotent — the app tolerates these columns being absent until this runs.
-- Run in the Supabase SQL editor.
-- =============================================================================

alter table quote_doc_items add column if not exists pc_tier         text;

alter table quote_docs      add column if not exists pc_tiered       boolean not null default false;
alter table quote_docs      add column if not exists accepted_pc_tier text;
alter table quote_docs      add column if not exists pc_tier_names    jsonb;
alter table quote_docs      add column if not exists journey          jsonb;

notify pgrst, 'reload schema';
