-- =============================================================================
-- 0046_coach_qa.sql — stored Q&A for the specialist AI coaches.
--
-- The Meta Ads Coach (first of several specialist coaches — Google, organic to
-- follow) answers the user's questions from their real ad data. We log each
-- question + answer + a short topic so a future "Marketing Head" can aggregate
-- across coaches (what the user keeps asking, recurring problems, etc.).
--
--   coach_qa.coach    — which specialist answered ('meta_ads' first).
--   coach_qa.topic    — short classifier for aggregation (e.g. 'kill/keep',
--                       'scaling', 'cost per lead', 'creative', 'lead quality').
--
-- Org-scoped via the existing is_member() RLS. Additive + idempotent — the app
-- tolerates the table being absent (logging is best-effort). Run in the Supabase
-- SQL editor.
-- =============================================================================

create table if not exists coach_qa (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  coach      text not null,          -- 'meta_ads' | (future) 'google' | 'organic'
  question   text not null,
  answer     text not null,
  topic      text,
  created_at timestamptz not null default now()
);
create index if not exists coach_qa_org_coach_idx on coach_qa(org_id, coach, created_at desc);

alter table coach_qa enable row level security;
drop policy if exists coach_qa_member on coach_qa;
create policy coach_qa_member on coach_qa
  using (is_member(org_id)) with check (is_member(org_id));

notify pgrst, 'reload schema';
