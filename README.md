# Marketing Command Centre — Plumb Renovations

Production rebuild of the single-file prototype into a hosted web app:
Next.js (App Router, TypeScript) + Tailwind + Supabase, deployed on Vercel.
Dark "cockpit" UI (cyan accent, JetBrains Mono metrics) ported from the
prototype; browser storage replaced with Supabase. All third-party keys stay
server-side.

See **`docs/BRIEF.md`** for the milestone plan, schema, env, and approvals
(the source of truth), and **`docs/integrations/`** for per-API notes.

## Stack

- **Next.js 15** (App Router, TypeScript), **Tailwind CSS 3**
- **Supabase** — Postgres, Auth (email magic-link), Storage, Realtime
- **Vercel** for hosting

## Milestone status

- **M1 (this commit): scaffold + UI port + Supabase + auth + seed** ✅
- M2 server-side AI · M3 Google Ads + Data Manager · M4 Meta leads/insights ·
  M5 GBP reviews · M6 scheduled + auto-publish · M7 AI video · M8 live dashboards

---

## Local development

### 1. Install

```bash
npm install
```

### 2. Start Supabase locally (Docker required)

The Supabase CLI is a dev dependency, so no global install is needed:

```bash
npm run db:start     # spins up local Postgres/Auth/Storage; applies migrations
```

It prints local credentials. Copy `.env.example` to `.env.local` and fill the
Supabase values it printed:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from CLI output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from CLI output>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Seed the real tracker data

```bash
npm run db:seed
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000. Enter your email; the magic link appears in the
local mail catcher at **http://127.0.0.1:54324** (Inbucket). Click it to sign in.

> Reset the local DB any time with `npm run db:reset` (re-applies migrations),
> then `npm run db:seed`.

---

## Creating the hosted projects (step by step)

### A. Supabase project

1. Go to https://supabase.com/dashboard → **New project**. Pick a name
   (e.g. `plumb-command-centre`), a strong database password (save it), and the
   **Sydney (ap-southeast-2)** region.
2. When it's ready, open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose)
3. Link the CLI and push the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npm run db:push        # applies supabase/migrations to the hosted DB
   ```
4. Seed it (uses the hosted values in `.env.local`):
   ```bash
   npm run db:seed
   ```
5. **Auth → URL Configuration**: set **Site URL** to your Vercel URL (or
   `http://localhost:3000` for now) and add `…/auth/callback` to
   **Redirect URLs**. Email magic-link is on by default.

### B. Vercel project

1. Push this repo to GitHub (already connected).
2. https://vercel.com/new → **Import** the repo. Framework auto-detects Next.js.
3. **Environment Variables**: add everything from `.env.local` that applies
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` = your Vercel URL). Later
   milestones add the Anthropic/Meta/Google keys here too.
4. **Deploy.** Then set the Supabase **Site URL / Redirect URLs** (step A5) to
   the deployed Vercel domain.

---

## Where things live

| Area | Path |
|------|------|
| Screens (ported UI) | `components/` |
| Shared data + actions | `components/DataProvider.tsx` |
| Supabase clients | `lib/supabase/` |
| Domain (types, constants, seed, format) | `lib/domain/` |
| Data access (row ↔ UI mapping) | `lib/data/` |
| AI generators (server-backed, M2) | `lib/ai/` + `app/api/ai/` |
| Schema + migrations | `supabase/migrations/` |
| Seed script | `scripts/seed.ts` |
| Docs | `docs/` |
