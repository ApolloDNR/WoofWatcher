# Codex Progress Report - 2026-06-24

## Completed

- Added provider-durable household audit readiness for invite acceptance, household member role changes, member revocation, and Access Pass activation/revocation.
- Added `household_audit_events` to the Drizzle schema with action, lifecycle state, actor, target member/user, role transition, note/reason, Access Pass expiry, created time, and provider/export metadata.
- Updated household routes so each audited household mutation inserts a durable audit row before returning the typed audit event.
- Added Access Pass expiry enforcement: activation now rejects invalid or past `expiresAt` values before helper access is changed.
- Added lifecycle states for household audit events: `invite-accepted`, `member-updated`, `member-revoked`, `access-pass-active`, `access-pass-revoked`, and `access-pass-expired`.
- Updated OpenAPI, Zod validators, and React generated schemas so clients see `provider-durable` audit storage and typed lifecycle states.
- Added focused Access Pass behavior tests for expiry validation and durable audit insert mapping.
- Extended API readiness tests so the schema, route, OpenAPI, Zod, and React contracts cannot drift silently.

## Verification

- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/householdAccessPass.test.ts artifacts/api-server/test/apiReadiness.test.ts` first failed on the missing durable audit schema/helper surface, then passed with 14 tests.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 374 passing.
- `NODE_PATH=artifacts/woofwatcher-mobile/node_modules node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit` - passing.
- `node --check artifacts/api-server/src/lib/household-access-pass.ts` - passing.
- `node --check artifacts/api-server/src/routes/household.ts` - passing.
- `node --check lib/db/src/schema/householdAuditEvents.ts` - passing.
- `node --check lib/api-zod/src/generated/api.ts` - passing.
- `node --check lib/api-client-react/src/generated/api.schemas.ts` - passing.
- `node artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings.
- Package-local Expo web export - passing, emitted `.expo-smoke`; the generated folder was removed after verification.

## Environment-Limited Checks

- `node node_modules/typescript/bin/tsc -p lib/db/tsconfig.json --noEmit` failed because this shell cannot resolve local Node type definitions: `TS2688: Cannot find type definition file for 'node'`.
- `node artifacts/api-server/build.mjs` failed because this shell cannot resolve `esbuild` without the pnpm workspace runner/symlink layer: `ERR_MODULE_NOT_FOUND: Cannot find package 'esbuild'`.
- These are the same local dependency-runner limitations seen in prior backend slices, not evidence of a route/schema test failure.
- Remote GitHub Actions run `28075849741` for commit `c67364e` failed before job execution with job `83119832168`, zero steps, `log not found: 83119832168`, and GitHub's billing/spending-limit annotation.

## Still Not Done

- Real iOS and Android device/simulator screenshots still need to be captured and attached in `/care-twin-qa`.
- The durable audit table still needs provider migration execution, RLS/provider access rules, retention/export/deletion policy, and production approval before public launch.
- Invite approval lifecycle storage is not complete yet.
- Scheduled or request-time cleanup for expired Access Pass helper roles is not complete yet.
- GitHub Actions remote CI is still blocked by the account billing/spending-limit issue until Apollo fixes GitHub billing/platform execution; latest checked run is `28078084503` / job `83126533628`.

## Next Best Slice

If device QA is available, run the Home Mission Deck and care-twin QA surfaces on iOS and Android, attach screenshots, share/export the QA report, and fix the first visible issue.

If device QA remains unavailable, continue provider readiness with invite approval state storage, audit-list/admin review APIs, scheduled Access Pass expiry cleanup, provider migration/RLS notes, and household/Access Pass integration tests.

## Completed - Follow-Up Slice

- Added the owner/admin household audit review API for durable household trust events.
- Added `GET /household/audit-events` with authentication, active-household scoping, owner/admin-only access, newest-first ordering, limit clamping, and optional `action` plus `lifecycleState` filters.
- Added `normalizeHouseholdAuditListQuery` and `buildHouseholdAuditEventFromRecord` so route responses use the same safe filter and record-normalization policy as the Access Pass audit helpers.
- Added typed OpenAPI, Zod, React client, React schema, and generated type surfaces for `ListHouseholdAuditEventsParams` and `HouseholdAuditEventListResponse`.
- Corrected stale OpenAPI copy so Access Pass audit responses no longer say durable audit storage is missing after the durable audit schema exists.

## Verification - Follow-Up Slice

- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/householdAccessPass.test.ts artifacts/api-server/test/apiReadiness.test.ts` first failed on the missing audit-list route and query normalizer, then passed with 16 tests.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 376 passing.
- `NODE_PATH=artifacts/woofwatcher-mobile/node_modules node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit` - passing.
- `node --check artifacts/api-server/src/lib/household-access-pass.ts` - passing.
- `node --check artifacts/api-server/src/routes/household.ts` - passing.
- `node --check lib/api-zod/src/generated/api.ts` - passing.
- `node --check lib/api-client-react/src/generated/api.ts` - passing.
- `node --check lib/api-client-react/src/generated/api.schemas.ts` - passing.
- `node artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings.
- Package-local Expo web export - passing, emitted `.expo-smoke`; the generated folder was removed after verification.

## Environment-Limited Checks - Follow-Up Slice

- `node node_modules/typescript/bin/tsc -p lib/api-zod/tsconfig.json --noEmit` remains environment-limited because this shell cannot resolve local `zod`; after this slice the earlier export-name collision is gone.
- `node node_modules/typescript/bin/tsc -p lib/api-client-react/tsconfig.json --noEmit` remains environment-limited because this shell cannot resolve local `@tanstack/react-query`.
- `node node_modules/typescript/bin/tsc -p artifacts/api-server/tsconfig.json --noEmit` remains environment-limited because this shell cannot resolve local `@types/node`.
- These are workspace dependency-resolution limits in the local Windows runner, not failing audit-readiness assertions.
- Remote GitHub Actions run `28078084503` for commit `eb50f5c` failed before job execution with job `83126533628`, zero steps, and `gh run view --log-failed` returned `log not found: 83126533628`, matching the standing GitHub billing/spending-limit blocker.

## Next Best Slice - Updated

If device QA is available, run the Home Mission Deck and care-twin QA surfaces on iOS and Android, attach screenshots, share/export the QA report, and fix the first visible issue.

If device QA remains unavailable, continue provider readiness with invite approval state storage/table design, scheduled Access Pass expiry cleanup or request-time expiry enforcement, provider migration/RLS/retention notes for `household_audit_events`, and integration tests around household/Access Pass mutation plus audit-review flows.

## Completed - Request-Time Expiry Follow-Up

- Added request-time Access Pass expiry enforcement for helper household roles.
- Added `accessPassExpiresAt` to household member rows and persisted the Access Pass activation expiry window onto the activated helper membership.
- Added `deriveAccessPassRuntimeStatus` so expired sitter/trainer/walker/vet-viewer helper passes become `expired access pass` during authorization without hiding the original display role from `/me`.
- Updated care-entry write authorization so `expired access pass` is read-only.
- Updated `/me` member payloads to expose `accessPassExpiresAt` and `accessPassExpired` for UI truth.
- Updated OpenAPI, Zod validators/types, and React generated schemas so clients can see member expiry metadata.

## Verification - Request-Time Expiry Follow-Up

- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/householdAccessPass.test.ts artifacts/api-server/test/apiReadiness.test.ts` first failed on the missing member expiry schema/runtime helper, then passed with 18 tests after implementation.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 378 passing.
- `NODE_PATH=artifacts/woofwatcher-mobile/node_modules node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit` - passing.
- `node --check artifacts/api-server/src/lib/household-access-pass.ts` - passing.
- `node --check artifacts/api-server/src/lib/household.ts` - passing.
- `node --check artifacts/api-server/src/routes/household.ts` - passing.
- `node --check lib/db/src/schema/householdMembers.ts` - passing.
- `node --check lib/api-zod/src/generated/api.ts` - passing.
- `node --check lib/api-zod/src/generated/types/member.ts` - passing.
- `node --check lib/api-client-react/src/generated/api.schemas.ts` - passing.
- `node artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings.
- Package-local Expo web export - passing, emitted `.expo-smoke`; the generated folder was removed after verification.

## Still Not Done - Request-Time Expiry Follow-Up

- Provider migration execution, Supabase RLS/policy approval, retention/export/deletion policy, and legal/privacy review are still required before public launch.
- Invite approval lifecycle storage is still not complete.
- Expired helper memberships are blocked at request time, but scheduled cleanup or an owner-facing cleanup UI remains a separate production polish task.
- Real iOS and Android device/simulator screenshot QA remains the highest visual release blocker.
