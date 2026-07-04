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
- When the current mission is `Auth And Setup Onboarding Proof`, open `/care-twin-qa?qaSurface=auth-setup-onboarding-proof`, then capture the Auth gateway and Setup local-preview path on iOS and Android while keeping provider-backed auth, household creation, invite delivery, and cross-device sync blocked until structured Clerk production, redirect/deep-link, household membership, and Apollo auth launch proof files exist.
- When reviewing the Auth gateway or Setup onboarding route, use `Open setup proof` to jump to the same Auth And Setup Onboarding Proof mission. This is a shortcut only; it does not prove Clerk OAuth, household creation, invite delivery, cross-device sync, or native screenshots.
- On the Auth gateway and Setup route, confirm the `Auth/Setup proof manifest` shows Clerk production app, Redirect and deep links, Native auth screenshots, Setup local-preview proof, Household sync boundary, and Launch gate rows. The manifest must keep `Native proof blocked` visible until structured Clerk production, redirect/deep-link, household membership, Apollo auth launch, and native iOS/Android screenshot proof is attached.
- On Home, confirm the header/menu action, Avatar Studio hero entry, household presence panel, Adventure inline action, pixel-room crop, and bottom-nav fit feel phone-sized, useful, and aligned with the premium neo-retro care-twin promise.
- In the owner-preview loop, quick-log one safe care event or open the detail sheet, then undo it or leave a QA note if you do not want the test log to stay in local preview data.
- On Log, confirm the care-type tabs, Undo/Add details, meal outcome, potty outcome, trust review, walk finish, and alone-time return controls feel phone-sized and easy to tap.
- On Plans, confirm schedule tabs, Add plan, Find event, suggestion add, routine done, owner chips, save, delete, Reminder Center preferences, and `Open push proof` controls feel phone-sized and easy to tap.
- On Health, confirm the Health/Bile tabs plus `Log health note`, `Records`, and `Share review` actions feel phone-sized, calm, useful for vet/caregiver handoff, and clearly non-diagnostic.
- On More, confirm Launch Readiness, Native QA Next Captures, provider setup, household invite, Access Pass, profile edit, and save/share actions feel phone-sized and easy to tap.
- On Records, confirm Dog ID share/print, medication search/filter, Care Pass preview, report resend/print, record add/delete, attachment, and sheet save/cancel controls feel phone-sized and easy to tap.
- On Records, use the `Records file handoff` Vault Command shortcut when the next proof target is Records local files, and use the Report History proof icon when the next target is Report Binary Export Proof. These are capture shortcuts only; they do not prove PDF/PNG generation or provider storage by themselves.
- On Records, confirm Care Pass Report History says `Saved on this device` unless Provider Launch Setup storage is provider-approved; `Ready to upload` is not a local draft or owner-reviewed status.
- On Records, confirm each Report History artifact shows the `Binary proof manifest` rows for Care Pass PDF, Dog ID PNG, Provider storage, and Native artifact proof. Local Records actions can now generate Care Pass PDF and Dog ID PNG bytes with file name, file size, and MIME metadata, but the rows must stay blocked until native share/reopen proof, provider storage, and iOS/Android evidence exists.
- When the current mission is `Records Local File Handoff`, open `/care-twin-qa?qaSurface=records-local-file-handoff`, then capture Care Pass Report History local HTML, Dog ID local HTML, Dog ID SVG image source, native share-sheet behavior, Android content URI, and fallback copy without claiming PDF/PNG/provider storage proof.
- When the current mission is `Report Binary Export Proof`, open `/care-twin-qa?qaSurface=report-binary-export-proof`, then capture the local Care Pass PDF bytes, local Dog ID PNG bytes, structured provider storage proof, generated file name/size/MIME/share proof, reopen proof, and iOS/Android artifact evidence before claiming PDF/PNG readiness.
- When the current mission is `Care-entry Provider Sync Proof`, open `/care-twin-qa?qaSurface=care-entry-provider-sync-proof`, then capture Supabase project id, migration/backfill for `care_entries.updated_at` and `care_entry_tombstones`, active-household RLS for cursor and tombstone routes, retention/export/deletion policy, dependency-complete build proof, and mobile full-refresh sign-off before enabling incremental care-entry sync.
- When reviewing More's Sync Health panel, use `Open sync proof` to jump to the same Care-entry Provider Sync Proof mission. This is a shortcut only; visible outbox/local sync status still does not prove Supabase migration, active-household RLS, retention policy, or incremental provider sync.
- When the current mission is `WoofGuide AI Provider Proof`, open `/care-twin-qa?qaSurface=woofguide-ai-provider-proof`, then capture OpenAI key location, secret storage, approved model policy, source/citation rules, owner-review write gate, veterinary safety boundary, fallback/incident handling, rollback plan, and support handoff before enabling live AI.
- When reviewing Provider Launch Setup's WoofGuide AI row, use `Open proof mission` to jump to the same WoofGuide AI Provider Proof mission. This is a shortcut only; it does not configure OpenAI, approve a model, enable live provider-backed AI, allow automatic care-log writes, clear source/citation review, or replace veterinary/safety approval.
- When the current mission is `Push Notifications Proof`, open `/care-twin-qa?qaSurface=push-notifications-proof`, then capture Expo push project config, APNs credentials, Firebase/FCM credentials, permission prompt copy, quiet hours, opt-out behavior, platform/provider-named iOS APNs and Android FCM delivery evidence, and missed-notification fallback before claiming reminder delivery.
- When reviewing Reminder Center, use Calendar's `Open push proof` action to jump to the same Push Notifications Proof mission. This is a shortcut only; local preference intent still does not prove provider configuration or delivered reminders.
- When the current mission is `Payments Provider Proof`, open `/care-twin-qa?qaSurface=payments-provider-proof`, then capture Plus and Family product ids, billing path decision, iOS App Store and Android Google Play sandbox purchase/renewal/cancel/refund/expired JSON receipt proof, restore purchases, entitlement mapping, household role access, refund/support policy, and checkout-gate proof before enabling paid checkout.
- When reviewing Provider Launch Setup's WoofWatcher Plus payments row, use `Open proof mission` to jump to the same Payments Provider Proof mission. This is a shortcut only; it does not approve tiers, configure store or Stripe billing, prove receipts, enable checkout, clear store approval, or replace Apollo sign-off.
- On Premium, confirm the `Payments proof manifest` shows Product catalog, Billing path decision, Sandbox receipts, Entitlements and restore, Refund and support policy, and Checkout gate rows. The manifest must keep `Checkout disabled` visible until real billing/provider proof, iOS App Store and Android Google Play receipt/restore evidence, refund/support policy approval, and Apollo checkout approval are attached.
- When the current mission is `Store Accounts Proof`, open `/care-twin-qa?qaSurface=store-accounts-proof`, then capture Apple Developer team id, App Store Connect app record, Google Play package record, platform/store-named iOS App Store Connect developer account proof, Android Google Play package proof, shared bundle/signing proof, reviewer access, metadata/privacy, Apollo release approval, no-submit boundary, and store submission proof before claiming App Review or Play review readiness.
- When reviewing Provider Launch Setup's Apple and Google store accounts row, use `Open proof mission` to jump to the same Store Accounts Proof mission. This is a shortcut only; it does not create accounts, approve metadata/screenshots, submit App Review or Play review, clear legal/privacy approval, or replace Apollo sign-off.
- When the current mission is `Account Deletion Proof`, open `/care-twin-qa?qaSurface=account-deletion-proof`, then capture structured deletion-route/auth, export-before-delete, data/object deletion receipt, audit/support receipt, recovery/cancellation, and legal/store approval proof files with MIME, byte size, and row-specific approvals before claiming destructive deletion readiness.
- When reviewing Provider Launch Setup's Self-serve account deletion row, use `Open proof mission` to jump to the same Account Deletion Proof mission. This is a shortcut only; it does not enable destructive deletion, delete provider data/storage, approve privacy/legal copy, satisfy App Store/Play Store review, or replace Apollo sign-off.
- When the current mission is `Route Visual Consistency`, open `/care-twin-qa?qaSurface=route-visual-consistency`, then capture Home, Log, Plans, Health, Records, and More on both iOS and Android with route-named evidence; web preview screenshots do not replace native proof.
- On the focused Route Visual Consistency mission, confirm the `Route visual proof manifest` shows six route-named iOS slots, six route-named Android slots, the QA note blocker, and the web-preview boundary before anyone claims visual sign-off.
- Before attempting native proof, run `pnpm run doctor:native-qa:json`. A `BLOCKED` result from missing `adb`, `emulator`, `java`, `ANDROID_HOME` or `ANDROID_SDK_ROOT`, or `JAVA_HOME` means use a configured Mac, Android Studio machine, physical device, TestFlight build, or helper environment instead of claiming local native QA. The JSON doctor's `nextActions` now explicitly call out Report Binary Export Proof, Care-entry Provider Sync Proof, WoofGuide AI Provider Proof, Payments Provider Proof, Push Notifications Proof, Store Accounts Proof, and Account Deletion Proof as helper missions alongside Route Visual Consistency, Auth/Setup, and Records local files; those action lines are capture instructions, not native proof by themselves.
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
- In `/care-twin-qa`, set `Tag screenshot evidence` to iOS or Android before attaching the screenshot from Photos. For Route Visual Consistency, name or save each attachment with the route label and platform, such as `Home-iOS`, `Home-Android`, `Log-iOS`, `Log-Android`, `Plans-iOS`, `Plans-Android`, `Health-iOS`, `Health-Android`, `Records-iOS`, `Records-Android`, `More-iOS`, and `More-Android`.
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
  Setup carries the approved generator, structured provider storage proof, and native artifact
  proof requirements.
- The mobile beta doctor also verifies `records binary export proof manifest is
  source-backed`, so Records must display artifact-specific Care Pass PDF, Dog
  ID PNG, provider storage, and native evidence blocker rows before generated
  PDF/PNG readiness can be claimed.
- The mobile beta doctor also verifies `generated binary artifact exports are
  source-backed`, so Records must wire the local Care Pass PDF and Dog ID PNG
  share actions from real base64 artifact bytes while keeping native
  share/reopen and provider storage proof blocked until device evidence exists.
- The mobile beta doctor also verifies `premium payments proof manifest is
  source-backed`, so Premium must display product catalog, billing path,
  platform-specific sandbox receipt, restore-purchase, refund/support, and
  checkout-gate blockers before paid checkout can be enabled.
- The mobile beta doctor also verifies `privacy safety payments proof guard is
  source-backed`, so Privacy & Safety must keep checkout blocked when only
  `paymentsEnabled` is staged and structured payments proof files are absent.
- The mobile beta doctor also verifies `auth/setup proof manifest is
  source-backed`, so Auth gateway and Setup must display structured Clerk,
  redirect/deep-link, native screenshot, setup local-preview, household sync,
  and Apollo auth launch blockers before native Auth/Setup proof can be claimed.
- The mobile beta doctor also verifies `privacy safety account deletion proof
  guard is source-backed`, so Privacy & Safety must keep destructive account
  deletion blocked when only `accountDeletionEnabled` is staged and structured
  account-deletion proof files are absent.

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
- The mobile beta doctor also verifies `support runbook proof guard is
  source-backed`, so the Support runbook must keep public launch blocked when
  only support/legal approval booleans and policy links are staged.
- Branch CI now runs that JSON doctor in the same workflow that installs
  `pnpm@10.24.0`, runs focused tests, and executes `build:ci`; use the workflow
  result as dependency-complete doctor proof when local Windows still has pnpm
  `11.7.0`.
- The in-app `Share Beta Handoff` packet now labels the recorded branch CI proof
  for `WoofWatcher Verify` run `28692423522`, job `85096033279`, commit
  `fd3a98f`, including the passed JSON doctor with auth/setup smoke proof,
  auth/setup native QA target coverage, auth provider proof packet coverage,
  the provider staged-row truth boundary, support legal readiness proof target,
  provider-approved support/legal launch-readiness wiring, the Plus checkout
  approval truth boundary, Records storage provider-approval clamp, Records
  binary proof manifest, Premium payments proof manifest, Auth/Setup proof
  manifest, Route Visual proof manifest, route-named Route Visual capture
  instructions, focused tests, and `build:ci` proof for `smoke:web`,
  `smoke:runtime`, and `proof:live-preview`. The recorded live-preview proof
  remains historical and points at a local `proof:live-preview` run generated
  `2026-07-03T22:21:21.304Z` on commit `0f60c22` from
  `http://127.0.0.1:60160/` with `19/19` web-preview route checks. It
  explicitly requires rerunning `WoofWatcher Verify` and `proof:live-preview`
  after any new commit before treating dependency or preview proof as current,
  while keeping native screenshots, provider setup, store approval, and Apollo
  sign-off blocked.
- Branch CI also proved the Provider Launch Setup row-level QA action routing on
  2026-07-03: `WoofWatcher Verify` run `28674214816`, job `85044028568`,
  commit `8d31dea`, with Setup pnpm, Setup Node, install, JSON mobile beta
  doctor, focused behavior tests, and Typecheck plus CI-safe builds all passing.
  This is provider-row routing proof only; the in-app recorded beta handoff proof
  still carries its explicit rerun-after-new-commit boundary.
- Branch CI also proved the Records proof shortcut routing on 2026-07-03:
  `WoofWatcher Verify` run `28674576890`, job `85045143466`, commit
  `e37e73a`, with Setup pnpm, Setup Node, install, JSON mobile beta doctor,
  focused behavior tests, and Typecheck plus CI-safe builds all passing. This is
  shortcut-routing proof only; native Records file proof, generated PDF/PNG
  proof, provider storage, and Apollo sign-off remain blocked.
- Branch CI also proved the Calendar Reminder Center push-proof shortcut on
  2026-07-03: `WoofWatcher Verify` run `28674916286`, job `85046177133`,
  commit `8a8bb50`, with Setup pnpm, Setup Node, install, JSON mobile beta
  doctor, focused behavior tests, and Typecheck plus CI-safe builds all passing.
  This is shortcut-routing proof only; Expo/APNs/FCM setup, delivered
  notification proof, native iOS/Android delivery QA, prompt/legal approval, and
  Apollo sign-off remain blocked.
- Branch CI also proved the More Sync Health provider-sync shortcut on
  2026-07-03: `WoofWatcher Verify` run `28675348598`, job `85047483945`,
  commit `e234d14`, with Setup pnpm, Setup Node, install, JSON mobile beta
  doctor, focused behavior tests, and Typecheck plus CI-safe builds all passing.
  This is shortcut-routing proof only; structured Supabase project id,
  migration/backfill, active-household cursor/tombstone RLS,
  retention/export/deletion, dependency-build, and mobile sign-off proof files,
  actual incremental provider sync, and Apollo sign-off remain blocked.
- Branch CI also proved the Auth/Setup proof shortcut on 2026-07-03:
  `WoofWatcher Verify` run `28675785938`, job `85048784312`, commit `7d7013b`,
  with Setup pnpm, Setup Node, install, JSON mobile beta doctor, focused
  behavior tests, and Typecheck plus CI-safe builds all passing. This is
  shortcut-routing proof only; Clerk setup, provider-backed household creation,
  invite delivery, cross-device sync, native screenshots, and Apollo sign-off
  remain blocked.
- Branch CI proved Auth/Setup structured provider-proof hardening on 2026-07-04:
  `WoofWatcher Verify` run `28701069572`, job `85119051428`, commit `6da692b`,
  with Setup pnpm, Setup Node, install dependencies, JSON mobile beta doctor,
  focused behavior tests, and Typecheck plus CI-safe builds all passing. This
  proves the structured proof guard only; real Clerk configuration, OAuth,
  provider-backed household creation, native screenshots, store review, public
  launch, and Apollo sign-off remain blocked.
- Local proof also hardened the shared attachment storage queue on 2026-07-04:
  medication proof photos, record documents, Adventure memories, Care Pass
  reports, and QA screenshots stay local-only until structured storage proof
  files cover bucket names, signed upload/download, household scope,
  retention/export/deletion, QA evidence storage, approval owner, and approval
  booleans. Focused attachment/privacy/launch/release/store/mobile readiness
  tests passed `142/142`, the full zero-dependency suite passed `581/581`, and
  the JSON mobile beta doctor reports `attachment storage proof guard is
  source-backed` as `PASS`; real storage provider proof, native evidence, store
  review, public launch, and Apollo sign-off remain blocked.
- Local proof also hardened aggregate Launch Readiness on 2026-07-04: complete
  native/local inputs plus raw provider-approved booleans no longer make the
  app `store-ready` unless structured proof flags are present for auth,
  care-entry sync, storage, AI, payments, account deletion, push delivery, store
  accounts, privacy/legal, and support/refund. Focused launch/release/store/
  mobile readiness tests passed `131/131`, the full zero-dependency suite passed
  `582/582`, and the JSON mobile beta doctor reports `aggregate launch
  readiness proof guard is source-backed` as `PASS`. Branch CI proved
  implementation commit `e257e4f` in `WoofWatcher Verify` run `28702584181`,
  job `85122931741`, with mobile beta doctor, focused behavior tests, and
  Typecheck plus CI-safe builds all passing; real provider proof files, native
  evidence, store review, public launch, and Apollo sign-off remain blocked.
- Local proof also hardened Privacy & Safety's AI disclosure on 2026-07-04:
  `aiProviderConfigured` no longer marks WoofGuide AI ready unless the
  structured WoofGuide AI provider proof manifest is live-AI ready. Focused
  Privacy & Safety/mobile readiness tests passed `121/121`, the full
  zero-dependency suite passed `583/583`, root/mobile TypeScript passed, and
  the JSON mobile beta doctor reports `privacy safety AI proof guard is
  source-backed` as `PASS`. Branch CI proved implementation commit `eb7234b`
  in `WoofWatcher Verify` run `28703163755`, job `85124450034`, with mobile
  beta doctor, focused behavior tests, and Typecheck plus CI-safe builds all
  passing; real OpenAI proof files, live AI approval, veterinary safety review,
  public launch, and Apollo sign-off remain blocked.
- Local proof also hardened Privacy & Safety's account deletion gate on
  2026-07-04: `accountDeletionEnabled` no longer marks destructive account
  deletion ready unless the structured Account deletion proof manifest allows
  destructive deletion. Focused Privacy & Safety/mobile readiness tests passed
  `122/122`, the full zero-dependency suite passed `584/584`, root/mobile
  TypeScript passed, and the JSON mobile beta doctor reports `privacy safety
  account deletion proof guard is source-backed` as `PASS`. Branch CI proved
  implementation commit `4357cf7` in `WoofWatcher Verify` run `28703690180`,
  job `85125840962`, with mobile beta doctor, focused behavior tests, and
  Typecheck plus CI-safe builds all passing; real route/auth,
  export-before-delete, data/object receipt, audit/support, recovery/cancellation,
  legal/store approval, public launch, and Apollo sign-off remain blocked.
- Local proof also hardened Privacy & Safety's payments gate on 2026-07-04:
  `paymentsEnabled` no longer marks checkout ready unless the structured
  Payments provider proof manifest is ready. Focused Privacy & Safety/mobile
  readiness tests passed `123/123`, the full zero-dependency suite passed
  `585/585`, root/mobile TypeScript passed, and the JSON mobile beta doctor
  reports `privacy safety payments proof guard is source-backed` as `PASS`.
  Branch CI proved implementation commit `5774048` in `WoofWatcher Verify` run
  `28704399568`, job `85127644483`; Setup pnpm, Setup Node, install, JSON
  mobile beta doctor, focused behavior tests, Typecheck plus CI-safe builds,
  post steps, and Complete job all passed. Real product ids, billing path
  decision, iOS App Store and Android Google
  Play sandbox receipts, restore purchases, refund/support approval, store
  approval, public launch, and Apollo checkout sign-off remain blocked.
- Branch CI also proved the focused payments provider proof target on 2026-07-03:
  `WoofWatcher Verify` run `28676385615`, job `85050584288`, commit `3b5f4ab`,
  completed successfully in `3m3s` with Setup pnpm, Setup Node, install, JSON
  mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe builds
  all passing. This is payments proof-target routing only; paid checkout,
  sandbox receipts, restore purchases, store billing, store approval, and Apollo
  sign-off remain blocked.
- Branch CI proved the Payments store-receipt proof hardening on 2026-07-04:
  `WoofWatcher Verify` run `28695703283`, job `85104771524`, commit `b579885`,
  completed successfully in about `3m08s`. This proves the source-backed iOS App
  Store and Android Google Play receipt/restore guard only; paid checkout,
  store billing, real provider receipts, money movement, refund/tax/support
  approval, store approval, and Apollo sign-off remain blocked.
- Branch CI also proved the payments preview proof-record refresh on 2026-07-03:
  `WoofWatcher Verify` run `28676751250`, job `85051688167`, commit `00b7f15`,
  completed successfully in `3m2s` with Setup pnpm, Setup Node, install, JSON
  mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe builds
  all passing. This is recorded proof freshness only; rerun CI after newer
  commits before treating dependency proof as current.
- Branch CI also proved the focused store accounts proof target on 2026-07-03:
  `WoofWatcher Verify` run `28677469355`, job `85053786318`, commit `182ed7d`,
  completed successfully in `2m55s` with Setup pnpm, Setup Node, install, JSON
  mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe builds
  all passing. This is store proof-target routing only; account creation,
  metadata/screenshot approval, App Review or Play review submission,
  legal/privacy approval, and Apollo sign-off remain blocked.
- Branch CI also proved the focused account deletion proof target on 2026-07-03:
  `WoofWatcher Verify` run `28678013555`, job `85055419174`, commit `51ecca7`,
  completed successfully in `2m56s` with Setup pnpm, Setup Node, install, JSON
  mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe builds
  all passing. This is account-deletion proof-target routing only; destructive
  deletion, provider data/storage deletion, privacy/legal approval, store
  deletion compliance, and Apollo sign-off remain blocked.
- The mobile package now has a `smoke:runtime` alias that starts a disposable
  static runtime over `.expo-smoke`, verifies 13 exported mobile routes return
  the Expo web shell, including `/sign-in` and `/setup`, and exits without
  leaving a server running.
- The mobile package now has `preview:smoke` and `preview:web` aliases for the
  no-dependency static server, both pinned to port `4194`, and the root
  `preview:mobile-beta` command points to the same handoff path.
- The mobile package also has `proof:live-preview`, which starts a disposable
  static preview server over `.expo-smoke`, verifies 18 launch-critical preview
  routes return the Expo web shell, including `/sign-in`, `/setup`, Auth/Setup,
  WoofGuide AI, push, payments, store accounts, account deletion, care-entry
  sync, Records handoff, report binary export, and Route Visual Consistency proof targets, and
  emits JSON proof with web-preview-only truth boundaries before helpers keep
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
- Auth gateway and Setup onboarding now expose `Open setup proof` to jump to
  `/care-twin-qa?qaSurface=auth-setup-onboarding-proof` from the actual
  sign-in/sign-up or local setup path. This shortcut still requires real
  iOS/Android proof and real provider evidence before any provider-backed auth
  or household sync claim.
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
  ids, the App Store/Google Play/Stripe or web checkout decision, iOS App Store
  and Android Google Play sandbox receipt tests, entitlement mapping,
  refund/support policy, and checkout-gate
  proof before paid checkout can be enabled. Share Beta Handoff prints those
  proof steps, and the payments row now opens
  `/care-twin-qa?qaSurface=payments-provider-proof` for focused helper capture,
  but checkout remains disabled until Apollo and the store/provider evidence is
  attached.
- Provider Launch Setup's WoofGuide AI gate now carries a `WoofGuide AI
  provider proof packet` requiring OpenAI key location, approved model policy,
  source/citation rules, owner-review write gate, veterinary safety boundary,
  and fallback/incident handling before live AI can be enabled. Share Beta
  Handoff prints those proof steps, and the WoofGuide AI row now opens
  `/care-twin-qa?qaSurface=woofguide-ai-provider-proof` for focused helper
  capture, but this does not configure an OpenAI key, approve a model, enable
  live AI, allow automatic care-log writes, or clear veterinary/safety review.
- Provider Launch Setup's Self-serve account deletion gate now carries a
  `Self-serve account deletion proof packet` requiring the deletion route and
  reauthentication gate, export-before-delete handoff, data/object deletion
  receipt, audit/support receipt, recovery-window cancellation rules, and
  legal/store approval before destructive deletion can be enabled. Share Beta
  Handoff prints those proof steps, and the account deletion row now opens
  `/care-twin-qa?qaSurface=account-deletion-proof` for focused helper capture,
  but this does not enable production deletion, delete provider data, satisfy
  store review, or replace Apollo/legal approval.
- The Account deletion proof manifest now rejects generic approval notes. Helpers
  must attach structured deletion-route/auth, export-before-delete, data/object
  deletion receipt, audit/support receipt, recovery/cancellation, and
  legal/store/Apollo proof files with MIME, byte size, and row-specific fields
  before destructive deletion can move to review.
- Provider Launch Setup's Apple and Google store accounts gate now carries an
  `Apple and Google store accounts proof packet` requiring Apple Developer team
  id, App Store Connect app record, Google Play package record, bundle ids,
  reviewer access notes, screenshots/metadata ownership, and release role
  approval before store submission can be claimed. Share Beta Handoff prints
  those proof steps, and the store accounts row now opens
  `/care-twin-qa?qaSurface=store-accounts-proof` for focused helper capture, but
  this does not create store accounts, approve metadata, submit the app, satisfy
  App Review or Play review, or replace Apollo approval.
- The Store accounts proof manifest rejects generic approval notes. Helpers must
  attach platform/store-named iOS App Store Connect developer account proof,
  Android Google Play package proof, shared bundle/signing proof, reviewer access
  proof, metadata/privacy proof, and Apollo release approval/no-submit-boundary
  proof before `App submission allowed` can become `Yes`.
- Provider Launch Setup's Push notifications gate now carries a `Push
  notifications proof packet` requiring Expo push project config, APNs
  credentials, Firebase/FCM credentials, permission prompt copy, quiet hours,
  opt-out behavior, and platform/provider-named native delivery QA before
  reminder delivery can be claimed.
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
  generator, structured provider storage proof, and generated artifact evidence needed
  before binary PDF/PNG readiness can be claimed.
- The Release Smoke Checklist and Share Beta Handoff now also name
  `/care-twin-qa?qaSurface=care-entry-provider-sync-proof` for Supabase
  migration/backfill, active-household cursor/tombstone RLS, retention/export/
  deletion policy, dependency proof, and mobile full-refresh sign-off before
  incremental care-entry sync can be enabled. More's Sync Health panel now opens
  the same proof mission through `Open sync proof`; this is a helper shortcut,
  not Supabase/provider approval by itself.
- The Release Smoke Checklist, Share Beta Handoff, live-preview verifier, JSON
  mobile beta doctor, and native QA tooling doctor now also name
  `/care-twin-qa?qaSurface=woofguide-ai-provider-proof` for OpenAI key location,
  secret storage, approved model policy, source/citation rules, owner-review
  write gate, veterinary safety boundary, fallback/incident handling, rollback
  plan, and support handoff before live AI can be enabled. More's WoofGuide AI
  provider row opens the same proof mission; this is a helper shortcut, not
  OpenAI configuration, model approval, automatic-write approval, or
  veterinary/safety sign-off by itself.
- The WoofGuide AI proof manifest rejects generic approval text. Helpers must
  attach structured proof files for OpenAI secret storage, approved model
  policy, source/citation rules, owner-review write gate, veterinary safety
  boundary, and fallback/incident handling before `Live AI allowed` can become
  `Yes`.
- The Release Smoke Checklist, Share Beta Handoff, live-preview verifier, JSON
  mobile beta doctor, and native QA tooling doctor now also name
  `/care-twin-qa?qaSurface=push-notifications-proof` for Expo push project
  config, APNs credentials, Firebase/FCM credentials, permission prompt copy,
  quiet hours, opt-out behavior, platform/provider-named iOS APNs and Android
  FCM delivery evidence, and missed-notification fallback before reminder
  delivery can be claimed. This is a proof target, not provider
  configuration or native delivery evidence by itself.
- The Release Smoke Checklist, Share Beta Handoff, live-preview verifier, JSON
  mobile beta doctor, and native QA tooling doctor now also name
  `/care-twin-qa?qaSurface=payments-provider-proof` for Plus and Family product
  ids, billing path decision, iOS App Store and Android Google Play sandbox
  purchase/renewal/cancel/refund/expired JSON receipt proof, restore purchases,
  entitlement mapping, refund/support policy,
  and checkout-gate evidence before paid checkout can be enabled. More's Plus
  payments provider row opens the same proof mission; this is a helper shortcut,
  not payments provider configuration, sandbox receipt proof, money movement, or
  Apollo/store approval by itself.
- The Release Smoke Checklist, Share Beta Handoff, live-preview verifier, JSON
  mobile beta doctor, and native QA tooling doctor now also name
  `/care-twin-qa?qaSurface=store-accounts-proof` for Apple Developer team id,
  App Store Connect app record, Google Play package record, platform/store-named
  iOS App Store Connect developer account proof, Android Google Play package
  proof, shared bundle/signing proof, reviewer access, metadata/privacy, Apollo
  release approval, no-submit boundary, and store submission proof before App
  Review or Play review readiness can be claimed. More's Apple and Google store accounts row
  opens the same proof mission; this is a helper shortcut, not account creation,
  metadata approval, store submission, or Apollo sign-off by itself.
- The Release Smoke Checklist, Share Beta Handoff, live-preview verifier, JSON
  mobile beta doctor, and native QA tooling doctor now also name
  `/care-twin-qa?qaSurface=account-deletion-proof` for self-serve deletion
  route, reauthentication, export-before-delete warning, data/object deletion
  receipt, audit trail, support receipt, recovery-window policy, cancellation
  behavior, and legal/store approval before destructive account deletion can be
  enabled. More's Self-serve account deletion row opens the same proof mission;
  this is a helper shortcut, not provider deletion, privacy/legal approval,
  App Store/Play Store compliance, or Apollo sign-off by itself.
- The Release Smoke Checklist, Share Beta Handoff, live-preview verifier, JSON
  mobile beta doctor, and native QA tooling doctor now also name
  `/care-twin-qa?qaSurface=support-legal-readiness-proof` for structured proof
  files covering support inbox, privacy policy and terms links,
  refund/subscription policy, veterinary and emergency boundary, deletion
  escalation, incident response owner, and Apollo launch approval/no-launch
  boundary before public launch can be claimed. Privacy & Safety's Support
  runbook card opens the same proof mission; this is a helper shortcut, not
  legal/privacy approval, refund/subscription approval, support-operation
  approval, veterinary-boundary sign-off, public launch approval, or Apollo
  sign-off by itself.
- The Support legal readiness proof manifest now rejects generic approval notes.
  Helpers must attach structured proof files for support inbox, privacy policy
  and terms, refund/subscription, veterinary/emergency boundary, deletion
  escalation, incident response owner, and Apollo launch approval/no-launch
  boundary before public launch can move to review. Share Beta Handoff and the
  JSON doctors name those file requirements with MIME, byte size, and
  row-specific approvals; this is proof gating, not legal/privacy approval,
  support-operation approval, public launch approval, or Apollo sign-off.
- The Support runbook now consumes that same structured proof manifest before
  its public-launch verdict can open. Local proof on 2026-07-04 first showed
  support/legal approval booleans and policy links producing `launchReady: true`
  without proof files, then passed focused Support Runbook/mobile readiness
  tests `121/121`, the full zero-dependency suite `586/586`, root/mobile
  TypeScript, and JSON doctor `support runbook proof guard is source-backed`.
  Branch CI proved implementation commit `ceecc55` in `WoofWatcher Verify` run
  `28705194968`, job `85129614020`; Setup pnpm, Setup Node, install, JSON
  mobile beta doctor, focused behavior tests, Typecheck plus CI-safe builds,
  post steps, and Complete job all passed. Branch-head proof-doc CI also passed
  for commit `58fe904` in run `28705426671`, job `85130189337`. Real
  support/legal proof files, store review, public launch, and Apollo sign-off
  remain blocked.
- Reminder Center now surfaces the same launch boundary in-product: provider
  configuration status, permission readiness, quiet-hours policy, and opt-out
  copy stay visible in Calendar before push delivery is enabled. Calendar can
  now save local push preference intent, a 9:00 PM-7:00 AM quiet-hours window,
  and opt-out state into the care document and privacy export. This is still a
  local preference/readiness boundary only; it does not configure Expo/APNs/FCM,
  deliver notifications, prove native delivery, or replace Apollo approval.
- Reminder Center now also consumes the structured Push notifications proof
  manifest before Calendar can treat push as provider-backed. Provider-approved
  setup plus granted permission can stage owner review, but provider-backed
  notification status stays local/in-app until structured Expo/APNs/FCM,
  permission, quiet-hours, opt-out, and native delivery proof files make
  `Reminder delivery allowed` true.
- Records Dog ID can now share a local SVG image-source credential file beside
  the local printable HTML credential file, and Records can generate a local Dog
  ID PNG plus local Care Pass PDF bytes for Report History. Native iOS/Android
  share/reopen proof and provider storage approval are still required before
  PDF/PNG export readiness can be claimed.
- Provider Launch Setup's Records/media storage gate now carries the Report
  binary export proof packet for local Care Pass PDF and Dog ID PNG artifact
  bytes, structured provider storage proof, native share/reopen proof, and iOS/Android
  artifact proof.
  The local Records route now implements the first PDF/PNG byte generation
  path, but the packet remains blocked until native share/reopen evidence and
  provider storage proof are attached.
- The Release Smoke Checklist and JSON doctor now include the `smoke:runtime`
  route proof between `smoke:web` and preview handoff, so helpers can confirm
  exported routes load before they keep the preview server open for visual QA.
- The Release Smoke Checklist and Share Beta Handoff now include a dedicated
  `Live preview handoff proof` section for branch CI, JSON doctor/export/runtime
  proof, `proof:live-preview` JSON route proof, `preview:smoke` output,
  `http://127.0.0.1:4194/`, and browser-open evidence while saying live preview
  proof does not replace native iOS/Android proof.
- Share Beta Handoff now also carries a `Recorded live preview proof` section
  from a recorded local `proof:live-preview` run generated
  `2026-07-03T19:45:52.244Z` on commit `0d363de`: `19/19` web-preview route shell
  checks passed against the existing `.expo-smoke` export, including sign-in,
  setup, Auth/Setup onboarding proof, Records file handoff, report binary export
  proof, care-entry sync proof, WoofGuide AI provider proof, push notifications
  proof, payments provider proof, store accounts proof, account deletion proof,
  support legal readiness proof, and route visual consistency. The recorded verifier URL is
  disposable; the review handoff URL remains `http://127.0.0.1:4194/` after
  `preview:smoke` is running. Rerun branch CI and `proof:live-preview` after new
  commits/exports before treating this proof as current, and do not use it as
  native iOS/Android proof.
- Provider Launch Setup now also shows a proof-needed checklist for every
  production provider gate in More and in the share packet: Clerk, Supabase/RLS,
  storage signed uploads, WoofGuide AI policy, payments, push, Apple/Google
  store accounts, and account deletion evidence.
- Provider Launch Setup now also highlights the single `Next provider gate`
  with owner/action/proof and prioritizes open rows before ready rows, so Apollo
  or a helper can close real provider proof without guessing which gate comes
  next.
- Provider Launch Setup now clamps Launch Readiness input to
  `provider-approved` status. Owner-reviewed local rows can stage proof work,
  but they no longer make release packets or store gates behave as if real
  Clerk/Supabase/storage/AI/payments/push/store/deletion providers are approved.
- More Launch Readiness now follows the same provider proof boundary for
  production auth and database readiness. Local sign-in, local household state,
  and non-attention sync status do not count as Clerk/Supabase launch proof.
- More Launch Readiness also keeps WoofWatcher Plus checkout in review when
  payment provider proof is staged but store-account approval, privacy/legal
  approval, or support/refund policy approval are still open. `Checkout ready`
  is reserved for the moment those payment obligations are actually closed.
- Provider Launch Setup row status now uses the same boundary. Local-draft and
  owner-reviewed toggles show as `Local staged` or `Owner staged`, stay in the
  open-provider list, keep `nextGate` active, and do not increase the
  provider-approved progress score until the saved provider status is
  `provider-approved`.
- Provider Launch Setup visible rows now show up to three proof checklist steps
  plus a `More proof steps` count. Use `Share Provider Plan` for the complete
  checklist, and do not treat a single visible proof line as enough to clear
  Supabase/RLS, PDF/PNG artifact, structured storage proof, or native proof blockers.
- Provider Launch Setup also gives the auth, database, storage, WoofGuide AI, payments, push, store accounts, and account deletion rows an
  `Open proof mission` action to the matching focused `/care-twin-qa` surface:
  Auth/Setup onboarding proof, Care-entry provider sync proof, Report binary
  export proof, WoofGuide AI Provider Proof, Payments Provider Proof, Push
  notifications proof, Store Accounts Proof, and Account Deletion Proof. These are capture shortcuts only;
  they do not replace provider credentials, native screenshots, store submission
  evidence, destructive deletion evidence, AI/model/safety approval, legal/store approval, or Apollo approval.
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
