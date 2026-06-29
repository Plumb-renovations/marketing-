-- =============================================================================
-- 0031_price_list_and_templates.sql — quote foundation: a per-org PRICE LIST
-- (rate card) + reusable QUOTE TEMPLATES.
--
--  * price_list_items — the business's standard rates (villaboard per m²,
--    waterproofing, basic electrical package fixed, plumbing points per point,
--    tiling per m², painting…). Fully user-editable; the smart line-item picker
--    auto-fills the rate from here, and a future AI review layer reads it to
--    flag a line as too cheap / too dear vs the rate card.
--  * quote_templates — a saved set of line items (+ optional scope/notes) the
--    user loads for a new job, e.g. "Ground floor bathroom", "Upstairs
--    bathroom". The payload is stored as jsonb so it stays readable by the AI
--    reviewer and survives quote-model tweaks.
--
-- Both are org-scoped via the existing is_member() RLS — same pattern as
-- saved_line_items / quote_docs (reads rely on RLS, no org_id filter in app
-- queries). Idempotent. Run in the Supabase SQL editor.
-- =============================================================================

-- ---- Price list (rate card) ------------------------------------------------
create table if not exists price_list_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  category    text not null default '',          -- e.g. 'Linings', 'Waterproofing', 'Electrical'
  name        text not null default '',          -- e.g. 'Villaboard', 'Plumbing point'
  unit        text not null default 'ea',         -- 'm²', 'point', 'fixed', 'ea', 'hr'…
  unit_price  numeric not null default 0,
  notes       text,                               -- internal note / what the rate covers
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists price_list_items_org_idx on price_list_items(org_id, sort_order);
alter table price_list_items enable row level security;
drop policy if exists price_list_items_member on price_list_items;
create policy price_list_items_member on price_list_items
  using (is_member(org_id)) with check (is_member(org_id));

-- ---- Saved quote templates -------------------------------------------------
create table if not exists quote_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  name        text not null default '',
  data        jsonb not null default '{}'::jsonb, -- { items:[...], scopeDescription, inclusions, exclusions }
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists quote_templates_org_idx on quote_templates(org_id, sort_order);
alter table quote_templates enable row level security;
drop policy if exists quote_templates_member on quote_templates;
create policy quote_templates_member on quote_templates
  using (is_member(org_id)) with check (is_member(org_id));

notify pgrst, 'reload schema';
