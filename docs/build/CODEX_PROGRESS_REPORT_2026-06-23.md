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

## Verification

- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts` - 84 passing.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts` - 85 passing.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts` - 85 passing after the device-steps QA contract.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts` - 14 passing after the setup/precondition QA contract.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts` - 14 passing after the pass-criteria and Needs tune escalation QA contract.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 360 passing.
- `node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit` - passing.
- `node artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`.

## Still Not Done

- Real iOS and Android device/simulator screenshots still need to be captured and attached in `/care-twin-qa`.
- Provider launch setup still requires real Clerk, Supabase/Postgres, storage, AI, payments, push, store-account, and deletion gates before public release.
- GitHub Actions remote CI has recently failed before job execution due to the account billing/spending-limit blocker.

## Next Best Slice

Run the Home Mission Deck QA surface on iOS and Android using the in-app setup, numbered device steps, pass criteria, and Needs tune escalation, attach screenshots, share the QA report, and tune the first visible phone-size issue.
