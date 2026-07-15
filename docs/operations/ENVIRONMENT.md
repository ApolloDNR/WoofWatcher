# Environment

WoofWatcher uses one API server, one Expo mobile app, and shared workspace
packages. Keep secrets out of chat and commits. Use local env files, Replit
secrets, Vercel env vars, or the relevant deployment secret manager.

## Required For API

- `PORT`: port used by the API server. Replit injects this.
- `DATABASE_URL`: Postgres connection string.
- `CLERK_SECRET_KEY`: Clerk server secret for authenticated API routes.

## Required For Mobile Auth

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk publishable key for Expo.

## Web Build Defaults

- `PORT`: Vite dev or preview port. If omitted by CI build jobs, the web app
  defaults to `5173` and the mockup sandbox defaults to `5174`.
- `BASE_PATH`: Vite base path. If omitted, builds default to `/`.

## Production Security

- `ALLOWED_ORIGINS`: comma-separated list of origins allowed to call the API
  with credentials. This must be set in production.

Example:

```text
ALLOWED_ORIGINS=https://woofwatcher.example.com,https://app.woofwatcher.example.com
```

## Optional AI And Avatar Generation

- `AI_INTEGRATIONS_GEMINI_API_KEY`: Gemini key.
- `AI_INTEGRATIONS_GEMINI_BASE_URL`: Gemini base URL when using a routed
  integration.

If Gemini env vars are absent, WoofGuide should fall back to safe local guidance
instead of breaking the care flow.

## Replit Mobile Routing

The mobile app currently reads `EXPO_PUBLIC_DOMAIN` and routes API calls to:

```text
https://${EXPO_PUBLIC_DOMAIN}
```

For local development outside Replit, set the domain to the reachable API host
or use the documented Expo/Replit proxy setup.

## Cloud Sync Go-Live

The app is local-first and fully usable with **no** cloud wiring: when
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is absent or a placeholder, auth falls back
to local mode and every care flow works against on-device storage. Cloud sync
is an additive layer that turns on only when the pieces below are all present.

Architecture: **client → Clerk (auth) → api-server → Postgres.** Clients never
talk to Postgres directly. Row-Level Security is enabled deny-by-default on
every table as a breach backstop; the api-server enforces household scoping in
application code.

### Status

- **Database: provisioned.** The WoofWatcher Supabase Postgres project has the
  full schema (8 tables) and deny-by-default RLS applied and verified. Its
  columns, primary keys, foreign keys, and unique constraints match the Drizzle
  schema in `lib/db/src/schema` exactly, so the api-server's ORM queries run
  against it as-is. No further schema work is required to go live.

### Remaining owner steps (require accounts / secrets — never commit these)

1. **`DATABASE_URL`** — the Supabase Postgres connection string, including the
   database password (set/reset it in Supabase → Project Settings → Database).
   Use the connection pooler string for autoscale/serverless hosts. It must use
   a role that bypasses RLS (Supabase's default `postgres` role does); a
   non-superuser role would be blocked by the deny-by-default policies.
2. **Clerk** — create a Clerk application, then set `CLERK_SECRET_KEY` and
   `CLERK_PUBLISHABLE_KEY` on the api-server and
   `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` on the mobile/web build.
3. **Deploy the api-server** (`artifacts/api-server`) — the current
   preview/autoscale deploy serves only the static web export and has no
   backend. Give the api-server host the `DATABASE_URL`, `CLERK_SECRET_KEY`,
   and `ALLOWED_ORIGINS` env vars.
4. **Point the client at the API** — set `EXPO_PUBLIC_DOMAIN` (and, if used,
   `EXPO_PUBLIC_CLERK_PROXY_URL`) to the api-server host so `/api/*` calls
   resolve. Optionally set the Gemini vars to enable live WoofGuide AI.

Once 1–4 are in place, the same build begins syncing households, care state,
and care log entries through the api-server. Until then it stays local-first
with no dead ends and no hidden sync failures.
