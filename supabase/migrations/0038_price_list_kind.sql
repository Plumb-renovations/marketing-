-- =============================================================================
-- 0038_price_list_kind.sql — separate CONSTRUCTION items from PC ITEMS & TILES
-- in the per-org price list.
--
-- The quote builder offers two parallel choices: the construction tier and the
-- PC items / tiles tier. Until now both kinds of rate lived in one combined
-- price list, so the PC fixture palette showed construction trades (Painting,
-- Demolition, Labour…) mixed in with fixtures. A `kind` flag splits them:
--   * 'construction' — trades/labour rates (the default for every existing row)
--   * 'pc'           — fixtures & tiles (the PC-items palette pulls only these)
--
-- Additive + idempotent: existing rows default to 'construction', so nothing
-- changes until the user re-files items as PC. Org-scoped via the existing
-- is_member() RLS (no policy change needed). Run in the Supabase SQL editor.
-- =============================================================================

alter table price_list_items
  add column if not exists kind text not null default 'construction';

-- Constrain to the known values (guarded so re-runs don't error).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'price_list_items_kind_chk'
  ) then
    alter table price_list_items
      add constraint price_list_items_kind_chk check (kind in ('construction', 'pc'));
  end if;
end $$;

create index if not exists price_list_items_org_kind_idx
  on price_list_items(org_id, kind, sort_order);

notify pgrst, 'reload schema';
