-- =============================================================================
-- 0029_lead_delete.sql — permanent lead delete that STAYS gone. Hard-deleting a
-- lead row isn't enough on its own for leads that came from Meta: a re-sync /
-- backfill could re-create them. This tombstone records the external key of a
-- permanently-deleted lead so the leadgen webhook skips re-importing it.
-- Org-scoped via is_member() RLS. Idempotent.
-- =============================================================================

create table if not exists deleted_lead_keys (
  org_id          uuid not null references orgs(id) on delete cascade,
  external_source text not null,                 -- e.g. 'meta_leadgen'
  external_id     text not null,                 -- the leadgen id
  created_at      timestamptz not null default now(),
  primary key (org_id, external_source, external_id)
);

do $$
declare t text;
begin
  foreach t in array array['deleted_lead_keys'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_member on %1$s;', t);
    execute format('create policy %1$s_member on %1$s using (is_member(org_id)) with check (is_member(org_id));', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
