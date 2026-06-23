-- =============================================================================
-- 0019_lead_archive.sql — soft-delete (archive) for leads.
--
-- Lets test/junk leads be archived so they drop out of the default list, all
-- counts and the cost-per-won-job / capacity metrics, without a hard delete
-- (archived leads can still be viewed + restored). Idempotent. Run in the
-- Supabase SQL editor. The leads page is behind login, so the app writes this
-- with the normal authenticated client under the existing is_member RLS.
-- =============================================================================

alter table leads add column if not exists archived_at timestamptz;

-- Speeds up "active leads" filtering per org.
create index if not exists leads_org_archived_idx on leads(org_id, archived_at);
