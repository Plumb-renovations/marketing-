-- =============================================================================
-- 0028_lead_journey.sql — Lead Journey Sales Coach. Tracks every deal from first
-- contact to won/lost: captured qualifying notes (voice/typed), the finer
-- journey stage + contact outcome, speed-to-contact, the follow-up cadence, the
-- pre-quote briefing, and loss reasons — so Hazel can coach each step and learn
-- from losses. Augments the existing `leads` (the board still uses `stage`);
-- `contacted_at` already exists from 0009 (used for speed-to-contact).
-- Org-scoped via is_member() RLS. Idempotent. Run in the Supabase SQL editor.
-- =============================================================================

-- Finer journey state + coaching fields on leads.
alter table leads add column if not exists journey_stage  text;        -- new|contacted|qualified|quote_sent|following_up|won|lost
alter table leads add column if not exists contact_outcome text;       -- no_answer|qualified|unqualified
alter table leads add column if not exists quote_sent_at   timestamptz;
alter table leads add column if not exists followup_step    int not null default 0; -- which cadence step we're on
alter table leads add column if not exists followup_due     timestamptz;            -- next nudge due
alter table leads add column if not exists last_touch_at    timestamptz;            -- last logged update
alter table leads add column if not exists qual             jsonb not null default '{}'::jsonb; -- budget/timeline/motivation/vision/concerns/competingQuotes/decisionStyle/jobSizeEstimate
alter table leads add column if not exists lost_detail      text;
alter table leads add column if not exists briefing         jsonb;                  -- cached pre-quote briefing

create index if not exists leads_followup_due_idx on leads(org_id, followup_due);

-- The journey timeline: every capture (voice/typed) + coaching/system event.
create table if not exists lead_journey_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  lead_id     text not null references leads(id) on delete cascade,
  kind        text not null,                       -- note|call|text|site_visit|quote|stage|lost|won|system
  channel     text,                                -- call|text|email|in_person
  source      text not null default 'typed',       -- voice|typed|system
  body        text,                                -- transcript / typed note / system message
  extracted   jsonb,                               -- facts Hazel pulled from the note
  created_at  timestamptz not null default now()
);
create index if not exists lead_journey_events_lead_idx on lead_journey_events(org_id, lead_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['lead_journey_events'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_member on %1$s;', t);
    execute format('create policy %1$s_member on %1$s using (is_member(org_id)) with check (is_member(org_id));', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
