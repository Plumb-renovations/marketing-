-- =============================================================================
-- 0014_quote_template.sql — premium quote template fields + Plumb pre-seed.
--
-- Adds the masthead/document fields the premium "Cream & Copper" template reads
-- (tagline sub-line, service-region line, ribbon-motif toggle, selected
-- template) to the per-org business_profiles row, then pre-seeds Plumb's
-- Branding & Quotes settings so the document renders correctly with no setup.
-- All values stay editable on the Branding & Quotes page. Idempotent.
-- Org-scoped via the existing is_member() RLS. Run in the Supabase SQL editor.
-- =============================================================================

alter table business_profiles add column if not exists tagline text;
alter table business_profiles add column if not exists region_line text;
alter table business_profiles add column if not exists show_ribbon boolean not null default true;
alter table business_profiles add column if not exists quote_template text not null default 'premium';

-- Pre-seed Plumb's branding (org 0000…0001 — same org 0008 pre-fills). Guarded
-- by `tagline is null` so it seeds once and never clobbers later edits. Bank
-- details are intentionally left blank for the owner to fill in.
update business_profiles set
  business_name            = coalesce(nullif(business_name, ''), 'Plumb Renovations'),
  tagline                  = 'Specialising in Bathroom Renovations',
  region_line              = 'Gold Coast & Northern Rivers',
  brand_color              = '#A86A45',
  brand_color2             = '#242220',
  show_ribbon              = true,
  quote_template           = 'premium',
  doc_contact_name         = 'Jacob',
  doc_contact_phone        = '0475 360 065',
  doc_contact_email        = 'enquiries@plumbrenovations.com.au',
  abn                      = '53 692 039 731',
  licence_no               = 'QBCC 15568067',
  gst_registered           = true,
  currency                 = 'AUD',
  default_terms            = coalesce(nullif(default_terms, ''),
    'This quote is valid for 30 days from the date above. Acceptance confirms agreement to the scope, pricing and payment schedule set out here. A 5% deposit secures your booking and scheduled start date.'),
  default_payment_schedule = '[
    {"label":"Deposit","percent":5},
    {"label":"Rough-in","percent":30},
    {"label":"Waterproofing","percent":30},
    {"label":"Tiling","percent":30},
    {"label":"Handover","percent":5}
  ]'::jsonb
where org_id = '00000000-0000-0000-0000-000000000001'
  and tagline is null;

-- If the Plumb org has no business_profiles row yet, create it pre-seeded.
insert into business_profiles (
  org_id, business_name, tagline, region_line, brand_color, brand_color2,
  show_ribbon, quote_template, doc_contact_name, doc_contact_phone,
  doc_contact_email, abn, licence_no, gst_registered, currency,
  default_terms, default_payment_schedule
) values (
  '00000000-0000-0000-0000-000000000001',
  'Plumb Renovations',
  'Specialising in Bathroom Renovations',
  'Gold Coast & Northern Rivers',
  '#A86A45', '#242220', true, 'premium',
  'Jacob', '0475 360 065', 'enquiries@plumbrenovations.com.au',
  '53 692 039 731', 'QBCC 15568067', true, 'AUD',
  'This quote is valid for 30 days from the date above. Acceptance confirms agreement to the scope, pricing and payment schedule set out here. A 5% deposit secures your booking and scheduled start date.',
  '[
    {"label":"Deposit","percent":5},
    {"label":"Rough-in","percent":30},
    {"label":"Waterproofing","percent":30},
    {"label":"Tiling","percent":30},
    {"label":"Handover","percent":5}
  ]'::jsonb
)
on conflict (org_id) do nothing;
