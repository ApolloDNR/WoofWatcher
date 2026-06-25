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
- Provider-backed invite delivery, UI wiring, retention policy, and expired-invite cleanup are not complete yet.
- Request-time enforcement for expired Access Pass helper roles is complete, but scheduled cleanup and owner-approved apply cleanup remain separate launch gates.
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

## Completed - Household Invitation Lifecycle Follow-Up

- Added durable `household_invitations` schema readiness for provider-backed sharing.
- Added owner/admin `GET /household/invitations`, `POST /household/invitations`, and `POST /household/invitations/{id}/revoke` routes with authentication, active-household scoping, safe filters, canonical role validation, future-expiry validation, and typed responses.
- Added lifecycle support for `pending-approval`, `approved`, `accepted`, `revoked`, `expired`, and `rejected` invitations.
- Updated `/household/join` to prefer durable invitation rows, block pending/revoked/expired/rejected/accepted invites, update runtime-expired rows, apply invitation roles to new memberships, and mark accepted invitations without removing the legacy invite-code fallback.
- Added invitation-created and invitation-revoked audit lifecycle states so invite creation and revocation can join the existing household trust trail.
- Updated OpenAPI, generated Zod validators/types, generated React schemas/hooks, and API readiness coverage for the full invite list/create/revoke/join lifecycle.

## Verification - Household Invitation Lifecycle Follow-Up

- RED/GREEN: `node --experimental-strip-types --test artifacts\api-server\test\householdInvitation.test.ts artifacts\api-server\test\apiReadiness.test.ts` first failed on missing `/household/invitations` OpenAPI coverage, then passed with 17 tests after implementation.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 381 passing.
- `node --check` passed for edited household invitation helpers, household routes, household access-pass helpers, DB schema, generated Zod files, and generated React client files.
- `git diff --check` - passing with only expected Windows line-ending warnings.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node artifacts\woofwatcher-mobile\scripts\verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- Package-local Expo web export - passing, emitted `.expo-smoke`; the generated folder was removed after verification.

## Environment-Limited Checks - Household Invitation Lifecycle Follow-Up

- Running the mobile TypeScript command from the repo root still hits the known Windows workspace dependency-resolution issue for `@tanstack/react-query`; the same command passes from the Expo app directory where the package-local dependencies resolve.
- Provider migration execution, Supabase RLS/policy approval, invite notification delivery, scheduled expiry cleanup, retention/export/deletion policy, legal/privacy approval, and real iOS/Android screenshots remain launch gates.

## Completed - Household Sharing Cleanup Review Follow-Up

- Added a non-destructive owner/admin household sharing cleanup review contract.
- Added `household-sharing-cleanup.ts` with shared stale-candidate derivation for runtime-expired invitation rows and expired Access Pass helper memberships.
- Added authenticated, active-household scoped, owner/admin-only `GET /household/sharing-cleanup`.
- The cleanup review returns `review-only` candidates, counts expired invitations versus expired helper passes, and does not delete, revoke, or mutate household access.
- Updated OpenAPI, generated Zod validators/types, generated React schemas/hooks, and API readiness coverage for `ListHouseholdSharingCleanupParams`, `HouseholdSharingCleanupCandidate`, and `HouseholdSharingCleanupResponse`.

## Verification - Household Sharing Cleanup Review Follow-Up

- RED/GREEN: `node --experimental-strip-types --test artifacts\api-server\test\householdSharingCleanup.test.ts artifacts\api-server\test\apiReadiness.test.ts` first failed on the missing cleanup helper and route contract, then passed with 18 tests after implementation.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 384 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- Syntax checks passed for the new cleanup helper, edited household route, generated Zod API file, generated React client, generated React schemas, and new cleanup generated type files.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `node scripts\smoke-web-export.js` remains environment-limited because this Windows shell has no global `pnpm`, but direct package-local Expo export passed, emitted 223 files with HTML and JavaScript, and `.expo-smoke` was removed after verification.

## Still Not Done - Household Sharing Cleanup Review Follow-Up

- Applying cleanup remains intentionally unimplemented until owner approval, Supabase migration/RLS, retention/export/deletion policy, legal/privacy review, and destructive access-change rules are approved.
- Invite notification/email delivery, provider-backed invite UI wiring, and real iOS/Android screenshot QA remain launch gates.

## Completed - Two-Day Beta Ship Path

- Added a concrete two-day beta ship plan at `docs/release/TWO_DAY_BETA_SHIP_PLAN.md`.
- Updated `releasePacket.ts` so internal beta readiness is separate from public App Store / Play Store readiness.
- Added `betaShipStatus`, `betaVerdictLabel`, `betaSummary`, and `betaNextActions` to the release packet.
- Updated More's Launch Readiness board with a visible 48-hour beta card.
- Preserved the public-launch boundary: provider sync, payments, AI, storage, legal/privacy, native QA, and store submission still stay gated until actually approved.

## Verification - Two-Day Beta Ship Path

- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\releasePacket.test.ts artifacts\woofwatcher-mobile\lib\launchReadiness.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 81 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 386 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `node --experimental-strip-types --check lib\releasePacket.ts` from `artifacts/woofwatcher-mobile` - passing.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, and verified HTML/JavaScript output before cleanup. PowerShell traversal hit generated long-path warnings during cleanup, so the generated folder was removed with a scoped Node cleanup after confirming the path was inside the mobile app directory.

## Still Not Done - Two-Day Beta Ship Path

- Real iOS and Android screenshots still need to be captured in `/care-twin-qa` before the beta should go outside the owner/builder loop.

## Completed - Two-Day Beta Action Path

- Upgraded More's Launch Readiness beta card from a passive summary into an actionable two-day ship path.
- The card now renders the release packet's first three `betaNextActions` directly in the app so Apollo, testers, or future builders can see the next deadline move without opening docs.
- Added an accessible primary beta action: `Open QA Cockpit` when the beta is waiting on native device proof, or `Share Beta Packet` once the internal beta is ready to circulate.
- Kept the public-launch boundary intact: the app still separates owner/internal beta readiness from App Store / Play Store approval, provider sync, payments, AI, storage, legal/privacy, and native QA gates.
- Added static mobile readiness coverage to protect the visible beta action rows and QA/share CTAs.

## Verification - Two-Day Beta Action Path

- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\releasePacket.test.ts artifacts\woofwatcher-mobile\lib\launchReadiness.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 81 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 386 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with only expected Windows line-ending warnings.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

## Still Not Done - Two-Day Beta Action Path

- Real iOS and Android screenshots still need to be captured in `/care-twin-qa` before the beta should go outside the owner/builder loop.
- Any route marked Needs tune during real phone QA should be fixed before wider beta sharing.

## Completed - Care Twin QA Beta Run Card

- Added a focused `48-hour beta run` card to the top of `/care-twin-qa`.
- The card uses the same native QA capture-plan model that feeds More's Launch Readiness panel, so the QA cockpit now shows the next beta capture surface, missing proof, complete/open count, and a direct `Open Next Surface` route action.
- Added a compact `Share QA` path beside the next-surface action so device testers can send the combined QA report after capture.
- Kept screenshot proof truthful: testers still need to capture real iOS/Android screenshots and attach them from Photos before native QA is considered complete.
- Added static mobile readiness coverage for the new capture-plan import, `48-hour beta run`, `nextBetaTarget`, `Open Next Surface`, and the accessible next-surface CTA.

## Verification - Care Twin QA Beta Run Card

- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts` - 85 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 386 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with only expected Windows line-ending warnings.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

## Still Not Done - Care Twin QA Beta Run Card

- The 48-hour beta run card is ready for device testers, but it does not replace real native capture.
- The next release task is still: capture iOS and Android proof, attach screenshots, mark Pass or Needs tune, and fix the first Needs tune route.

## Completed - Care Twin QA Platform Evidence Tagging

- Added an explicit `Tag screenshot evidence` control to the `/care-twin-qa` 48-hour beta run card.
- Testers can choose iOS, Android, or Web before attaching screenshots from Photos, so real device proof is counted by intended capture platform instead of whichever runtime attached the file.
- Saved QA screenshot evidence now uses `selectedEvidencePlatform` for `targetPlatform`.
- Each attached screenshot row shows the counted platform label, making it easier to see whether the iOS/Android proof gap is actually closing.
- Static mobile readiness coverage now protects the selected platform state, accessible tag controls, selected target platform write, and visible attachment platform labels.

## Verification - Care Twin QA Platform Evidence Tagging

- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts` - 85 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 386 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

## Still Not Done - Care Twin QA Platform Evidence Tagging

- Real iOS and Android screenshots still need to be captured and attached by a device tester.
- Any route marked Needs tune during that run should be fixed before broader beta sharing.

## Completed - Care Twin QA Return Loop

- Added a QA capture return loop for routes opened from `/care-twin-qa`.
- QA target launches now append `qaReturn=care-twin-qa`, `qaSurface`, and `qaTitle` query context.
- Shared `BoardRouteHeader` detects that temporary QA context and renders a `Return to QA Cockpit` banner with capture-specific copy.
- The banner only appears during QA capture sessions, letting testers open target routes, take screenshots, then return to `/care-twin-qa` to attach proof and mark Pass or Needs tune without manually finding the route again.
- Static mobile readiness coverage now protects the query builder, route params, shared banner, and cockpit return action.

## Verification - Care Twin QA Return Loop

- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts` - 85 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 386 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

## Still Not Done - Care Twin QA Return Loop

- Real iOS and Android screenshots still need to be captured and attached by a device tester.
- Any screen marked Needs tune during capture must be fixed before the beta goes outside the owner/builder loop.

## Completed - Care Twin QA Device Mission Briefing

- Added a `Next device mission` briefing inside the `/care-twin-qa` 48-hour beta run card.
- The briefing shows the next target route, priority, current review status, attached evidence count, setup steps, pass criteria, and the exact Needs tune escalation rule before testers leave the cockpit.
- Kept the actual native-capture boundary intact: the briefing helps Apollo or a tester run the two-day QA pass, but it does not replace real iOS/Android screenshots or human visual approval.
- Added static mobile readiness coverage for the new route, evidence, status, setup, pass-criteria, and failure-escalation briefing fields.

## Verification - Care Twin QA Device Mission Briefing

- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts` - 85 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 386 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

## Still Not Done - Care Twin QA Device Mission Briefing

- Real iOS and Android screenshots still need to be captured and attached from `/care-twin-qa`.
- The first route marked Needs tune during that device pass should be fixed before wider beta sharing.

## Completed - Care Twin QA Mission Action Rail

- Added mission-level `Attach proof`, `Pass`, and `Needs tune` controls inside the `/care-twin-qa` 48-hour beta run card.
- The top card now resolves the active `nextBetaSurface` from the current beta target and attaches proof through the same saved local QA evidence model as the lower checklist.
- The proof action uses the selected iOS/Android/Web evidence tag, and the Pass/Needs tune buttons write to the active surface status so testers can complete the next mission without scrolling.
- The new controls use shared 48px touch targets and mission-specific accessibility labels.
- Static mobile readiness coverage now protects `nextBetaSurface`, proof attachment, selected-platform helper copy, mission review labels, status writes, and the shared mobile touch target contract.

## Verification - Care Twin QA Mission Action Rail

- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts` - 85 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 386 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.

## Still Not Done - Care Twin QA Mission Action Rail

- Real iOS and Android screenshots still need to be captured and attached through the mission controls.
- Any screen marked Needs tune during that capture pass should be fixed before wider beta sharing.

## Completed - Owner Preview Core Loop QA Surface

- Added `Owner Preview Core Loop` as a launch-critical Mobile Release QA surface for the two-day beta.
- The new surface protects the real owner path through Home, Log, Plans, Health, More, Records, Avatar Studio, and Care Pass instead of letting isolated screen checks stand in for a usable beta.
- The device mission asks testers to quick-log one safe care event or open the detail sheet, inspect Plans, review Health Watch/Bile Watch copy, open Launch Readiness from More, and confirm no key route is a dead end.
- Required evidence is explicit: iOS screenshot of Quick Log or Log, Android screenshot of More's Launch Readiness, and a note that the full owner loop was reachable.
- The surface keeps provider, payment, storage, AI, and store gates truthful while improving the internal beta path.

## Verification - Owner Preview Core Loop QA Surface

- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 86 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 387 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

## Still Not Done - Owner Preview Core Loop QA Surface

- Real iOS and Android screenshots still need to be captured and attached through `/care-twin-qa`.
- Any owner-loop route marked Needs tune during that capture pass should be fixed before wider beta sharing.

## Completed - Owner Preview Route Loop Guide

- Added an `Owner route loop` panel to the `/care-twin-qa` 48-hour beta run card for the Owner Preview Core Loop.
- The panel lists the beta journey in order: Home, Log, Plans, Health, More, Records, Avatar Studio, and Care Pass.
- Each route check includes the route, expected outcome, and proof note when evidence is required.
- `mobileLaunchQaEvidence.ts` now carries the same route checklist into the capture plan and shareable QA script.
- Static readiness coverage protects the in-app route-loop panel and the route checklist data contract.

## Verification - Owner Preview Route Loop Guide

- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 87 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 388 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

## Still Not Done - Owner Preview Route Loop Guide

- Real iOS and Android screenshots still need to be captured and attached through `/care-twin-qa`.
- The first route marked Needs tune during owner-preview capture should be fixed before wider beta sharing.
