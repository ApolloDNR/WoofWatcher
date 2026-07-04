# WoofWatcher Product Quality Gates

This file defines the gates required before calling WoofWatcher a Full Premium Release.

## Gate 1: Product Scope

Status: In progress.

Passing evidence:

- `docs/ULTIMATE_RELEASE_PLAN.md` exists and lists feature map, status, gaps, queue, decisions, and blockers.
- Every major feature has a current status and release gap.
- No major workstream depends only on chat memory.

Current gaps:

- Need Apollo confirmation for any inaccessible shared ChatGPT source material.
- Need final launch target and monetization decision.

## Gate 2: Core Mobile Experience

Status: In progress.

Passing evidence:

- Account sign-in/sign-up works in Expo.
- Onboarding creates household, dog profile, diet baseline, and routines.
- Today Command gives a clear next action.
- Quick Log and Full Log cover all required care event types.
- Calendar/routines can be assigned and completed.
- Records, handoff, reports, and WoofGuide route to useful workflows.
- Exported mobile web-runtime smoke exercises Home, Log, Plans, Health, Records, More, Care Twin QA, WoofGuide, Premium, Privacy, and Avatar Studio routes from `.expo-smoke` without leaving a preview server running.
- Dog profile credential fields feed the Records ID card, share text, and escaped print-ready source.
- Records includes a Medication Plan that derives taken, due, missed, upcoming, dose, owner, logged-by, and adherence percentage from routines and medication logs.
- Home quick log and the Log composer can create medication logs with routine identity, dose, taken/skipped outcome, and household visibility.
- Records includes Medication Follow-ups that derive missed-dose, due-now, and refill due-soon/overdue owner actions from routines, logs, and medication records.
- Records includes Medication History for recent household-visible medication logs with dose, outcome, caregiver, routine id, notes, medicine/dose/caregiver/note search, and taken/skipped/missed/needs-review filters.
- Home quick log can record household-visible water refills, and Records includes Hydration status derived from visible water logs.
- Home quick log can record household-visible walk logs, the full Log composer captures route/place, distance, dog interactions, social outcome notes, and household visibility, and Records includes Walk Activity plus Saved Routes derived from visible walk logs, duration, places/routes, dog interactions, social outcomes, and caregivers.
- Home quick log can record household-visible potty logs, the Log composer captures pee/poop kind, condition, stool color, and routine/accident/urgent/straining context, and Records includes Potty Health derived from visible potty logs, stool review signals, colors, context, conditions, and caregivers.
- Records includes Weekly Care Trends that compare current and previous 7-day household-visible care windows across meal completion, walk minutes, water refills, potty/medication/health watch signals, and caregiver participation.
- The Log composer captures structured training skill/cue, win/practice/struggle outcome, duration, next-practice notes, and household visibility, and Records includes Training Progress derived from visible training logs.
- The Log composer captures Alone Time duration, return state, trigger/context, calming support, recovery minutes, sticky notes, and household visibility, and Records includes Alone Time patterns derived from visible departure logs.
- Records Weight Trend now uses shared care-domain logic for visible weigh-ins, profile fallback, goal distance, and chart inputs, and Care Pass reports include the same Weight Trend context.
- The Log composer captures Grooming Care type, duration, coat/skin notes, products/groomer context, next due date, sticky notes, and household visibility, and Records includes Grooming Care derived from visible grooming logs.
- Dedicated Setup route can save dog profile, diet baseline, starter routine, and household caregiver basics in one flow.
- Log entries have a detail sheet with sticky notes, audit trail history, sync/error visibility, edit/delete actions, and shareable handoff text.
- Log exposes a durable Offline Outbox banner for local, pending, and failed care-entry changes with retryable create/update counts and a Retry sync action.
- More exposes household Sync Health with healthy/loading/syncing/attention status, care-log count, household member count, outbox count, and retry/refresh guidance.
- Calendar and More expose Household Responsibility derived from routine-board truth, including care-team routine ownership, open/overdue/unassigned counts, visible today log activity, and a next household action.
- More exposes Household Access derived from synced account members, local-only caregivers, routine-only owners, invite readiness, permission labels, and next-step copy.
- More exposes Access Passes for local sitter/trainer/vet/emergency helper permission drafts plus My Care Today assigned-care workload, without claiming provider-backed remote access is live.
- Calendar exposes Reminder Center derived from routine-board status, medication follow-ups, record reminders, and grooming due dates, with urgency counts, explicit notification-readiness copy, and row routing to routine edit, Records, Medication log, or Grooming log before provider-backed push delivery exists.
- Log search combines text query and type filters across titles, notes, caregivers, nested details, route/place fields, medication fields, and sticky notes with owner-readable summary and empty-state copy.
- Care document refresh keeps newer local/offline profile, routine, record, and report changes when server care-state data is older, then pushes the newer doc back to the household.
- Care entry refresh stays in full-refresh mode until the API exposes a real `updatedAt` cursor and delete tombstones, so mobile sync does not misuse the occurrence-time `since` filter as provider-ready incremental sync.
- Care Pass reports can be previewed by audience before sharing.
- Shared Care Passes are stored as report-history artifacts for quick resend, with visible print-ready/restored metadata and escaped HTML payloads for future PDF/export flows.
- Records show expired, due-soon, current, and reference status for saved record rows.
- WoofGuide shows deterministic suggested actions tied to health watch, record attention, diet setup, routines, meal logging, and Care Pass preview.
- More exposes a local CareTwin Roster with the active live dog, provider-gated future pet slots, Add future dog flow, and no fake switching before scoped multi-dog care documents exist.
- Empty, loading, error, offline, pending, synced, and failed states are visible.

Current gaps:

- Shared onboarding readiness exists and is used by the Today setup nudge. The care foundation setup route exists, but auth-connected account provisioning, invite approval, and post-setup confirmation remain incomplete.
- Provider-backed multi-dog care documents/switching, provider-backed role enforcement beyond existing household/helper routes, server-backed report storage, record document storage, provider-backed reminder delivery, formal Alone Time trigger plans, richer weight-goal plans, native/provider proof for generated PDF/PNG artifacts, and broader role/document/account audit policy need implementation. The focused Report Binary Export Proof route now renders the generator/storage/native-proof manifest and keeps `Generated artifacts allowed: No`; Records creates local Care Pass PDF and Dog ID PNG bytes without claiming native share/reopen or provider storage readiness.
- Native simulator/device runtime smoke still needs configured iOS/Android tooling; exported web-runtime route smoke does not replace native rendering.

## Gate 3: Care Domain Correctness

Status: Partially passing.

Passing evidence:

- Focused tests cover event normalization, day status, care sync, Today Command, setup wizard, diet progress, medication quick-log defaults, medication composer wiring, medication adherence, medication follow-ups, medication history search/outcome filters, water quick-log defaults, hydration summaries, hydration Care Pass language, mobile Records hydration wiring, walk quick-log visibility, walk activity summaries, saved walk route templates, walk activity and Saved Routes Care Pass language, mobile Records walk activity wiring, full Log walk route fields, Full Log search derivation and mobile wiring, potty quick-log visibility, potty composer detail fields, Potty Health summaries, Potty Health color/context review evidence, Potty Health Care Pass language, mobile Records Potty Health wiring, Weekly Care Trends derivation, Care Pass trend language, mobile Records trend wiring, Training Progress derivation, Log composer training fields, trainer Care Pass training language, mobile Records training wiring, Alone Time derivation, Log composer Alone Time fields, Care Pass Alone Time language, mobile Records Alone Time wiring, Weight Trend derivation, Care Pass Weight Trend language, mobile Records Weight Trend wiring, Grooming Care derivation, Log composer grooming fields, Care Pass Grooming Care language, mobile Records Grooming Care wiring, Reminder Center derivation, Calendar wiring, and action routing, Household Responsibility derivation, Calendar/More responsibility wiring, Household Access derivation and More wiring, Access Pass local-draft permissions, My Care Today derivation, More Access Pass/My Care Today wiring, local CareTwin roster readiness, Care Log Audit Trail derivation and mobile Log wiring, Care Pass medication language, mobile Records medication wiring, health handoff, care pass, Care Pass artifact snapshots, print-ready Care Pass HTML, legacy printable artifact recovery, record vault, pet credential fallbacks, print-ready Dog ID credentials, record due-status, routine board, sticky notes, and WoofGuide action cards.
- Shared logic lives in `lib/care-domain`.

Current gaps:

- Add more edge-case tests for recurring routines, medication schedules, provider-backed notifications, multi-dog state, and report generation.
- Add API integration coverage for domain-backed routes.

## Gate 4: Backend And Data

Status: In progress.

Passing evidence:

- API server typechecks and builds in CI.
- API includes auth, household, care state, care entries, health, avatar, and WoofGuide-related routes.
- Production CORS is documented and guarded.
- Care-entry list queries now have a tested shared normalizer that preserves valid incremental `since` pulls, clamps `limit`, rejects malformed `since` values with a typed `400`, and keeps OpenAPI/generated-client readiness aligned.

Current gaps:

- Need broader integration tests for authenticated household-scoped routes.
- Need provider storage for record documents, generated reports, credential images, and binary export proof artifacts; local Care Pass PDF and Dog ID PNG generation exists, but storage, retention/export/deletion, and native share/reopen proof remain launch blockers.
- Need provider-backed role-aware permissions beyond existing care-entry and household helper APIs, broader audit trail policy for documents/accounts, provider migration/RLS/retention rules for household audit rows, scheduled or owner-facing cleanup for expired Access Pass helper memberships, and provider-backed data export/delete paths. Request-time helper expiry enforcement exists now.
- Need deeper multi-device conflict policy, server-backed delete/edit retention rules, and native offline recovery QA.

## Gate 5: AI Safety And Usefulness

Status: In progress.

Passing evidence:

- WoofGuide direction is documented.
- Medical boundary is documented.
- AI helper routes exist.
- Deterministic WoofGuide action-card model and tests exist before action writes are enabled.

Current gaps:

- Need structured action execution for log drafts, reminders, vet notes, and report drafts.
- Need assistant source/context display.
- Need vet-note/report drafting flow.
- Need hard checks that AI does not diagnose or claim emergency certainty.

## Gate 6: Premium UI, Motion, And Accessibility

Status: In progress.

Passing evidence:

- Warm brand assets and Phoenix art exist.
- Mobile screens have functional product surfaces.
- Home has a tested avatar motion state model and visible motion row that connects avatar state to Health Watch, recent logs, routine status, quiet hours, and low energy.

Current gaps:

- Need design system.
- Need screen-by-screen polish.
- Need full motion spec, Rive/Lottie/Reanimated asset pipeline, transition rules, and runtime animation QA.
- Need full accessibility pass. Critical action screen-reader labels are covered by focused static smoke, but contrast, dynamic type, keyboard flow, touch targets, and native screen-reader traversal still need QA.
- Need visual regression or screenshot review.
- Need Figma alignment if Figma becomes the canonical design source.

## Gate 7: QA And CI

Status: Partially passing.

Passing evidence:

- GitHub Actions `WoofWatcher Verify` passes on `main`.
- CI installs with frozen lockfile, runs focused tests, typechecks, builds API, builds web prototype, and builds mockup sandbox.
- Local zero-dependency focused tests can run with bundled Node.
- Local API parser/readiness proof now covers the care-entry occurrence query, server `updatedAt` cursor query, delete tombstone route, and generated-client/spec contract.
- Local API route integration proof now hits the real Express care-entry handlers through an injectable router factory for server cursor reads, ambiguous cursor rejection, tombstone reads, and invalid tombstone cursor rejection without requiring live provider credentials.
- Local mobile readiness proof now protects the full-refresh boundary for care entries until provider migration/RLS, retention policy, and mobile incremental adoption are verified against the server cursor/delete-tombstone contract.
- Provider Launch Setup now exposes the exact Supabase migration/backfill, active-household RLS, retention/export/deletion, and mobile full-refresh sign-off proof needed for `care_entries.updated_at`, `care_entry_tombstones`, `/care-entries?updatedSince=`, and `/care-entries/tombstones?updatedSince=` before incremental sync can be claimed.
- The care-entry provider sync proof packet now structures that provider gate into Supabase project, migration/backfill, active-household RLS, retention/export/deletion, dependency-complete build, and mobile incremental sign-off evidence; the checklist appears in Provider Launch Setup, More, and Share Beta Handoff.
- The focused Auth/Setup proof manifest now surfaces Clerk production app, redirect/deep-link, native Auth screenshot, Setup local-preview, household sync, and launch-gate blockers on `/care-twin-qa?qaSurface=auth-setup-onboarding-proof`; the route shows `Native proof allowed: No` until real Clerk/provider proof, iOS/Android screenshots, household sync evidence, and Apollo approval are attached. Branch CI proved this focused manifest guard in `WoofWatcher Verify` run `28690620657`, job `85091134806`, on commit `e8a1ea9`. The manifest now also requires four platform-and-surface-specific native screenshot proofs for iOS Auth gateway, Android Auth gateway, iOS Setup local-preview, and Android Setup local-preview before generic native Auth/Setup readiness can open; branch CI proved that stricter guard in `WoofWatcher Verify` run `28694530592`, job `85101746726`, on commit `581b8b1`.
- The focused Records local-file handoff proof manifest now structures the native Records file-proof gate into Care Pass Report History local HTML, Dog ID local HTML credential, Dog ID SVG image source, native share-sheet behavior, Android content URI or saved-file proof, fallback copy, and generated PDF/PNG/provider boundary evidence; the focused `/care-twin-qa?qaSurface=records-local-file-handoff` route shows `Native file proof allowed: No` until real iOS/Android share evidence and notes are attached. Branch CI proved this focused manifest guard in `WoofWatcher Verify` run `28691115501`, job `85092467507`, on commit `8268809`. The manifest now also requires six platform-and-file-specific native proofs for iOS/Android Care Pass HTML, Dog ID HTML, and Dog ID SVG, plus Android `content://` or `file://` URI proof, before generic native file readiness can open; branch CI proved that stricter guard in `WoofWatcher Verify` run `28693966672`, job `85100292756`, on commit `97fa65a`.
- The Push notifications proof manifest now structures the reminder-delivery provider gate into Expo push project config, APNs credentials, Firebase/FCM credentials, permission prompt/preference copy, quiet-hours/opt-out behavior, and delivery QA evidence; the focused `/care-twin-qa?qaSurface=push-notifications-proof` route shows `Reminder delivery allowed: No` until real provider proof and iOS/Android delivery evidence are attached. The manifest now also requires platform/provider-specific iOS APNs and Android FCM delivery proofs with file/URI naming, image MIME, byte size, token registration, delivered reminder, permission preference, quiet-hours or opt-out, and fallback capture before generic push readiness can open; branch CI proved that stricter guard in `WoofWatcher Verify` run `28695138006`, job `85103354696`, on commit `1772aed`.
- The Payments provider proof manifest now structures the paid-checkout provider gate into product catalog, billing path decision, sandbox receipts, entitlements and restore, refund/support policy, and checkout gate evidence; the focused `/care-twin-qa?qaSurface=payments-provider-proof` route shows `Checkout allowed: No` until real billing, receipt, restore, refund/support, store, and Apollo checkout proof are attached. Branch CI proved this focused manifest guard in `WoofWatcher Verify` run `28690249414`, job `85090172228`, on commit `12c63eb`. The manifest now also requires separate iOS App Store and Android Google Play sandbox receipt evidence with platform/store naming, JSON MIME, byte size, product id, transaction id, purchase, renewal, cancellation, refund, expiration, and `restorePurchaseConfirmed` before generic payment approval flags can open checkout; branch CI proved that stricter guard in `WoofWatcher Verify` run `28695703283`, job `85104771524`, on commit `b579885`.
- The Store accounts proof manifest now structures the App Store/Play submission gate into Apple Developer/App Store Connect access, Google Play package record, bundle/signing ownership, reviewer access/test credentials, screenshots/metadata ownership, privacy-label readiness, and release role approval evidence; the focused `/care-twin-qa?qaSurface=store-accounts-proof` route shows `App submission allowed: No` until real Apple/Google account and approval proof are attached.
- The Store accounts proof manifest also rejects generic Apple/Google approval notes. The gate now requires structured platform/store-named proof files with MIME, byte size, account ids, roles, bundle/package ownership, reviewer access, metadata/privacy approvals, Apollo release approval, and no-submit-boundary evidence before app submission can be treated as reviewable.
- The Account deletion proof manifest now structures the self-serve deletion compliance gate into deletion route/auth, export-before-delete handoff, data/object deletion receipt, audit/support receipt, recovery/cancellation policy, and legal/store approval evidence; the focused `/care-twin-qa?qaSurface=account-deletion-proof` route shows `Destructive deletion allowed: No` until provider, legal, store, and Apollo approval proof are attached.
- The Support legal readiness proof manifest now structures the support/privacy/legal/refund/veterinary-boundary launch gate into support inbox, privacy policy and terms links, refund/subscription policy, veterinary and emergency boundary, deletion escalation, incident response owner, and Apollo approval evidence; the focused `/care-twin-qa?qaSurface=support-legal-readiness-proof` route shows `Public launch allowed: No` until real support/legal, store-review, and Apollo approval proof are attached.
- The WoofGuide AI provider proof manifest now rejects generic provider/model/source/write-gate/veterinary/fallback approval strings. Live AI remains blocked until six structured proof files cover OpenAI secret storage, approved model policy, source/citation rules, owner-review write gate, veterinary safety boundary, and fallback/incident handling with proof naming, MIME, byte size, required policy fields, and safety booleans.
- Provider Launch Setup now also carries the Report binary export proof packet under Records and media storage, requiring local Care Pass PDF and Dog ID PNG artifact bytes, provider storage policy, native share/reopen proof, and iOS/Android artifact proof before binary export readiness can be claimed.
- `/care-twin-qa?qaSurface=report-binary-export-proof` now turns that packet into a focused launch-critical QA target for generated file name/size/MIME/share proof, provider storage policy, and iOS/Android artifact evidence.
- The focused Report Binary Export Proof route now renders the `Report binary export proof manifest` directly, with Care Pass PDF, Dog ID PNG, provider storage, and native artifact proof rows, `Generated artifacts allowed: No`, blockers, and a boundary that native share/reopen, renderer approval, provider storage, app-store review, public launch, and Apollo sign-off remain blocked. Branch CI proved this focused manifest guard in `WoofWatcher Verify` run `28691498890`, job `85093511875`, on commit `822ff54`.
- The generated Report Binary Export manifest now treats native proof as four concrete slots, not one approval boolean: iOS Care Pass PDF, Android Care Pass PDF, iOS Dog ID PNG, and Android Dog ID PNG. Each slot needs platform/artifact naming, MIME, positive byte size, share proof, and reopen proof before `Generated artifacts allowed` can ever move toward `Yes`. Branch CI proved this guard in `WoofWatcher Verify` run `28693395380`, job `85098728807`, on commit `41de898`.
- The Route Visual proof manifest now requires route-named iOS/Android evidence per route instead of treating generic platform screenshot counts as complete proof. Generic six-iOS/six-Android attachments still count in the summary, but Home, Log, Plans, Health, Records, and More stay blocked until the evidence file name or URI names that route for that platform. Branch CI proved this guard in `WoofWatcher Verify` run `28691984899`, job `85094842263`, on commit `f273d3e`. This keeps visual proof blocked until actual route screenshots and human review exist.
- Records now generates local Care Pass PDF and Dog ID PNG bytes with file name, MIME type, and byte-size metadata, and the mobile beta doctor guards `generated binary artifact exports are source-backed`; this is local artifact generation only, not native iOS/Android share/reopen approval or provider storage readiness.
- The Release Smoke Checklist now gives Apollo/Replit one source-backed rehearsal for dependency/export proof, route rehearsal, Records local HTML export truth, provider proof gates including the Report binary export proof packet, native/store proof, and launch truth boundaries inside Share Beta Handoff and the JSON mobile beta doctor. It also names the focused Records handoff target at `/care-twin-qa?qaSurface=records-local-file-handoff` for Care Pass local HTML, Dog ID local HTML, Dog ID SVG, Android content URI, fallback copy, and still-pending PDF/PNG/provider proof.
- `build:ci` now runs the mobile `smoke:web` export, `smoke:runtime`, and `proof:live-preview`; the runtime smoke verifies 11 exported routes return the Expo web shell, and the live-preview proof verifies 10 launch-critical preview handoff routes with web-preview-only truth boundaries.
- GitHub Actions now runs `pnpm run doctor:mobile-beta:json` after frozen dependency install with pinned `pnpm@10.24.0`, before focused tests and `build:ci`, so the machine-readable beta dependency/export gate is covered by branch CI.
- Share Beta Handoff now includes recorded branch `WoofWatcher Verify` proof for run `28692423522`, job `85096033279`, commit `fd3a98f`, while explicitly requiring a rerun after any new commit and saying CI proof does not approve native screenshots, provider setup, store approval, or Apollo sign-off. The proof-refresh commit itself was later proven by branch CI run `28692782500`, job `85096979911`, on commit `4254e05`.

Current gaps:

- Local JSON mobile beta doctor still blocks in this Codex checkout because the local pnpm CLI is `11.7.0` while the repo is pinned to `10.24.0`; Corepack is not on PATH.
- Need actual provider migration/RLS proof, retention/export/deletion approval, dependency-complete provider integration evidence, and native QA proof before care-entry incremental sync can replace full-refresh mobile behavior.
- Need actual Expo/APNs/FCM configuration, notification permission/legal approval, quiet-hours/opt-out sign-off, and native iOS/Android delivery evidence before Reminder Center can claim provider-backed push delivery.
- Need exact Plus/Family product ids, billing path decision, real iOS App Store and Android Google Play sandbox purchase/renewal/cancel/refund/expired JSON receipt proof, restore-purchase proof, entitlement mapping, refund/support policy, store checkout approval, and Apollo sign-off before paid checkout can be enabled.
- Need real platform/store-named Apple Developer/App Store Connect access proof, Google Play package proof, reviewer credentials, screenshots/metadata/privacy-label proof, release-role approval, no-submit-boundary proof, and Apollo store-submission sign-off before App Review or Play review can be claimed.
- Need provider-backed deletion route, reauthentication, export-before-delete approval, data/object deletion receipts, audit/support receipt, recovery/cancellation policy, privacy/legal/store approval, and Apollo sign-off before destructive account deletion can be enabled.
- Need approved support inbox ownership, privacy policy and terms links, refund/subscription policy, veterinary-boundary language, deletion escalation, incident response owner, App Store/Play review support URLs, and Apollo sign-off before public launch can be claimed.
- Need native simulator/device runtime smoke; exported web-runtime route smoke is source-backed but not native proof.
- Critical mobile action accessibility labels are covered by focused static smoke.
- Home avatar motion state and wiring are covered by focused tests.
- Medication adherence, medication follow-ups, medication history search/outcome filters, medication log defaults, Care Pass medication language, and Records/Log wiring are covered by focused tests.
- Water quick-log defaults, hydration summary logic, Care Pass hydration language, and Records hydration wiring are covered by focused tests.
- Walk quick-log visibility, full Log walk route fields, Walk Activity summary logic, Saved Routes derivation, Care Pass walk activity/Saved Routes language, and Records walk activity wiring are covered by focused tests.
- Potty quick-log visibility, potty composer stool color/context fields, Potty Health summary logic, color/context review evidence, Care Pass potty health language, and Records Potty Health wiring are covered by focused tests.
- Weekly Care Trends derivation, private-log exclusion, current-versus-previous window comparison, Care Pass trend language, and Records trend wiring are covered by focused tests.
- Training Progress derivation, private-log exclusion, Log composer skill/outcome/next-practice fields, trainer Care Pass language, and Records training wiring are covered by focused tests.
- Alone Time derivation, private-log exclusion, Log composer duration/return-state/trigger/support/recovery fields, Care Pass handoff language, and Records Alone Time wiring are covered by focused tests.
- Weight Trend derivation, private-log exclusion, profile baseline fallback, goal parsing, Care Pass report language, and Records chart wiring are covered by focused tests.
- Grooming Care derivation, private-log exclusion, Log composer type/duration/coat/products/next-due fields, Care Pass report language, and Records Grooming Care wiring are covered by focused tests.
- Reminder Center derivation, urgency sorting, private-log exclusion through the underlying care helpers, notification-readiness copy, Calendar wiring, row action routing, and Log type preselection are covered by focused tests.
- Household Responsibility derivation and Calendar/More responsibility wiring are covered by focused tests.
- Household Access derivation and More wiring are covered by focused tests.
- Access Pass derivation, local draft creation, My Care Today derivation, More wiring, and privacy export/deletion inclusion are covered by focused tests.
- Adventure Mode derivation, private quest ordering, local memory drafts, More route wiring, and privacy export/deletion inclusion are covered by focused tests.
- Care Log Audit Trail derivation and Log edit/sticky/delete/detail wiring are covered by focused tests.
- Full Log search derivation, normalized type filters, sticky-note/detail search, and mobile Log wiring are covered by focused tests.
- Durable sync outbox derivation, household Sync Health derivation, conflict-safe care document refresh reconciliation, and mobile Log/More/CareContext wiring are covered by focused tests.
- Need broader report/export tests. Owner privacy export now includes staged pet roster data.

## Gate 8: Security, Privacy, And Compliance

Status: Not passing.

Passing evidence:

- Secrets are not documented in plaintext.
- Production CORS requirement is documented.
- Medical boundary is documented.

Current gaps:

- Need privacy copy and data handling policy.
- Need role-based access control.
- Care-log edit/delete audit trail exists in mobile/domain, and household invite/member/Access Pass audit rows now have owner/admin review APIs plus request-time helper expiry enforcement. Broader record/document/account audit policy, provider migration/RLS, retention/export/deletion, and scheduled or owner-facing expired-helper cleanup remain open.
- Need document storage access rules.
- AI usage disclosure, owner care-data export, staged pet roster export, Access Pass draft export, Adventure memory export, and non-destructive deletion request preparation exist in mobile; provider-backed policy, cloud media storage, and destructive deletion still need approval.

## Gate 9: Deployment And Operations

Status: In progress.

Passing evidence:

- Environment docs exist.
- CI exists.
- Expo app identity uses release-grade WoofWatcher slug/scheme and Pegasus Dreamscapes native package identifiers instead of generated Replit placeholders.
- Mobile More now uses a tested shared launch-readiness model that prevents Store Ready from appearing until native QA evidence, provider setup, privacy/legal, support, payments, push, deletion, and store-account gates are all satisfied.

Current gaps:

- Need production environment matrix.
- Need Vercel/API/mobile deployment targets confirmed.
- Need migration runbook.
- Need monitoring/logging configuration.
- Need Expo/EAS account access, native preview builds, store screenshots, privacy manifests, and Apollo-approved TestFlight/Google Play submission. The iOS/Android EAS release path is now documented.
- Need rollback and support triage process.

## Gate 10: Business Readiness

Status: In progress.

Passing evidence:

- Monetization options are documented in the release plan.
- Free, Plus, and Family entitlement gates are defined in shared domain logic and visible on the mobile Plus screen before checkout is enabled.

Current gaps:

- Need Apollo decision on final pricing, grandfathering, trial rules, support scope, refund terms, and launch target.
- Need legal/privacy terms before paid launch.

## Current CI Baseline

Latest known passing CI after the Full Log search slice:

- Workflow: `WoofWatcher Verify`
- Branch: `main`
- Evidence: run `27370209662`, completed success on 2026-06-11 UTC

## Required Before Claiming Full Release

Do not mark Full Premium Release complete until every gate above is either passing with evidence or explicitly waived by Apollo in writing.
