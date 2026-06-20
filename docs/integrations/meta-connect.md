# Meta — per-user "Connect Meta" (Facebook Login for Business)

Lets each org connect its **own** Meta account from **Settings → Integrations**
instead of pasting tokens. Builds on the per-org config from `0005_org_integrations`.

## Permissions requested

Matched to what the code actually uses:

| Permission | Used for |
|---|---|
| `ads_management` | create campaigns / ad sets / creatives / ads, upload images (`publishMetaAd`) |
| `leads_retrieval` | read leads delivered by the leadgen webhook (`fetchLead`) |
| `pages_show_list` | list the user's Pages (account picker) |
| `pages_manage_metadata` | subscribe the app to the Page's leadgen webhook |

These are advanced permissions → external users can only grant them once the app
passes **Meta App Review**. The flow is built to be demonstrable for that
submission (real OAuth dialog → token → account/Page selection → live use).

## OAuth flow

1. **Connect** — `GET /api/integrations/meta/oauth/start` (auth-gated) sets a
   CSRF `state` cookie and redirects to the Login dialog. Uses
   `META_LOGIN_CONFIG_ID` (Login for Business configuration) when set, else a
   scope-based dialog with the same permissions.
2. **Callback** — `GET /api/integrations/meta/oauth/callback` validates `state`,
   exchanges the code → short-lived token → **long-lived (~60-day) token**,
   reads `/me`, and saves the token to `org_integrations` as `status='pending'`.
3. **Pick account + Page** — `GET …/accounts` lists `/me/adaccounts` and
   `/me/accounts`; the user selects, then `POST …/save` writes
   `ad_account_id` / `page_id` / `ig_user_id` and flips `status='connected'`.
4. From then on, `getMetaConfig(orgId)` returns this org's stored
   token/account/page for every Meta call.

## Tokens, expiry & reconnect

- Tokens are stored **server-only** in `org_integrations` (RLS enabled with no
  policies; only the service-role client reads them). The browser only ever sees
  a **redacted status** from `GET …/status`.
- Long-lived user tokens last ~60 days. `token_expires_at` is stored;
  `getMetaConfig` treats an expired token as "not connected". Any Graph call that
  gets a token rejection (`MetaAuthError`, code 190) flips the row to
  `status='expired'` (`markMetaExpired`).
- The UI shows a **Reconnect** state for expired/revoked tokens. Reconnecting
  (re-running the OAuth flow) refreshes the token and selection.
- `POST …/disconnect` clears the token + selection.

## Plumb (default org) is unchanged

The default org has no `org_integrations` row, so it keeps using the env
System-User token/account/page. Settings shows it as "connected via system
user" (read-only).

## Env

- `META_APP_ID`, `META_APP_SECRET` — the Meta app (same app as the System User).
- `META_LOGIN_CONFIG_ID` — optional Login-for-Business configuration id.
- Register the redirect URI in the app dashboard:
  `{NEXT_PUBLIC_APP_URL}/api/integrations/meta/oauth/callback`.
