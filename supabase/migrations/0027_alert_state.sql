-- =============================================================================
-- 0027_alert_state.sql — remember which proactive alerts the user has snoozed,
-- so Hazel's "needs your attention" strip doesn't re-nag a dismissed item (it
-- re-surfaces after the snooze window, since brutal truths shouldn't vanish
-- forever). Org-scoped via is_member() RLS. Idempotent.
-- =============================================================================

create table if not exists alert_dismissals (
  org_id        uuid not null references orgs(id) on delete cascade,
  alert_key     text not null,                       -- stable signal id (e.g. pause-<adsetId>, money-wasted)
  snoozed_until timestamptz,                          -- hidden until this time; null = until manually cleared
  dismissed_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (org_id, alert_key)
);

do $$
declare t text;
begin
  foreach t in array array['alert_dismissals'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_member on %1$s;', t);
    execute format('create policy %1$s_member on %1$s using (is_member(org_id)) with check (is_member(org_id));', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
