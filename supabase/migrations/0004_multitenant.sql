-- =============================================================================
-- 0004_multitenant.sql — multi-tenant foundation
--
-- Each NEW signup now gets its OWN org (with an `owner` membership) instead of
-- every user joining the single Plumb org. The existing Plumb org, its
-- memberships and data are left untouched. The org-scoped RLS from 0001
-- (`is_member(org_id)`) already prevents any cross-org read/write, so the core
-- table policies need no changes — only the new-user bootstrap, a small org
-- helper, and the (previously Plumb-hardcoded) Storage policies change here.
--
-- Apply by running this file in the Supabase SQL editor (same as 0003).
-- =============================================================================

-- The caller's current org = their earliest membership. security definer so it
-- can read memberships under RLS; safe to use in policies and column defaults.
create or replace function current_org_id()
returns uuid language sql security definer stable
set search_path = public as $$
  select m.org_id
  from memberships m
  where m.user_id = auth.uid()
  order by m.created_at asc
  limit 1
$$;

-- New-user bootstrap: provision a personal org and make the new user its owner.
-- Replaces the 0001 version that joined everyone to the fixed Plumb org. The
-- on_auth_user_created trigger from 0001 already calls handle_new_user().
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  new_org  uuid;
  org_name text;
begin
  -- Idempotent: never double-provision a user who already has a membership.
  if exists (select 1 from memberships where user_id = new.id) then
    return new;
  end if;

  -- Name the org from an optional signup field, else the email local-part.
  org_name := coalesce(
    nullif(new.raw_user_meta_data->>'org_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'My workspace'
  );

  insert into orgs (name) values (org_name) returning id into new_org;

  insert into memberships (org_id, user_id, role)
  values (new_org, new.id, 'owner')
  on conflict do nothing;

  -- Give the org a default settings row to read/update.
  insert into app_settings (org_id) values (new_org)
  on conflict (org_id) do nothing;

  return new;
end $$;

-- Storage: the 0001 policies hard-coded the Plumb org id (so only Plumb members
-- could use the buckets). Relax to "any authenticated org member". This is
-- bucket-level access, NOT per-org object isolation — true isolation needs
-- org-prefixed object paths (flagged for a later PR). Photos are currently
-- stored as data URLs in the DB, so these buckets are effectively unused today.
drop policy if exists "post-photos member access" on storage.objects;
create policy "post-photos member access" on storage.objects
  for all to authenticated
  using (bucket_id = 'post-photos' and current_org_id() is not null)
  with check (bucket_id = 'post-photos' and current_org_id() is not null);

drop policy if exists "videos member access" on storage.objects;
create policy "videos member access" on storage.objects
  for all to authenticated
  using (bucket_id = 'videos' and current_org_id() is not null)
  with check (bucket_id = 'videos' and current_org_id() is not null);
