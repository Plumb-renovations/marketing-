-- =============================================================================
-- 0005_org_integrations.sql — per-org integration credentials
--
-- Until now Meta credentials lived only in env vars (a single Plumb account).
-- This adds a per-org table so each org can connect its OWN Meta (and later
-- Google) account: a long-lived access token plus the chosen ad account / Page.
--
-- Secrets stay server-only: RLS is ENABLED with NO authenticated/anon policy,
-- so the browser can never read this table. All access goes through the
-- service-role admin client on the server (which bypasses RLS); the Settings
-- UI talks to server routes that return a redacted status, never the token.
--
-- Plumb keeps working with no row here: the Meta config resolver falls back to
-- the env System-User values for the default org.
--
-- Apply by running this file in the Supabase SQL editor (same as 0004).
-- =============================================================================

create table if not exists org_integrations (
  org_id            uuid not null references orgs(id) on delete cascade,
  provider          text not null,                         -- 'meta' | 'google'
  status            text not null default 'disconnected',  -- 'connected'|'pending'|'expired'|'disconnected'
  access_token      text,                                  -- long-lived user token (server-only)
  token_expires_at  timestamptz,                           -- null = long-lived/unknown
  scopes            text[] not null default '{}',
  ad_account_id     text,                                  -- digits only, no act_ prefix
  page_id           text,
  ig_user_id        text,
  external_user_id  text,                                  -- the connecting platform user id
  details           jsonb not null default '{}'::jsonb,    -- non-secret display extras (names, etc.)
  connected_at      timestamptz,
  updated_at        timestamptz not null default now(),
  primary key (org_id, provider)
);

-- Look up the org that owns a given Meta Page (used to route inbound webhooks).
create index if not exists org_integrations_meta_page_idx
  on org_integrations (page_id) where provider = 'meta';

alter table org_integrations enable row level security;
-- Intentionally NO policies: only the service-role server client may touch this.

-- Reuse the shared updated_at trigger from 0001.
drop trigger if exists trg_org_integrations_updated on org_integrations;
create trigger trg_org_integrations_updated
  before update on org_integrations
  for each row execute function set_updated_at();
