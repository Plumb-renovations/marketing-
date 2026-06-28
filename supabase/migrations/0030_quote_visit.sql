-- =============================================================================
-- 0030_quote_visit.sql — quote/site-visit scheduling for the Head of Sales.
--
-- Lets a qualified lead have a quote visit BOOKED against it (date + time +
-- optional notes), so Hazel can show an upcoming-visits schedule, surface
-- imminent visits with the pre-quote briefing, and (later) feed the Board
-- Meeting home page ("you have 2 quote visits today"). Reuses the leads table —
-- the briefing already lives in leads.briefing — so no new table is needed.
--
-- Org-scoped via the existing is_member() RLS on leads (no policy change). The
-- app writes these with the normal authenticated client. Idempotent — safe to
-- run repeatedly. Run in the Supabase SQL editor.
-- =============================================================================

alter table leads add column if not exists visit_at    timestamptz;
alter table leads add column if not exists visit_notes  text;

-- Speeds up "upcoming visits for this org, soonest first".
create index if not exists leads_org_visit_idx on leads(org_id, visit_at);

notify pgrst, 'reload schema';
