---
name: WoofWatcher mobile sync architecture
description: How the mobile app syncs household care data — doc vs rows split, seeding, conflict policy, auth wiring.
---

# WoofWatcher mobile (artifacts/woofwatcher-mobile) — sync foundation

MOBILE ONLY. Never edit the web artifact (`artifacts/woofwatcher`) for this product line.

## Split: config doc vs log rows
- **Care-state document** (jsonb, optimistic `version`): all CONFIG — profile, caregivers,
  dietProfile, routines, goals, records, and (future) calendar events. One row per household.
  Edited via `updateCareDoc(updater)` → `PUT /api/care-state`.
- **Care log entries**: individual append-only ROWS via `/api/care-entries` (GET/POST/PATCH/DELETE).
  Concurrent-safe — never put the running log inside the doc.
- **Why:** two devices editing the same jsonb doc race on version; log appends must never lose
  writes, so they are separate rows, not doc fields.

## Conflict policy (doc PUT)
- Detect 409 by **duck-typing** (`err.status === 409`), NOT `instanceof ApiError` — `ApiError`
  is NOT re-exported from `@workspace/api-client-react` (only setBaseUrl/setAuthTokenGetter are).
- On 409: adopt server doc+version, replay the local change on top (last-writer-wins per field),
  retry PUT once; if it fails again, give up and let the next full refresh reconcile.

## Seeding
- Server (`api-server/src/lib/household.ts`) JIT-provisions user + default household +
  care_state row (`doc {}`, version 1) on first authenticated request.
- Client treats `Object.keys(doc).length === 0` as a fresh household and PUTs its local default
  doc (the "Phoenix" default profile) as the seed. So new households get the Phoenix starter.

## Offline + optimistic UX
- AsyncStorage key `woofwatcher.v2.state` (`{doc, entries, serverVersion}`) hydrates instantly;
  server sync reconciles after Clerk reports signed-in. Mutations are optimistic with temp ids
  (`temp_...`); replace temp with server row on success, roll back on failure.

## Auth wiring (root app/_layout.tsx)
- `setBaseUrl(\`https://\${EXPO_PUBLIC_DOMAIN}\`)` at module top.
- `ClerkProvider` (publishableKey from `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, tokenCache from
  `@clerk/expo/token-cache`) → AuthBridge effect does `setAuthTokenGetter(() => getToken())`.
- Dev script injects `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY`.
- Auth screens use Clerk **Core v3** APIs (signIn.password/finalize, signUp.password/
  verifications.sendEmailCode/verifyEmailCode, useSSO startSSOFlow). Custom UI, not Clerk components.

## Paid-LLM server routes must require auth
- Any `/api/*` route that can spend the server's model credits (e.g. woofguide-events) MUST be
  `requireAuth`-guarded, or it's an unauthenticated cost-abuse surface.
- **Why:** a public POST that calls OpenAI lets anyone burn paid tokens.
- **How to apply:** guard the route AND make the mobile caller send the Clerk token. Raw `fetch`
  (not the api-client) needs an explicit `Authorization: Bearer ${await getToken()}` header.
- Pre-existing AI endpoints `avatar-emotions`, `avatar-stylize`, `care-helper` are still
  unauthenticated (out of scope) — harden them if touched.

## Testing
- e2e the signed-in flow with `runTest({ testClerkAuth: true })` — programmatic Clerk login,
  no UI interaction with Clerk components. Verifies seed + entry persistence across reload.
