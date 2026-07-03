# WoofWatcher Two-Day Beta Ship Plan

Date: 2026-06-25

## Decision

The two-day target is an internal beta / owner-preview ship, not a public App Store or Play Store launch.

This keeps the product moving fast without pretending that provider credentials, Supabase migration/RLS, payments, legal/privacy approval, store accounts, or final native QA are already complete.

## Ship Target

Ship a polished Expo/PWA beta candidate that Apollo can preview, share with a small trusted tester group, and hand to design polish tools without losing the real care workflows.

The beta can include:

- Local-first Phoenix care workflows.
- Home, Log, Plans, Health, More, Adventure, Records, Reports, Care Pass, Avatar Studio, WoofGuide, and Launch Readiness.
- Meal served-to-outcome lifecycle.
- Potty parent/outcome model.
- Household pulse, Access Pass drafts, My Care Today, care logs, reminders, records, and report packets.
- PixelLab asset-backed care twin visuals and state-aware animation architecture.
- Release packet and store-prep packet that clearly say public launch is not approved yet.

The beta must not claim:

- App Store or Play Store approval.
- Provider-backed household sync if Supabase/Clerk/provider gates are not configured.
- Live payments.
- Live AI provider behavior without keys/policy.
- Live document/photo storage without approved storage rules.
- Veterinary diagnosis or treatment certainty.

## 48-Hour Priority Order

1. Keep the app compiling, exporting, and opening as an Expo/PWA beta.
2. Make Launch Readiness distinguish internal beta readiness from public launch readiness.
3. Capture or prepare the native iOS/Android QA path through `/care-twin-qa`.
4. Keep the core workflows navigable and fast: Home, Log, Plans, Health, More, and Adventure.
5. Preserve all truth boundaries around provider setup, payments, AI, storage, and store submission.
6. Commit and push each verified beta-shipping slice.

## Owner/Test Checklist

- Open the Expo/PWA beta on phone-size viewport.
- Visit Home, Log, Plans, Health, More, Adventure, Records, Avatar Studio, and Care Pass.
- From More, open Launch Readiness.
- Read the 48-hour beta card's next actions.
- Tap `Open QA Cockpit` if the card says device proof is still needed.
- Tap `Share Beta Handoff` when you need one owner-readable packet for Apollo, a helper, Fable, Replit, or a design-polish pass.
- If any target is marked `Needs tune`, tap `Share Fix Brief` from More's Native QA Next Captures before editing so the first route issue has a focused repair packet.
- Share the Launch Packet.
- Open `/care-twin-qa`.
- Use the `48-hour beta run` card to start with the next required launch-critical surface.
- Use the large cockpit actions first: platform tag, `Open Next Surface`, `Attach proof`, `Pass`, `Needs tune`, `Share QA`, and per-surface `Open surface` are all intended to be phone-sized beta controls.
- If the card shows `Owner route loop`, follow that ordered checklist before marking the mission Pass; it is the beta's real owner journey, not an optional note.
- When the current mission is `Owner Preview Core Loop`, use the bottom nav to open Home, Log, Plans, Health, and More in order, then confirm Adventure, Records, Avatar Studio, and Care Pass are reachable from More or Home without dead ends.
- When the current mission is `Auth And Setup Onboarding Proof`, open `/care-twin-qa?qaSurface=auth-setup-onboarding-proof`, then capture the Auth gateway and Setup local-preview path on iOS and Android while keeping provider-backed auth, household creation, invite delivery, and cross-device sync blocked until real provider proof exists.
- On Home, confirm the header/menu action, Avatar Studio hero entry, household presence panel, Adventure inline action, pixel-room crop, and bottom-nav fit feel phone-sized, useful, and aligned with the premium neo-retro care-twin promise.
- In the owner-preview loop, quick-log one safe care event or open the detail sheet, then undo it or leave a QA note if you do not want the test log to stay in local preview data.
- On Log, confirm the care-type tabs, Undo/Add details, meal outcome, potty outcome, trust review, walk finish, and alone-time return controls feel phone-sized and easy to tap.
- On Plans, confirm schedule tabs, Add plan, Find event, suggestion add, routine done, owner chips, save, and delete controls feel phone-sized and easy to tap.
- On Health, confirm the Health/Bile tabs plus `Log health note`, `Records`, and `Share review` actions feel phone-sized, calm, useful for vet/caregiver handoff, and clearly non-diagnostic.
- On More, confirm Launch Readiness, Native QA Next Captures, provider setup, household invite, Access Pass, profile edit, and save/share actions feel phone-sized and easy to tap.
- On Records, confirm Dog ID share/print, medication search/filter, Care Pass preview, report resend/print, record add/delete, attachment, and sheet save/cancel controls feel phone-sized and easy to tap.
- When the current mission is `Records Local File Handoff`, open `/care-twin-qa?qaSurface=records-local-file-handoff`, then capture Care Pass Report History local HTML, Dog ID local HTML, Dog ID SVG image source, native share-sheet behavior, Android content URI, and fallback copy without claiming PDF/PNG/provider storage proof.
- When the current mission is `Report Binary Export Proof`, open `/care-twin-qa?qaSurface=report-binary-export-proof`, then capture the approved Care Pass PDF generator, approved Dog ID PNG renderer, provider storage policy, generated file name/size/MIME/share proof, and iOS/Android artifact evidence before claiming PDF/PNG readiness.
- When the current mission is `Care-entry Provider Sync Proof`, open `/care-twin-qa?qaSurface=care-entry-provider-sync-proof`, then capture Supabase project id, migration/backfill for `care_entries.updated_at` and `care_entry_tombstones`, active-household RLS for cursor and tombstone routes, retention/export/deletion policy, dependency-complete build proof, and mobile full-refresh sign-off before enabling incremental care-entry sync.
- When the current mission is `Push Notifications Proof`, open `/care-twin-qa?qaSurface=push-notifications-proof`, then capture Expo push project config, APNs credentials, Firebase/FCM credentials, permission prompt copy, quiet hours, opt-out behavior, delivery QA, and missed-notification fallback before claiming reminder delivery.
- When the current mission is `Route Visual Consistency`, open `/care-twin-qa?qaSurface=route-visual-consistency`, then capture Home, Log, Plans, Health, Records, and More on both iOS and Android; web preview screenshots do not replace native proof.
- Before attempting native proof, run `pnpm run doctor:native-qa:json`. A `BLOCKED` result from missing `adb`, `emulator`, `java`, `ANDROID_HOME` or `ANDROID_SDK_ROOT`, or `JAVA_HOME` means use a configured Mac, Android Studio machine, physical device, TestFlight build, or helper environment instead of claiming local native QA.
- On Avatar Studio, confirm Scan/Template/Customize/Emotes tabs, Gallery, Take photo, template tiles, coat swatches, face options, accessories, mood previews, Reset, and Save Avatar controls feel phone-sized and easy to tap.
- On Adventure, confirm quest cards, private memory capture, `Save Memory`, and `Share Adventure` feel phone-sized, useful, and aligned with the real-care RPG promise instead of decorative game fluff.
- On WoofGuide, confirm quick questions, suggested actions, the send button, and owner-review Cancel/Apply draft controls feel phone-sized, useful, and clearly non-diagnostic.
- Write the `Mission note` in the 48-hour beta card before marking the owner-preview mission Pass; this note is required proof for the no-dead-ends route loop.
- Read the `Next device mission` panel before leaving the cockpit: it shows route, setup steps, pass criteria, evidence count, and the Needs tune rule for that screen.
- Tap `Open Next Surface`, test the route, capture proof, then return to `/care-twin-qa`.
- If the target screen shows `Return to QA Cockpit`, use that banner after capture instead of manually hunting for the QA route.
- Capture at least one iOS screenshot and one Android screenshot when devices/simulators are available.
- For the owner-preview loop, capture the iOS screenshot on Quick Log or Log and the Android screenshot on More's Launch Readiness panel.
- The shareable QA script should include the same route loop: Home, Log, Plans, Health, More, Adventure, Records, Avatar Studio, Care Pass.
- In `/care-twin-qa`, set `Tag screenshot evidence` to iOS or Android before attaching the screenshot from Photos.
- Attach screenshots from Photos to the current mission through the 48-hour beta card's `Attach proof` control, or to the matching QA surface farther down the cockpit.
- Confirm the attached file shows the expected counted platform label.
- Mark the current mission `Pass` or `Needs tune` from the 48-hour beta card before moving on.
- If the card shows `Pass pending proof`, the mission is not complete yet; attach the missing screenshots or save the required Mission note until that gate clears.
- In More's Launch Readiness panel, check Native QA Next Captures before sharing: if `Proof status` says `Pass pending proof`, tap `Finish Proof`, attach proof or save the Mission note in `/care-twin-qa`, and recheck before moving on.
- Also check the `Owner preview proof` row in More's Native QA panel. It now stays visible even when Owner Preview Core Loop is not one of the top four next captures, and `Finish Proof` remains active if the loop is marked Pass but still needs the Mission note.
- Use `/care-twin-qa`'s `Share QA` action after writing mission notes or attaching proof; it now includes the live native capture plan before the full release QA, store packet, and care-twin state report.
- Use More's `Share Beta Handoff` action after the saved proof state is current; it combines the Release Smoke Checklist, beta verdict, public-launch boundary, next device mission, missing proof, route loop, dependency proof commands, provider proof checklist, and truth boundaries in one packet.
- Mark any visual route that feels below App Store quality as Needs tune.
- When a visual route is marked Needs tune, use More's `Share Fix Brief` action to send the exact route, QA note, proof gaps, setup/repro steps, done condition, and return-to-`/care-twin-qa` instructions before repairing it.
- Tap `Share Beta Packet` only after local verification and owner sign-off are still truthful for an internal beta.

## Current Gates

Shippable for internal beta after local verification passes:

- Focused behavior/readiness tests.
- Mobile TypeScript.
- PixelLab asset verification.
- Package-local Expo web export.
- `git diff --check`.
- Root `packageManager` and GitHub Actions pnpm setup agree on `pnpm@10.24.0`.
- `pnpm run doctor:mobile-beta` reports no install/export blockers.
- `pnpm run doctor:mobile-beta:json` reports the same status as parseable JSON
  for Replit, native helpers, or automation, including structured
  `proofCommands` for the dependency/export proof sequence.
- GitHub Actions `WoofWatcher Verify` runs `pnpm run doctor:mobile-beta:json`
  after frozen dependency install with pinned `pnpm@10.24.0`, before focused
  tests and `build:ci`.
- The JSON doctor reports `release smoke checklist is source-backed` and lists
  `Release smoke checklist` as a handoff proof section before helpers claim the
  beta packet is complete.
- The JSON doctor reports `records local file handoff proof is source-backed`
  and lists `/care-twin-qa?qaSurface=records-local-file-handoff` in next
  actions before helpers claim Records local-file proof.
- `pnpm --filter @workspace/woofwatcher-mobile run smoke:runtime` verifies the
  exported `.expo-smoke` runtime for Sign-in, Setup, Home, Log, Plans, Health,
  Records, More, Care Twin QA, WoofGuide, Premium, Privacy, and Avatar Studio
  before preview handoff.
- `pnpm --filter @workspace/woofwatcher-mobile run preview:smoke` serves the
  exact `.expo-smoke` export at `http://127.0.0.1:4194/`; keep that terminal
  open while Apollo, Fable, Replit, or device QA reviews the build.
- The mobile beta doctor passes the Node 24 runtime check and confirms EAS
  preview/production build profiles cover both iOS and Android.
- If `pnpm` is present, the mobile beta doctor confirms the actual CLI version
  is exactly `10.24.0`.
- The mobile beta doctor also verifies `report binary export proof packet is
  source-backed`, so PDF/PNG readiness stays blocked unless Provider Launch
  Setup carries the approved generator, storage policy, and native artifact
  proof requirements.

Current environment note:

- The latest cross-platform install-guard slice removed the root `sh -c` preinstall dependency that was blocking Windows package/export attempts before Expo could run. `preinstall` now calls `node scripts/enforce-pnpm-install.mjs`, which still removes forbidden npm/yarn lockfiles and rejects npm/yarn user agents while running in a Windows-friendly Node process.
- The latest Expo config slice also declares `ios`, `android`, and `web` platforms in `artifacts/woofwatcher-mobile/app.json` and sets `expo.web.bundler` to `metro`, matching the committed `smoke:web` export path. Package-local Expo CLI export now passes from `artifacts/woofwatcher-mobile` through `node_modules\expo\bin\cli export --platform web --output-dir .expo-smoke --clear`.
- The new root `doctor:mobile-beta` command summarizes dependency/export state for Apollo, Replit, or a device helper. If `pnpm` is not on PATH, the scripted `smoke:web` path can still be blocked even when the package-local Expo CLI proof path passes; install or activate `pnpm@10.24.0` before treating the full doctor path as dependency-complete.
- The root package now pins `packageManager: pnpm@10.24.0`, matching the GitHub Actions verify workflow. The doctor checks that alignment so Replit, Corepack, local shells, and CI use the same pnpm target before export proof.
- The doctor now gives explicit bootstrap guidance for the missing-pnpm case: if Corepack is available, run `corepack prepare pnpm@10.24.0 --activate`; if Corepack is not on PATH, install pnpm 10.24.0 directly or run the proof path in Replit/WSL.
- The doctor now also verifies the current Node runtime is Node 24 and that `artifacts/woofwatcher-mobile/eas.json` includes both iOS and Android build profiles for preview and production. Those checks currently pass in this shell.
- The doctor now enforces the actual `pnpm --version` output when pnpm is present, so a stray pnpm 11.x helper install cannot be mistaken for the pinned `pnpm@10.24.0` beta export path.
- The doctor now also supports `--json` through `pnpm run doctor:mobile-beta:json`.
  In this cleaned Windows shell the JSON payload is valid, reports
  `result: BLOCKED`, and keeps source-backed checks passing while naming the
  true local blocker: pnpm is `11.7.0` while the repo is pinned to `10.24.0`.
- The JSON payload also includes `proofCommands`, so automation can read the
  exact `corepack`, `pnpm install`, doctor, JSON doctor, `smoke:web`,
  `smoke:runtime`, `proof:live-preview`, and `preview:smoke` command order
  without parsing prose.
- Branch CI now runs that JSON doctor in the same workflow that installs
  `pnpm@10.24.0`, runs focused tests, and executes `build:ci`; use the workflow
  result as dependency-complete doctor proof when local Windows still has pnpm
  `11.7.0`.
- The in-app `Share Beta Handoff` packet now labels the recorded branch CI proof
  for `WoofWatcher Verify` run `28665850917`, job `85017274907`, commit
  `c17571a`, including the passed JSON doctor with auth/setup smoke proof,
  auth/setup native QA target coverage, auth provider proof packet coverage,
  focused test, and `build:ci` proof for `smoke:web`, `smoke:runtime`, and
  `proof:live-preview`. It explicitly requires rerunning `WoofWatcher Verify`
  after any new commit before treating dependency proof as current, while
  keeping native screenshots, provider setup, store approval, and Apollo
  sign-off blocked.
- The mobile package now has a `smoke:runtime` alias that starts a disposable
  static runtime over `.expo-smoke`, verifies 13 exported mobile routes return
  the Expo web shell, including `/sign-in` and `/setup`, and exits without
  leaving a server running.
- The mobile package now has `preview:smoke` and `preview:web` aliases for the
  no-dependency static server, both pinned to port `4194`, and the root
  `preview:mobile-beta` command points to the same handoff path.
- The mobile package also has `proof:live-preview`, which starts a disposable
  static preview server over `.expo-smoke`, verifies 13 launch-critical preview
  routes return the Expo web shell, including `/sign-in`, `/setup`, and the
  focused auth/setup onboarding proof target, and emits JSON proof with
  web-preview-only truth boundaries before helpers keep
  `preview:smoke` open for human review. Root `build:ci` runs it after
  `smoke:web` and `smoke:runtime`.
- The Release Smoke Checklist now has an `Auth and setup route smoke` proof row,
  and the JSON doctor reports `auth/setup runtime smoke proof is source-backed`
  when `smoke:runtime`, `proof:live-preview`, and the checklist all cover
  `/sign-in` plus `/setup` without claiming provider-backed auth or household
  creation.
- The Release Smoke Checklist, Share Beta Handoff, live-preview route verifier,
  native QA doctor, and JSON mobile beta doctor now also name
  `/care-twin-qa?qaSurface=auth-setup-onboarding-proof` as the focused native
  capture target for Auth gateway plus Setup local-preview proof. This is a
  phone QA mission only; it does not approve provider-backed auth, household
  creation, invite delivery, cross-device sync, or Apollo launch sign-off.
- The in-app `Share Beta Handoff` packet now repeats the exact dependency proof
  commands and warns that dependency proof only counts when both doctor commands
  report no blockers.
- The in-app `Share Beta Handoff` packet now includes the Release Smoke
  Checklist: dependency/export proof, route rehearsal, Records local HTML export
  truth for `WoofWatcherReports` and `WoofWatcherCredentials`, provider proof
  gates including the Report binary export proof packet, native/store proof, and
  truth boundaries. This is rehearsal proof, not native QA, provider approval,
  store approval, binary export readiness, or Apollo sign-off.
- Provider Launch Setup's Production auth gate now carries a `Production auth
  provider proof packet` requiring Clerk production app id, redirect/deep-link
  URL list, OAuth sign-in test proof, session/token policy, and household
  membership policy before provider-backed account sync or household creation
  can be claimed. Share Beta Handoff prints those proof steps through the
  `Provider proof needed` section; this is a proof checklist, not configured
  Clerk/provider auth.
- Provider Launch Setup's WoofWatcher Plus payments gate now carries a
  `WoofWatcher Plus payments proof packet` requiring Plus and Family product
  ids, the App Store/Google Play/Stripe or web checkout decision, sandbox
  receipt tests, entitlement mapping, refund/support policy, and checkout-gate
  proof before paid checkout can be enabled. Share Beta Handoff prints those
  proof steps, but checkout remains disabled until Apollo and the store/provider
  evidence is attached.
- Provider Launch Setup's WoofGuide AI gate now carries a `WoofGuide AI
  provider proof packet` requiring OpenAI key location, approved model policy,
  source/citation rules, owner-review write gate, veterinary safety boundary,
  and fallback/incident handling before live AI can be enabled. Share Beta
  Handoff prints those proof steps, but this does not configure an OpenAI key,
  approve a model, enable live AI, or clear veterinary/safety review.
- Provider Launch Setup's Self-serve account deletion gate now carries a
  `Self-serve account deletion proof packet` requiring the deletion route and
  reauthentication gate, export-before-delete handoff, data/object deletion
  receipt, audit/support receipt, recovery-window cancellation rules, and
  legal/store approval before destructive deletion can be enabled. Share Beta
  Handoff prints those proof steps, but this does not enable production
  deletion, delete provider data, satisfy store review, or replace Apollo/legal
  approval.
- Provider Launch Setup's Apple and Google store accounts gate now carries an
  `Apple and Google store accounts proof packet` requiring Apple Developer team
  id, App Store Connect app record, Google Play package record, bundle ids,
  reviewer access notes, screenshots/metadata ownership, and release role
  approval before store submission can be claimed. Share Beta Handoff prints
  those proof steps, but this does not create store accounts, approve metadata,
  submit the app, satisfy App Review or Play review, or replace Apollo approval.
- Provider Launch Setup's Push notifications gate now carries a `Push
  notifications proof packet` requiring Expo push project config, APNs
  credentials, Firebase/FCM credentials, permission prompt copy, quiet hours,
  opt-out behavior, and delivery QA before reminder delivery can be claimed.
  Share Beta Handoff prints those proof steps, but this does not configure push
  providers, deliver notifications, approve permission copy, or replace native
  iOS/Android notification QA and Apollo signoff.
- The Release Smoke Checklist and Share Beta Handoff now name the focused
  Records handoff target at `/care-twin-qa?qaSurface=records-local-file-handoff`,
  including Care Pass local HTML, Dog ID local HTML, Dog ID SVG, share-sheet
  behavior, Android content URI, and fallback copy proof. This still does not
  provide actual iOS/Android proof by itself.
- The Release Smoke Checklist and Share Beta Handoff now also name
  `/care-twin-qa?qaSurface=report-binary-export-proof` for the approved
  generator, provider storage policy, and generated artifact evidence needed
  before binary PDF/PNG readiness can be claimed.
- The Release Smoke Checklist and Share Beta Handoff now also name
  `/care-twin-qa?qaSurface=care-entry-provider-sync-proof` for Supabase
  migration/backfill, active-household cursor/tombstone RLS, retention/export/
  deletion policy, dependency proof, and mobile full-refresh sign-off before
  incremental care-entry sync can be enabled.
- The Release Smoke Checklist, Share Beta Handoff, live-preview verifier, JSON
  mobile beta doctor, and native QA tooling doctor now also name
  `/care-twin-qa?qaSurface=push-notifications-proof` for Expo push project
  config, APNs credentials, Firebase/FCM credentials, permission prompt copy,
  quiet hours, opt-out behavior, delivery QA, and missed-notification fallback
  before reminder delivery can be claimed. This is a proof target, not provider
  configuration or native delivery evidence by itself.
- Records Dog ID can now share a local SVG image-source credential file beside
  the local printable HTML credential file; PNG/PDF credential export still
  needs native/provider generation and real iOS/Android share proof.
- Provider Launch Setup's Records/media storage gate now carries the Report
  binary export proof packet for an approved Care Pass PDF generator, approved
  Dog ID PNG renderer, provider storage policy, and iOS/Android artifact proof.
  This is a proof requirement, not implemented PDF/PNG generation.
- The Release Smoke Checklist and JSON doctor now include the `smoke:runtime`
  route proof between `smoke:web` and preview handoff, so helpers can confirm
  exported routes load before they keep the preview server open for visual QA.
- The Release Smoke Checklist and Share Beta Handoff now include a dedicated
  `Live preview handoff proof` section for branch CI, JSON doctor/export/runtime
  proof, `proof:live-preview` JSON route proof, `preview:smoke` output,
  `http://127.0.0.1:4194/`, and browser-open evidence while saying live preview
  proof does not replace native iOS/Android proof.
- Share Beta Handoff now also carries a `Recorded live preview proof` section
  from a recorded local `proof:live-preview` run: `10/10` web-preview route shell
  checks passed against the regenerated `.expo-smoke` export. The recorded
  verifier URL is disposable; the review handoff URL remains
  `http://127.0.0.1:4194/` after `preview:smoke` is running. Rerun branch CI and
  `proof:live-preview` after new commits/exports before treating this proof as
  current, and do not use it as native iOS/Android proof.
- Provider Launch Setup now also shows a proof-needed checklist for every
  production provider gate in More and in the share packet: Clerk, Supabase/RLS,
  storage signed uploads, WoofGuide AI policy, payments, push, Apple/Google
  store accounts, and account deletion evidence.
- Provider Launch Setup now also highlights the single `Next provider gate`
  with owner/action/proof and prioritizes open rows before ready rows, so Apollo
  or a helper can close real provider proof without guessing which gate comes
  next.
- The in-app `Share Beta Handoff` packet now includes that provider proof
  checklist too, so deadline helpers can use one packet for dependency proof,
  device proof, provider evidence, and launch truth boundaries.
- Mobile TypeScript, package-local web export, and exported web-runtime route smoke now pass in this cleaned Windows shell, but no local iOS/Android simulator/tooling is visible here. Re-run the full doctor, install, scripted `smoke:web`, `smoke:runtime`, preview handoff, and actual device capture from Replit, Git Bash/WSL with pnpm 10.24.0 installed, CI, or a native-device environment before treating this as native/device-proven.

Still blocked for public launch:

- Real iOS/Android screenshots and human visual approval.
- Supabase migration/RLS/provider access rules.
- Provider-backed invite delivery and household sync approval.
- Storage retention/export/deletion policy.
- Support, privacy/legal, refund, and veterinary-boundary approval.
- Apple Developer, Google Play, Expo/EAS credentials, and final store submission approval.
