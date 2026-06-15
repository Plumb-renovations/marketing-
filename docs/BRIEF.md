# Project brief — Marketing Command Centre

Source of truth for the production rebuild. The single-file prototype
(`MarketingCommandCentre-2.html`) is the design system / data model / AI persona;
we port from it rather than reinventing the UI.

**Business:** Plumb Renovations — quality bathroom/ensuite/laundry renovations,
Gold Coast AU (waterplumb.com.au).

**Stack:** Next.js (App Router, TS) + Tailwind + Supabase (Postgres, Auth,
Storage, Edge/scheduled functions, Realtime). Deploy on Vercel. All third-party
keys stay server-side; the browser never sees a key.

---

## Milestone plan (one commit per milestone)

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Scaffold + port UI + Supabase + auth (email magic-link) + seed | ✅ done |
| 2 | Server-side AI generation (Anthropic, `AD_PERSONA` verbatim, multimodal, JSON+retries+rate-limit) | ✅ done |
| 3 | Google Ads reads + **Data Manager API** conversion upload (legacy Ads API upload path closed to new adopters since 15 Jun 2026) | |
| 4 | Meta leads webhook + Page/IG insights + ad spend (NZD→AUD on ingest, store both); dev app until App Review + Business Verification | |
| 5 | Google Business Profile reviews (gated access) | |
| 6 | Scheduled functions (hourly/daily) + Realtime + under-booked-month auto-draft + auto-publish | |
| 7 | AI video pipeline P1 (upload → transcribe → Claude edit plan → 9:16 captioned render → Calendar draft; per-video cost) | |
| 8 | Switch dashboards from seed → live data | |

Write a short integration doc (auth flow, scopes, approval steps, rate limits)
in `docs/integrations/` **before** wiring each external API.

## Folder structure

```
app/                    # App Router: (app) protected shell + route pages, login, auth, api
components/             # ported UI: leads/ pipeline/ revenue/ dashboards/ content/ ads/ ui/
  DataProvider.tsx      # shared state + lead actions, Supabase-backed (replaces prototype `store`)
  AppShell.tsx          # sidebar + header + global drawers
lib/
  supabase/             # client / server / middleware
  domain/               # types, constants, seed, format helpers (ported)
  data/                 # row <-> UI mapping + writes
  ai/                   # client generators -> /api/ai/* (server-backed in M2)
supabase/migrations/    # schema + RLS
scripts/seed.ts         # loads the real tracker data
docs/                   # this brief + per-integration notes
```

## Database schema

Implemented in `supabase/migrations/0001_init.sql` — org-scoped, RLS denies by
default, access requires org membership (`is_member`). App-authored entities
(leads, quotes, line items, posts, ads) use **text ids** so the ported UI keeps
its id scheme; live-data tables (`ad_spend_daily`, `campaigns`, `keywords`,
`channel_insights`, `reviews`, `conversions_uploaded`, `videos`, `fx_rates`) are
created now and populated in later milestones. Tokens are never stored in the DB
(env / Supabase Vault only). Quote line items are stored GST-exclusive; the app
applies the 10% GST. Two private Storage buckets: `post-photos`, `videos`.

> Note vs. the original plan: pipeline settings + the manual `metrics` object
> live together in `app_settings` (one row per org); a `handle_new_user` trigger
> auto-joins each authenticated staff member to the single org (swap for an
> email allowlist in a later milestone).

## Environment variables

See `.env.example`. Only `NEXT_PUBLIC_SUPABASE_*` reach the browser (guarded by
RLS). Everything else is server-only.

## Third-party approvals (long lead times — start early)

1. **Meta** — Business Verification + App Review for `leads_retrieval`,
   `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`,
   `ads_management`, `instagram_manage_insights`, `read_insights`, `ads_read`.
   Build against a **dev app** first. (M4)
2. **Google Ads API** — developer token (start Basic, apply Standard) on the
   **MCC**; website must be live. (M3)
3. **Google Business Profile API** — gated, ~14-day review; verified GBP active
   60+ days; name the reviews endpoint in the request. (M5)
4. **Google Cloud** — one project + OAuth consent screen (verification can take
   weeks for sensitive scopes). (M3–M5)
5. **Data Manager API** — for enhanced-conversions-for-leads upload (the Google
   Ads API path is closed to new adopters as of 15 Jun 2026). (M3)
6. **Anthropic** (M2), **AssemblyAI** + **Shotstack** (M7) — account signups.

Confirm current scopes/access tiers against the official Meta and Google docs at
build time — several changed during 2026.
