-- =============================================================================
-- 0026_engagement.sql — AI comment + review responder. Stores FB/IG comments
-- and Google reviews so Hazel can DRAFT a reply (brand voice) the user approves
-- before it's posted. Nothing auto-posts.
--
-- Reading/replying to comments needs Meta permissions beyond the current
-- ads/leads scopes (pages_read_engagement, pages_manage_engagement,
-- instagram_manage_comments → App Review); Google reviews need a Google Business
-- Profile connection that isn't set up yet. This table is the channel-agnostic
-- store that fills as each connection lights up — until then the UI shows a
-- clear "pending" state, never fake items. Org-scoped RLS. Idempotent.
-- =============================================================================

create table if not exists engagement_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  channel     text not null,                       -- 'facebook' | 'instagram' | 'google'
  kind        text not null,                       -- 'comment' | 'review'
  external_id text not null,                        -- comment id / review id
  parent_ref  text,                                 -- post id / media id / location
  permalink   text,
  author_name text,
  text        text,
  rating      int,                                  -- reviews only (1-5); null for comments
  sentiment   text,                                 -- 'positive' | 'neutral' | 'negative'
  status      text not null default 'new',          -- new | drafted | flagged | replied | skipped
  draft_reply text,
  flagged     boolean not null default false,       -- sensitive → user's personal attention
  flag_reason text,
  replied_at  timestamptz,
  item_at     timestamptz,                          -- when the comment/review was made
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, channel, external_id)
);

create index if not exists engagement_items_org_recent_idx on engagement_items(org_id, item_at desc);
create index if not exists engagement_items_org_status_idx on engagement_items(org_id, status);

do $$
declare t text;
begin
  foreach t in array array['engagement_items'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_member on %1$s;', t);
    execute format('create policy %1$s_member on %1$s using (is_member(org_id)) with check (is_member(org_id));', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
