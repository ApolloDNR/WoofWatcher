# QA Test Plan

## Current Automated Baseline

Run focused behavior tests:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts
```

CI must pass `WoofWatcher Verify` on `main`.

Latest local evidence, 2026-06-20:

- PASS: 294 behavior/readiness tests with bundled Node across `artifacts\woofwatcher-mobile\lib\*.test.ts` and `lib\care-domain\test\*.test.ts`.
- PASS: 74 focused mobile QA/care-twin readiness tests covering platform-aware Mobile Release QA evidence, Care Twin QA reporting, and static mobile readiness.
- PASS: mobile TypeScript check with bundled Node and workspace TypeScript.
- PASS: PixelLab asset verifier checked 149 Phoenix room/sprite/template/emote/accessory/seed-strip/Option B runtime assets with 0 missing and 0 invalid.
- PASS: Expo web export completed through the package-local Expo CLI and Metro resolver patch.
- PASS: `/care-twin-qa` Mobile Release QA now uses helper-driven platform evidence completeness, flexible screenshot-slot math, visible Native proof open/ready copy, and evidence-gap copy.
- PREVIOUS 2026-06-19: Headless Chrome visual smoke captured `/portrait` and Home from the exported web build; this was not rerun in the 2026-06-20 platform-evidence slice.
- REMOTE CI: GitHub Actions `WoofWatcher Verify` is currently blocked before job start by the account billing/spending-limit issue documented in `docs/BLOCKERS_FOR_APOLLO.md`. Use the Actions run list as live evidence instead of treating this static doc as current CI state.

Latest local evidence, 2026-06-21:

- PASS: 326 behavior/readiness tests with bundled Node across `artifacts\woofwatcher-mobile\lib\*.test.ts` and `lib\care-domain\test\*.test.ts`.
- PASS: 75 focused mobile QA/readiness tests covering Store Screenshot QA, platform evidence, and static mobile route wiring.
- PASS: mobile TypeScript check with bundled Node and workspace TypeScript.
- PASS: PixelLab asset verifier checked 149 registered assets with 0 missing and 0 invalid.
- PASS: Expo web export completed to `C:\Users\Apoll\OneDrive\Documentos\New project\tmp\woofwatcher-store-screenshot-qa-export`.
- PASS: `/care-twin-qa` now turns Store Submission screenshot checklist rows into iOS/Android store screenshot QA surfaces with route-open actions, Pass/Needs tune controls, notes, store-safe prompts, and native share packet output.

Latest local evidence, 2026-06-23:

- PASS: 85 focused mobile QA/readiness tests covering Mobile Release QA surfaces, Native QA Next Captures, and static mobile readiness.
- PASS: Mobile Release QA surfaces now require explicit numbered `verificationSteps` in addition to screenshot evidence and launch-risk copy.
- PASS: `/care-twin-qa` renders Device steps/Store steps before evidence capture, and the native share report includes the same route-check steps.
- PASS: More's Native QA Next Captures panel shows the first concrete step for each next QA target.
- PASS: 14 focused Mobile Release QA and Native QA Capture Plan tests covering setup/precondition steps before screenshot capture.
- PASS: `/care-twin-qa`, native QA share text, generated Store Screenshot QA surfaces, and More's Native QA Next Captures now carry setup/prep guidance before route-check steps.
- PASS: all Mobile Release QA and Store Screenshot QA surfaces now carry explicit pass criteria plus Needs tune escalation so visual QA cannot be marked complete without the real launch-quality checks.
- PASS: `/care-twin-qa`, More Native QA Next Captures, Mobile Release QA reports, and Native QA capture-plan share text all expose pass/failure criteria before screenshot evidence.
- STILL REQUIRED: real iOS and Android device/simulator execution, screenshot attachment, QA report sharing, and visible issue tuning.

Latest local evidence, 2026-07-04:

- PASS: Care-document launch proof persistence now keeps structured support/legal proof evidence and Provider Launch Setup proof-ready flags in the saved care document instead of stripping them during `mergeDoc`.
- PASS: More now feeds Launch Readiness from `launchProviderSetupPlan.providerInput.*ProofReady` plus launch-ready support/legal proof variables, so raw provider booleans still cannot bypass `deriveLaunchProviderSetup`, but valid structured proof can reach the top-level launch tiles.
- PASS: Mobile readiness passed `114/114` for the care-document launch proof persistence guard.
- PASS: Focused Provider/Launch/Support/Privacy/Reminder tests passed `36/36`.
- PASS: Direct JSON mobile beta doctor reports `care document launch proof persistence guard is source-backed` as `PASS`; the doctor remains `BLOCKED` only on local pnpm `11.7.0` versus pinned `10.24.0` and missing Corepack.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed with the dot reporter.
- PASS: Root TypeScript, mobile TypeScript, direct mobile beta doctor source-backed checks, and `git diff --check` passed for the care-document launch proof persistence guard.
- PASS: Implementation commit `79ec06b` (`Preserve launch proof fields`) was pushed to `automation/premium-revenue-product-builder`.
- BLOCKED: Fresh branch CI for `79ec06b` is pending; the latest visible run list still shows only earlier `workflow_dispatch` successes through run `28705671803`, which predates this implementation commit.
- PASS: Privacy owner export now clamps stale or imported `provider-approved` launch support/provider profiles through the shared structured proof models before serialization.
- PASS: `buildPrivacyExportBundle` uses `deriveSupportRunbookPlan` for `launchSupportProfile` and `deriveLaunchProviderSetup` for `launchProviderProfile`, downgrading missing-proof statuses to `owner-reviewed` in the exported bundle.
- PASS: `privacySafety.test.ts` passed `10/10` for the export launch-status clamp.
- PASS: The mobile beta doctor now reports `privacy export launch status proof guard is source-backed` as `PASS`.
- PASS: Mobile readiness passed `114/114`, and the full zero-dependency API/mobile/PWA/care-domain suite passed with the dot reporter.
- PASS: Root TypeScript, mobile TypeScript, direct mobile beta doctor source-backed checks, and `git diff --check` passed for the Privacy export launch-status clamp.
- PASS: Implementation commit `33d8fd0` (`Clamp privacy export launch statuses`) was pushed to `automation/premium-revenue-product-builder`.
- BLOCKED: Fresh branch CI for `33d8fd0` is pending; the latest visible run list still shows only earlier `workflow_dispatch` successes through run `28705671803`, which predates this implementation commit.
- PASS: Privacy & Safety now displays `Provider-approved packet` only when the support runbook plan is `launchReady`; stale or imported `provider-approved` support profiles without structured support/legal proof display as owner-reviewed local packets.
- PASS: Privacy's launch support save path re-derives `deriveSupportRunbookPlan(launchDraft)` and downgrades attempted `provider-approved` saves to `owner-reviewed` unless structured support/legal proof makes the draft launch-ready.
- PASS: The mobile beta doctor now reports `privacy support status proof guard is source-backed` as `PASS`.
- PASS: Mobile readiness passed `114/114` for the Privacy support/legal status clamp.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed with the dot reporter.
- PASS: Root TypeScript, mobile TypeScript, direct mobile beta doctor source-backed checks, and `git diff --check` passed for the Privacy support/legal status clamp.
- PASS: Implementation commit `9f18688` (`Clamp privacy support proof status`) was pushed to `automation/premium-revenue-product-builder`.
- BLOCKED: Fresh branch CI for `9f18688` is pending; the latest visible run list still shows only earlier `workflow_dispatch` successes through run `28705671803`, which predates this implementation commit.
- PASS: More's Provider Launch Setup save path now clamps persisted `launchProviderProfile.providerStatus` back to `owner-reviewed` unless all eight provider rows have both configured setup and their matching structured proof-ready flag.
- PASS: `PROVIDER_SETUP_FIELDS` now maps auth, database, storage, AI, payments, push, store accounts, and account deletion rows to explicit `proofKey` fields, and the mobile readiness guard asserts `saveProviderSetup` uses `normalized[field.key] && normalized[field.proofKey]`.
- PASS: Mobile readiness passed `114/114` for the persisted-status proof clamp.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed with the dot reporter.
- PASS: Root TypeScript, mobile TypeScript, direct mobile beta doctor source-backed checks, and `git diff --check` passed for the persisted-status clamp.
- PASS: Implementation commit `4406001` (`Clamp provider setup save proof status`) was pushed to `automation/premium-revenue-product-builder`.
- BLOCKED: Fresh branch CI for `4406001` is pending; the latest visible run list still shows only earlier `workflow_dispatch` successes through run `28705671803`, which predates this implementation commit.
- PASS: Provider Launch Setup row proof hardening now keeps provider-approved auth, database, storage, AI, payments, push, store, and deletion toggles staged as `Proof pending` until each row's structured proof-ready flag is present.
- PASS: `deriveLaunchProviderSetup` now requires configured setup, `providerStatus: "provider-approved"`, and the matching row proof flag before a row becomes `ready` or forwards true provider input into Launch Readiness.
- PASS: `launchProviderSetup.test.ts` passed `7/7`.
- PASS: Focused Provider Launch Setup plus mobile readiness tests passed `121/121`.
- PASS: Direct JSON mobile beta doctor reports `provider launch setup proof guard is source-backed` as `PASS`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `591/591`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: `git diff --check` passed with expected Windows CRLF warnings only.
- PASS: Implementation commit `83757f2` (`Require provider setup proof guard`) was pushed to `automation/premium-revenue-product-builder`.
- BLOCKED: Fresh branch CI for `83757f2` is pending; the latest visible run list still showed only earlier `workflow_dispatch` successes through run `28705671803`, which predates this implementation commit.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- STILL REQUIRED: real structured provider proof files for auth, database sync, storage, AI, payments, push, store accounts, and account deletion; real native/store/public-launch evidence; and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: PWA hosted nudge proof hardening now keeps backend URL plus household id plus push provider staged as `provider_proof_pending` until structured delivery proof is attached.
- PASS: `buildHostedNudgePlan` now requires backend job policy, caregiver consent, provider delivery, caregiver privacy, quiet-hours and daily-budget enforcement, missed-delivery fallback, native delivery proof, and Apollo approval before returning `ready_to_schedule`.
- PASS: PWA readiness passed `17/17`.
- PASS: Mobile readiness passed `114/114`.
- PASS: Direct JSON mobile beta doctor reports `PWA hosted nudge proof guard is source-backed` as `PASS`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `590/590`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Implementation commit `3c933a0` (`Require PWA hosted nudge proof guard`) was pushed to `automation/premium-revenue-product-builder`.
- BLOCKED: Fresh branch CI for `3c933a0` is pending; the latest visible run list still showed only earlier `workflow_dispatch` successes through run `28705671803`, which predates this implementation commit.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- STILL REQUIRED: real backend job runner, caregiver consent, provider delivery setup, caregiver privacy review, quiet-hours/daily-budget enforcement proof, missed-delivery fallback proof, native delivery proof, public launch, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: PWA cloud sync proof hardening now keeps backend URL plus household id staged as `provider_proof_pending` until structured provider proof is attached.
- PASS: `buildCloudSyncPlan` now requires Supabase project id, migration/backfill, active-household RLS, retention/export/deletion, dependency-complete build proof, mobile full-refresh sign-off, and Apollo approval before returning `ready_to_connect`.
- PASS: PWA readiness passed `16/16`.
- PASS: Mobile readiness passed `114/114`.
- PASS: Direct JSON mobile beta doctor reports `PWA cloud sync proof guard is source-backed` as `PASS`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `589/589`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Implementation commit `101fdf5` (`Require PWA cloud sync proof guard`) was pushed to `automation/premium-revenue-product-builder`.
- BLOCKED: Fresh branch CI for `101fdf5` is pending; the latest visible run list still showed only earlier `workflow_dispatch` successes through run `28705671803`, which predates this implementation commit.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- STILL REQUIRED: real Supabase project, migration/backfill, active-household RLS, retention/export/deletion policy, dependency-complete provider build, mobile full-refresh sign-off, public launch, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: PWA WoofGuide AI proof hardening now keeps a server OpenAI key signal staged as provider proof pending instead of presenting it as live AI.
- PASS: The PWA no longer posts to `/api/care-helper` unless `assistantStatus.proofReady` is true from structured AI provider proof.
- PASS: PWA readiness passed `15/15`.
- PASS: Mobile readiness passed `114/114`.
- PASS: Direct JSON mobile beta doctor reports `PWA WoofGuide AI proof guard is source-backed` as `PASS`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `588/588`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- BLOCKED: Fresh branch CI for the current branch tip is pending because manual `WoofWatcher Verify` dispatch from this Codex thread is blocked by the local approval/usage gate.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- STILL REQUIRED: real structured OpenAI key-storage, model-policy, source/citation, owner-review write-gate, veterinary-safety, fallback/incident proof files, live provider approval, public launch, and Apollo sign-off.

Latest local evidence, 2026-07-04:

- PASS: The focused `/care-twin-qa?qaSurface=report-binary-export-proof` mission now derives Provider Launch Setup from saved care state instead of hardcoding provider storage to false.
- PASS: The focused Report Binary Export proof manifest uses `launchProviderSetupPlan.providerInput.storageProviderConfigured` and forwards saved `storageProviderEvidence` as `providerStorageEvidence`.
- PASS: Red-first mobile readiness failed because `/care-twin-qa` did not use `useCare` or `deriveLaunchProviderSetup` and still passed `storageProviderConfigured: false`.
- PASS: Focused report-binary/provider/mobile readiness tests passed `126/126`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `594/594`.
- PASS: Direct JSON mobile beta doctor source-backed checks passed while still reporting the local dependency blocker.
- PASS: `git diff --check` passed with expected Windows CRLF warnings only.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- STILL REQUIRED: real local Care Pass PDF/Dog ID PNG native share and reopen proof, structured provider storage files, actual provider upload, store review, public launch, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: Privacy export and deletion-request attachment summaries now derive storage options from normalized saved `launchProviderProfile.storageProviderEvidence`.
- PASS: Owner export metadata moves attachment queues to `Ready for provider upload` only when the shared structured attachment-storage proof validator accepts the saved evidence.
- PASS: Deletion request copy includes the same provider-upload-ready attachment summary instead of always saying approved storage rules are waiting.
- PASS: `privacySafety.test.ts` passed `12/12`.
- PASS: Focused privacy/attachment/mobile readiness tests passed `132/132`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed with the dot reporter.
- PASS: Direct JSON mobile beta doctor source-backed checks passed while still reporting the local dependency blocker.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- STILL REQUIRED: real structured provider storage proof files, actual provider upload, object ids, signed access, retention/export/deletion receipts, native proof, store review, public launch, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: Provider Launch Setup now normalizes and preserves `storageProviderEvidence` instead of stripping valid saved/imported structured storage proof.
- PASS: Records Report History forwards Provider Launch Setup storage evidence into both Care Pass artifact export and Report Binary Export proof manifests.
- PASS: Privacy & Safety forwards the saved storage evidence into `deriveAccountSafetyPlan` instead of hardcoding storage provider setup to false.
- PASS: Focused Provider Launch Setup plus mobile readiness tests passed `121/121`.
- PASS: Focused Care Pass/report/Privacy/provider/mobile proof tests passed `161/161`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed with the dot reporter.
- PASS: Direct JSON mobile beta doctor source-backed checks passed while still reporting the local dependency blocker.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- STILL REQUIRED: real structured provider storage proof files, storage buckets/rules, signed upload/download, household scope, retention/export/deletion, QA evidence storage, native share/reopen proof, store review, public launch, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: Care Pass report artifact storage proof hardening now keeps saved printable HTML reports local-only when storage provider setup is configured but structured storage proof files are absent.
- PASS: Focused Care Pass/mobile readiness/beta handoff/release QA/smoke checklist tests passed `169/169`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `587/587`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Direct JSON mobile beta doctor reports `Care Pass storage proof guard is source-backed` as `PASS`.
- BLOCKED: Fresh branch CI for the current branch tip is pending because manual `WoofWatcher Verify` dispatch from this Codex thread is blocked by the local approval/usage gate.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- STILL REQUIRED: real structured provider storage proof files with bucket names, signed upload/download, household scope, retention/export/deletion, QA evidence storage, approval owner, approval booleans, native share/reopen proof, store review, public launch, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: Reminder Center push proof hardening now keeps provider-backed notifications local/in-app when push provider setup is configured and provider-approved but structured push proof files are absent.
- PASS: Focused Reminder Center/push/mobile readiness tests passed `125/125`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `586/586`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Direct JSON mobile beta doctor reports `reminder center push proof guard is source-backed` as `PASS`.
- PASS: Implementation commit `c36e36e` (`Require reminder push proof guard`) was pushed to `automation/premium-revenue-product-builder`.
- BLOCKED: Fresh branch CI for `c36e36e` is pending because manual `WoofWatcher Verify` dispatch from this Codex thread was rejected by the local approval/usage gate before GitHub accepted it; the latest visible run list still showed only earlier `workflow_dispatch` successes through run `28705671803`, which predates `c36e36e`.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- STILL REQUIRED: real Expo push project config, APNs credentials, Firebase/FCM credentials, permission prompt/preference proof, quiet-hours/opt-out proof, iOS APNs delivery evidence, Android FCM delivery evidence, missed-notification fallback proof, store privacy review, public launch, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: Support runbook proof hardening now keeps public launch `blocked` when support/legal approval booleans and privacy/terms links are present but structured support/legal proof files are absent.
- PASS: Focused Support Runbook/mobile readiness tests passed `121/121`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `586/586`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Direct JSON mobile beta doctor reports `support runbook proof guard is source-backed` as `PASS`.
- PASS: Branch CI proved implementation commit `ceecc55` in `WoofWatcher Verify` run `28705194968`, job `85129614020`; Setup pnpm, Setup Node, install, JSON mobile beta doctor, focused behavior tests, Typecheck plus CI-safe builds, post steps, and Complete job all passed.
- PASS: Branch CI proved the support-runbook proof-doc commit `58fe904` in `WoofWatcher Verify` run `28705426671`, job `85130189337`; Setup pnpm, Setup Node, install, JSON mobile beta doctor, focused behavior tests, Typecheck plus CI-safe builds, post steps, and Complete job all passed.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- STILL REQUIRED: real support inbox proof, privacy policy and terms proof, refund/subscription policy proof, veterinary/emergency boundary proof, deletion escalation proof, incident response proof, Apollo launch approval/no-launch-boundary proof, store review, public launch, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: Privacy & Safety payments proof hardening now keeps checkout `blocked` when `paymentsEnabled` is true but structured payments proof files are absent.
- PASS: Focused Privacy & Safety/mobile readiness tests passed `123/123`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `585/585`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Direct JSON mobile beta doctor reports `privacy safety payments proof guard is source-backed` as `PASS`.
- PASS: Branch CI proved implementation commit `5774048` in `WoofWatcher Verify` run `28704399568`, job `85127644483`; Setup pnpm, Setup Node, install, JSON mobile beta doctor, focused behavior tests, Typecheck plus CI-safe builds, post steps, and Complete job all passed.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- STILL REQUIRED: real product ids, billing path decision, iOS App Store and Android Google Play sandbox receipt proof, restore purchases, entitlement mapping, refund/support policy, Apollo checkout approval, store approval, public launch, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: Privacy & Safety account deletion proof hardening now keeps account deletion `blocked` when `accountDeletionEnabled` is true but structured deletion proof files are absent.
- PASS: Focused Privacy & Safety/mobile readiness tests passed `122/122`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `584/584`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Direct JSON mobile beta doctor reports `privacy safety account deletion proof guard is source-backed` as `PASS`.
- PASS: Branch CI proved implementation commit `4357cf7` in `WoofWatcher Verify` run `28703690180`, job `85125840962`, with mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe builds passing.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- STILL REQUIRED: real deletion route/auth proof, export-before-delete proof, data/object deletion receipt, audit/support receipt, recovery/cancellation proof, legal/store approval, public launch approval, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: Privacy & Safety AI proof hardening now keeps WoofGuide AI disclosure `limited` when `aiProviderConfigured` is true but structured provider proof files are absent.
- PASS: Focused Privacy & Safety/mobile readiness tests passed `121/121`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `583/583`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Direct JSON mobile beta doctor reports `privacy safety AI proof guard is source-backed` as `PASS`.
- PASS: Branch CI proved implementation commit `eb7234b` in `WoofWatcher Verify` run `28703163755`, job `85124450034`, with mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe builds passing.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- STILL REQUIRED: real OpenAI key storage, approved model policy, source/citation review, owner-reviewed write-gate proof, veterinary safety approval, fallback/incident proof files, public launch, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: Aggregate Launch Readiness proof hardening now blocks `storeLaunchReady` when provider/store/approval booleans are true but structured proof flags are absent.
- PASS: Focused launch/release/store/mobile readiness tests passed `131/131`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `582/582`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Direct JSON mobile beta doctor reports `aggregate launch readiness proof guard is source-backed` as `PASS`.
- PASS: Branch CI proved implementation commit `e257e4f` in `WoofWatcher Verify` run `28702584181`, job `85122931741`, with mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe builds passing.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- BLOCKED: Direct JSON native QA tooling doctor still reports missing `adb`, `emulator`, `java`, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, and `JAVA_HOME`.
- STILL REQUIRED: real provider proof files, real storage bucket configuration, signed upload/download policies, household scoping, retention/export/deletion approval, native iOS/Android proof, store review, public launch, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: Shared attachment storage proof hardening now blocks `storageProviderConfigured` from marking local medication proof photos, record documents, Adventure memories, Care Pass reports, and QA screenshots upload-ready unless structured attachment storage proof evidence is attached.
- PASS: `attachmentManifest.test.ts` passed `6/6`.
- PASS: Focused attachment/privacy/launch/release/store/mobile readiness tests passed `142/142`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `581/581`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Direct JSON mobile beta doctor reports `attachment storage proof guard is source-backed` as `PASS`.
- PASS: Branch CI proved implementation commit `84c6fac` in `WoofWatcher Verify` run `28701902248`, job `85121219768`, with mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe builds passing.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- BLOCKED: Direct JSON native QA tooling doctor still reports missing `adb`, `emulator`, `java`, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, and `JAVA_HOME`.
- STILL REQUIRED: real storage bucket configuration, signed upload/download policies, household scoping, retention/export/deletion approval, QA evidence storage approval, native iOS/Android proof, store review, public launch, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: Auth/Setup structured provider-proof hardening now blocks legacy Clerk, redirect/deep-link, household sync, and launch approval booleans unless structured Clerk production, redirect/deep-link, household membership, and Apollo auth launch proof files are attached.
- PASS: `authProviderProof.test.ts` passed `5/5`.
- PASS: Focused Auth/Setup/release-QA/Share Beta Handoff/smoke/readiness tests passed `149/149`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `577/577`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Direct JSON mobile beta doctor reports `auth/setup proof manifest is source-backed` as `PASS`.
- PASS: Branch CI proved commit `6da692b` in `WoofWatcher Verify` run `28701069572`, job `85119051428`; Setup pnpm, Setup Node, install dependencies, JSON mobile beta doctor, focused behavior tests, Typecheck plus CI-safe builds, post steps, and Complete job all passed.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- BLOCKED: Direct JSON native QA tooling doctor still reports missing `adb`, `emulator`, `java`, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, and `JAVA_HOME`.
- STILL REQUIRED: real Clerk configuration, OAuth/deep-link approval, provider-backed household creation, native Auth/Setup screenshots, store approval, public launch, and Apollo sign-off.

Earlier 2026-07-04 local evidence:

- PASS: Care-entry provider sync proof red/green coverage now blocks legacy Supabase ids, migration notes, RLS notes, policy notes, CI URLs, and mobile sign-off strings unless six structured proof files are attached.
- PASS: Focused care-entry/provider-setup/Share Beta Handoff/release-QA/smoke/readiness tests passed `153/153`.
- PASS: Full zero-dependency API/mobile/PWA/care-domain suite passed `576/576`.
- PASS: Root TypeScript and mobile TypeScript passed with bundled Node and workspace TypeScript.
- PASS: Direct JSON mobile beta doctor reports `care-entry provider sync proof target is source-backed` and `care-entry provider sync proof manifest is source-backed` as `PASS`.
- PASS: Branch CI proved commit `2721de1` in `WoofWatcher Verify` run `28699549834`, job `85115170898`; Setup pnpm, Setup Node, install dependencies, JSON mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe builds all passed.
- BLOCKED: Direct JSON mobile beta doctor still reports `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- BLOCKED: Direct JSON native QA tooling doctor still reports missing `adb`, `emulator`, `java`, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, and `JAVA_HOME`.
- STILL REQUIRED: real Supabase migration/backfill execution, production RLS/privacy proof, retention/export/deletion approval, native incremental sync QA, rollback approval, and Apollo sign-off before incremental care-entry sync can be enabled.

## Required Automated Coverage

- Event taxonomy and normalization.
- Routine board matching.
- Meal progress and meal completion fields.
- Medication adherence for taken, due, missed, and upcoming medication routines, including private-log exclusion and Records mobile wiring.
- Medication quick-log and full Log composer defaults for routine dose, taken/skipped outcome, household visibility, and skipped-medication adherence behavior.
- Medication proof attachment seams for local proof URI/name/source, local-only storage status, proof-attached timeline state, audit history, and explicit owner confirmation after proof is attached.
- Medication follow-ups for missed doses, due-now doses, refill records, notification-rule copy, Records mobile wiring, and Care Pass report language.
- Medication history for recent household-visible medication logs, including dose, outcome, caregiver, routine id, note, private-log exclusion, medicine/dose/caregiver/note search, taken/skipped/missed/needs-review outcome filters, filtered summary copy, empty-state copy, and Records mobile wiring.
- Water quick-log defaults for household-visible fresh-water refills.
- Hydration summary derivation for visible water logs, refill equivalents, daily goal percentage, caregiver participation, Records mobile wiring, and Care Pass report language.
- Walk quick-log defaults for household-visible activity evidence, including Home/Log active-session start behavior.
- Walk session lifecycle for active in-progress walks, newest-open-session detection, timer-backed finish, route/place, distance, dog interactions, social outcome, notes, audit history, and mobile Home/Log wiring.
- Walk Activity derivation for visible walk logs, duration, distance when logged, dog interactions, social outcomes, places/routes, caregiver participation, Records mobile wiring, and Care Pass report language.
- Saved walk route templates derived from household-visible route/place logs, including private-log exclusion, stale-log exclusion, repeat-route grouping, visits, average duration, distance, dog interactions, caregiver list, social outcome snippets, Records mobile wiring, walk composer fields, and Care Pass report language.
- Weekly Care Trends derived from household-visible logs, including current-versus-previous 7-day windows, meal completion, walk minutes, water refills, potty/medication/health watch signals, caregiver participation, Records mobile wiring, and Care Pass report language.
- Training Progress derived from household-visible training logs, including skill/cue, outcome, duration, next-practice notes, private-log exclusion, Records mobile wiring, Log composer fields, and trainer Care Pass report language.
- Alone Time derivation from household-visible departure logs, including duration, return state, trigger/context, calming support, recovery minutes, private-log exclusion, Records mobile wiring, Log composer fields, and Care Pass handoff language.
- Weight Trend derivation from household-visible weigh-ins, including goal parsing, profile fallback, private-log exclusion, current/previous change, Records chart wiring, and Care Pass report language.
- Grooming Care derivation from household-visible grooming logs, including duration, type, coat/skin notes, products/groomer context, next due date, private-log exclusion, Records mobile wiring, Log composer fields, and Care Pass report language.
- Potty quick-log defaults for household-visible potty evidence.
- Incident Watch derivation from household-visible incident logs, including alias normalization, private-log exclusion, alert/follow-up counts, injury checks, trigger/exposure extraction, 7/30/lookback trend windows, rising/improving/steady/clear trend labels, owner follow-up tasks, trainer goal suggestions, Records mobile routing, and Care Pass report language.
- Potty composer, detail-sheet correction, and Potty Health derivation for visible potty logs, pee/poop counts, outcome/location/pee-detail/stool-detail edits, stale-detail clearing when outcomes change, stool review signals, condition summaries, stool colors, accident/urgent/straining context, caregiver participation, audit history, Records mobile wiring, and Care Pass report language.
- Care sync local/pending/failed/retry behavior, durable outbox derivation, retryable create/update counts, mobile Log outbox visibility, household Sync Health dashboard derivation, More Sync Health visibility, and conflict-safe care document refresh reconciliation.
- Household Responsibility derivation for care-team routine ownership, open/overdue/unassigned routines, visible today log counts, next household action copy, and Calendar/More mobile wiring.
- Household Access derivation for synced members, local-only caregivers, routine-only owners, invite readiness, permission labels, next-step copy, and More mobile wiring.
- Access Pass derivation for local helper permission drafts, sitter/trainer/vet/emergency permission boundaries, blocked actions, provider-gated sharing copy, My Care Today assigned routines, and More mobile wiring.
- Reminder Center derivation for routine reminders, missed/due medication follow-ups, expiring/missing records, grooming due dates, private-log exclusion, urgency sorting, display limits, notification-readiness copy, and Calendar mobile wiring.
- Reminder Center action routing for routine edit, Records review, Medication log preselection, Grooming log preselection, and accessible row labels.
- Care log audit trail creation, sanitization, sticky-note/edit/delete audit events, correction-history summary cards, changed-field chips, non-health deletion audit notes, and mobile Log detail wiring.
- Care log search across title, note, caregiver, nested details, sticky notes, normalized type aliases, type filters, newest-first sorting, active-filter summary copy, and Log mobile wiring.
- Today Command priority selection, routine-board alignment, and overdue assigned routine routing.
- Home Quick Log routine matching and meal detail enrichment.
- Health Watch signals and medical boundary.
- Health Watch pattern cards with evidence, owner next steps, and steady-state behavior.
- Care Pass generation, report artifacts, print-ready escaped HTML payloads, legacy artifact print recovery, and Records print-source sharing for future PDF/export flows.
- Care Pass audience checklists and Health Pattern Review next steps.
- Record vault and due status.
- Record reminders for expired, due-soon, missing-critical, and reference-only records.
- Pet credential fallbacks, escaped print-ready Dog ID credential HTML, and Records printable Dog ID sharing.
- Sticky notes.
- WoofGuide deterministic actions and owner-reviewed draft payloads for meal logs, record reminders, vet notes, and Care Pass review.
- Setup wizard.
- Premium plan packaging and checkout-disabled guard.
- Premium entitlement policy for Free, Plus, and Family feature gates before checkout is enabled.
- Premium payments proof manifest for product catalog, billing path, sandbox receipt, restore-purchase, refund/support, and checkout-gate blockers before paid checkout is enabled.
- Auth/Setup proof manifest for Clerk production app, redirect/deep links, platform-specific native Auth screenshots, Setup local-preview proof, household sync, and launch-gate blockers on Auth, Setup, and the focused Auth/Setup helper route before native Auth/Setup proof is claimed.
- Records local-file handoff proof manifest for Care Pass Report History local HTML, Dog ID local HTML credential, Dog ID SVG image source, native share sheet, Android content URI or saved-file proof, fallback copy, and generated PDF/PNG/provider boundary blockers before native Records file proof is claimed.
- Report binary export proof manifest for Care Pass PDF, Dog ID PNG, provider storage, and native artifact proof blockers on the focused Report Binary Export Proof helper route before generated PDF/PNG readiness is claimed.
- Route visual proof manifest for Home, Log, Plans, Health, Records, and More native iOS/Android screenshot slots, QA note blocker, and web-preview-only boundary before visual sign-off is claimed.
- Route visual proof hardening that keeps each Home, Log, Plans, Health, Records, and More row blocked until the matching iOS/Android evidence file name or URI is route-named, even if generic platform screenshot counts are present.
- Avatar motion state derivation for health watch, recent care logs, due routines, quiet hours, and low energy.
- Privacy/account safety export, deletion request, AI disclosure, document storage gates, and payment launch blockers.
- Mobile readiness static smoke for critical route registration, tab coverage, string router links, launch-blocking safety copy, CI Expo web export wiring, Records printable report and Dog ID actions, Hydration/Walk/Potty Records wiring, and screen-reader labels for critical Privacy, Premium, WoofGuide, and More actions.
- Expo app identity smoke for release-grade slug, URL scheme, iOS bundle id, Android package id, and absence of Replit placeholders.
- Expo/EAS release profile smoke for committed iOS/Android development, preview, production, and submit paths.
- Mobile release runbook smoke for iOS, Android, TestFlight, Google Play, Fable, and web dashboard/PWA handoff coverage.
- Store submission screenshot QA surfaces derived from the Store Submission packet, including iOS/Android evidence slots, route targets, store-safe prompts, launch-risk copy, and `/care-twin-qa` wiring.
- CI `build:ci` runs a mobile Expo web export smoke and verifies emitted HTML/JavaScript assets.

## Records Binary Artifact Proof

Current evidence, 2026-07-03: `reportGeneratedBinaryArtifact.ts` creates local
base64 Care Pass PDF bytes and Dog ID PNG bytes without provider storage.
Records wires those artifacts into Report History PDF actions and the Dog ID PNG
action, writes them through Expo FileSystem when a document directory exists,
and falls back to share-safe text when local file writing is unavailable.

Current evidence, 2026-07-03: `buildReportBinaryExportProofManifest` can show
`Local PDF generated` and `Local PNG generated` with file name, MIME type, and
byte size, but it still keeps the manifest blocked until native iOS/Android
share/reopen proof and provider storage evidence are attached.

Current evidence, 2026-07-03: `mobileReadiness.test.ts` and
`scripts/mobile-beta-doctor.mjs` guard `generated binary artifact exports are
source-backed`, so local PDF/PNG generation cannot drift back to HTML/SVG-only
fallbacks while native/provider proof remains open.

## Manual Mobile QA

1. Sign up/sign in.
2. Complete setup: dog profile, diet, routine, caregiver.
3. Confirm Today shows next needed care.
4. Log a meal with expected, served, eaten, skipped/partial, note, and caregiver visibility.
5. Use Home Quick Log for a meal and confirm it records the open routine, expected portion, served amount, eaten amount, complete status, and household visibility.
6. Confirm a visible matching meal log changes the routine from due/missed to handled and shows complete/partial/skipped status.
7. Confirm a private meal log stays out of shared household routine status.
8. Add a medication routine, use Home quick log for Meds, and confirm it records the matching routine, dose, taken outcome, and household visibility.
9. Use the Log medication composer and confirm the Medication routine panel, dose field, taken/skipped choice, and household visibility toggle are visible.
10. Open a pending medication log, attach proof from the photo library, and confirm the detail sheet shows Proof status: Attached, the attachment name, and Local-only proof saved without marking the log confirmed.
11. Confirm the timeline changes from Proof needed to Proof attached while Needs review remains until an adult owner confirms the medication log.
12. Confirm Records Medication Plan shows taken status, dose, logged-by context, and adherence percentage after a visible taken medication log.
13. Confirm a skipped medication log does not count as taken, a private medication log does not satisfy the household Medication Plan, and an overdue unlogged medication becomes missed.
14. Add a medication refill record with a near due date and confirm Records Medication Follow-ups shows the refill action and notification-rule copy.
15. Preview the vet Care Pass and confirm Medication includes adherence status, taken/upcoming doses, and refill follow-up language.
16. Confirm Records Medication History shows recent visible taken/skipped medication logs with dose, caregiver, relative time, and notes, while private medication logs stay out.
17. Use Home Quick Log for Water and confirm it records a household-visible fresh-water refill.
18. Confirm Records Hydration updates refill-equivalent progress, caregivers, latest water log, and next-step copy after water logs.
19. Preview a Care Pass and confirm the Hydration section summarizes today without making medical claims.
20. Use Home Quick Log for Walk and confirm it starts a household-visible active walk session, changes Home to Walk active, and routes an already-active walk to the Log finish flow.
21. Finish the active walk from Log with route/place, distance, dog interactions, social outcome notes, and optional note; confirm the same log records duration/audit history and Records Walk Activity updates minutes, places, latest walk, and next-step copy.
22. Log the same route more than once and confirm Records Saved Routes groups the route, shows visits, average duration, dog interactions, suggested use, and the latest social note.
23. Mark a walk private and confirm it stays out of shared Walk Activity, Saved Routes, routine status, and Care Pass route context.
24. Preview a trainer or sitter Care Pass and confirm Walk Activity includes route/place, dog interaction context, and Saved Routes.
25. Confirm Records Care Trends summarizes the last 7 days, meal completion, walk minutes, and review signals while ignoring private logs.
26. Preview a Care Pass and confirm Care Trends adds weekly context without making medical claims.
27. Add a Training log with skill/cue, win/practice/struggle outcome, duration, next-practice note, sticky note, and household visibility.
28. Confirm Records Training Progress updates sessions, minutes, wins, skills, latest session, and next-practice guidance while ignoring private training logs.
29. Preview a trainer Care Pass and confirm Training Progress includes session count, skills, latest outcome, trigger/context when present, and next-practice notes.
30. Use Home Quick Log for Potty and confirm it records household-visible potty routine evidence.
31. Add a potty log with pee/poop kind, soft/off condition, stool color, accident/urgent/straining context, and a sticky note; then open the log detail sheet, use Clarify potty log to correct outcome/location/pee/stool detail, and confirm Records Potty Health updates pee, poop, review count, color/context detail, latest detail, audit history, and stool detail next-step copy without carrying stale fields.
32. Preview a vet or sitter Care Pass and confirm Potty Health summarizes stool color and potty context without making medical claims.
33. Add sticky note to a log.
34. Add vaccine, insurance, microchip, vet, receipt, and document records.
35. Confirm Records shows expired, due-soon, and missing-critical reminders but does not warn on reference-only microchip/policy values; share the Dog ID card text and printable Dog ID source.
36. Preview and share sitter/vet/trainer/caregiver Care Pass.
37. Confirm Care Pass includes the audience checklist, Health Pattern Review, and non-diagnostic boundary before sharing.
38. Confirm report history stores shared Care Pass with printable export metadata, separate resend action, and printable-source share action.
39. Ask WoofGuide about recent changes and verify non-diagnostic wording.
40. Open WoofGuide suggested actions and confirm owner review appears before saving a meal log, creating a reminder, inserting a vet note, or reviewing Care Pass.
41. Open Privacy & Safety from More, share the care-data export, and confirm it includes care data counts without auth/session tokens.
42. Prepare an account deletion request and confirm it is non-destructive and says manual review/export first.
43. Confirm AI disclosure, document storage rules, and payment launch blockers are visible.
44. Review Health Watch pattern cards and confirm evidence, owner next steps, and vet-boundary language are visible.
45. Confirm the Home avatar motion row changes for a recent meal, upcoming walk, overdue routine, quiet hours, low energy, and Health Watch signal.
46. Force offline or failed sync state and confirm the Log shows the Offline Outbox banner, retryable create/update counts, pending count, failed-sync message, and Retry sync action.
47. Open More and confirm Sync Health shows household status, care-log count, care-team count, outbox waiting count, next-step guidance, and a refresh/retry action with accessible label.
48. Edit profile, routine, record, or report state offline or during a stale refresh; confirm the newer local care document is kept and pushed back instead of overwritten by older server data.
49. Open Calendar and confirm Household Responsibility shows handled/open/overdue/unassigned routine counts plus the next household step.
50. Open More and confirm Responsibility Center shows the same household next step, member routine loads, visible log counts, and routes to Calendar.
51. Create a log, add a sticky note, edit its title or note, open details, and confirm Correction history summarizes the latest update/changed fields while Audit trail still shows create, sticky-note, and edit evidence.
52. Delete a log and confirm a separate deleted-log audit note appears without counting as a health or routine-completion event.
53. Add an Alone Time log with duration, return state, trigger/context, calming support, recovery minutes, sticky note, and household visibility.
54. Confirm Records Alone Time updates status, minutes, anxious/distress counts, triggers, supports, latest context, and next-step copy while private alone logs stay out.
55. Preview a sitter/trainer Care Pass and confirm Alone Time summarizes the latest return state, recovery, trigger, and calming support without diagnosing anxiety.
56. Add two visible Weight logs and one private Weight log; confirm Records Weight Trend uses only visible weigh-ins for the chart and goal distance.
57. Update the weight goal and confirm Records shows the correct to-go/over-goal copy.
58. Preview a vet Care Pass and confirm Weight Trend includes current weight, goal, latest weigh-in, and owner-reported context language.
59. Open More and confirm Household Access shows synced members, invite-needed caregivers, routine-only owners, and the correct invite code state.
60. Add a local caregiver and assign a routine to someone not in the synced account member list; confirm Household Access marks them as invite needed instead of silently treating them as synced.
61. Confirm the Household Access invite action is disabled without an invite code and uses the share action when a household invite code exists.
62. Add a Grooming log with type, duration, coat/skin note, product or groomer context, next due date, sticky note, and household visibility.
63. Confirm Records Grooming Care updates status, minutes, type counts, products, next due date, latest context, and next-step copy while private grooming logs stay out.
64. Preview a sitter or vet Care Pass and confirm Grooming Care summarizes latest grooming, product context, next due date, and owner-reported/non-diagnostic boundary language.
65. Open Calendar and confirm Reminder Center combines overdue routines, missed/due medication follow-ups, due-soon records, and grooming due dates into one owner action list with urgent/watch/total counts and no claim that real push notifications are enabled.
66. Tap Reminder Center rows and confirm they route to the expected concrete workflow: routine edit, Records, Medication log, or Grooming log with the composer type preselected.
67. Open Log, search by caregiver, route/place, medication detail, and sticky-note text, then combine search with type chips and confirm the summary and empty state update correctly.
68. Open Records Medication History, search by medicine, dose, caregiver, and note text, then switch Taken, Skipped, Missed, and Needs review filters and confirm summary and empty-state copy update correctly.
69. Open Avatar Studio, switch to Emotes, tap each Phoenix mood state, and confirm the mood grid uses the corresponding PixelLab emote art instead of the same head crop with a color wash while the top hero remains the live Studio care-twin room.
70. Switch Avatar Studio to the Retriever template, open Emotes, and confirm all 10 moods use the Retriever starter pack instead of Phoenix art. Switch to an unfinished template and confirm it falls back to that template's own base still rather than the wrong dog.
71. Switch Avatar Studio to the Husky / Spitz template, open Emotes, and confirm all 10 moods use the Husky starter pack, including Home Alone and Not Feeling Well, with no Retriever or Phoenix fallback art.
72. Switch Avatar Studio to the Bully template, open Emotes, and confirm all 10 moods use the Bully starter pack, including Home Alone and Not Feeling Well, with no Husky, Retriever, or Phoenix fallback art.
73. Open More and confirm CareTwin Roster shows Phoenix/the primary dog as the live care twin with Live, Future, and Gated metrics.
74. Tap Add future dog, save a planned dog such as London, and confirm it appears as Provider-gated without changing Phoenix's active logs or profile.
75. Tap the provider-gated future dog and confirm the app explains that multi-dog switching requires provider-backed multi-dog care documents before logs, routines, records, and reports can be separated.
76. Open Privacy & Safety export after adding a future dog and confirm staged pet roster data is included without auth/session tokens.
77. Open More, create an Access Pass draft for a sitter, and confirm the card shows Drafts, permission boundary copy, and a Share Draft Summary action without claiming remote access is live.
78. Open More with routines assigned to the current user and confirm My Care Today shows assigned, open, overdue counts plus the next assigned routine.
79. Open Privacy & Safety export after creating an Access Pass draft and confirm Access Pass data is included without auth/session tokens.
80. Open More, tap Adventure Mode, and confirm the route presents a private RPG care quest board without claiming live maps, public sharing, or cloud photo storage.
81. With household-visible walk, training, play, or alone-time logs present, confirm Adventure Mode derives level/XP, completed proof, the next available quest, and a Save Memory action from real care evidence.
82. Save an Adventure memory draft, confirm it appears in the Memory shelf as local/private, then open Privacy & Safety export and confirm Adventure memories are included without auth/session tokens.
83. Open Phoenix Home and confirm the Care Quest board includes Adventure Mode with next quest, level, XP, memory count, and a direct route to the Adventure screen without pushing Quick Log or Next Up below usability.
84. Add an Incident log with trigger, exposure, injury check, action taken, follow-up, sticky note, and household visibility.
85. Open Records Incident Watch and confirm the trend signal, 7/30/lookback counts, follow-up plan, trainer goals, and non-diagnostic boundary are visible.
86. Tap an Incident Watch follow-up row and confirm it routes to the Incident composer or trainer Care Pass preview instead of becoming a dead recommendation.
87. Preview a trainer Care Pass and confirm Incident Watch includes trend, owner follow-ups, trainer goal ideas, and factual non-diagnostic language.
88. Open `/care-twin-qa`, review the Store Screenshot QA section, and confirm it lists Phoenix Home, Quick Log, Plans & Schedule, Health Watch, Care Pass, Avatar Studio, and Privacy & Launch Gates as store screenshot surfaces.
89. For each Store Screenshot QA surface, open the target route, capture one iOS screenshot and one Android screenshot, attach each screenshot back to the matching store card, and confirm the platform evidence counts update separately.
90. Share the QA summary and confirm the report includes the Store Submission packet plus the store screenshot surface notes without claiming App Store or Play Store approval.

## Missing QA

- Simulator/device runtime smoke. CI web export smoke exists, but it does not replace native runtime rendering.
- API integration tests.
- Auth onboarding smoke.
- Visual regression or screenshot review.
- Rive/Lottie/Reanimated avatar asset runtime checks and a native-device visual pass for the PixelLab Phoenix, Retriever, Husky, and Bully emote packs.
- Full accessibility pass for contrast, dynamic type, keyboard flow, touch targets, and native screen-reader traversal. Static labels for critical mobile actions are now covered.
- Document upload/security tests.
- Self-serve provider-backed account deletion tests.
- Payment/paywall tests when monetization is enabled.

## Care Twin Native QA Matrix

Current evidence, 2026-06-19: `careTwinAssets.ts` now exports
`CARE_TWIN_RUNTIME_QA_SCENARIOS` plus `evaluateCareTwinRuntimeQaScenario`,
and `careTwinAssets.test.ts` verifies all 12 avatar motion states against the
expected sprite action, dogless room variant, zone, scene phase, priority need,
and layered readiness. The human device checklist lives in
`docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md`.

Current evidence, 2026-06-19: the mobile app now has a development/internal
`/care-twin-qa` route that renders the full care-twin matrix with the production
`LivingPhoenixRoom` component. More links to `Care Twin QA` only under
`__DEV__`, and `mobileReadiness.test.ts` protects route registration, matrix
usage, and the native QA prompt surface.

Current evidence, 2026-06-19: `/care-twin-qa` now supports session-level
Pass/Needs tune review controls, per-scenario device notes, summary counts, and
a native share action backed by `careTwinQaReport.ts`. The shared report states
that native screenshot evidence is still required before launch.

Current evidence, 2026-06-20: `/care-twin-qa` now also includes a Mobile Release
QA cockpit backed by `mobileReleaseQa.ts`. Device testers can mark Phoenix Home,
Care Twin State Lab, Avatar Studio, Incident Composer, Records Incident Watch,
and Trainer Care Pass as Pass or Needs tune, add per-surface notes, open the
target route, and share a combined release QA report. The report keeps attached
iOS/Android screenshots and human review as required before launch approval.

Current evidence, 2026-06-20: the Mobile Release QA cockpit autosaves and
restores the QA session locally through `mobileQaSession.ts` and AsyncStorage.
Release-surface status, care-twin state status, and device notes survive route
hops so testers can open Home, Log, Records, Care Pass, and Avatar Studio while
building one report. This is local device evidence only, not provider-backed QA
storage.

Current evidence, 2026-06-20: `careTwinChoreography.test.ts` covers the motion
recipe that makes Phoenix feel like one stateful game character instead of a
generic tapped button. The app now derives primary loop, ambient loops,
state-aware tap response, reaction duration, and QA copy from the same care-twin
plan used by `LivingPhoenixRoom`. Device reviewers should use the new Motion
recipe box in `/care-twin-qa` while judging loop timing and touch response.

Current evidence, 2026-06-20: `/care-twin-qa` now captures local screenshot
evidence for the Mobile Release QA cockpit and the 12-state care-twin matrix.
Device testers can capture a native screenshot, attach it from Photos to the
matching release surface or care-twin state, leave the route, return, and keep
the attachment in the local QA session. `mobileQaSession.test.ts`,
`mobileReleaseQa.test.ts`, `careTwinQaReport.test.ts`, and
`mobileReadiness.test.ts` cover screenshot evidence sanitization, persistence,
summary counts, share-report filenames, and route wiring. This is local QA
evidence only; provider-backed screenshot storage and release approval still
require Apollo-approved storage/provider rules and human review.

Current evidence, 2026-06-20: screenshot evidence is now platform-aware. Native
captures attached from iOS count toward iOS screenshot slots, Android captures
count toward Android slots, and web/unknown attachments stay visible without
falsely satisfying native proof. The Mobile Release QA cockpit header and share
report show iOS and Android coverage separately, and the care-twin matrix report
lists attached screenshot platforms beside file names.

Current evidence, 2026-06-21: `/care-twin-qa` now also includes Store
Screenshot QA surfaces generated from the Store Submission packet. Store
screenshots use the same platform-aware evidence controls as the release
workflow checklist, including explicit iOS and Android screenshot slots, route
targets, Pass/Needs tune controls, store-safe prompts, and share-report output.

Current evidence, 2026-06-30: Mobile Release QA and Store Screenshot QA now use
proof-gated Pass labels. A surface marked Pass remains `Pass pending proof`
until every required iOS screenshot, Android screenshot, flexible screenshot,
and QA note is attached. `/care-twin-qa` renders an amber `Pass pending release
proof` gate on affected release/store cards, the share report lists missing
proof per surface, and `mobileReleaseQa.test.ts` plus `mobileReadiness.test.ts`
protect the label, summary, share text, and route wiring. This protects launch
truth only; actual native screenshot proof still has to be captured on iOS and
Android.

Current evidence, 2026-06-21: saved `/care-twin-qa` release evidence now feeds
More's Launch Readiness cockpit. `mobileLaunchQaEvidence.ts` builds the combined
launch/store QA surface set, derives `LaunchReadinessNativeQaSummary` from the
saved local QA session, and returns `null` for empty sessions so native proof is
not invented. More reloads that saved session on focus and recalculates Launch
Readiness from it. Focused saved-QA/mobile readiness tests pass at 73 tests.

Current evidence, 2026-06-21: More now also shows `Native QA Next Captures`
inside Launch Readiness. The capture plan ranks missing screenshot targets by
launch-critical priority and names missing iOS, Android, or flexible screenshot
evidence per surface. Focused capture-plan/mobile readiness tests pass at 75
tests.

Current evidence, 2026-06-21: Native QA next-captures now has a shareable
capture script. Focused tests cover the share text header, generated timestamp,
progress counts, ordered route list, missing evidence, and done condition.
Static readiness tests verify More exposes `Share QA Plan` from the same saved
QA capture plan.

Current evidence, 2026-06-21: Provider Launch Setup is now covered by focused
tests and static mobile readiness checks. `launchProviderSetup.test.ts` verifies
profile normalization, eight-gate progress math, share text, and the rule that
partial provider approval cannot be shown as fully provider-approved. Privacy
export tests verify `launchProviderProfile` is included in owner data, and
mobile readiness checks verify More renders Provider Launch Setup, Edit Provider
Plan, and Share Provider Plan inside Launch Readiness.

Native QA still needs real iOS/Android screenshots for room/sprite scale, stage
cropping, touch response, and loop readability.

Latest local evidence, 2026-06-19:

- Mobile TypeScript compile passed for the WoofWatcher Expo app.
- Focused Node tests passed for care-twin assets, care-twin stage routing, avatar motion, Avatar Studio, and avatar template readiness.
- PixelLab asset verification passed with 149 registered assets, 0 missing, and 0 invalid.
- Expo web export passed from the package-local CLI.
- Chrome web visual smoke caught and then verified the Avatar Studio live-sprite overlay fix; Home rest-state behavior was then guarded in code so ambient awake loops do not override sleep/rest scenes.
- The latest Option B day-room pass still needs real iOS/Android screenshots for visual approval; local checks prove wiring and asset dimensions, not final phone-size taste.

Latest local evidence, 2026-06-20:

- Focused mobile layout/readiness tests passed at 70 tests.
- Full local behavior/readiness suite passed at 298 tests across `artifacts/woofwatcher-mobile/lib/*.test.ts` and `lib/care-domain/test/*.test.ts`.
- Mobile TypeScript compile passed for the WoofWatcher Expo app.
- PixelLab asset verification passed with 149 registered assets, 0 missing, and 0 invalid.
- Expo web export passed to `tmp/woofwatcher-mobile-layout-export`.
- `git diff --check` passed with only expected Windows line-ending warnings.
- The floating-paw tab shell and Home, Log, Plans, Health, More, and Records route bottom spacing are now guarded by shared `mobileLayout.ts` helpers. Native iOS/Android visual QA still needs real device or simulator screenshots for final safe-area, crop, touch, and animation approval.

Latest local evidence, 2026-06-20:

- Full local behavior/readiness suite passed at 300 tests across `artifacts/woofwatcher-mobile/lib/*.test.ts` and `lib/care-domain/test/*.test.ts`.
- Mobile TypeScript compile passed for the WoofWatcher Expo app.
- PixelLab asset verification passed with 149 registered assets, 0 missing, and 0 invalid.
- Expo web export passed to `tmp/woofwatcher-standalone-layout-export`.
- `git diff --check` passed with only expected Windows line-ending warnings.
- Standalone routes and auth/setup surfaces now use shared `getStandaloneRouteBottomPadding`, and WoofGuide uses shared `getDockedComposerBottomPadding`; static readiness tests reject the old route-local constants. Native iOS/Android visual QA still needs real device or simulator screenshots for final safe-area, keyboard/composer fit, crop, touch, and animation approval.

Latest local evidence, 2026-06-20:

- Full local behavior/readiness suite passed at 302 tests across `artifacts/woofwatcher-mobile/lib/*.test.ts` and `lib/care-domain/test/*.test.ts`.
- Focused setup/privacy/readiness tests passed at 76 tests.
- Mobile TypeScript compile passed for the WoofWatcher Expo app.
- PixelLab asset verification passed with 149 registered assets, 0 missing, and 0 invalid.
- Expo web export passed to `tmp/woofwatcher-household-setup-export`.
- `git diff --check` passed with only expected Windows line-ending warnings.
- First-run setup now captures household create, join-by-invite, or local-preview intent; persists the household setup plan; exports it in owner data; and shows truthful account/provider confirmation copy. Native iOS/Android visual QA still needs real device or simulator screenshots for setup flow fit, safe areas, keyboard/composer behavior, stage crop, touch, and animation approval.

Latest local evidence, 2026-06-21:

- Focused mobile layout/readiness tests passed at 76 tests.
- Full local behavior/readiness suite passed at 306 tests across `artifacts/woofwatcher-mobile/lib/*.test.ts` and `lib/care-domain/test/*.test.ts`.
- Mobile TypeScript compile passed for the WoofWatcher Expo app.
- PixelLab asset verification passed with 149 registered assets, 0 missing, and 0 invalid.
- Expo web export passed to `tmp/woofwatcher-mobile-interaction-contract-export`.
- Shared mobile layout contracts now cover route top spacing, modal sheets, centered modals, keyboard offsets, touch targets, and inline hit slop across launch-critical tabbed, standalone, setup/auth, WoofGuide, Records, Log, and fallback surfaces. Native iOS/Android visual QA still needs screenshots for notch clearance, keyboard/composer fit, modal reach, touch response, stage crop, and animation approval.

Latest local evidence, 2026-06-21:

- Focused provider/privacy/mobile readiness tests passed at 78 tests.
- Full local behavior/readiness suite passed at 337 tests across `artifacts/woofwatcher-mobile/lib/*.test.ts` and `lib/care-domain/test/*.test.ts`.
- Mobile TypeScript compile passed for the WoofWatcher Expo app.
- Provider Launch Setup now gives Apollo an editable/shareable production checklist while still keeping native QA, provider credentials, legal/support, store-account, and App Store/Play Store approval outside the app until actually completed.

Latest local evidence, 2026-06-23:

- API readiness now has a focused zero-dependency test for OpenAPI/generated-client coverage of `/woofguide-events`, `/avatar-stylize`, and `/avatar-emotions`.
- `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` passed with 2 tests.
- Full local focused behavior/readiness suite passed with 362 tests across API readiness, mobile library tests, PWA vanilla tests, and shared care-domain tests.
- API readiness now also covers `/care-entries?limit=...` so the server-supported pagination cap stays documented and typed in OpenAPI, React generated params, and Zod generated validators/types.
- `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` passed with 3 tests after the `limit` query contract fix.
- Full local focused behavior/readiness suite passed with 363 tests after the `limit` query contract fix.
- API readiness now covers `PUT /care-state` write-error contracts so validation errors, missing-document errors, and optimistic conflict envelopes stay documented and typed.
- `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on missing care-state `400` OpenAPI coverage, then passed with 4 tests after the contract update.
- Full local focused behavior/readiness suite passed with 364 tests after the care-state write-error contract fix.
- API readiness now covers care-entry create/update/delete write-error contracts so invalid log bodies or ids stay documented as `400` responses and generated create mutation errors are typed as `ApiError`.
- `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on missing create-care-entry `400` OpenAPI coverage, then passed with 5 tests after the contract update.
- Full local focused behavior/readiness suite passed with 365 tests after the care-entry write-error contract fix.
- API readiness now covers household provisioning and auth-error contracts so `/me`, profile update, household rename, and join-household auth/validation errors stay documented and generated household hooks expose `ApiError`.
- `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on missing `getMe` `401` OpenAPI coverage, then passed with 6 tests after household contract updates.
- Full local focused behavior/readiness suite passed with 366 tests after the household provisioning/auth contract fix.
- API readiness now covers provider-gated WoofGuide action contracts so care-helper questions and WoofGuide event flows keep authenticated routes, rate-limit surfaces, truthful local fallbacks, and generated client error types.
- `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on missing care-helper `401` OpenAPI coverage, then passed with 7 tests after WoofGuide provider/action contract updates.
- Full local focused behavior/readiness suite passed with 367 tests after the WoofGuide provider/action contract fix.
- API readiness now covers authenticated household scoping for care-state and care-entry read/write routes so server code, OpenAPI, and generated React query errors stay aligned around active-household data boundaries.
- `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on missing care-state read `401` OpenAPI coverage, then passed with 8 tests after household scoping contract updates.
- Full local focused behavior/readiness suite passed with 368 tests after the care-state/care-entry household scoping contract fix.
- API readiness now covers role-aware care-entry write boundaries so create/update/delete routes resolve the authenticated household member role, read-only roles receive documented `403` errors, kid/helper logs remain pending confirmation, safety-critical medication/vomit/symptom/incident logs remain reviewable, and medication proof metadata stays attached.
- `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on the missing `care-entry-authorization.ts` policy module, then passed with 9 tests after the role-aware write contract was added.
- Full local focused behavior/readiness suite passed with 369 tests after the care-entry role-policy contract fix.
- Mobile TypeScript passed with `NODE_PATH=artifacts/woofwatcher-mobile/node_modules`, PixelLab asset verification passed at `ok=149 missing=0 invalid=0`, API route/generated-client syntax checks passed, `git diff --check` passed, and Expo web export emitted `.expo-smoke` from the package-local Expo CLI.
- `node --check lib/api-client-react/src/generated/api.ts` and `node --check lib/api-zod/src/generated/api.ts` passed syntax checks for the generated-client edits.
- `NODE_PATH=artifacts/woofwatcher-mobile/node_modules node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit` passed after the WoofGuide provider/action and household scoping contract fixes; the local Windows checkout currently needs the package-local dependency path for the generated React API client.
- PixelLab asset verification passed with 149 registered assets, 0 missing, and 0 invalid.
- `git diff --check` passed with only expected Windows line-ending warnings.
- Expo web export passed by invoking the package-local Expo CLI directly because the local Windows shell does not expose `pnpm`.
- Remote GitHub Actions runs `28063020164`, `28064200143`, `28065179874`, `28066357245`, `28067734120`, and `28069107846` failed before job start with the standing account billing/spending-limit annotation.
- Direct workspace `tsc` checks for `lib/api-client-react` and `lib/api-zod` and direct `artifacts/api-server/build.mjs` remain environment-limited without the pnpm workspace symlink layer; the observed failures were missing package resolution for existing dependencies (`@tanstack/react-query`, `zod`, `esbuild`), not route-contract assertion failures.

Latest local evidence, 2026-06-23:

- API readiness now covers household member role mutation and revocation contracts so owner/admin-only helper management, canonical role payloads, active-household scoping, empty-patch rejection, self-change/self-revocation blocking, protected-owner safeguards, Access Pass-compatible helper scopes, and typed `ApiError` mutation failures stay aligned across server routes, OpenAPI, Zod validators, and the generated React client.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on the missing empty-patch guard, then passed with 10 tests after role-update validation, OpenAPI enum coverage, Zod enum coverage, and generated React schema typing were added.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 370 passing after the household member mutation contract fix.
- `NODE_PATH=artifacts/woofwatcher-mobile/node_modules node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit` - passing.
- `node artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- `node --check artifacts/api-server/src/lib/household-authorization.ts`, `node --check artifacts/api-server/src/routes/household.ts`, `node --check lib/api-client-react/src/generated/api.ts`, and `node --check lib/api-zod/src/generated/api.ts` - passing syntax checks.
- `git diff --check` - passing with only expected Windows line-ending warnings.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, which was removed after verification.
- Remote GitHub Actions run `28072320208` for commit `6e25c2f` failed before job execution with job `83109274416`, `steps: []`, `runner_id: 0`, `log not found: 83109274416`, and the billing/spending-limit annotation. Local verification remains the current evidence for this slice until the GitHub account billing/spending-limit blocker is fixed.

Latest local evidence, 2026-06-23:

- API readiness now covers household invite acceptance and Access Pass helper mutation contracts so join-by-invite emits typed audit metadata, stores canonical adult caregiver roles, and Access Pass activation/revocation stay owner/admin-only, active-household-scoped, helper-role-limited, and generated-client typed.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts` first failed on the missing `household-access-pass.ts` policy/audit module, then passed with 11 tests after invitation audit events, Access Pass activation/revocation routes, OpenAPI schemas, Zod validators, and generated React hooks were added.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 371 passing after the household invitation/Access Pass audit contract fix.
- `NODE_PATH=artifacts/woofwatcher-mobile/node_modules node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit` - passing.
- `node artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- `node --check artifacts/api-server/src/lib/household-access-pass.ts`, `node --check artifacts/api-server/src/routes/household.ts`, `node --check lib/api-client-react/src/generated/api.ts`, `node --check lib/api-client-react/src/generated/api.schemas.ts`, and `node --check lib/api-zod/src/generated/api.ts` - passing syntax checks.
- `git diff --check` - passing with only expected Windows line-ending warnings.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, which was removed after verification.
- Direct `node artifacts/api-server/build.mjs` remains environment-limited in this Windows shell because `esbuild` is present in pnpm's store but not resolvable without the pnpm workspace symlink/runner layer. The failure is `ERR_MODULE_NOT_FOUND: Cannot find package 'esbuild'`, not an edited route-contract assertion failure.
- Remote GitHub Actions run `28074177667` for commit `fa26845` failed before job execution with job `83114878625`, `steps: []`, `log not found: 83114878625`, and the billing/spending-limit annotation. Local verification remains the current evidence for this slice until GitHub billing/platform execution is fixed.

Latest local evidence, 2026-06-24:

- API readiness and behavior tests now cover durable household audit readiness: `household_audit_events` schema, provider-durable audit storage status, invite/member/Access Pass lifecycle states, Access Pass future-expiry validation, route-level audit inserts, and generated OpenAPI/Zod/React contract typing.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/householdAccessPass.test.ts artifacts/api-server/test/apiReadiness.test.ts` first failed on the missing durable audit schema and helper import/runtime surface, then passed with 14 tests after the schema, helper, route, and generated contract updates.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 374 passing after the durable household audit/Access Pass expiry slice.
- `NODE_PATH=artifacts/woofwatcher-mobile/node_modules node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit` - passing.
- `node --check artifacts/api-server/src/lib/household-access-pass.ts`, `node --check artifacts/api-server/src/routes/household.ts`, `node --check lib/db/src/schema/householdAuditEvents.ts`, `node --check lib/api-zod/src/generated/api.ts`, and `node --check lib/api-client-react/src/generated/api.schemas.ts` - passing syntax checks.
- `node artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with only expected Windows line-ending warnings.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, which was removed after verification.
- Direct `node node_modules/typescript/bin/tsc -p lib/db/tsconfig.json --noEmit` remains environment-limited in this Windows shell because local Node type definitions are not resolvable; the failure is `TS2688: Cannot find type definition file for 'node'`.
- Direct `node artifacts/api-server/build.mjs` remains environment-limited in this Windows shell because `esbuild` is not resolvable without the pnpm workspace symlink/runner layer. The failure is still `ERR_MODULE_NOT_FOUND: Cannot find package 'esbuild'`, not an edited route-contract assertion failure.
- Remote GitHub Actions run `28075849741` for commit `c67364e` failed before job execution with job `83119832168`, `steps: []`, `log not found: 83119832168`, and the billing/spending-limit annotation. Local verification remains the current evidence for this slice until GitHub billing/platform execution is fixed.

Latest local evidence, 2026-06-24:

- API readiness and behavior tests now cover the owner/admin household audit review API: authenticated `GET /household/audit-events`, active-household scoping, owner/admin-only access, newest-first ordering, safe `limit`/`action`/`lifecycleState` filters, typed response parsing, OpenAPI documentation, Zod validators, React schemas/hooks, and generated type exports.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/householdAccessPass.test.ts artifacts/api-server/test/apiReadiness.test.ts` first failed on the missing audit-list route and query normalizer, then passed with 16 tests after the route, helper, and generated contract updates.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 376 passing after the household audit review API slice.
- `NODE_PATH=artifacts/woofwatcher-mobile/node_modules node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit` - passing.
- `node --check artifacts/api-server/src/lib/household-access-pass.ts`, `node --check artifacts/api-server/src/routes/household.ts`, `node --check lib/api-zod/src/generated/api.ts`, `node --check lib/api-client-react/src/generated/api.ts`, and `node --check lib/api-client-react/src/generated/api.schemas.ts` - passing syntax checks.
- `node artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with only expected Windows line-ending warnings.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, which was removed after verification.
- Direct package TypeScript checks for `lib/api-zod`, `lib/api-client-react`, and `artifacts/api-server` remain environment-limited by unresolved local workspace dependencies (`zod`, `@tanstack/react-query`, and `@types/node`). The previous generated-type export collision in `lib/api-zod` is fixed; the remaining failures are dependency-resolution limits in this Windows shell, not audit-readiness assertion failures.
- Remote GitHub Actions run `28078084503` for commit `eb50f5c` failed before job execution with job `83126533628`, `steps: []`, and `log not found: 83126533628`, matching the billing/spending-limit blocker. Local verification remains the current evidence for this slice until GitHub billing/platform execution is fixed.

Latest local evidence, 2026-06-24:

- API readiness and behavior tests now cover request-time Access Pass expiry enforcement: helper memberships persist `accessPassExpiresAt`, expired helper roles become `expired access pass` during authorization, care-entry writes treat expired helper authority as read-only, `/me` exposes `accessPassExpiresAt` plus `accessPassExpired`, and OpenAPI/Zod/React member schemas expose the same expiry metadata.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/householdAccessPass.test.ts artifacts/api-server/test/apiReadiness.test.ts` first failed on missing member expiry schema/runtime helper coverage, then passed with 18 tests after implementation.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 378 passing after the request-time Access Pass expiry slice.
- `NODE_PATH=artifacts/woofwatcher-mobile/node_modules node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit` - passing.
- `node artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- Syntax checks passed for edited API helpers/routes, generated member schemas, and the household member DB schema.
- `git diff --check` - passing with only expected Windows line-ending warnings.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, which was removed after verification.

Latest local evidence, 2026-06-24:

- API readiness and behavior tests now cover durable household invitation lifecycle readiness: `household_invitations` schema, owner/admin invite list/create/revoke routes, safe lifecycle filters, canonical role validation, future-expiry validation, invitation-created/revoked audit events, and durable invite acceptance checks in `/household/join`.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/householdInvitation.test.ts artifacts/api-server/test/apiReadiness.test.ts` first failed on missing `/household/invitations` OpenAPI coverage, then passed with 17 tests after implementation.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 381 passing after the durable household invitation lifecycle slice.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` - passing.
- `node artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- Syntax checks passed for edited API helpers/routes, generated invitation schemas/hooks/types, generated audit enums, and the household invitation DB schema.
- `git diff --check` - passing with only expected Windows line-ending warnings.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, which was removed after verification.

Latest local evidence, 2026-06-24:

- API readiness and behavior tests now cover the owner/admin household sharing cleanup review API: authenticated `GET /household/sharing-cleanup`, active-household scoping, owner/admin-only access, safe `limit` and `kind` filters, non-destructive review-only candidate derivation, runtime-expired invitation rows, expired Access Pass helper memberships, typed response parsing, OpenAPI documentation, Zod validators/types, React schemas/hooks, and generated type exports.
- RED/GREEN: `node --experimental-strip-types --test artifacts/api-server/test/householdSharingCleanup.test.ts artifacts/api-server/test/apiReadiness.test.ts` first failed on the missing cleanup helper and route contract, then passed with 18 tests after implementation.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 384 passing after the household sharing cleanup review slice.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` - passing.
- `node artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- Syntax checks passed for the new cleanup helper, edited household route, generated Zod API file, generated React client, generated React schemas, and new cleanup generated type files.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, verified HTML/JavaScript output, and removed the generated folder after verification.

Latest local evidence, 2026-06-25:

- Release packet tests now cover two-day beta readiness separately from public launch readiness: beta candidate pending device proof, internal beta ready while provider/store gates remain blocked, local beta gates blocked, and fully store-ready.
- Static mobile readiness tests now protect More's Launch Readiness wiring for `betaShipStatus`, `betaVerdictLabel`, and `betaSummary`.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/releasePacket.test.ts artifacts/woofwatcher-mobile/lib/launchReadiness.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts` - 81 passing.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 386 passing after the two-day beta ship-path slice.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` - passing.
- `node artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` - 149 assets valid, 0 missing, 0 invalid.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, verified HTML/JavaScript output, and removed the generated folder after verification.

Latest local evidence, 2026-06-25:

- More's Launch Readiness beta card now renders visible `betaNextActions` so the two-day ship path is testable from the app, not only from docs or share text.
- The beta card CTA opens `/care-twin-qa` while native proof is the blocker and falls back to sharing the beta packet when internal beta circulation is ready.
- Static mobile readiness tests now protect visible beta action rows, the accessible `Open beta device QA cockpit` label, `Open QA Cockpit`, and `Share Beta Packet`.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/releasePacket.test.ts artifacts/woofwatcher-mobile/lib/launchReadiness.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts` - 81 passing.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 386 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` - passing.
- `node scripts/verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, verified HTML/JavaScript output, and removed the generated folder after verification.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, verified HTML/JavaScript output, and removed the generated folder after verification.

Latest local evidence, 2026-06-25:

- `/care-twin-qa` now exposes mission-level `Attach proof`, `Pass`, and `Needs tune` controls directly inside the 48-hour beta run card.
- The mission proof action resolves the active `nextBetaSurface`, attaches screenshots with the currently selected iOS/Android/Web evidence tag, and keeps the lower per-surface evidence controls available for deeper review.
- Mission Pass and Needs tune write to the same surface status model used by the release QA summary, so testers can update the next target without scrolling through the longer checklist.
- The new controls use the shared `MIN_MOBILE_TOUCH_TARGET` contract and accessible mission-specific labels.
- Static mobile readiness tests protect `nextBetaSurface`, the mission proof action, selected-platform helper text, mission Pass/Needs tune labels, and the status write calls.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts` - 85 passing.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 386 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` - passing.
- `node scripts/verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.

Latest local evidence, 2026-06-25:

- `/care-twin-qa` now starts with a focused `48-hour beta run` card before the longer release and store QA checklist.
- The card derives the next surface from `buildMobileLaunchQaCapturePlan`, shows missing proof, displays complete/open count, and lets testers jump with `Open Next Surface` or send the combined report with `Share QA`.
- Static mobile readiness tests protect `48-hour beta run`, `nextBetaTarget`, `Open Next Surface`, and the accessible `Open next beta QA surface` label.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts` - 85 passing.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 386 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` - passing.
- `node scripts/verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, verified HTML/JavaScript output, and removed the generated folder after verification.

Latest local evidence, 2026-06-25:

- `/care-twin-qa` now lets testers choose `Tag screenshot evidence` as iOS, Android, or Web before attaching screenshots from Photos.
- New QA screenshot evidence uses the selected platform for `targetPlatform`, so iPhone/Android proof can be counted correctly even when the upload happens through an Expo/PWA preview.
- Attached screenshot rows show the counted platform label beside the file name, making device-proof gaps easier to audit.
- Static mobile readiness tests protect `selectedEvidencePlatform`, the accessible `Tag QA screenshots as ...` controls, `targetPlatform: selectedEvidencePlatform`, and visible attachment platform labels.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts` - 85 passing.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 386 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` - passing.
- `node scripts/verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, verified HTML/JavaScript output, and removed the generated folder after verification.

Latest local evidence, 2026-06-25:

- `/care-twin-qa` target launches now append QA return context with `qaReturn=care-twin-qa`, `qaSurface`, and `qaTitle`.
- Shared `BoardRouteHeader` reads that context and shows a temporary `Return to QA Cockpit` banner on board-header routes opened from the QA workflow.
- The banner gives testers a phone-visible way to return after capture, attach proof, and mark Pass or Needs tune without manually navigating back to the QA route.
- Static mobile readiness tests protect `buildQaReturnRoute`, the QA query context, `useLocalSearchParams`, `Return to QA Cockpit`, and the cockpit return action.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts` - 85 passing.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 386 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` - passing.
- `node scripts/verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, verified HTML/JavaScript output, and removed the generated folder after verification.

Latest local evidence, 2026-06-25:

- `/care-twin-qa` now adds a `Next device mission` briefing to the 48-hour beta run card before testers open a target screen.
- The briefing shows the target route, launch/store priority, current review status, attached evidence count, setup steps, pass criteria, and the exact `Needs tune if` rule for the selected surface.
- This reduces phone-test drift during the two-day beta push while preserving the boundary that actual iOS/Android screenshots and human visual approval are still required.
- Static mobile readiness tests protect `Next device mission`, `Before capture`, `Pass when`, `Needs tune if`, the target route, evidence count, QA status label, setup steps, pass criteria, and failure-escalation copy.
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts` - 85 passing.
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts` - 386 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` - passing.
- `node scripts/verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct Expo export via package-local CLI - passing, emitted `.expo-smoke`, verified HTML/JavaScript output, and removed the generated folder after verification.

Latest local evidence, 2026-06-25:

- Mobile Release QA now includes a launch-critical `Owner Preview Core Loop` surface, aimed at the real internal-beta journey instead of isolated screenshots.
- The required owner-preview route sequence is Home, Log, Plans, Health, More, Records, Avatar Studio, and Care Pass.
- The surface requires a safe quick-log/detail-sheet check, Plans add/edit reachability, non-diagnostic Health Watch/Bile Watch language, Launch Readiness review, and no dead-end routes.
- Required proof is an iOS Quick Log or Log screenshot, an Android Launch Readiness screenshot from More, and a note confirming the core loop was reachable without dead ends.
- The surface preserves truthful provider, payment, storage, AI, and store gates instead of treating internal beta polish as public launch readiness.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 86 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 387 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- Phoenix Home now keeps its owner-preview first-screen actions on the shared 48px mobile touch-target contract.
- The hardened controls include the header/menu action, Avatar Studio hero entry, household presence panel, and Adventure inline action.
- Static readiness now extracts the named Home style blocks and asserts each uses `MIN_MOBILE_TOUCH_TARGET`.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` failed first on the 42px `headerButton`, then passed with 77 tests after Home used the shared target.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 94 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 395 passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Mobile TypeScript is currently blocked in this cleaned Windows shell because the Expo/mobile dependency layer is absent (`expo/tsconfig.base` not found), and Expo web export should be re-run from Git Bash, WSL, CI, or a preinstalled dependency layer with `sh` available.

Latest local evidence, 2026-06-25:

- Native QA now produces a focused `WoofWatcher Needs Tune Fix Brief` for the first target marked `Needs tune`.
- `mobileLaunchQaEvidence.ts` tracks `firstNeedsTuneTarget` across the full open capture list, even when the target is outside the visible next-four captures.
- The fix brief includes route, priority, QA note, proof gaps, setup and repro steps, optional Owner route loop, done condition, Needs tune rule, and return-to-`/care-twin-qa` instructions.
- More's Native QA Next Captures panel now exposes `Share Fix Brief` only when a Needs tune target exists, with static readiness guarding the import, copy, accessibility label, and shared 48px touch target.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts` first failed on the missing `buildMobileLaunchQaFixBriefShareText` export, then passed with 12 tests after the helper landed.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` first failed because More lacked the fix-brief import/action/style, then passed with 78 tests after wiring.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\betaHandoffPacket.test.ts artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 100 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 401 passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts\woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passed with expected Windows line-ending warnings only.
- `node node_modules\typescript\bin\tsc -p artifacts\woofwatcher-mobile\tsconfig.json --noEmit` - blocked in this cleaned Windows shell by missing Expo/mobile dependencies and config (`expo/tsconfig.base` not found, plus missing React Native/Expo module types). Re-run from the dependency-complete mobile environment before dependency/export sign-off.

Latest local evidence, 2026-06-25:

- Adventure Mode now keeps its owner-preview memory actions on the shared 48px mobile touch-target contract.
- The hardened controls are the `Save Memory` primary action and `Share Adventure` secondary action.
- Static readiness now extracts `primaryBtn` and `secondaryBtn` from the Adventure route and asserts each uses `MIN_MOBILE_TOUCH_TARGET`.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` failed first on `primaryBtn`, then passed with 76 tests after Adventure used the shared target.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 93 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 394 passing.
- `node node_modules\typescript\bin\tsc -p artifacts\woofwatcher-mobile\tsconfig.json --noEmit` - currently blocked in this cleaned Windows shell because the Expo/mobile dependency layer is absent (`expo/tsconfig.base` not found).
- `node scripts\verify-pixellab-assets.js` from `artifacts\woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Expo web export smoke did not complete in this Windows shell: the sandboxed attempt lacked `pnpm`, and the network-enabled bundled-pnpm attempt reached the registry but failed before export because the root preinstall script calls `sh`, which is unavailable here.

Still not done for this Adventure slice:

- Real iOS and Android screenshots still need to be captured and attached through `/care-twin-qa`.
- Apollo or a helper still needs to visually approve the Adventure route's quest list, memory capture, Save Memory, Share Adventure, and private/safety copy before sharing the beta beyond the builder loop.
- Expo web export should be re-run from Git Bash, WSL, CI, or another dependency environment with `sh` available before this slice is treated as export-proven.

Latest local evidence, 2026-06-25:

- More now keeps the Launch Readiness and household gateway actions on the shared 48px mobile touch-target contract.
- The hardened controls include profile edit, Care Intelligence action, provider setup actions, native QA share/cockpit actions, beta next action, Launch/Store packet share actions, Access Pass share and role chips, household invite, prompt modal actions, provider status chips, weight-unit chips, and profile/diet/provider save buttons.
- Static readiness now extracts those named More style blocks and asserts each uses `MIN_MOBILE_TOUCH_TARGET`.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` failed first on the 32px `profileEditBtn`, then passed with 73 tests after More used the shared target.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 90 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 391 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- Plans now keeps its core owner-preview controls on the shared 48px mobile touch-target contract.
- The hardened controls include Add plan, Find event, suggestion add, schedule tabs, schedule completion, routine add, event remove, routine done, modal type chips, owner chips, save, and delete.
- Static readiness now extracts those named Plans style blocks and asserts each uses `MIN_MOBILE_TOUCH_TARGET`.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` failed first on the 40px `addBtn`, then passed with 72 tests after Plans used the shared target.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 89 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 390 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- `/care-twin-qa`'s `Share QA` action now includes the live native QA capture plan before the full mobile release QA, store submission packet, and care-twin state report.
- The shared packet uses `buildMobileLaunchQaCaptureShareText(betaCapturePlan, reviewedAtIso)`, so the next target, missing evidence, Owner route loop, Mission note requirement, and done condition come from the same in-app capture plan as the 48-hour beta card.
- Static mobile readiness protects the route import and share-packet order.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` failed before the route imported/shared the capture plan, then passed with 71 tests after wiring.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 88 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 389 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- More's Native QA Next Captures panel now includes an action rail with `Share QA Plan` and a direct cockpit action.
- The cockpit action says `Finish Proof` when any target is still `Pass pending proof`; otherwise it says `Open QA Cockpit`.
- The cockpit action routes directly to `/care-twin-qa` and uses accessible labels that distinguish proof completion from normal capture.
- Static readiness protects `nativeQaCaptureHasProofPending`, visible `Finish Proof` copy, and the `nativeQaCaptureCockpitAction` style/action contract.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` failed before the cockpit action existed, then passed with 71 tests after wiring.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 88 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 389 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- `/care-twin-qa` now keeps critical tester controls on the shared 48px mobile touch-target contract.
- The hardened controls include screenshot platform tags, Open Next Surface, Share QA, Share QA Summary, evidence attach/clear, per-surface Open Surface, and Pass/Needs tune review buttons.
- Static readiness now extracts named style blocks and asserts those controls use `MIN_MOBILE_TOUCH_TARGET` instead of route-local 40-46px heights.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` failed first on the 44px `betaRunPlatformOption`, then passed with 71 tests after the QA route used the shared touch target.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 88 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 389 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- Quick Log now keeps the core owner-preview logging actions on the shared 48px mobile touch-target contract.
- The hardened controls include outbox retry, care-type launcher tabs, quick-feedback Undo/Add details, alone-time return outcomes, active-walk finish, trust proof attachment, trust review actions, meal outcome buttons, potty outcome buttons, and potty detail save.
- Static readiness now extracts those named Log style blocks and asserts each uses `MIN_MOBILE_TOUCH_TARGET`.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` failed first on the 36px `outboxButton`, then passed with 71 tests after the Log route used the shared target.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 88 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 389 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- Health Watch now keeps its core owner-preview controls on the shared 48px mobile touch-target contract.
- The hardened controls include the Health/Bile segmented tabs, `Log health note`, and `Records` hero actions.
- Static readiness now extracts those named Health style blocks and asserts each uses `MIN_MOBILE_TOUCH_TARGET`.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` failed first on the 36px `tabPill`, then passed with 71 tests after the Health route used the shared target.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 88 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 389 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- More's Launch Readiness board now renders `Proof status` inside Native QA Next Captures.
- Pass rows that still have required missing screenshots or Mission note evidence display `Pass pending proof` instead of looking complete.
- `buildMobileLaunchQaCaptureShareText` now uses the same owner-readable status label, so the shared QA plan does not leak raw internal status strings or hide pending proof.
- Static readiness protects `mobileLaunchQaCaptureTargetStatusLabel(target)` and visible `Pass pending proof` copy in More.
- Red/green evidence: the targeted launch-QA/readiness tests failed before `mobileLaunchQaCaptureTargetStatusLabel` existed and before More called it, then passed after wiring.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 80 passing.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 88 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 389 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- The native QA capture plan now treats required `Note ...` evidence as a real missing item, not just descriptive copy.
- The Owner Preview Core Loop stays open when screenshots are attached and the surface is marked Pass but the required no-dead-ends QA note is missing.
- `/care-twin-qa` now shows a `Mission note` input inside the 48-hour beta run card and marks it `Required` when the active target still needs QA-note proof.
- The mission note writes into `surfaceNotes[nextBetaTarget.surfaceId]`, so it persists through the existing local QA session and flows into share reports.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 88 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 389 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- `/care-twin-qa` now shows `Pass pending proof` when a beta mission is marked Pass but the active capture target still has missing required evidence.
- The proof gate explains that the mission remains open until missing proof is attached and the Mission note is saved.
- The same card lists the first missing proof items, so testers do not have to infer why the capture plan still has an open target.
- Static mobile readiness protects `nextBetaTargetMissingEvidence`, `nextBetaTargetPassPendingProof`, `Pass pending proof`, the proof-gate explanation, and `nextBetaTargetMissingEvidence.slice(0, 2)`.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` failed before the proof gate existed, then passed with 71 tests after wiring.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 88 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 389 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- `/care-twin-qa` now shows an `Owner route loop` panel inside the 48-hour beta run card when the active target is `Owner Preview Core Loop`.
- The panel gives device testers the exact route order and expected outcome for Home, Log, Plans, Health, More, Records, Avatar Studio, and Care Pass before they mark the mission Pass.
- `mobileLaunchQaEvidence.ts` now carries the same `routeChecklist` into the capture plan and the shareable QA script, so the route loop can be sent to Apollo, a helper, or a design polish tool without drift.
- Static mobile readiness protects `Owner route loop`, `nextBetaTarget.routeChecklist`, `routeCheck.expected`, and `routeCheck.proof`.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 87 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 388 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- Records and Care Pass now keep their owner-preview report, credential, medication, and vault actions on the shared 48px mobile touch-target contract.
- The hardened controls include Dog ID share/print, medication search clear, medication filter chips, Care Pass preview rows, report artifact resend/print, progress report period tabs, record delete, empty add, record type chips, attachment, and sheet cancel/save.
- Static readiness now extracts those named Records style blocks and asserts each uses `MIN_MOBILE_TOUCH_TARGET`.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` failed first on `shareInline`, then passed with 74 tests after the Records route used the shared target.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 91 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 392 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- Avatar Studio now keeps its owner-preview creator actions on the shared 48px mobile touch-target contract.
- The hardened controls include creator tabs, gallery/take-photo/reset/save buttons, coat swatches, face-marking options, mood preview chips, and shared-constant-backed large template/accessory tiles.
- Static readiness now extracts those named Avatar Studio style blocks and asserts each uses or references `MIN_MOBILE_TOUCH_TARGET`.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` failed first on the 40px `tab`, then passed with 75 tests after Avatar Studio used the shared target.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 92 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 393 passing.
- From `artifacts/woofwatcher-mobile`: `NODE_PATH=node_modules node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` - passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Direct package-local Expo web export passed, emitted `.expo-smoke`, verified HTML and JavaScript output, and removed the generated folder with a scoped Node cleanup.

Latest local evidence, 2026-06-25:

- WoofGuide now keeps its prompt, send, and owner-review actions on the shared 48px mobile touch-target contract.
- The hardened controls include quick question chips, suggested action rows, the composer send button, and the owner-review Cancel/Apply draft controls.
- Static readiness now extracts the named WoofGuide style blocks and asserts each references `MIN_MOBILE_TOUCH_TARGET`.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` failed first on `quickChip`, then passed with 78 tests after WoofGuide used the shared target.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 95 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 396 passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Mobile TypeScript is currently blocked in this cleaned Windows shell because the Expo/mobile dependency layer is absent (`expo/tsconfig.base` not found), and Expo web export should be re-run from Git Bash, WSL, CI, or a preinstalled dependency layer with `sh` available.

Latest local evidence, 2026-06-25:

- More now exposes a `Share Beta Handoff` action that sends a single 48-hour beta packet instead of forcing Apollo or a helper to stitch together Launch Packet, Native QA Plan, and route-loop notes manually.
- `betaHandoffPacket.ts` combines `ReleasePacket` truth with `MobileLaunchQaCapturePlan` proof gaps, including beta verdict, public-launch verdict, next device mission, missing proof, Owner route loop run order, Pass pending proof instruction, and provider/store/AI truth boundaries.
- Static readiness now protects the More import/share wiring plus the new `betaHandoffShareButton` shared mobile touch-target contract.
- Red/green evidence: `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\betaHandoffPacket.test.ts` first failed because `betaHandoffPacket.ts` did not exist; `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` then failed because More did not import/share the packet; both passed after the helper and More wiring landed.
- `node --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\betaHandoffPacket.test.ts artifacts\woofwatcher-mobile\lib\mobileReleaseQa.test.ts artifacts\woofwatcher-mobile\lib\mobileLaunchQaEvidence.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts` - 97 passing.
- `node --experimental-strip-types --test artifacts\api-server\test\*.test.ts artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts` - 398 passing.
- `node scripts\verify-pixellab-assets.js` from `artifacts/woofwatcher-mobile` - 149 assets valid, 0 missing, 0 invalid.
- `git diff --check` - passing with expected Windows line-ending warnings only.
- Mobile TypeScript is currently blocked in this cleaned Windows shell because the Expo/mobile dependency layer is absent (`expo/tsconfig.base` not found), and Expo web export should be re-run from Git Bash, WSL, CI, or a preinstalled dependency layer with `sh` available.

Latest local evidence, 2026-06-25:

- Root `preinstall` now uses the cross-platform Node guard `scripts/enforce-pnpm-install.mjs` instead of `sh -c`, so Windows package/export attempts are no longer stopped by a missing Unix shell before Expo can run.
- The guard still removes forbidden `package-lock.json` and `yarn.lock` files and still rejects npm/yarn installs by checking `npm_config_user_agent`.
- Static mobile readiness now protects this package/export prerequisite because the two-day beta depends on another environment being able to install and export the mobile app.
- Red/green evidence: `mobileReadiness.test.ts` first failed because `scripts/enforce-pnpm-install.mjs` did not exist, then passed with 79 tests after the guard and package script were wired.
- Direct guard verification passed with `npm_config_user_agent=pnpm/9.0.0` and failed as expected with `npm_config_user_agent=npm/10.0.0`.
- Follow-up verification passed the 101-test targeted beta QA/readiness suite, the 402-test focused behavior/readiness suite, PixelLab verification at 149 files, and `git diff --check` with expected Windows line-ending warnings only.
- Mobile TypeScript remains blocked in this cleaned Windows shell because the Expo/mobile dependency layer is absent (`expo/tsconfig.base` not found), local `pnpm` is still not on PATH here, and actual Expo export plus iOS/Android capture should be re-run from Replit, Git Bash/WSL with pnpm installed, CI after billing is fixed, or a native-device environment.

Latest local evidence, 2026-06-25:

- `artifacts/woofwatcher-mobile/app.json` now declares `ios`, `android`, and `web` platforms and sets `expo.web.bundler` to `metro`, matching the existing `smoke:web` script.
- Static mobile readiness now protects those Expo app config values inside the web export smoke wiring test.
- Red/green evidence: `mobileReadiness.test.ts` first failed on the missing app-config assertions, then passed with 79 tests after wiring.
- A direct package-local Expo CLI export attempt advanced past the previous `No platforms are configured to use the Metro bundler` error.
- The remaining direct-export stop is the dependency layer: `Cannot determine the project's Expo SDK version because the module 'expo' is not installed`.
- Expo web export is therefore config-ready but not dependency/export-proven in this cleaned Windows shell; rerun the smoke from Replit, Git Bash/WSL with pnpm installed, CI after billing is fixed, or any environment where the mobile package can resolve Expo.

Latest local evidence, 2026-06-25:

- Root `doctor:mobile-beta` now runs `scripts/mobile-beta-doctor.mjs` as the first two-day beta environment check.
- The doctor checks pnpm, the root install guard, mobile `smoke:web`, Expo iOS/Android/web + Metro config, mobile Expo dependency resolution, PixelLab verifier presence, and the `/care-twin-qa` owner-preview proof steps.
- Static mobile readiness protects the command plus proof language for `/care-twin-qa`, iOS/Android evidence, Mission note, and GitHub Actions boundaries.
- Red/green evidence: `mobileReadiness.test.ts` first failed on the missing doctor script, then passed with 80 tests after the command and script were wired.
- Direct doctor run in this cleaned Windows shell exits blocked with the expected current issues: missing local `pnpm` and missing mobile `expo` dependency resolution.

Latest local evidence, 2026-06-25:

- Root `package.json` now pins `packageManager: pnpm@10.24.0`, matching the pnpm version configured in `.github/workflows/verify.yml`.
- `scripts/mobile-beta-doctor.mjs` checks the root package-manager pin against the CI workflow before export handoff, so Replit, Corepack, local shells, and CI converge on the same pnpm target.
- Static mobile readiness protects the root `packageManager`, the workflow pnpm version, and the doctor source check.
- Red/green evidence: `mobileReadiness.test.ts` first failed on the missing root package-manager pin, then passed with 80 tests after the pin and doctor alignment check were wired.
- Direct doctor run in this cleaned Windows shell now passes `packageManager matches CI pnpm - pnpm@10.24.0 pinned`, while still blocking on the expected local environment issues: missing `pnpm` on PATH and missing mobile `expo` dependency resolution.

Latest local evidence, 2026-06-25:

- `scripts/mobile-beta-doctor.mjs` now prints Corepack-specific recovery guidance for the missing-pnpm blocker.
- The doctor treats Corepack as a warning-level bootstrap helper, not as a replacement for actual pnpm/export proof.
- Static mobile readiness protects `Corepack` and the exact `corepack prepare pnpm@10.24.0 --activate` command.
- Red/green evidence: `mobileReadiness.test.ts` first failed on missing Corepack guidance, then passed with 80 tests after the doctor was updated.
- Direct doctor run in this cleaned Windows shell now reports one Corepack warning, no change to the two true export blockers, and the exact pnpm activation command for helper environments where Corepack is available.

Latest local evidence, 2026-06-25:

- `scripts/mobile-beta-doctor.mjs` now checks the active runtime as `Node 24 runtime`.
- The doctor now reads `artifacts/woofwatcher-mobile/eas.json` and checks that preview and production EAS build profiles cover both iOS and Android.
- Static mobile readiness protects the Node 24 and EAS iOS/Android doctor contracts.
- Red/green evidence: `mobileReadiness.test.ts` first failed on missing `Node 24 runtime`, then passed with 80 tests after the doctor checks were added.
- Direct doctor run now passes Node 24 and EAS profile coverage, while still returning blocked for the two real local export issues: no `pnpm` on PATH and no mobile `expo` dependency resolution.
- Follow-up verification passed the 102-test targeted beta QA/readiness suite, the 403-test focused behavior/readiness suite, PixelLab verification at 149 files, and `git diff --check` with expected Windows line-ending warnings only.

Latest local evidence, 2026-06-25:

- `scripts/mobile-beta-doctor.mjs` now enforces the actual pnpm CLI version when a `pnpm` command is available.
- The doctor derives `expectedPackageManager` from `expectedPnpmVersion` so package-manager pinning and runtime CLI checks stay aligned.
- Static mobile readiness protects `expectedPnpmVersion` and the exact `pnpm.stdout.trim() === expectedPnpmVersion` comparison.
- Red/green evidence: `mobileReadiness.test.ts` first failed on missing exact pnpm version enforcement, then passed with 80 tests after the doctor check was added.
- The normal direct doctor run still reports the two true blockers in this shell: no `pnpm` command on PATH and no mobile `expo` dependency resolution.

Latest local evidence, 2026-06-26:

- `package.json` now exposes `doctor:mobile-beta:json` as
  `node scripts/mobile-beta-doctor.mjs --json`.
- The mobile beta doctor now suppresses human console rows in JSON mode and
  emits one parseable payload with `name`, `purpose`, `result`, `checks`,
  `issues`, `warnings`, and `nextActions`.
- Static mobile readiness protects the root script and executes the JSON doctor
  directly, then parses the output and verifies the current blocked state,
  Node 24 pass, EAS profile pass, Corepack warning, and next actions.
- Red/green evidence: `mobileReadiness.test.ts` first failed on the missing
  root JSON script, then passed with 81 tests after JSON mode was wired.
- Direct JSON doctor run in this cleaned Windows shell exits blocked as
  intended and reports the same two true issues: `pnpm available` and
  `mobile package can resolve expo`.

Latest local evidence, 2026-06-26:

- `scripts/mobile-beta-doctor.mjs --json` now source-validates the Owner
  Preview Care Pass storage proof chain.
- The JSON doctor reports `owner-preview Care Pass storage proof is
  source-backed` only when the release QA matrix still requires the Care Pass
  Report History storage-status proof, the native QA capture share text still
  carries route-check `Proof:` lines, and `/care-twin-qa` still renders the
  Owner route-loop proof text.
- Red/green evidence: `mobileReadiness.test.ts` first failed on the missing
  doctor check, then passed with 81 tests after the source-backed check was
  added.
- Direct JSON doctor run in this cleaned Windows shell still exits blocked on
  the two real export issues: missing `pnpm available` and missing
  `mobile package can resolve expo`.
- Follow-up verification passed the 102-test release QA/native capture/readiness
  suite, the 420-test zero-dependency behavior/readiness suite, PixelLab
  verification at 149 files, and `git diff --check` with expected Windows
  line-ending warnings only.

Latest local evidence, 2026-06-26:

- The one-tap 48-hour Beta Handoff packet now explicitly includes the Care Pass
  Report History storage-status proof in `Required beta proof after export`.
- The packet tells helpers to confirm Report History says `Saved on this
  device`, or `Ready to upload` only after structured provider storage proof is attached, so the
  storage truth check is visible even if a tester reads only the handoff packet
  and not the route-loop details.
- The mobile beta doctor's source-backed Owner Preview storage-proof guard now
  also checks `betaHandoffPacket.ts` for that required proof line.
- Red/green evidence: `betaHandoffPacket.test.ts` first failed on the missing
  handoff proof line, then passed after the packet and doctor guard were
  updated.
- Follow-up verification passed mobile readiness, the 420-test zero-dependency
  behavior/readiness suite, PixelLab verification at 149 files, and the direct
  JSON doctor still blocks only on missing pnpm and missing mobile Expo
  dependency resolution.

Latest local evidence, 2026-06-26:

- The one-tap 48-hour Beta Handoff packet now warns that dependency proof
  requires a real PATH `pnpm` at `10.24.0` and must not use a bundled
  `pnpm 11.x` candidate.
- The mobile beta doctor source-backed handoff check now requires that same
  warning before reporting `beta handoff source includes proof sections`.
- Red/green evidence: `betaHandoffPacket.test.ts` first failed on the missing
  bundled-pnpm warning, then passed after the packet and doctor guard were
  updated.
- Follow-up verification passed mobile readiness, the 420-test zero-dependency
  behavior/readiness suite, PixelLab verification at 149 files, `git diff
  --check`, and the direct JSON doctor still blocks only on missing pnpm and
  missing mobile Expo dependency resolution.

Latest local evidence, 2026-06-26:

- Saved Care Pass report artifacts now expose a dedicated export manifest for
  launch handoff and Records Report History.
- `describeCarePassArtifactExport` returns the printable HTML file name, MIME
  type, format label, byte size, source status, storage view, provider-backed
  truth flag, and an explicit `PDF export still needs native or
  provider-backed generation` detail.
- Records Report History now renders `Printable HTML`, calculated KB,
  `PDF pending`, provider/local storage state, and the PDF/native-provider
  boundary beside the existing resend and printable-source actions.
- The mobile beta doctor source-backed provider-storage check now validates the
  new export-helper route and `exportView.storage` wiring instead of the old
  direct storage-helper call.
- Red/green evidence: `care-pass.test.ts` first failed on the missing export
  helper, and `mobileReadiness.test.ts` first failed on missing Records export
  manifest wiring, then both passed after the domain/UI/doctor contract was
  aligned.
- Verification passed Care Pass tests, 81-test mobile readiness, the 421-test
  zero-dependency behavior/readiness suite, PixelLab verification at 149 files,
  direct JSON doctor source checks, and `git diff --check` with expected
  Windows line-ending warnings only.
- Direct JSON doctor still reports `BLOCKED` on the real local export issues:
  missing pnpm and missing mobile Expo dependency resolution.

Latest local evidence, 2026-06-26:

- The one-tap 48-hour Beta Handoff packet now includes the Care Pass export
  manifest proof line.
- The packet tells helpers to confirm Report History shows `Printable HTML`,
  file size, and `PDF pending` before claiming PDF readiness.
- The mobile beta doctor source-backed handoff and Owner Preview storage-proof
  checks now require that same proof line in `betaHandoffPacket.ts`.
- Red/green evidence: `betaHandoffPacket.test.ts` first failed on the missing
  manifest proof line, then passed after the packet and doctor guards were
  updated.
- Verification passed the beta handoff packet test, 81-test mobile readiness,
  direct JSON doctor source checks, the 421-test zero-dependency
  behavior/readiness suite, PixelLab verification at 149 files, and `git diff
  --check` with expected Windows line-ending warnings only.
- Direct JSON doctor still reports `BLOCKED` on the real local export issues:
  missing pnpm and missing mobile Expo dependency resolution.

Latest local evidence, 2026-06-26:

- The machine-readable mobile beta doctor now includes the same Care Pass export
  manifest proof as a `nextActions` item.
- JSON helpers now see: verify Records/Care Pass Report History shows
  `Printable HTML`, file size, and `PDF pending` before claiming PDF readiness.
- Red/green evidence: `mobileReadiness.test.ts` first failed on the missing
  JSON `nextActions` contract, then passed after `scripts/mobile-beta-doctor.mjs`
  was updated.
- Verification passed 81-test mobile readiness, the direct JSON doctor source
  check, the 421-test zero-dependency behavior/readiness suite, PixelLab
  verification at 149 files, and `git diff --check` with expected Windows
  line-ending warnings only.
- Direct JSON doctor still reports `BLOCKED` on the real local export issues:
  missing pnpm and missing mobile Expo dependency resolution.

Latest local evidence, 2026-06-26:

- The mobile beta doctor now emits explicit `truthBoundaries` in JSON mode and
  prints the same boundaries in human mode.
- The boundaries say `READY_FOR_EXPORT` covers dependency install/web export
  gates only, does not approve App Store, Play Store, native device QA, provider
  sync, storage, AI, payments, legal/privacy/support, or Apollo launch sign-off,
  and that `BLOCKED` means do not claim beta export readiness.
- Red/green evidence: `mobileReadiness.test.ts` first failed on the missing
  `truthBoundaries` payload, then passed after `scripts/mobile-beta-doctor.mjs`
  was updated.
- Verification passed 81-test mobile readiness, the direct JSON doctor output,
  the 421-test zero-dependency behavior/readiness suite, PixelLab verification
  at 149 files, and `git diff --check` with expected Windows line-ending
  warnings only.
- Direct JSON doctor still reports `BLOCKED` on the real local export issues:
  missing pnpm and missing mobile Expo dependency resolution.

Latest local evidence, 2026-06-26:

- The mobile beta doctor now source-validates the owner-readable Beta Handoff
  truth-boundary section before passing the machine-readable handoff guard.
- The protected chain requires the packet to keep the no-store-submission,
  provider-gated, non-diagnostic WoofGuide, and public-launch-separate-from-beta
  evidence boundaries aligned with the JSON `truthBoundaries` payload.
- Verification passed 81-test mobile readiness, direct JSON doctor output, the
  382-test zero-dependency behavior/readiness suite, PixelLab asset verification
  at 149 files, and `git diff --check` with expected Windows line-ending
  warnings only.
- Direct JSON doctor still reports `BLOCKED` on the real local export issues:
  missing pnpm and missing mobile Expo dependency resolution.

Latest local evidence, 2026-06-26:

- Local preview/export runtime is now a required QA gate before any Fable,
  Replit, device, or Apollo review handoff. The exported app must render at
  `http://127.0.0.1:4194/` without `ErrorFallback`, and DOM smoke must confirm
  Phoenix Home, Quick Log, Adventure, and Care Pass content.
- `pnpm --filter @workspace/woofwatcher-mobile run smoke:web` must pass after
  the Metro single-instance resolver patch.
- `pnpm run doctor:mobile-beta:json` may report `READY_FOR_EXPORT` only when the
  exact `pnpm@10.24.0` proof path is active. That status remains limited to
  dependency install and web export gates.
- Launch QA still requires native iOS and Android screenshots/evidence from
  `/care-twin-qa`, provider-backed configuration proof, store-account proof,
  legal/privacy/support approval, and Apollo sign-off before public release.

Latest local evidence, 2026-06-26:

- Quick Log QA must confirm launcher tiles communicate the action mode before
  a tester taps: routine/casual care tiles show `Tap log`, and medication,
  vomit/health context, and incident-style tiles show `Details`.
- Screen-reader traversal must hear labels and hints that match the real tap
  result. Detail-first tiles should say they open details and need context
  before saving.
- Focused proof passed through `quickLogEntry.test.ts` and
  `mobileReadiness.test.ts`; broader local proof passed the 383-test
  behavior/readiness suite and PixelLab verification at 149 files.

Latest local evidence, 2026-06-26:

- Phoenix Home QA must confirm quick care actions animate the main care twin,
  not a second dog or disconnected overlay.
- Care-event reactions are now source-backed by `careTwinReactionPolicy.ts`:
  meal served -> eat loop with outcome-pending copy, potty -> ear-perk bathroom
  attempt copy, water -> drink loop, walk -> walk loop, training/treat ->
  earned celebration, and vomit/symptom/incident -> calm review-oriented health
  reactions.
- Screen review should confirm the reaction bubble copy stays tied to real care
  value and does not introduce medical certainty.
- Focused proof passed through `careTwinReactionPolicy.test.ts` and
  `mobileReadiness.test.ts`.
- Broader local proof passed the `386`-test behavior/readiness suite and
  PixelLab verification at `ok=149 missing=0 invalid=0`.

## Quick Log Detail Sheet Owner-Preview Proof

Latest local evidence, 2026-06-27:

- Quick Log launcher tiles now have a compact detail sheet for long-press and
  detail-required actions.
- Meal detail presentation protects the served -> outcome lifecycle: quick log
  can serve the usual meal, and full details capture Ate all, Ate most, Ate some,
  Refused, or Still grazing.
- Potty detail presentation protects the parent/outcome model: Potty is the
  bathroom attempt, while pee, poop, both, accident, and tried-nothing are
  outcomes.
- Medication remains detail-first by policy, so the app asks for dose/status
  context before saving instead of treating it like a casual one-tap log.
- The latest mobile web preview was rebuilt to `.expo-smoke` and loaded at
  `http://127.0.0.1:4194/` without a fallback error.
- Verification passed `quickLogEntry.test.ts` 10/10, `mobileReadiness.test.ts`
  81/81, the 387-test behavior/readiness suite, PixelLab verifier
  `ok=149 missing=0 invalid=0`, Expo web export, and browser DOM smoke.

## Provider Launch Setup Next-Gate Proof

Latest local evidence, 2026-06-27:

- Provider Launch Setup now derives `openCount` and `nextGate` from the same
  source model used by Launch Readiness and share packets.
- More must show `Next provider gate` with owner, next action, and proof
  required when any production provider gate remains open.
- When all provider gates are ready, More must show the owner-review state
  instead of implying store approval.
- The share packet must include `Next Provider Gate` and the final boundary:
  provider setup is not App Store or Play Store approval.
- Red/green proof first failed on the missing next-gate model/UI, then passed
  `launchProviderSetup.test.ts` and `mobileReadiness.test.ts`.
- Broader local proof passed the 402-test behavior/readiness suite, mobile
  TypeScript, PixelLab verifier `ok=149 missing=0 invalid=0`, Expo web export
  to `.expo-smoke`, preview root `HEAD 200`, and focused QA route `HEAD 200`.

## Health Review Packet Share Proof

Latest local evidence, 2026-06-28:

- Health Watch now has a direct `Share review` action for the Health Review
  Packet, placed immediately after the non-diagnostic boundary copy.
- `buildHealthReviewPacketShareText` formats dog name, generated timestamp,
  status, safe language label, summary, suggested prompts, vet-share checklist,
  and boundary text into one owner-shareable packet.
- The packet explicitly says it organizes owner observations only and is not
  veterinary advice.
- Red/green proof first failed on the missing share helper/UI contract, then
  passed `healthReviewPacket.test.ts` and `mobileReadiness.test.ts`.
- Broader local proof passed the 403-test behavior/readiness suite, mobile
  TypeScript, PixelLab verifier `ok=149 missing=0 invalid=0`, package-local
  Expo web export to `.expo-smoke`, preview root `HEAD 200`, focused QA route
  `HEAD 200`, and `git diff --check` with expected Windows CRLF warnings only.

## Mood And Energy Trend Proof

Latest local evidence, 2026-06-28:

- Quick Log Mood now captures a structured mood, energy level, household
  visibility, care context, and optional sticky note.
- `deriveMoodTrend` lives in `lib/care-domain` so Records, future Care Pass
  text, and WoofGuide can share the same non-guessy formula.
- Records Mood Trend now shows average score, steady/watch status, energy mix,
  latest context, and a next step instead of a loose screen-local bar chart.
- A broad `origin/main` merge was tested and aborted because it conflicted
  across API, mobile routes, generated clients, binary avatar assets, and docs;
  this pass intentionally ported only the relevant mood/energy logic.
- Focused proof passed `care-domain.test.ts` and `mobileReadiness.test.ts`
  with 88/88 tests.
- Broader local proof passed the 405-test behavior/readiness suite,
  `tsc --build`, mobile TypeScript, PixelLab verifier
  `ok=149 missing=0 invalid=0`, package-local Expo web export to `.expo-smoke`,
  preview root `HEAD 200`, focused QA route `HEAD 200`, and `git diff --check`
  with expected Windows CRLF warnings only.

## Care Entries Incremental Sync Query Proof

Latest local evidence, 2026-07-04:

- `/care-entries` list queries now use a shared API normalizer before provider
  sync relies on incremental pulls.
- Valid `since` date-time strings preserve incremental household log reads, and
  `limit` still clamps to the safe 1-500 range.
- Malformed or blank `since` values now return a typed `400` with
  `Invalid since query. Use an ISO date-time string.` instead of silently
  widening to the full household care log.
- OpenAPI documents the invalid-query response, and API readiness protects the
  route/helper/spec/generated-client contract for `since`, `limit`, and the
  `400` error surface.
- Red/green proof first failed with `ERR_MODULE_NOT_FOUND` for the missing
  `care-entry-query.ts` helper, then passed after the helper and route wiring
  were added.
- Focused proof passed `careEntryQuery.test.ts` plus `apiReadiness.test.ts`
  with `19/19` tests. Broader proof passed the API/mobile/care-domain suite
  with `489/489` tests.
- API TypeScript passed after prepending bundled Node to `PATH`.
- JSON mobile beta doctor source-backed checks still pass, but the result
  remains truthfully `BLOCKED` only because local pnpm is `11.7.0` while the
  repo is pinned to `10.24.0`.
- API build remains locally blocked by the existing dependency layer:
  `@esbuild/win32-x64` is missing from `node_modules`. Re-run after dependency
  install/build proof exists in a pinned `pnpm@10.24.0` environment.

## Care Entries Route Integration Proof

Latest local evidence, 2026-07-04:

- Care-entry route handlers now live behind an injectable
  `createCareEntriesRouter` factory. Production still wires the real Drizzle DB,
  Clerk auth helpers, household helpers, and Drizzle query operators.
- `careEntryRoutes.test.ts` starts an Express app with fake DB/auth dependencies
  and hits the real route handlers over HTTP.
- Route proof covers `/care-entries?updatedSince=` returning server cursor rows,
  ambiguous `since` plus `updatedSince` returning `400` before DB access,
  `/care-entries/tombstones?updatedSince=` returning delete tombstone rows, and
  invalid tombstone cursors returning `400` before DB access.
- The testability pass also made the `api-zod` runtime barrel explicit with
  `./generated/api.ts` while preserving named type-only aliases for generated
  model types.
- Red/green proof first failed because direct care-entry route imports pulled
  live DB/provider barrels and extensionless runtime imports, then passed after
  the factory seam and explicit runtime export were added.
- Focused API proof passed `apiReadiness.test.ts`, `careEntryRoutes.test.ts`,
  and `careEntryQuery.test.ts` with `25/25` tests. Broader proof passed the
  API/mobile/care-domain suite with `496/496` tests.
- `pnpm run typecheck:libs` and API TypeScript passed after prepending bundled
  Node and pnpm to `PATH`.
- Local API build remains blocked by missing `@esbuild/win32-x64` in
  `node_modules`; rerun in a dependency-complete pinned pnpm environment or use
  branch CI as build authority.

## Care Entries Refresh Cursor Boundary Proof

Latest local evidence, 2026-07-04:

- Mobile care sync now routes care-entry refreshes through
  `buildCareEntryRefreshPlan` before calling `listCareEntries`.
- The current plan stays in `full` mode because `/care-entries?since=` filters
  by `occurredAt`, not a server update cursor, and there are no delete
  tombstones yet.
- `CareContext` keeps `hasUpdatedAtCursor: false` and
  `hasDeleteTombstones: false`, so future builders cannot silently turn the
  occurrence-time filter into fake provider sync readiness.
- The readiness boundary is explicit:
  `Full care-entry refresh required until the API exposes an updatedAt cursor
  and delete tombstones.`
- Red/green proof first failed because `careSync.ts` did not export
  `buildCareEntryRefreshPlan`, then passed after the helper and CareContext
  wiring were added.
- Focused proof passed `careSync.test.ts` plus `mobileReadiness.test.ts` with
  `126/126` tests. Broader proof passed the API/mobile/care-domain suite with
  `490/490` tests.
- Mobile TypeScript passed after prepending bundled Node to `PATH`.
- Expo web export smoke passed to `.expo-smoke` with `219` assets and `223`
  files.
- JSON mobile beta doctor source-backed checks still pass, but the result
  remains truthfully `BLOCKED` only because local pnpm is `11.7.0` while the
  repo is pinned to `10.24.0`.

## Care Entries Server Cursor And Tombstone Contract Proof

Latest local evidence, 2026-07-03:

- `care_entries` now has a server-owned `updatedAt` cursor in the Drizzle schema.
- `/care-entries?updatedSince=` is documented, validated, generated-client typed,
  and routed through the API list query without changing the existing
  occurrence-time `/care-entries?since=` behavior.
- The list query rejects ambiguous `since` plus `updatedSince` requests with
  `Use either since or updatedSince for care-entry sync, not both.`
- Care-entry deletes now write `care_entry_tombstones` rows with the deleted
  entry id, pet id, deleting user, delete time, and update cursor.
- `/care-entries/tombstones?updatedSince=` is authenticated, household-scoped,
  OpenAPI documented, Zod-validated, and exposed in the generated React client.
- Red/green proof first failed on missing `updatedSince`, `updatedAt`,
  tombstone route/schema, and generated-client coverage, then passed after the
  server contract was added.
- Focused API proof passed `careEntryQuery.test.ts` plus
  `apiReadiness.test.ts` with `21/21` tests. Broader proof passed the
  API/mobile/care-domain suite with `492/492` tests.
- Library TypeScript, API TypeScript, and mobile TypeScript passed after
  prepending bundled Node and pnpm to `PATH`.
- Expo web export smoke passed to `.expo-smoke` with `219` assets and `223`
  files.
- JSON mobile beta doctor source-backed checks still pass, but the result
  remains truthfully `BLOCKED` only because local pnpm is `11.7.0` while the
  repo is pinned to `10.24.0`.
- Local API build remains blocked by missing `@esbuild/win32-x64` in
  `node_modules`; rerun in a dependency-complete pinned pnpm environment or use
  branch CI as build authority.

## Provider Launch Setup Cursor/Tombstone Proof Handoff

Latest local evidence, 2026-07-03:

- Provider Launch Setup now makes the Household database sync gate actionable
  for the server cursor/tombstone contract instead of using generic database
  readiness copy.
- The proof row requires a Supabase project id, applied migrations/backfill for
  `care_entries.updated_at` and `care_entry_tombstones`, active-household RLS
  proof for `/care-entries?updatedSince=` and
  `/care-entries/tombstones?updatedSince=`, backup plus
  retention/export/deletion policy, and mobile full-refresh sign-off until
  incremental adoption is verified.
- The beta handoff packet includes the same Provider Launch Setup proof row, so
  Apollo/Replit sees the provider work required before mobile can stop using
  full care-entry refresh.
- Red/green proof first failed on the missing cursor/tombstone proof language
  in `launchProviderSetup.test.ts`, then passed after the provider setup model
  was updated.
- Focused mobile proof passed `launchProviderSetup.test.ts`,
  `betaHandoffPacket.test.ts`, and `mobileReadiness.test.ts` with `120/120`
  tests. Broader proof passed the API/mobile/care-domain suite with `492/492`
  tests.
- Mobile TypeScript passed after prepending bundled Node and pnpm to `PATH`;
  the first attempt failed because pnpm's child process could not find `node`.
- Expo web export smoke passed to `.expo-smoke` with `219` assets and `223`
  files.
- JSON mobile beta doctor source-backed checks still pass, but the result
  remains truthfully `BLOCKED` only because local pnpm is `11.7.0` while the
  repo is pinned to `10.24.0`.

## Care Entry Provider Sync Proof Packet

Latest local evidence, 2026-07-03:

- `careEntryProviderSyncProof.ts` now turns the care-entry provider launch gate
  into a structured packet with six proof items: Supabase project, migration
  and backfill, active-household RLS, retention/export/deletion,
  dependency-complete build, and mobile incremental sign-off.
- The packet requires proof for `care_entries.updated_at`,
  `care_entry_tombstones`, `/care-entries?updatedSince=`,
  `/care-entries/tombstones?updatedSince=`, backup/retention/export/deletion
  policy, and full-refresh mobile sign-off before incremental care-entry sync
  can be reviewed.
- Provider Launch Setup now includes the packet checklist in the Household
  database sync row, More shows the proof steps under the next provider gate,
  and Share Beta Handoff carries the same checklist for Apollo/Replit handoff.
- Red/green proof first failed because `careEntryProviderSyncProof.ts` and the
  provider checklist wiring did not exist, then passed after the packet model
  and More/provider/beta handoff wiring were added.
- Focused proof passed `careEntryProviderSyncProof.test.ts`,
  `launchProviderSetup.test.ts`, `betaHandoffPacket.test.ts`, and
  `mobileReadiness.test.ts` with `123/123` tests. Broader proof passed the
  API/mobile/PWA/care-domain suite with `514/514` tests.
- Mobile TypeScript, `pnpm run typecheck:libs`, and API TypeScript passed after
  prepending bundled Node and pnpm to `PATH`.
- Expo web export smoke passed to `.expo-smoke` with `219` assets and `223`
  files.
- JSON mobile beta doctor source-backed checks still pass, but the result
  remains truthfully `BLOCKED` only because local pnpm is `11.7.0` while the
  repo is pinned to `10.24.0`; Corepack is not on PATH.
- This is a provider proof checklist, not provider approval. Mobile incremental
  care-entry sync remains blocked until actual Supabase migration/RLS/retention
  evidence and native QA proof are attached.

## Care-Entry Provider Sync Proof Manifest

Latest local evidence, 2026-07-03:

- `/care-twin-qa?qaSurface=care-entry-provider-sync-proof` now renders a focused
  Care-entry provider sync proof manifest using the existing
  `deriveCareEntryProviderSyncProof` packet.
- The manifest shows proof progress, `Incremental sync allowed: No`, every
  Supabase project, migration/backfill, active-household RLS,
  retention/export/deletion, dependency-complete build, and mobile incremental
  sign-off row, plus blockers and the full-refresh boundary.
- Red/green proof first failed because the focused QA route did not import or
  render the manifest, then failed again because the JSON mobile beta doctor did
  not report `care-entry provider sync proof manifest is source-backed`.
- Focused proof now passes `careEntryProviderSyncProof.test.ts` and
  `mobileReleaseQa.test.ts` with `28/28` tests, plus the focused care-twin QA
  route and machine-readable doctor readiness run with `114/114` tests. Direct
  JSON mobile beta doctor reports `care-entry provider sync proof manifest is
  source-backed` as `PASS` while remaining blocked only on local pnpm/Corepack.
- This clears only source-backed helper visibility for the provider-sync proof
  packet. It does not run Supabase migrations, approve RLS, configure
  retention/export/deletion, enable incremental sync, replace native proof, or
  replace Apollo sign-off.

## WoofGuide AI Provider Proof Manifest

Latest local evidence, 2026-07-03:

- `/care-twin-qa?qaSurface=woofguide-ai-provider-proof` now renders a focused
  WoofGuide AI provider proof manifest using `buildAiProviderProofManifest`.
- The manifest shows proof progress, `Live AI allowed: No`, every OpenAI key
  storage, model policy, source/citation, owner-review write gate, veterinary
  safety, and fallback/incident row, plus blockers and the deterministic
  owner-reviewed boundary before live AI can be enabled.
- The manifest now rejects generic approval strings. `Live AI allowed` remains
  `No` until six structured proof files are attached: OpenAI secret storage,
  approved model policy, source/citation rules, owner-review write gate,
  veterinary safety boundary, and fallback/incident handling. Each file needs
  proof naming, acceptable MIME, positive byte size, required policy fields, and
  the row-specific safety booleans.
- Structured-proof hardening verification first failed because generic
  provider/model/source/write-gate/veterinary/fallback approval strings made the
  manifest `ready-for-review` without proof files. After the fix, focused AI
  provider proof tests passed `3/3`, and targeted AI proof plus mobile readiness
  passed `117/117`.
- Red/green proof first failed because `buildAiProviderProofManifest` did not
  exist, then failed again because the focused QA route did not import or render
  the manifest, then failed again because the JSON mobile beta doctor did not
  report `woofguide ai provider proof manifest is source-backed`.
- Focused proof now passes `aiProviderProof.test.ts` `3/3`, targeted AI proof
  plus mobile readiness and release-QA tests with `143/143`, and the broader
  zero-dependency API/mobile/PWA/care-domain suite with `572/572`. Root
  TypeScript passes, PixelLab asset verification passes with `ok=149
  missing=0 invalid=0`, and `git diff --check` passes with expected Windows
  CRLF warnings only.
- Direct JSON mobile beta doctor reports `woofguide ai provider proof manifest
  is source-backed` as `PASS` while remaining blocked only on local
  pnpm `11.7.0` versus pinned `10.24.0` plus missing Corepack. Direct JSON
  native QA tooling doctor remains blocked because this Windows shell lacks
  Android `adb`, Android `emulator`, Java, `ANDROID_HOME`/`ANDROID_SDK_ROOT`,
  and `JAVA_HOME`.
- This clears only source-backed helper visibility for the WoofGuide AI proof
  packet. It does not configure OpenAI, approve a model policy, enable live AI,
  allow automatic care-log writes, replace citation/source review, clear
  veterinary safety approval, or replace Apollo sign-off.

## Push Notifications Provider Proof Manifest

Latest local evidence, 2026-07-03:

- `/care-twin-qa?qaSurface=push-notifications-proof` now renders a focused Push
  notifications proof manifest using `buildPushNotificationsProofManifest`.
- The manifest shows proof progress, `Reminder delivery allowed: No`, every
  Expo push project config, APNs credentials, Firebase/FCM credentials,
  permission prompt/preference copy, quiet-hours/opt-out, and reminder delivery
  QA row, plus blockers and the local Reminder Center boundary before push
  reminder delivery can be claimed.
- The APNs, FCM, and delivery QA rows now require platform/provider-specific
  native delivery evidence before reminder delivery can open: iOS APNs and
  Android FCM files or URIs with image MIME, positive byte size, token
  registration, delivered reminder, permission preference, quiet-hours or
  opt-out, and fallback capture. Generic APNs/FCM/delivery strings stay
  blocked.
- Red/green proof first failed because `buildPushNotificationsProofManifest`
  did not exist.
- Native-delivery hardening proof then failed because generic APNs/FCM/delivery
  strings incorrectly made the manifest `ready-for-review`.
- Focused proof now passes `pushNotificationsProof.test.ts` and
  `mobileReleaseQa.test.ts` with `27/27` tests, and the native-delivery
  hardening plus handoff/readiness proof passes focused `148/148` tests. The
  broader zero-dependency API/mobile/PWA/care-domain suite passes `567/567`,
  root TypeScript passes, and mobile TypeScript passes.
- Branch CI proved the native-delivery hardening implementation in
  `WoofWatcher Verify` run `28695138006`, job `85103354696`, on commit
  `1772aed`; Setup pnpm, Setup Node, install dependencies, JSON mobile beta
  doctor, focused behavior tests, and Typecheck plus CI-safe builds all passed.
- Direct JSON mobile beta doctor reports `push notifications proof manifest is
  source-backed` as `PASS` while remaining blocked only on local
  pnpm/Corepack. Direct JSON native QA tooling doctor remains blocked because
  this Windows shell lacks Android `adb`, Android `emulator`, Java,
  `ANDROID_HOME`/`ANDROID_SDK_ROOT`, and `JAVA_HOME`.
- This clears only source-backed helper visibility for the push notifications
  proof packet. It does not configure Expo push, APNs, Firebase/FCM, prove iOS
  or Android delivery, approve prompt/legal copy, enable reminders, or replace
  Apollo sign-off.

## Release Smoke Checklist Handoff

Latest local evidence, 2026-07-03:

- `mobileReleaseSmokeChecklist.ts` now builds one source-backed release
  rehearsal for Apollo/Replit helpers before Share Beta Handoff is treated as
  current proof.
- The checklist covers dependency/export commands, route rehearsal, Records
  local-file export truth for `WoofWatcherReports` and
  `WoofWatcherCredentials`, provider proof gates, native/store proof, and truth
  boundaries.
- Share Beta Handoff now embeds the checklist, including the static
  `preview:smoke` proof command, the `/care-twin-qa` QA-return route, Care Pass
  Report History `Printable HTML local file`/`PDF pending` copy, Dog ID
  `local HTML credential file`/`SVG image source`/`generated PDF/PNG proof remains separate`
  copy, and the
  care-entry provider sync proof packet.
- `/care-twin-qa?qaSurface=records-local-file-handoff` is now the focused
  Records local-file proof mission for Care Pass Report History local HTML, Dog
  ID local HTML, Dog ID SVG image source, share-sheet behavior, Android content
  URI, and fallback copy. This is a proof checklist only; real iOS/Android
  evidence still has to be attached before treating Records handoff proof as
  device-verified.
- The focused route now renders a source-backed `Records local file handoff
  proof manifest` before Evidence Capture, with ready/open counts, `Native file
  proof allowed: No`, item evidence rows, blockers, and the generated
  PDF/PNG/provider boundary.
- The JSON mobile beta doctor now checks `release smoke checklist is
  source-backed` and includes `Release smoke checklist` in
  `handoffProofSections`.
- Red/green proof first failed with `ERR_MODULE_NOT_FOUND` for
  `mobileReleaseSmokeChecklist.ts`, then passed after the helper and handoff
  wiring were added.
- Focused proof passed `mobileReleaseSmokeChecklist.test.ts`,
  `betaHandoffPacket.test.ts`, and `mobileReadiness.test.ts` with `116/116`
  tests. Broader proof passed the API/mobile/PWA/care-domain suite with
  `515/515` tests.
- Mobile TypeScript, `pnpm run typecheck:libs`, API TypeScript,
  `git diff --check`, and Expo web export smoke passed after prepending bundled
  Node and pnpm to `PATH`; the export produced `219` assets and `223` files in
  `.expo-smoke`.
- Static preview route smoke returned `200` for `/`, `/more`, `/care-twin-qa`,
  `/records`, and `/woofguide`.
- JSON mobile beta doctor source-backed checks all pass, but the result remains
  truthfully `BLOCKED` only because local pnpm is `11.7.0` while the repo is
  pinned to `10.24.0`; Corepack is not on PATH.
- This checklist is rehearsal proof, not provider approval, generated PDF/image
  export, native iOS/Android QA proof, store approval, public launch, or Apollo
  sign-off.

## Report Binary Export Proof Packet

Latest local evidence, 2026-07-03:

- `reportBinaryExportProof.ts` now models the exact proof packet required before
  Care Pass PDF or Dog ID PNG readiness can be claimed: approved PDF generator,
  approved PNG renderer, provider storage handoff, and native artifact proof.
- Provider Launch Setup's Records and media storage gate includes that packet in
  `proofRequired` and `proofChecklist`, and Share Provider Plan text carries the
  same requirements for Apollo/Replit handoff.
- The Release Smoke Checklist and JSON mobile beta doctor verify the packet is
  source-backed while keeping local PDF/PNG generation separate from native and
  provider readiness.
- Records Report History now renders a `Binary proof manifest` for each saved
  Care Pass artifact. Confirm it names the current Care Pass HTML source, Dog ID
  SVG source, provider storage state, and iOS/Android evidence blockers before
  any helper claims generated PDF/PNG readiness.
- `/care-twin-qa?qaSurface=report-binary-export-proof` now gives the packet a
  focused native QA target that must collect local PDF/PNG file name, file size,
  MIME, share/reopen proof, structured provider storage proof, and iOS/Android artifact
  evidence before binary readiness.
- The focused route now renders the `Report binary export proof manifest`
  before Evidence Capture, with ready/open counts, `Generated artifacts
  allowed: No`, Care Pass PDF, Dog ID PNG, provider storage, native artifact
  proof rows, blockers, and the native/provider/Apollo approval boundary.
- The manifest now requires `4/4 native proofs ready` before generated binary
  readiness can open: iOS Care Pass PDF, Android Care Pass PDF, iOS Dog ID PNG,
  and Android Dog ID PNG. A generic native artifact approval flag is not enough;
  each artifact proof needs platform/artifact naming in the file name or URI,
  expected MIME type, positive byte size, share proof, and reopen proof.
- Red/green proof first failed on the missing helper/provider/checklist/doctor
  wiring, then passed focused report/provider/smoke/readiness tests `120/120`.
- Fresh local verification also passed the broader API/mobile/PWA/care-domain
  suite `520/520`, mobile TypeScript, and `tsc --build`.
- JSON mobile beta doctor source-backed checks pass, including `report binary
  export proof packet is source-backed`, but the result remains truthfully
  `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to
  `10.24.0`; Corepack is not on PATH.
- Follow-up proof-target verification first failed on the missing QA surface,
  beta handoff instruction, release smoke item, and doctor guard, then passed
  focused mobile release/beta/smoke/readiness tests `133/133`, the broader
  API/mobile/PWA/care-domain suite `521/521`, mobile TypeScript, and `tsc
  --build`.
- Focused manifest verification first failed on missing route manifest wiring
  and the missing JSON doctor guard, then passed focused care-twin route and
  machine-readable doctor readiness tests `114/114`, the full zero-dependency
  API/mobile/PWA/care-domain suite `559/559`, root TypeScript, mobile
  TypeScript, and `git diff --check` with expected Windows CRLF warnings only.
- Native-proof hardening verification passed focused report-binary plus
  machine-readable doctor tests `119/119`, direct JSON mobile beta doctor
  source-backed checks, the full zero-dependency API/mobile/PWA/care-domain
  suite `562/562`, root TypeScript, and mobile TypeScript.
- Branch CI proved the native-proof hardening in `WoofWatcher Verify` run
  `28693395380`, job `85098728807`, on commit `41de898`; Setup pnpm, Setup
  Node, install, JSON mobile beta doctor, focused behavior tests, and Typecheck
  plus CI-safe builds all passed.
- Branch CI proved the focused manifest guard in `WoofWatcher Verify` run
  `28691498890`, job `85093511875`, on commit `822ff54`; Setup pnpm, Setup
  Node, install, JSON mobile beta doctor, focused behavior tests, and Typecheck
  plus CI-safe builds all passed.
- This is a proof packet, not binary export implementation. Actual Care Pass PDF
  generation, Dog ID PNG generation, provider-backed storage, four-slot
  iOS/Android artifact proof, and launch approval remain blocked until real
  evidence exists.

Latest follow-up local evidence, 2026-07-04:

- The focused `/care-twin-qa?qaSurface=report-binary-export-proof` mission now
  consumes saved Provider Launch Setup storage proof through
  `deriveLaunchProviderSetup(state.launchProviderProfile)`.
- The focused route forwards saved `storageProviderEvidence` into
  `buildReportBinaryExportProofManifest`, matching Records Report History's
  storage-proof path while preserving all binary/native/provider blockers.
- Red-first verification failed on the missing `useCare` and
  `deriveLaunchProviderSetup` wiring, then passed focused
  report-binary/provider/mobile readiness tests `126/126`.
- Mobile TypeScript, root TypeScript, the full zero-dependency
  API/mobile/PWA/care-domain suite `594/594`, direct JSON mobile beta doctor
  source-backed checks, and `git diff --check` passed. The JSON doctor remains
  truthfully `BLOCKED` only because local pnpm is `11.7.0` while the repo pins
  `10.24.0` and Corepack is not on PATH.
- This does not prove native iOS/Android PDF/PNG share/reopen, configure
  provider storage, upload artifacts, satisfy store review, launch publicly, or
  replace Apollo sign-off.

Latest follow-up local evidence, 2026-07-06:

- More's Launch Readiness attachment queue now consumes the same saved Provider
  Launch Setup storage proof path as Records, Privacy, and the focused Report
  Binary Export helper.
- `deriveAttachmentManifest` in More receives
  `launchProviderSetupPlan.providerInput.storageProviderConfigured` and saved
  `storageProviderEvidence` instead of a forced
  `{ storageProviderConfigured: false }` option.
- Red-first mobile readiness failed on the old hardcoded false path, then
  passed `114/114` after implementation.
- Focused attachment/provider/mobile readiness tests passed `127/127`.
- Mobile TypeScript, root TypeScript, the full zero-dependency
  API/mobile/PWA/care-domain suite `594/594`, and direct JSON mobile beta
  doctor source-backed checks passed. The JSON doctor remains truthfully
  `BLOCKED` only because local pnpm is `11.7.0` while the repo pins `10.24.0`
  and Corepack is not on PATH.
- This does not perform provider upload, create object ids, prove native
  share/reopen, satisfy store review, launch publicly, or replace Apollo
  sign-off.

Latest Store Screenshot QA follow-up local evidence, 2026-07-06:

- Store Screenshot QA now consumes the saved Provider Launch Setup, Support
  Runbook, and attachment-storage proof paths before building the Store
  Submission screenshot checklist.
- `/care-twin-qa` derives `launchProviderSetupPlan`, `launchSupportPlan`, and
  `attachmentManifest` from saved care state, then forwards provider
  proof-ready flags, support/legal proof variables, and
  `attachmentManifest.launchQueue` into `storeLaunchReadinessPlan`.
- `nativeQa` remains `null`, so the packet is still store-prep evidence only
  and cannot approve native screenshots, App Store or Play review, public
  launch, or Apollo sign-off.
- Red-first mobile readiness failed because `/care-twin-qa` lacked
  `deriveAttachmentManifest`/`deriveSupportRunbookPlan` and still hardcoded
  store provider gates false, then passed `114/114` after implementation.
- The focused attachment/launch-provider/support/store/mobile QA suite passed
  `177/177`.
- Mobile TypeScript, root TypeScript, the full zero-dependency
  API/mobile/PWA/care-domain suite `594/594`, and direct JSON mobile beta
  doctor source-backed checks passed. The JSON doctor remains truthfully
  `BLOCKED` only because local pnpm is `11.7.0` while the repo pins `10.24.0`
  and Corepack is not on PATH.
- This does not attach real proof files, perform provider upload, create store
  accounts, prove native screenshots, satisfy store review, launch publicly, or
  replace Apollo sign-off.

## Mobile Runtime Route Smoke

Latest local evidence, 2026-07-03:

- `artifacts/woofwatcher-mobile/scripts/smoke-runtime-preview.js` now starts a
  disposable localhost static server over `.expo-smoke`, requests the exported
  mobile routes, verifies each route returns `200` HTML with the Expo web entry
  script, and closes the server in `finally`.
- The protected route set is `/`, `/log`, `/calendar`, `/health`, `/records`,
  `/more`, `/care-twin-qa`, `/woofguide`, `/premium`, `/privacy`, and
  `/portrait`.
- The mobile package exposes `pnpm --filter @workspace/woofwatcher-mobile run
  smoke:runtime`; root `build:ci` runs it immediately after mobile `smoke:web`.
  Share Beta Handoff, the Release Smoke Checklist, and the JSON mobile beta
  doctor list the same command.
- Red/green proof first failed because the package script, runtime smoke
  script, doctor proof command, and checklist command were missing, then passed
  after the command and source-backed checks were added.
- Focused proof passed `mobileReadiness.test.ts`,
  `mobileReleaseSmokeChecklist.test.ts`, and `betaHandoffPacket.test.ts` with
  `117/117` tests. Broader proof passed the API/mobile/PWA/care-domain suite
  with `516/516` tests.
- Mobile TypeScript, `pnpm run typecheck:libs`, and API TypeScript passed after
  prepending bundled Node and pnpm to `PATH`. Expo web export smoke produced
  `219` assets and `223` files in `.expo-smoke`.
- Direct runtime smoke passed for all 11 routes:
  `/`, `/log`, `/calendar`, `/health`, `/records`, `/more`, `/care-twin-qa`,
  `/woofguide`, `/premium`, `/privacy`, and `/portrait`.
- JSON mobile beta doctor source-backed checks pass, including `smoke:runtime
  route command exists` and `release smoke checklist is source-backed`, but the
  result remains truthfully `BLOCKED` only because local pnpm is `11.7.0` while
  the repo is pinned to `10.24.0`.
- This is exported web-runtime proof only. Native iOS/Android simulator or
  device rendering, provider approvals, generated PDF/image export, store
  approval, public launch, and Apollo sign-off remain blocked until real
  artifacts exist.

## CI Mobile Beta Doctor Gate

Latest local evidence, 2026-07-03:

- `.github/workflows/verify.yml` now runs `pnpm run doctor:mobile-beta:json`
  immediately after `pnpm install --frozen-lockfile` and before focused tests or
  `build:ci`.
- This means branch CI uses Node 24 plus the workflow-pinned `pnpm@10.24.0` to
  prove the same machine-readable dependency/export gate that Apollo, Replit, or
  a native helper sees in the Share Beta Handoff proof sequence.
- Red/green proof first failed because `verify.yml` did not include the JSON
  doctor command, then passed after the workflow step was added.
- Focused readiness proof passed `mobileReadiness.test.ts` with `113/113`
  tests after the workflow change.
- Dependency-complete branch CI proof passed in `WoofWatcher Verify` run
  `28653044937`, job `84975449140`, in 2m56s on
  `automation/premium-revenue-product-builder`; the workflow passed Setup pnpm,
  install, `pnpm run doctor:mobile-beta:json`, focused behavior tests, and
  `build:ci` with mobile `smoke:web` plus `smoke:runtime`.
- Direct local JSON doctor still reports `BLOCKED` only because this Windows
  shell exposes pnpm `11.7.0` while the repo is pinned to `10.24.0`; all
  source-backed checks pass, including release smoke checklist, owner preview
  proof wiring, `/care-twin-qa` proof flow, route smoke command, provider-aware
  Care Pass storage, and truth boundaries.
- This CI doctor gate does not prove native iOS/Android screenshots, provider
  setup, generated PDF/image export, app-store approval, public launch, or
  Apollo sign-off.

## Route Visual Proof Hardening

Latest local evidence, 2026-07-04:

- `buildRouteVisualProofManifest` now separates platform screenshot counts from per-route readiness. Generic files such as `native-ios-1.png` and `native-android-1.png` can increase attached counts, but they do not satisfy Home, Log, Plans, Health, Records, or More unless the file name or URI contains the route label.
- Red proof first failed because six generic iOS screenshots plus six generic Android screenshots incorrectly marked the manifest `ready`. After the fix, focused Route Visual tests passed `26/26`, focused care-twin route and machine-readable doctor readiness passed `114/114`, the full zero-dependency API/mobile/PWA/care-domain suite passed `560/560`, root TypeScript passed, mobile TypeScript passed, direct JSON mobile beta doctor source-backed checks passed, and `git diff --check` produced expected Windows CRLF warnings only.
- Branch CI proved the route-named guard in `WoofWatcher Verify` run `28691984899`, job `85094842263`, on commit `f273d3e`; Setup pnpm, Setup Node, install dependencies, JSON mobile beta doctor, focused behavior tests, Typecheck plus CI-safe builds, and post steps all passed.
- Share Beta Handoff, the Release Smoke Checklist, the Route Visual QA mission model, the mobile beta doctor, the native QA tooling doctor, the two-day beta plan, and the native QA matrix now tell helpers to name or save each Route Visual attachment with the route label and platform before attaching it. Focused handoff/smoke/checklist/readiness tests passed `144/144`, focused doctor readiness passed `114/114`, and the full zero-dependency suite passed `560/560`. Branch CI proved the capture-instructions slice in `WoofWatcher Verify` run `28692423522`, job `85096033279`, on commit `fd3a98f`.
- `scripts/native-qa-tooling-doctor.mjs --json` still reports `BLOCKED` in this Windows shell because Android `adb`, Android `emulator`, Java, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, and `JAVA_HOME` are missing. Route-named manifest proof does not replace native screenshots, route visual review, provider setup, generated PDF/image export proof, app-store approval, public launch, or Apollo sign-off.

## Share Beta Handoff Recorded CI Proof

Latest local evidence, 2026-07-03:

- More now passes `RECORDED_MOBILE_BETA_CI_PROOF` into
  `buildBetaHandoffPacketShareText`, so the shared packet carries recorded
  dependency-complete `WoofWatcher Verify` proof instead of only listing local
  commands.
- The handoff labels that evidence as recorded branch CI proof for run
  `28692423522`, job `85096033279`, branch
  `automation/premium-revenue-product-builder`, commit `fd3a98f`, duration
  `3m06s`, the proof URL, and the passed Setup pnpm, install, JSON doctor,
  focused behavior, and `build:ci` steps with `smoke:web`, `smoke:runtime`,
  `proof:live-preview`, provider-approved support/legal launch-readiness
  wiring, Premium payments proof manifest, Auth/Setup proof manifest, and Route
  Visual proof manifest plus route-named Route Visual capture instructions.
- The handoff now warns helpers to rerun `WoofWatcher Verify` after any new
  commit before treating dependency proof as current.
- Red/green proof first failed because `RECORDED_MOBILE_BETA_CI_PROOF` was not
  exported from `betaHandoffPacket.ts`, then passed after the recorded proof
  model, handoff formatting, More wiring, and doctor source guard were added.
- Fresh focused proof for the freshness boundary passed
  `betaHandoffPacket.test.ts` plus `mobileReadiness.test.ts` with `116/116`
  tests, and the broader API/mobile/PWA/care-domain suite passed `521/521`.
- Direct local JSON doctor source-backed checks now require the recorded run,
  job, commit, historical label, and rerun warning to stay present, but the
  result remains truthfully `BLOCKED` only because this Windows shell exposes
  pnpm `11.7.0` while the repo is pinned to `10.24.0`.
- Fresh refresh proof first failed because the machine-readable mobile beta
  doctor still expected the older recorded run while the packet named
  `28692423522` / `fd3a98f`, then passed focused beta handoff plus mobile
  readiness tests `117/117`, the full zero-dependency API/mobile/PWA/care-domain
  suite `560/560`, root TypeScript, mobile TypeScript, and `git diff --check`.
  JSON mobile beta doctor source-backed checks pass, including `recorded CI proof
  freshness boundary is source-backed`, and still block only on the local
  pnpm/Corepack mismatch.
- Branch CI proved the recorded-proof refresh itself in `WoofWatcher Verify` run
  `28692782500`, job `85096979911`, on commit `4254e05`; Set up job, Checkout,
  Setup pnpm, Setup Node, install dependencies, JSON mobile beta doctor, focused
  behavior tests, Typecheck plus CI-safe builds, post steps, and Complete job all
  passed. This is proof of the source-backed recorded-proof refresh and guard
  only; it still does not create actual native iOS/Android route screenshots,
  approve route visuals, satisfy store review, launch publicly, or replace Apollo
  sign-off.
- Branch CI also proved the recorded-proof verification-note commit in
  `WoofWatcher Verify` run `28692845687`, job `85097154144`, on commit
  `c742905`; JSON mobile beta doctor, focused behavior tests, and Typecheck plus
  CI-safe builds all passed. This docs proof update still requires the usual
  rerun-after-new-commit boundary.
- The 2026-07-04 Route Visual capture-instructions refresh updated
  `RECORDED_MOBILE_BETA_CI_PROOF` to run `28692423522` and kept
  `RECORDED_LIVE_PREVIEW_HANDOFF_PROOF` as a historical local `proof:live-preview` run
  generated `2026-07-03T22:21:21.304Z` on commit `0f60c22` from
  `http://127.0.0.1:60160/`, with `19/19` web-preview route shell checks and
  the web-preview-only boundary still explicit.
- This handoff proof does not approve native screenshots, provider setup,
  generated PDF/image export, app-store approval, public launch, or Apollo
  sign-off.

## Focused Auth/Setup Proof Manifest

Latest local evidence, 2026-07-04:

- `/care-twin-qa?qaSurface=auth-setup-onboarding-proof` now renders the
  `Auth/Setup proof manifest` before Evidence Capture, using the same
  source-backed manifest shown on the Auth gateway and Setup route.
- The focused manifest shows Clerk production app, redirect and deep links,
  native Auth screenshots, Setup local-preview proof, household sync boundary,
  and launch gate rows with ready/open counts, `Native proof allowed: No`,
  blockers, and the provider/native/Apollo boundary.
- The native Auth and Setup rows now require four platform-and-surface-specific
  image proofs before native proof can open: iOS Auth gateway, Android Auth
  gateway, iOS Setup local-preview, and Android Setup local-preview. Generic
  native approval flags no longer satisfy these rows without `nativeEvidence`
  carrying platform/surface naming, image MIME, positive byte size,
  provider-boundary copy, and reachable Setup controls.
- The provider rows now require structured proof files for Clerk production,
  redirect/deep-link URLs, household membership policy, and Apollo auth launch
  approval before the Clerk, redirect, household sync, or launch rows can become
  ready. Generic provider approval booleans only stage pending structured-proof
  row copy.
- Focused red/green proof first failed on the missing focused-route manifest
  and missing JSON doctor guard, then passed focused route/doctor readiness
  `114/114`.
- Native-proof hardening verification first failed because generic native
  approval booleans incorrectly made the manifest `ready`, then passed
  `authProviderProof.test.ts` `4/4`, focused Auth/Setup plus machine-readable
  doctor tests `118/118`, and direct JSON mobile beta doctor source-backed
  checks including `auth/setup proof manifest is source-backed`.
- Branch CI proved the native-proof hardening implementation in `WoofWatcher
  Verify` run `28694530592`, job `85101746726`, on commit `581b8b1`; Setup
  pnpm, Setup Node, install dependencies, JSON mobile beta doctor, focused
  behavior tests, and Typecheck plus CI-safe builds all passed.
- The full zero-dependency API/mobile/PWA/care-domain focused suite passed
  `557/557`; root TypeScript and mobile TypeScript both passed.
- Provider-proof hardening verification first failed because staged provider
  approval booleans plus complete native evidence made the manifest ready
  without proof files, then passed `authProviderProof.test.ts` `5/5`, focused
  Auth/Setup/release-QA/Share Beta Handoff/smoke/readiness tests `149/149`, the
  full zero-dependency API/mobile/PWA/care-domain suite `577/577`, root
  TypeScript, mobile TypeScript, direct JSON doctor source-backed checks, and
  `git diff --check`.
- Direct `scripts/mobile-beta-doctor.mjs --json` reports `auth/setup proof
  manifest is source-backed` as `PASS`, while remaining truthfully `BLOCKED`
  only because local pnpm is `11.7.0` and the repo is pinned to `10.24.0`.
- Branch CI also passed for commit `e8a1ea9` in `WoofWatcher Verify` run
  `28690620657`, job `85091134806`, in `3m18s`; Setup pnpm, Setup Node,
  install dependencies, JSON mobile beta doctor, focused behavior tests, and
  Typecheck plus CI-safe builds all passed for the focused Auth/Setup manifest
  guard.
- Direct `scripts/native-qa-tooling-doctor.mjs --json` still reports
  `BLOCKED` because this Windows shell lacks Android `adb`, Android `emulator`,
  Java, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, and `JAVA_HOME`; real iOS/Android
  Auth and Setup screenshots are still required.

## Payments Provider Proof Target

Latest local evidence, 2026-07-04:

- `/care-twin-qa?qaSurface=payments-provider-proof` is now a launch-critical
  focused mission for WoofWatcher Plus payments evidence before any paid
  checkout can be enabled.
- The target requires Plus and Family product ids, price/currency and trial
  decision, App Store/Google Play/Stripe or web billing path, sandbox purchase,
  renewal, cancel, refund, expired receipt, restore purchases, entitlement
  mapping, household role access, refund/support policy, and Apollo checkout
  approval.
- More's Provider Launch Setup maps the Plus payments row to `Open proof
  mission`, and Share Beta Handoff, the Release Smoke Checklist, the JSON mobile
  beta doctor, live-preview proof, and native QA tooling doctor all name the
  same target.
- Launch Readiness now keeps the WoofWatcher Plus tile in `Checkout approval
  open` review when payment provider proof is staged but store-account,
  privacy/legal, or support/refund approval is still missing. The tile does not
  say `Checkout ready` until those obligations are closed.
- Premium now shows a `Payments proof manifest` with Product catalog, Billing
  path decision, Sandbox receipts, Entitlements and restore, Refund and support
  policy, and Checkout gate rows. It keeps `Checkout disabled` visible and
  lists blockers until the real billing/provider proof and Apollo checkout
  approval are attached.
- `/care-twin-qa?qaSurface=payments-provider-proof` now also renders a focused
  `Payments provider proof manifest` with the same product catalog, billing
  path, sandbox receipts, entitlements/restore, refund/support, and checkout
  gate rows, ready/open counts, `Checkout allowed: No`, blockers, and the
  money-movement boundary before Evidence Capture.
- The manifest now keeps Sandbox receipts at `0/2 sandbox receipt proofs ready`,
  Entitlements and restore at `0/2 restore proofs ready`, and Checkout disabled
  when the old boolean approvals are true but iOS App Store and Android Google
  Play receipt evidence is missing. To open those rows, each JSON receipt proof
  must name the platform/store in the file name or URI, include a positive byte
  size, product id, transaction id, purchase, renewal, cancellation, refund,
  expiration, and `restorePurchaseConfirmed`.
- Focused proof passed `mobileReleaseQa.test.ts`,
  `betaHandoffPacket.test.ts`, `mobileReleaseSmokeChecklist.test.ts`, and
  `mobileReadiness.test.ts` with `138/138` tests. The broader mobile/PWA/care
  domain suite passed `506/506`.
- Direct `scripts/mobile-beta-doctor.mjs --json` reports `payments provider
  proof target is source-backed` as `PASS`, while remaining truthfully
  `BLOCKED` only because local pnpm is `11.7.0` and the repo is pinned to
  `10.24.0`.
- Direct `scripts/mobile-beta-doctor.mjs --json` also reports `premium
  payments proof manifest is source-backed` as `PASS`, proving the Premium
  route renders the manifest without enabling checkout.
- Direct `scripts/mobile-beta-doctor.mjs --json` now reports `payments provider
  proof manifest is source-backed` as `PASS`, proving the focused helper route
  renders the manifest without enabling checkout.
- Branch CI also passed for commit `12c63eb` in `WoofWatcher Verify` run
  `28690249414`, job `85090172228`, in `2m56s`; Setup pnpm, Setup Node,
  install dependencies, JSON mobile beta doctor, focused behavior tests, and
  Typecheck plus CI-safe builds all passed for the focused manifest guard.
- Direct `scripts/native-qa-tooling-doctor.mjs --json` lists the payments proof
  route in `nativeProofTargets`, but remains `BLOCKED` in this Windows shell
  because Android adb/emulator, Java, `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and
  `JAVA_HOME` are unavailable.
- Direct live-preview handoff proof was later refreshed after the support/legal
  readiness proof target landed and now passes `19/19` web-preview route shell
  checks, including `/care-twin-qa?qaSurface=payments-provider-proof` and
  `/care-twin-qa?qaSurface=support-legal-readiness-proof`, against the existing
  `.expo-smoke` export. This is web-preview proof only; it does not approve
  native screenshots, provider payments setup, sandbox receipts, money movement,
  store approval, public launch, or Apollo sign-off.
- Fresh local verification for the stricter receipt gate passed
  `paymentsProviderProof.test.ts`, `mobileReleaseQa.test.ts`,
  `betaHandoffPacket.test.ts`, `mobileReleaseSmokeChecklist.test.ts`, and
  `mobileReadiness.test.ts` with `148/148`, direct JSON mobile beta doctor
  source-backed checks including `payments provider proof target is
  source-backed` and `payments provider proof manifest is source-backed`, the
  full zero-dependency API/mobile/PWA/care-domain suite `569/569`, root
  TypeScript, and mobile TypeScript. Direct JSON mobile beta doctor remains
  `BLOCKED` only because local pnpm is `11.7.0` while the repo is pinned to
  `10.24.0`; direct native QA tooling doctor remains `BLOCKED` because Android
  `adb`, Android `emulator`, Java, `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and
  `JAVA_HOME` are unavailable.
- Branch CI proved the stricter receipt gate in `WoofWatcher Verify` run
  `28695703283`, job `85104771524`, on commit `b579885`; Setup pnpm, Setup
  Node, install dependencies, JSON mobile beta doctor, focused behavior tests,
  Typecheck plus CI-safe builds, post steps, and Complete job all passed in
  about `3m08s`.

## Store Accounts Proof Manifest

Latest local evidence, 2026-07-04:

- `buildStoreAccountsProofManifest` now keeps app submission blocked when only
  legacy text approvals are present.
- The manifest requires six structured proof files: iOS App Store Connect
  developer account proof, Android Google Play package proof, shared
  bundle/signing ownership proof, reviewer access proof, metadata/privacy proof,
  and Apollo release approval/no-submit-boundary proof.
- Each proof must include the expected platform/store naming, MIME, positive
  byte size, ids/roles/ownership fields, and approval booleans before its row
  becomes ready.
- Focused store/handoff/smoke/readiness tests passed `148/148`; the full
  zero-dependency API/mobile/PWA/care-domain suite passed `571/571`; root
  TypeScript, mobile TypeScript, and `git diff --check` passed.
- Direct JSON mobile beta doctor source-backed checks pass, including `store
  accounts proof packet is source-backed`, `store accounts proof target is
  source-backed`, and `store accounts proof manifest is source-backed`, while
  remaining blocked only on the local pnpm/Corepack mismatch.
- Branch CI proved commit `0c495a1` in `WoofWatcher Verify` run `28696518769`,
  job `85106928992`; JSON mobile beta doctor, focused behavior tests, and
  Typecheck plus CI-safe builds all passed.

Latest local evidence, 2026-07-03:

- `/care-twin-qa?qaSurface=store-accounts-proof` now renders a source-backed
  `Store accounts proof manifest` instead of only routing helpers to a generic
  store-account capture target.
- The manifest is built by `buildStoreAccountsProofManifest` and shows Apple
  Developer/App Store Connect access, Google Play package record,
  bundle/signing ownership, reviewer access/test credentials,
  screenshots/metadata ownership, privacy-label readiness, and release role
  approval evidence rows.
- The focused route shows ready/open counts, `App submission allowed: No`, the
  blocker list, and the store-submission boundary before Evidence Capture.
- Red/green proof first failed on the missing manifest builder, then failed on
  the missing focused-route manifest wiring, then failed on the missing JSON
  doctor guard before the implementation was completed.
- Focused Store Accounts proof plus release-QA proof tests passed `27/27`.
  Focused care-twin route and machine-readable doctor readiness tests passed
  `114/114`. The broader zero-dependency API/mobile/PWA/care-domain focused
  suite passed `555/555`, root TypeScript passed, mobile TypeScript passed, and
  `git diff --check` reported only expected Windows CRLF warnings.
- Direct `scripts/mobile-beta-doctor.mjs --json` reports `store accounts proof
  manifest is source-backed` as `PASS`, while remaining truthfully `BLOCKED`
  only because this Windows shell exposes pnpm `11.7.0` while the repo is pinned
  to `10.24.0` and Corepack is not on PATH.
- Direct `scripts/native-qa-tooling-doctor.mjs --json` remains `BLOCKED`
  because this Windows shell lacks Android `adb`, Android `emulator`, Java,
  `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and `JAVA_HOME`.
- This manifest does not create Apple or Google store accounts, approve
  metadata or screenshots, submit to App Review or Play review, clear legal or
  privacy approval, enable public launch, or replace Apollo sign-off.

## Records Local File Handoff Proof Manifest

Latest local evidence, 2026-07-04:

- `/care-twin-qa?qaSurface=records-local-file-handoff` now renders a
  source-backed `Records local file handoff proof manifest` instead of only
  routing helpers to a generic Records local-file capture target.
- The manifest is built by `buildRecordsLocalFileHandoffProofManifest` and
  shows Care Pass Report History local HTML, Dog ID local HTML credential, Dog
  ID SVG image source, native share-sheet behavior, Android content URI or
  saved-file proof, fallback copy, and generated PDF/PNG/provider boundary
  evidence rows.
- The native share-sheet rows now require six platform-and-file-specific proofs
  before native file proof can open: iOS Care Pass local HTML, Android Care Pass
  local HTML, iOS Dog ID local HTML, Android Dog ID local HTML, iOS Dog ID SVG
  image source, and Android Dog ID SVG image source. Generic `iOS and Android
  share sheets opened` notes stay blocked. Android content URI or saved-file
  proof requires `content://` or `file://` URI evidence for the Android file
  slots.
- The focused route shows ready/open counts, `Native file proof allowed: No`,
  the blocker list, and the local-file/native-proof boundary before Evidence
  Capture.
- Red/green proof first failed on the missing manifest builder, then failed on
  the missing focused-route manifest wiring, then failed on the missing JSON
  doctor guard before the implementation was completed.
- Focused report artifact export tests passed `7/7`. Focused care-twin route
  and machine-readable doctor readiness tests passed `114/114`. The broader
  zero-dependency API/mobile/PWA/care-domain focused suite passed `559/559`,
  root TypeScript passed, mobile TypeScript passed, and `git diff --check`
  reported only expected Windows CRLF warnings.
- Native-proof hardening verification first failed on generic native notes
  making the manifest `ready-for-review`, then passed
  `reportArtifactExportFile.test.ts` `8/8`, focused Records local-file plus
  machine-readable doctor tests `122/122`, the full zero-dependency
  API/mobile/PWA/care-domain suite `563/563`, root TypeScript, and mobile
  TypeScript.
- Direct `scripts/mobile-beta-doctor.mjs --json` reports `records local file
  handoff proof manifest is source-backed` as `PASS`, while remaining
  truthfully `BLOCKED` only because this Windows shell exposes pnpm `11.7.0`
  while the repo is pinned to `10.24.0` and Corepack is not on PATH.
- Direct `scripts/native-qa-tooling-doctor.mjs --json` remains `BLOCKED`
  because this Windows shell lacks Android `adb`, Android `emulator`, Java,
  `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and `JAVA_HOME`.
- Branch CI passed for commit `8268809` in `WoofWatcher Verify` run
  `28691115501`, job `85092467507`, in `3m1s`; Setup pnpm, Setup Node, install,
  JSON mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe
  builds all passed.
- Branch CI also proved the native-proof hardening guard in `WoofWatcher Verify`
  run `28693966672`, job `85100292756`, on commit `97fa65a` in about `3m7s`;
  Setup pnpm, Setup Node, install, JSON mobile beta doctor, focused behavior
  tests, Typecheck plus CI-safe builds, post steps, and Complete job all passed.
- This manifest does not prove native iOS or Android share sheets, Android
  content URI handoff, fallback copy, generated PDF/PNG readiness,
  provider-backed storage, cloud sync, public launch, or Apollo sign-off.

## Account Deletion Proof Manifest

Latest local evidence, 2026-07-03:

- `/care-twin-qa?qaSurface=account-deletion-proof` now renders a source-backed
  `Account deletion proof manifest` instead of only routing helpers to a generic
  account-deletion capture target.
- The manifest is built by `buildAccountDeletionProofManifest` and shows
  deletion route/auth, export-before-delete handoff, data/object deletion
  receipt, audit/support receipt, recovery/cancellation policy, and legal/store
  approval evidence rows.
- The focused route shows ready/open counts, `Destructive deletion allowed: No`,
  the blocker list, and the destructive-deletion boundary before Evidence
  Capture.
- Red/green proof first failed on the missing manifest builder, then failed on
  the missing focused-route manifest wiring, then failed on the missing JSON
  doctor guard before the implementation was completed.
- Focused Account Deletion proof plus release-QA proof tests passed `27/27`.
  Focused care-twin route and machine-readable doctor readiness tests passed
  `114/114`. The broader zero-dependency API/mobile/PWA/care-domain focused
  suite passed `556/556`, root TypeScript passed, mobile TypeScript passed, and
  `git diff --check` reported only expected Windows CRLF warnings.
- Direct `scripts/mobile-beta-doctor.mjs --json` reports `account deletion
  proof manifest is source-backed` as `PASS`, while remaining truthfully
  `BLOCKED` only because this Windows shell exposes pnpm `11.7.0` while the repo
  is pinned to `10.24.0`.
- Direct `scripts/native-qa-tooling-doctor.mjs --json` remains `BLOCKED`
  because this Windows shell lacks Android `adb`, Android `emulator`, Java,
  `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and `JAVA_HOME`.
- This manifest does not enable destructive deletion, delete provider data or
  storage objects, approve privacy/legal language, satisfy App Store or Play
  Store review, enable public launch, or replace Apollo sign-off.

Latest local evidence, 2026-07-04:

- The manifest now rejects generic approval strings. `Destructive deletion
  allowed` remains `No` until six structured proof files are attached:
  deletion-route/auth, export-before-delete, data/object deletion receipt,
  audit/support receipt, recovery/cancellation policy, and legal/store/Apollo
  approval.
- Each structured proof needs matching locator text, acceptable MIME, positive
  byte size, required row fields, and row-specific approval booleans before its
  row can become ready.
- Structured-proof hardening verification first failed because generic
  deletion-route/export/receipt/audit/recovery/legal strings made the manifest
  ready. After the fix, focused Account Deletion proof plus
  release-QA/handoff/smoke/readiness tests passed `148/148`, the broader
  zero-dependency API/mobile/PWA/care-domain suite passed `574/574`, root
  TypeScript passed, mobile TypeScript passed, and direct JSON doctor
  source-backed checks passed. Branch CI proved the implementation commit
  `49b0f47` in `WoofWatcher Verify` run `28697969135`, job `85110888132`, with
  JSON mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe
  builds all passing.
- Direct `scripts/mobile-beta-doctor.mjs --json` remains truthfully `BLOCKED`
  only because local pnpm is `11.7.0` while the repo is pinned to `10.24.0` and
  Corepack is not on PATH. Direct
  `scripts/native-qa-tooling-doctor.mjs --json` remains `BLOCKED` because this
  Windows shell lacks Android `adb`, Android `emulator`, Java,
  `ANDROID_HOME`/`ANDROID_SDK_ROOT`, and `JAVA_HOME`.
  Real provider deletion, storage/object deletion receipts, legal/privacy/store
  approval, public launch, and Apollo sign-off remain required.

## Support Legal Readiness Proof Manifest

Latest local evidence, 2026-07-04:

- `/care-twin-qa?qaSurface=support-legal-readiness-proof` now renders a
  source-backed `Support legal readiness proof manifest` instead of only
  routing helpers to a generic support/legal capture target.
- The manifest is built by `buildSupportLegalReadinessProofManifest` and shows
  structured proof rows for support inbox, privacy policy and terms links,
  refund/subscription policy, veterinary and emergency boundary, deletion
  escalation, incident response owner, and Apollo launch approval/no-launch
  boundary.
- The focused route shows ready/open counts, `Public launch allowed: No`, the
  blocker list, and the public-launch boundary before Evidence Capture.
- Red/green proof first showed generic support inbox/privacy-terms/refund/
  veterinary/deletion/incident/Apollo approval strings incorrectly making the
  manifest `ready-for-review` without proof files. After implementation, the
  manifest stays blocked until seven structured proof files include matching
  locator text, acceptable MIME, positive byte size, required row fields, and
  row-specific approval booleans.
- Focused support runbook proof tests passed `6/6`. Focused Support Legal plus
  release-QA/handoff/smoke/readiness tests passed `150/150`. The broader
  zero-dependency API/mobile/PWA/care-domain focused suite passed `576/576`,
  root TypeScript passed, and mobile TypeScript passed. Branch CI proved the
  implementation commit `4082e30` in `WoofWatcher Verify` run `28698684465`,
  job `85112820340`, with JSON mobile beta doctor, focused behavior tests, and
  Typecheck plus CI-safe builds all passing.
- Direct `scripts/mobile-beta-doctor.mjs --json` reports `support legal
  readiness proof manifest is source-backed` as `PASS`, while remaining
  truthfully `BLOCKED` only because this Windows shell exposes pnpm `11.7.0`
  while the repo is pinned to `10.24.0`.
- Direct `scripts/native-qa-tooling-doctor.mjs --json` remains `BLOCKED`
  because this Windows shell lacks Android `adb`, Android `emulator`, Java,
  `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and `JAVA_HOME`.
- Branch CI passed for commit `0489972` in `WoofWatcher Verify` run
  `28689927419`, job `85089300582`, in about `3m0s`; Setup pnpm, Setup Node,
  install, JSON mobile beta doctor, focused behavior tests, and Typecheck plus
  CI-safe builds all passed.
- This manifest does not approve legal or privacy copy, refund/subscription
  policy, support operations, veterinary-boundary language, App Store or Play
  Store review, public launch, or replace Apollo sign-off.

## Latest Automation Branch CI Proof

Latest evidence, 2026-07-06:

- GitHub Actions `WoofWatcher Verify` run `28836909561`, job `85522525710`,
  passed on `automation/premium-revenue-product-builder` commit `d21f44e`;
  Setup pnpm, Setup Node, install dependencies, JSON mobile beta doctor,
  focused behavior tests, and Typecheck plus CI-safe builds all completed
  successfully.
- Local proof-refresh verification passed beta handoff plus mobile readiness
  `117/117`, the full zero-dependency API/mobile/PWA/care-domain suite
  `594/594`, root TypeScript, mobile TypeScript, PixelLab verifier
  `ok=149 missing=0 invalid=0`, and `git diff --check`.
- Direct JSON mobile beta doctor remains truthfully `BLOCKED` only because
  local pnpm is `11.7.0` versus pinned `10.24.0` and Corepack is not on PATH.
- This updates dependency-complete branch proof only; it does not clear native
  iOS/Android proof, provider proof files, store review, public launch, or
  Apollo sign-off.

Latest local evidence, 2026-07-07:

- Privacy & Safety now forwards saved Provider Launch Setup AI, payments, and
  account-deletion proof evidence into the existing WoofGuide AI, payments, and
  deletion proof validators.
- Red/green verification first failed because `normalizeLaunchProviderProfile`
  stripped `aiProviderEvidence`; after implementation, focused
  provider/readiness tests passed `128/128`.
- The full zero-dependency API/mobile/PWA/care-domain suite passed `594/594`;
  root TypeScript passed; direct JSON mobile beta doctor reported
  `privacy provider proof evidence propagation is source-backed` as `PASS`;
  PixelLab asset verification passed `ok=149 missing=0 invalid=0`; and
  `git diff --check` passed with expected Windows CRLF warnings only.
- Direct JSON mobile beta doctor remains truthfully `BLOCKED` only because
  local pnpm is `11.7.0` versus pinned `10.24.0` and Corepack is not on PATH.
  This is local source-backed proof only until branch CI passes after the new
  commit.
- Branch CI proved the implementation commit `61ed6fd` in `WoofWatcher Verify`
  run `28844274663`, completed success in `3m17s` on
  `automation/premium-revenue-product-builder`. Rerun CI after this proof-record
  docs commit before treating dependency proof as current for the final branch
  tip.
- Branch CI then proved proof-record commit `a786f3f` in `WoofWatcher Verify`
  run `28844518727`, completed success in `3m14s` on
  `automation/premium-revenue-product-builder`.
- Reminder Center and `/care-twin-qa?qaSurface=push-notifications-proof` now
  consume saved Provider Launch Setup `pushNotificationsProofEvidence`.
  `LaunchProviderProfile` preserves the field through normalization and
  CareContext persistence, Calendar reads it through
  `buildReminderNotificationPreferencesForCenter`, and the focused helper route
  feeds it into `buildPushNotificationsProofManifest` instead of using an empty
  manifest.
- Focused provider/reminder/readiness tests passed `124/124`; the full
  zero-dependency API/mobile/PWA/care-domain suite passed `594/594`; root
  TypeScript, mobile TypeScript, direct JSON mobile beta doctor source-backed
  checks, and PixelLab verifier `ok=149 missing=0 invalid=0` passed.
- Direct JSON mobile beta doctor reports `push notification proof evidence
  propagation is source-backed` as `PASS`, while remaining truthfully `BLOCKED`
  only because local pnpm is `11.7.0` versus pinned `10.24.0` and Corepack is
  not on PATH. Branch CI proved commit `9d02eaa` in `WoofWatcher Verify` run
  `28852945785`, completed success in `3m16s` on
  `automation/premium-revenue-product-builder`.
- The focused Store Accounts proof mission now consumes saved Provider Launch
  Setup `storeAccountsProofEvidence`. `LaunchProviderProfile` preserves the
  field through normalization and CareContext persistence, and the focused
  helper route feeds it into `buildStoreAccountsProofManifest` instead of using
  an empty manifest.
- Focused provider/store/readiness tests passed `125/125`; the full
  zero-dependency API/mobile/PWA/care-domain suite passed `594/594`; root
  TypeScript, mobile TypeScript, direct JSON mobile beta doctor source-backed
  checks, and PixelLab verifier `ok=149 missing=0 invalid=0` passed.
- Direct JSON mobile beta doctor reports `store accounts proof evidence
  propagation is source-backed` as `PASS`, while remaining truthfully `BLOCKED`
  only because local pnpm is `11.7.0` versus pinned `10.24.0` and Corepack is
  not on PATH. Branch CI proved implementation commit `b5286de` in
  `WoofWatcher Verify` run `28863131822`, completed success in `3m6s` on
  `automation/premium-revenue-product-builder`. Rerun CI after this proof-record
  docs commit before treating dependency proof as current for the final branch
  tip.
- The focused Account Deletion proof mission now consumes saved Provider Launch
  Setup `accountDeletionEvidence`. The focused helper route feeds that saved
  deletion/legal proof evidence into `buildAccountDeletionProofManifest` instead
  of rendering an empty manifest.
- Red/green verification first failed on the hardcoded empty focused manifest,
  then mobile readiness passed `114/114`, the full zero-dependency
  API/mobile/PWA/care-domain suite passed `594/594`, root TypeScript and mobile
  TypeScript passed, PixelLab verifier passed `ok=149 missing=0 invalid=0`, and
  `git diff --check` passed with expected Windows CRLF warnings only. Direct
  JSON mobile beta doctor reports `account deletion proof evidence propagation
  is source-backed` as `PASS`, while remaining truthfully `BLOCKED` only because
  local pnpm is `11.7.0` versus pinned `10.24.0` and Corepack is not on PATH.
  Real destructive deletion, provider data/object deletion receipts, legal/store
  approval, public launch, and Apollo sign-off remain required.
