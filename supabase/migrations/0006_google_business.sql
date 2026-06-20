-- =============================================================================
-- 0006_google_business.sql — Google Business Profile connection support
--
-- The per-org integration table (0005) was built for Meta, whose tokens are
-- long-lived access tokens. Google OAuth instead returns a long-lived REFRESH
-- token (used to mint short-lived access tokens), so add a column to store it.
-- Everything else (RLS server-only, status, details jsonb) is reused, with
-- provider = 'google_business'.
--
-- Apply by running this file in the Supabase SQL editor (same as 0005).
-- =============================================================================

alter table org_integrations
  add column if not exists refresh_token text;
