# Integration: Authentication (Supabase Auth)

Wired in Milestone 1. Internal tool for Plumb Renovations staff.

## Auth flow (email magic-link / OTP)

1. User enters their email at `/login` (`app/login/page.tsx`).
2. Browser calls `supabase.auth.signInWithOtp({ email, options.emailRedirectTo: <origin>/auth/callback })`.
3. Supabase emails a magic link. Locally, it lands in Inbucket
   (http://127.0.0.1:54324); in production it's a real email.
4. The link hits `app/auth/callback/route.ts`, which calls
   `exchangeCodeForSession(code)` to set the session cookie, then redirects to `/leads`.
5. `middleware.ts` (`lib/supabase/middleware.ts`) refreshes the session on every
   request and redirects unauthenticated users to `/login`. The `(app)` layout
   re-checks `getUser()` server-side as defense-in-depth.
6. Sign out: `POST /auth/signout` (`supabase.auth.signOut()`), linked in the sidebar.

## Org membership & access

- A single org row (`ORG_ID = 00000000-…-0001`) is seeded by the migration.
- A `handle_new_user` trigger on `auth.users` auto-adds every new user to that
  org via `memberships`. RLS policies (`is_member(org_id)`) scope every table to
  org members, so a signed-in staff member sees the shared data and nobody else can.
- **Scope note:** today *any* email that completes magic-link sign-in joins the
  org. For a private staff tool this is acceptable short-term; tighten to an
  email allowlist (or disable open signup in Supabase Auth settings) in a later
  milestone.

## Config / scopes

- No third-party OAuth scopes — this is first-party Supabase Auth.
- Supabase **Auth → URL Configuration**: Site URL + `…/auth/callback` redirect
  must match each environment (local, Vercel).
- Keys: only `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` reach
  the browser (safe by design; protected by RLS). `SUPABASE_SERVICE_ROLE_KEY` is
  server-only (seeding; later webhooks/scheduled fns).

## Rate limits

- Supabase caps auth emails (default ~30/hour on the built-in SMTP). For real
  volume, configure a custom SMTP provider in Supabase Auth settings.

## Future: Google sign-in (left as a clean path, not built)

Add a "Continue with Google" button calling
`supabase.auth.signInWithOAuth({ provider: "google", options.redirectTo: <origin>/auth/callback })`
and enable the Google provider in Supabase Auth. The same `/auth/callback` route
and membership trigger handle it — no schema changes needed.
