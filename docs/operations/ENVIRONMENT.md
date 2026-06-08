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
