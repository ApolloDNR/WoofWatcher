# Codex Progress Report - 2026-06-23

## Completed

- Added `Home Mission Deck` as a launch-critical Mobile Release QA surface.
- The internal `/care-twin-qa` cockpit now receives the mission deck from the same `mobileReleaseQa.ts` source list that powers release QA reports and saved-session evidence.
- Required proof now calls for iOS and Android compact-deck screenshots, floating paw-nav visibility, no-overflow review, and route confirmation for pending meal, active walk/alone sessions, Adventure, Health, and Care Pass.
- Added tests so the Home mission deck cannot be dropped from the native QA plan during future design polish.
- Tuned the Native QA capture plan to preserve release-surface order within priority groups, so tester scripts start with Phoenix Home and Home Mission Deck before moving to the rest of the launch-critical surfaces.
- Added explicit numbered device verification steps to every Mobile Release QA surface and generated Store Screenshot QA surface.
- `/care-twin-qa` now shows Device steps/Store steps before screenshot evidence capture, the Mobile Release QA share report includes the same route-check steps, and More's Native QA Next Captures rows show the first step for each next route.
- Added setup/precondition steps to every Mobile Release QA surface and generated Store Screenshot QA surface.
- QA packets now explain how to prepare demo-safe state before capture, including pending meal setup, active walk/Alone Time setup, Incident Watch sample-data setup, PixelLab readiness, and blocked store-screenshot boundaries.
- `/care-twin-qa` now shows Setup first/Store prep before Device steps, and More's Native QA Next Captures rows show the first prep step plus the first route-check step.
- Added explicit pass criteria and Needs tune escalation to every Mobile Release QA surface and generated Store Screenshot QA surface.
- `/care-twin-qa`, More's Native QA Next Captures, Mobile Release QA reports, and Native QA capture-plan share text now expose pass/failure criteria before screenshot evidence so tester proof cannot drift into a fake launch pass.
- Added API readiness coverage for mounted WoofGuide event and Avatar Studio routes that were not represented in OpenAPI or generated clients.
- OpenAPI now documents `/woofguide-events`, `/avatar-stylize`, and `/avatar-emotions` with safe provider-boundary language, rate/error responses, and owner-reviewed request/response models.
- React API client schemas/hooks and Zod generated validators/exports now cover WoofGuide event status/creation, Avatar Studio stylized portrait creation, and Avatar Studio emotion-set creation.
- Root `test:focused` now includes `artifacts/api-server/test/*.test.ts` so API contract drift is caught with the same zero-dependency behavior suite.
- Closed `/care-entries?limit=` contract drift: the API route already accepts `limit`, and OpenAPI plus React/Zod generated clients now expose it with the documented 1-500 range and 250 default.
- Closed `PUT /care-state` write-error contract drift: the route already returns `400` validation errors, `404` missing-document errors, and `409` optimistic conflict envelopes, and OpenAPI plus the React generated mutation now document/type those shapes as `ApiError | CareStateEnvelope`.
- Closed care-entry write-error contract drift: create/update/delete routes already validate bodies or ids, and OpenAPI plus the React generated create mutation now expose those invalid-write errors as `ApiError` instead of leaving create errors as `unknown`.
- Closed household provisioning/auth contract drift: `/me`, profile update, household rename, and join-household routes already require auth and validate payloads, and OpenAPI plus generated React household hooks now document/type `401`, `400`, and missing-invite `404` errors as `ApiError`.
- Closed WoofGuide provider/action contract drift: care-helper questions and WoofGuide event flows now have readiness coverage for authenticated routes, rate-limit surfaces, truthful local fallbacks, provider-failure boundaries, and generated client error types.
- OpenAPI now documents care-helper `401`, provider-backed `429`, and provider `502` responses without falsely representing local fallback as a provider-missing error, and WoofGuide event status/creation now document authenticated `401` responses.
- Closed care-state/care-entry household scoping contract drift: API readiness now proves these read/write paths resolve the active household from the authenticated user, scope reads and mutations to that household, stamp created logs with household/caregiver ids, and expose auth/not-found errors to generated React query clients.
- Closed the first role-aware care-entry write policy contract: API readiness now proves the server exposes authenticated household member role lookup, applies care-entry write policy before create/update/delete writes, returns documented ApiError-shaped `403` bodies for read-only or non-adult delete attempts, keeps kid/helper logs pending confirmation, keeps safety-critical medication/vomit/symptom/incident logs reviewable, and preserves medication proof metadata.
- OpenAPI now documents care-entry create/update/delete `403` responses so provider-backed household roles and generated clients can handle forbidden helper/vet-viewer writes without drifting from the server.
- Closed the household member role mutation contract: owner/admin helper management now has an authorization helper, authenticated active-household-scoped update/revoke routes, canonical role payloads, empty-patch rejection, self-change/self-revocation blocking, protected-owner safeguards, Access Pass-compatible role language, typed `403` errors, and generated OpenAPI/Zod/React client coverage.
- Tightened role-update safety during the slice: unknown role strings are rejected by the generated Zod validator and OpenAPI enum instead of silently normalizing to an adult role.
- Closed the first invitation and Access Pass audit contract: join-by-invite now stores canonical adult caregiver roles instead of legacy member strings and returns a typed `HouseholdAuditEvent`; owner/admin Access Pass activation and revocation routes now validate payloads, scope targets to the active household, enforce sitter/trainer/walker/vet-viewer helper roles, reject self/owner/core-member misuse, and return helper audit metadata.
- OpenAPI, Zod validators, and the generated React client now expose `HouseholdJoinResponse`, `HouseholdAuditEvent`, `HouseholdAccessPassMutationResponse`, `AccessPassActivationInput`, `AccessPassRevocationInput`, `activateHouseholdAccessPass`, and `revokeHouseholdAccessPass`.

## Verification

- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts` - 84 passing.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts` - 85 passing.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts` - 85 passing after the device-steps QA contract.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts` - 14 passing after the setup/precondition QA contract.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts` - 14 passing after the pass-criteria and Needs tune escalation QA contract.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 360 passing.
- `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` - 2 passing after the API contract-readiness slice.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 362 passing.
- `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` - 3 passing after the care-entries `limit` contract fix.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 363 passing.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on missing care-state `400` contract coverage, then passed with 4 tests after OpenAPI and generated React client updates.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 364 passing after the care-state write-error contract fix.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on missing create-care-entry `400` OpenAPI coverage, then passed with 5 tests after care-entry write contract updates.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 365 passing after the care-entry write-error contract fix.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on missing `getMe` `401` OpenAPI coverage, then passed with 6 tests after household contract updates.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 366 passing after the household provisioning/auth contract fix.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on missing care-helper `401` OpenAPI coverage, then passed with 7 tests after WoofGuide provider/action contract updates.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 367 passing after the WoofGuide provider/action contract fix.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on missing care-state read `401` OpenAPI coverage, then passed with 8 tests after household scoping contract updates.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 368 passing after the care-state/care-entry household scoping contract fix.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on missing `care-entry-authorization.ts`, then passed with 9 tests after the role-aware care-entry policy contract was added.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 369 passing after the care-entry role-policy contract fix.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on the missing household member empty-patch guard, then passed with 10 tests after household role mutation/revocation contracts and canonical role typing were added.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 370 passing after the household member role mutation contract fix.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on the missing `household-access-pass.ts` policy/audit helper, then passed with 11 tests after invitation and Access Pass audit contracts were added.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 371 passing after the invitation/Access Pass audit contract fix.
- `node --check artifacts/api-server/src/lib/care-entry-authorization.ts` and `node --check artifacts/api-server/src/routes/care-entries.ts` - passing syntax checks.
- `node --check artifacts/api-server/src/lib/household-authorization.ts` and `node --check artifacts/api-server/src/routes/household.ts` - passing syntax checks.
- `node --check artifacts/api-server/src/lib/household-access-pass.ts`, `node --check artifacts/api-server/src/lib/household-authorization.ts`, `node --check artifacts/api-server/src/routes/household.ts`, `node --check lib/api-client-react/src/generated/api.ts`, `node --check lib/api-client-react/src/generated/api.schemas.ts`, and `node --check lib/api-zod/src/generated/api.ts` - passing syntax checks.
- `NODE_PATH=artifacts/woofwatcher-mobile/node_modules node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit` - passing with the package-local dependency path used for the generated React API client in this Windows checkout.
- `node artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`.
- Remote GitHub Actions runs `28063020164`, `28064200143`, `28065179874`, `28066357245`, `28067734120`, `28069107846`, `28072320208`, and `28074177667` failed before job start with the account billing/spending-limit annotation, so local verification remains the authoritative evidence for these slices.
- `node node_modules/typescript/bin/tsc -p lib/api-client-react/tsconfig.json --noEmit` and `node node_modules/typescript/bin/tsc -p lib/api-zod/tsconfig.json --noEmit` could not run as direct package checks in this Windows runtime because workspace package symlinks are not materialized without pnpm; failures were missing `@tanstack/react-query`/`zod`, not edited-code diagnostics.
- `node artifacts/api-server/build.mjs` could not run directly because `esbuild` is not resolvable without the pnpm workspace execution layer; the direct failure was `ERR_MODULE_NOT_FOUND` for `esbuild`.

## Still Not Done

- Real iOS and Android device/simulator screenshots still need to be captured and attached in `/care-twin-qa`.
- Provider launch setup still requires real Clerk, Supabase/Postgres, storage, AI, payments, push, store-account, provider migration/RLS/retention rules for durable audit rows, invite approval workflows, scheduled Access Pass expiry cleanup, and deletion gates before public release.
- GitHub Actions remote CI has recently failed before job execution due to the account billing/spending-limit blocker; latest checked run is `28074177667` / job `83114878625` with zero steps and `log not found`.

## Next Best Slice

When device QA is available, run the Home Mission Deck QA surface on iOS and Android using the in-app setup, numbered device steps, pass criteria, and Needs tune escalation, attach screenshots, share the QA report, and tune the first visible phone-size issue. While device QA remains unavailable, continue provider-backed readiness with invite approval states, audit review/admin APIs, scheduled Access Pass expiry cleanup, provider migration/RLS notes, and household/Access Pass integration tests.
