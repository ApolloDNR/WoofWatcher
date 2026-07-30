# WoofWatcher Product Quality Gates

## 2026-07-30 Fixed-dark Plus and WoofGuide trust icons

The fixed-navy checkout and owner-review chips use constant bright-gold icons.
Mobile readiness rejects adaptive light-theme amber on those dark surfaces.
Native visual and screen-reader evidence remains open; checkout and live AI
remain provider-gated and owner-reviewed.

## 2026-07-30 Plus and WoofGuide console-kicker contrast

The fixed-light console bubbles use constant brand-navy ink for their compact
Plus and WoofGuide kickers. Mobile readiness rejects adaptive copper on those
scheme-independent surfaces. Native visual and screen-reader evidence remains
open; checkout and live AI remain provider-gated.

## 2026-07-30 Avatar photo-reference explanation contrast

The fixed-light Avatar Studio photo-reference card now keeps both its compact
kicker and its owner-trust explanation in constant brand-navy ink. Mobile
readiness rejects adaptive dark-theme ink on that cream surface. Native visual
and screen-reader evidence remains open.

## 2026-07-30 Decorative pixel-icon semantics

The shared pixel-art icon primitive is hidden from the accessibility tree when
it accompanies labeled care controls. Native VoiceOver and TalkBack traversal
remain open release evidence.

## 2026-07-29 WoofGuide veterinary-boundary label contrast

The fixed-light WoofGuide safety card uses constant brand-navy ink for the
compact `Not veterinary advice` label. Mobile readiness rejects adaptive
copper on that scheme-independent surface. Native iOS/Android visual and
accessibility review remain open; live AI stays provider-gated, non-diagnostic,
and owner-reviewed.

## 2026-07-28 Story Day Trail waypoint contrast

The source gate now protects constant dark boundaries around the fixed-light
real-care waypoints. Native iOS/Android visual review remains open.

## 2026-07-25 Dark-Scheme Shared Chrome

The compact shell, desktop preview frame/backdrop, and Fast Log modal now
follow the active theme instead of forcing light parchment behind dark routes.
Fixed-light Quick Log and Records art surfaces now keep constant dark contrast
for their copy and credential boundaries instead of using theme-flipping ink.
Static readiness protects the seam; native/device dark-mode visual QA remains
open.

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
- PWA WoofGuide separates a server OpenAI key signal from live AI readiness: key detection shows provider proof pending, and live helper calls stay blocked until structured AI provider proof sets `proofReady`.
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
- Need real structured OpenAI key-storage, model-policy, source/citation, owner-review write-gate, veterinary-safety, and fallback/incident proof before enabling provider-backed live AI in mobile or PWA surfaces.
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
- Provider Launch Setup now exposes the exact structured Supabase project, migration/backfill, active-household RLS, retention/export/deletion, dependency-complete build, and mobile full-refresh sign-off proof files needed for `care_entries.updated_at`, `care_entry_tombstones`, `/care-entries?updatedSince=`, and `/care-entries/tombstones?updatedSince=` before incremental sync can be claimed.
- The care-entry provider sync proof packet now rejects generic provider notes and structures that provider gate into six proof files: Supabase project id, migration/backfill, active-household cursor/tombstone RLS, retention/export/deletion, dependency-complete build, and mobile incremental sign-off. Each file must carry file name or URI, MIME, byte size, required row fields, and row-specific booleans or approvals; the checklist appears in Provider Launch Setup, More, and Share Beta Handoff.
- The focused Auth/Setup proof manifest now surfaces Clerk production app, redirect/deep-link, native Auth screenshot, Setup local-preview, household sync, and launch-gate blockers on `/care-twin-qa?qaSurface=auth-setup-onboarding-proof`; the route shows `Native proof allowed: No` until structured Clerk production, redirect/deep-link, household membership, Apollo auth launch, and iOS/Android screenshot proof files are attached. Branch CI proved this focused manifest guard in `WoofWatcher Verify` run `28690620657`, job `85091134806`, on commit `e8a1ea9`. The manifest now also requires four platform-and-surface-specific native screenshot proofs for iOS Auth gateway, Android Auth gateway, iOS Setup local-preview, and Android Setup local-preview before generic native Auth/Setup readiness can open; branch CI proved that stricter guard in `WoofWatcher Verify` run `28694530592`, job `85101746726`, on commit `581b8b1`. A follow-up hardening now keeps staged provider approval booleans blocked until the structured Auth provider proof files include locator, MIME, byte size, required row fields, and row-specific approvals; branch CI proved that provider-proof guard in `WoofWatcher Verify` run `28701069572`, job `85119051428`, on commit `6da692b`.
- The focused Records local-file handoff proof manifest now structures the native Records file-proof gate into Care Pass Report History local HTML, Dog ID local HTML credential, Dog ID SVG image source, native share-sheet behavior, Android content URI or saved-file proof, fallback copy, and generated PDF/PNG/provider boundary evidence; the focused `/care-twin-qa?qaSurface=records-local-file-handoff` route shows `Native file proof allowed: No` until real iOS/Android share evidence and notes are attached. Branch CI proved this focused manifest guard in `WoofWatcher Verify` run `28691115501`, job `85092467507`, on commit `8268809`. The manifest now also requires six platform-and-file-specific native proofs for iOS/Android Care Pass HTML, Dog ID HTML, and Dog ID SVG, plus Android `content://` or `file://` URI proof, before generic native file readiness can open; branch CI proved that stricter guard in `WoofWatcher Verify` run `28693966672`, job `85100292756`, on commit `97fa65a`.
- The Push notifications proof manifest now structures the reminder-delivery provider gate into Expo push project config, APNs credentials, Firebase/FCM credentials, permission prompt/preference copy, quiet-hours/opt-out behavior, and delivery QA evidence; the focused `/care-twin-qa?qaSurface=push-notifications-proof` route shows `Reminder delivery allowed: No` until real provider proof and iOS/Android delivery evidence are attached. The manifest now also requires platform/provider-specific iOS APNs and Android FCM delivery proofs with file/URI naming, image MIME, byte size, token registration, delivered reminder, permission preference, quiet-hours or opt-out, and fallback capture before generic push readiness can open; branch CI proved that stricter guard in `WoofWatcher Verify` run `28695138006`, job `85103354696`, on commit `1772aed`.
- Reminder Center now consumes the Push notifications proof manifest for its provider-backed notification status. A configured/provider-approved push row can stage Calendar preference review, but Calendar keeps provider-backed notifications local/in-app until structured Expo/APNs/FCM, permission, quiet-hours, opt-out, and native delivery proof files make the manifest ready. Implementation commit `c36e36e` is pushed; fresh branch CI for that commit remains pending because manual dispatch was blocked before GitHub accepted it.
- The Payments provider proof manifest now structures the paid-checkout provider gate into product catalog, billing path decision, sandbox receipts, entitlements and restore, refund/support policy, and checkout gate evidence; the focused `/care-twin-qa?qaSurface=payments-provider-proof` route shows `Checkout allowed: No` until real billing, receipt, restore, refund/support, store, and Apollo checkout proof are attached. Branch CI proved this focused manifest guard in `WoofWatcher Verify` run `28690249414`, job `85090172228`, on commit `12c63eb`. The manifest now also requires separate iOS App Store and Android Google Play sandbox receipt evidence with platform/store naming, JSON MIME, byte size, product id, transaction id, purchase, renewal, cancellation, refund, expiration, and `restorePurchaseConfirmed` before generic payment approval flags can open checkout; branch CI proved that stricter guard in `WoofWatcher Verify` run `28695703283`, job `85104771524`, on commit `b579885`.
- Privacy & Safety now consumes the Payments provider proof manifest for its payments gate. `paymentsEnabled` can stage provider setup, but checkout remains `blocked` until structured payments proof files make the manifest ready. Branch CI proved this Privacy & Safety guard in `WoofWatcher Verify` run `28704399568`, job `85127644483`, on commit `5774048`.
- The Store accounts proof manifest now structures the App Store/Play submission gate into Apple Developer/App Store Connect access, Google Play package record, bundle/signing ownership, reviewer access/test credentials, screenshots/metadata ownership, privacy-label readiness, and release role approval evidence; the focused `/care-twin-qa?qaSurface=store-accounts-proof` route shows `App submission allowed: No` until real Apple/Google account and approval proof are attached.
- The Store accounts proof manifest also rejects generic Apple/Google approval notes. The gate now requires structured platform/store-named proof files with MIME, byte size, account ids, roles, bundle/package ownership, reviewer access, metadata/privacy approvals, Apollo release approval, and no-submit-boundary evidence before app submission can be treated as reviewable.
- The Account deletion proof manifest now structures the self-serve deletion compliance gate into deletion route/auth, export-before-delete handoff, data/object deletion receipt, audit/support receipt, recovery/cancellation policy, and legal/store approval evidence; the focused `/care-twin-qa?qaSurface=account-deletion-proof` route shows `Destructive deletion allowed: No` until provider, legal, store, and Apollo approval proof are attached.
- The Account deletion proof manifest now also rejects generic deletion approval notes. Destructive deletion stays blocked until structured proof files cover deletion-route/auth, export-before-delete, data/object deletion receipt, audit/support receipt, recovery/cancellation policy, and legal/store/Apollo approval with MIME, byte size, required row fields, and row-specific approval booleans.
- Privacy & Safety now consumes the Account deletion proof manifest for its account deletion gate. `accountDeletionEnabled` can stage provider setup, but account deletion remains `blocked` until structured deletion proof files make the manifest destructive-deletion ready.
- The Support legal readiness proof manifest now structures the support/privacy/legal/refund/veterinary-boundary launch gate into support inbox, privacy policy and terms links, refund/subscription policy, veterinary and emergency boundary, deletion escalation, incident response owner, and Apollo approval evidence; the focused `/care-twin-qa?qaSurface=support-legal-readiness-proof` route shows `Public launch allowed: No` until real support/legal, store-review, and Apollo approval proof are attached.
- The Support legal readiness proof manifest now also rejects generic support/legal approval notes. Public launch stays blocked until structured proof files cover support inbox, privacy policy and terms, refund/subscription, veterinary/emergency boundary, deletion escalation, incident response owner, and Apollo launch approval/no-launch boundary with MIME, byte size, required row fields, and row-specific approval booleans.
- The Support runbook now consumes the Support legal readiness proof manifest for its public-launch verdict. Support/legal approval booleans can stage owner review, but `launchReady`, `supportRunbookApproved`, and `privacyLegalApproved` remain blocked until structured support/legal proof files make the manifest ready. Privacy & Safety also uses that launch-ready verdict before displaying, preserving, or exporting `provider-approved` support/provider status; stale or attempted provider-approved saves and owner exports without structured proof become owner-reviewed local packets. Branch CI proved the Support runbook guard in `WoofWatcher Verify` run `28705194968`, job `85129614020`, on commit `ceecc55`; branch-head proof-doc CI also passed in run `28705426671`, job `85130189337`, on commit `58fe904`. Privacy status/export commits `9f18688` and `33d8fd0` are pushed, but fresh branch CI is still pending because the latest visible run list only shows earlier `workflow_dispatch` successes through run `28705671803`, which predates those commits.
- The WoofGuide AI provider proof manifest now rejects generic provider/model/source/write-gate/veterinary/fallback approval strings. Live AI remains blocked until six structured proof files cover OpenAI secret storage, approved model policy, source/citation rules, owner-review write gate, veterinary safety boundary, and fallback/incident handling with proof naming, MIME, byte size, required policy fields, and safety booleans.
- Privacy & Safety now consumes the WoofGuide AI proof manifest for its AI disclosure gate. `aiProviderConfigured` can stage provider setup, but the disclosure remains `limited` until structured AI proof files make the manifest live-AI ready.
- Provider Launch Setup now also carries the Report binary export proof packet under Records and media storage, requiring local Care Pass PDF and Dog ID PNG artifact bytes, structured provider storage proof, native share/reopen proof, and iOS/Android artifact proof before binary export readiness can be claimed.
- `/care-twin-qa?qaSurface=report-binary-export-proof` now turns that packet into a focused launch-critical QA target for generated file name/size/MIME/share proof, structured provider storage proof, and iOS/Android artifact evidence.
- The focused Report Binary Export Proof route now renders the `Report binary export proof manifest` directly, with Care Pass PDF, Dog ID PNG, provider storage, and native artifact proof rows, `Generated artifacts allowed: No`, blockers, and a boundary that native share/reopen, renderer approval, provider storage, app-store review, public launch, and Apollo sign-off remain blocked. Branch CI proved this focused manifest guard in `WoofWatcher Verify` run `28691498890`, job `85093511875`, on commit `822ff54`.
- The generated Report Binary Export manifest now treats native proof as four concrete slots, not one approval boolean: iOS Care Pass PDF, Android Care Pass PDF, iOS Dog ID PNG, and Android Dog ID PNG. Each slot needs platform/artifact naming, MIME, positive byte size, share proof, and reopen proof before `Generated artifacts allowed` can ever move toward `Yes`. Branch CI proved this guard in `WoofWatcher Verify` run `28693395380`, job `85098728807`, on commit `41de898`.
- The generated Report Binary Export manifest now also treats provider storage as structured evidence, not `storageProviderConfigured`. The provider row remains `Provider storage pending structured proof` until an attached proof file carries locator, MIME, byte size, bucket names, signed upload/download, household scope, retention/export/deletion, QA evidence storage, and approval booleans.
- The shared attachment manifest now also treats provider storage as structured evidence, not `storageProviderConfigured`. Local medication proof photos, record documents, Adventure memories, Care Pass reports, and QA screenshots remain `local-only` until `AttachmentStorageProviderEvidence` carries proof file naming, MIME, byte size, bucket names, signed upload/download policies, household scope, retention/export/deletion rules, QA evidence storage policy, approval owner, and approval booleans; More Launch Readiness and Privacy & Safety now consume the same proof boundary.
- Care Pass report artifact storage now also treats provider storage as structured evidence, not `storageProviderConfigured`. Saved printable HTML reports stay `Saved locally` until `CarePassStorageProviderEvidence` carries proof file naming, MIME, byte size, bucket names, signed upload/download policies, household scope, retention/export/deletion rules, QA evidence storage policy, approval owner, and approval booleans; beta handoff, release smoke checklist, and native QA copy now name the structured provider storage proof boundary.
- Durable Provider Launch Setup storage evidence now flows into those storage-specific validators. `storageProviderEvidence` survives profile normalization and care-document persistence, then Records sends it into Care Pass artifact export and Report Binary Export proof manifests while Privacy & Safety sends it into `deriveAccountSafetyPlan`; raw `storageProviderConfigured` still cannot bypass proof requirements.
- Privacy export and deletion-request attachment summaries now use that same saved storage evidence path. Owner export metadata and deletion copy can show `ready for provider upload` only after normalized `launchProviderProfile.storageProviderEvidence` satisfies the shared attachment-storage proof validator; otherwise they keep the approved-storage-rules blocker.
- The focused `/care-twin-qa?qaSurface=report-binary-export-proof` helper route now uses that same saved storage evidence path. It derives Provider Launch Setup from care state, feeds `providerInput.storageProviderConfigured`, and forwards saved `storageProviderEvidence` into the Report Binary Export proof manifest instead of hardcoding provider storage to false; generated PDF/PNG readiness still requires local bytes, native iOS/Android share/reopen proof, structured provider storage files, store review, public launch, and Apollo sign-off.
- More Launch Readiness now uses that same saved storage evidence path for its shared attachment queue. The route derives Provider Launch Setup before calling `deriveAttachmentManifest`, passes `providerInput.storageProviderConfigured` plus saved `storageProviderEvidence`, and keeps the Records Storage launch tile aligned with Records, Privacy, and the focused Report Binary Export mission without treating raw setup booleans as provider upload proof.
- Store Screenshot QA now uses those same saved proof paths for its Store Submission screenshot checklist. `/care-twin-qa` derives Provider Launch Setup, Support Runbook, and attachment manifest state before building `storeLaunchReadinessPlan`, forwards provider proof-ready flags, support/legal proof variables, and `attachmentManifest.launchQueue`, and keeps `nativeQa: null` so the packet remains preparation evidence only.
- PWA cloud sync now treats provider sync as structured evidence, not `backendConfigured`, backend URL, or household id. `buildCloudSyncPlan` stays at `provider_proof_pending` until proof covers Supabase project id, migration/backfill, active-household RLS, retention/export/deletion, dependency-complete build proof, mobile full-refresh sign-off, and Apollo approval; the mobile beta doctor now guards `PWA cloud sync proof guard is source-backed`.
- PWA hosted nudges now treat closed-app delivery as structured evidence, not backend/push provider setup. `buildHostedNudgePlan` stays at `provider_proof_pending` and keeps jobs empty until proof covers backend jobs, caregiver consent, provider delivery, caregiver privacy, quiet-hours and daily-budget enforcement, missed-delivery fallback, native delivery, and Apollo approval; the mobile beta doctor now guards `PWA hosted nudge proof guard is source-backed`.
- Launch Readiness now treats provider/store/approval readiness as aggregate structured proof, not raw provider-approved booleans. Store-ready status stays blocked until the dashboard input includes structured proof flags for auth, care-entry sync, storage, AI, payments, account deletion, push delivery, store accounts, privacy/legal, and support/refund; More now feeds those inputs from the Provider Launch Setup model's already-gated `providerInput` proof flags plus launch-ready support/legal proof variables.
- Provider Launch Setup row readiness now uses the same structured-proof boundary before forwarding provider truth into Launch Readiness. A configured/provider-approved row remains staged as `Proof pending` until its matching auth, database, storage, AI, payments, push, store-account, or deletion proof-ready flag is true; More's save path now applies the same proof-key mapping before persisting `provider-approved`, so configured-only profiles are saved back as `owner-reviewed`. `CareContext` also preserves `supportLegalReadinessEvidence` and all provider proof-ready flags during saved care-document merge, so valid saved/imported structured proof can reach Launch Readiness without raw boolean bypasses. Local proof passed focused Provider Launch Setup/mobile readiness tests `121/121`, the full zero-dependency suite `591/591`, root TypeScript, mobile TypeScript, JSON doctor source-backed checks, and `git diff --check`; the save-path clamp additionally passed mobile readiness `114/114`, the full zero-dependency suite with the dot reporter, root TypeScript, mobile TypeScript, direct mobile beta doctor source-backed checks, and `git diff --check`; the persistence guard passed mobile readiness `114/114`, focused Provider/Launch/Support/Privacy/Reminder tests `36/36`, direct JSON doctor source-backed checks, the full zero-dependency suite with the dot reporter, root TypeScript, mobile TypeScript, and `git diff --check`. Row-guard implementation commit `83757f2`, save-path implementation commit `4406001`, and persistence implementation commit `79ec06b` are pushed; fresh branch CI is still pending because the latest visible run list only shows earlier `workflow_dispatch` successes through run `28705671803`, which predates these implementation commits.
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
- Need the six structured account-deletion proof files attached and approved before destructive deletion can be treated as reviewable; local notes or owner-staged text do not count as provider/legal/store deletion readiness.
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
- AI usage disclosure, owner care-data export, staged pet roster export, Access Pass draft export, Adventure memory export, and non-destructive deletion request preparation exist in mobile; Privacy & Safety now consumes saved Provider Launch Setup proof evidence for AI, payments, and account deletion when those structured manifests exist. Provider-backed policy, cloud media storage, real checkout, and destructive deletion still need approval.

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

Latest known passing automation-branch CI:

- Workflow: `WoofWatcher Verify`
- Branch: `automation/premium-revenue-product-builder`
- Evidence: run `28836909561`, job `85522525710`, completed success on
  2026-07-07 UTC for commit `d21f44e`
- Coverage: Setup pnpm, Setup Node, install dependencies, JSON mobile beta
  doctor, focused behavior tests, and Typecheck plus CI-safe builds
- Branch CI then proved implementation commit `61ed6fd` in `WoofWatcher Verify`
  run `28844274663`, completed success in `3m17s`.
- Branch CI then proved proof-record commit `a786f3f` in `WoofWatcher Verify`
  run `28844518727`, completed success in `3m14s`.
- Current branch CI proof: `WoofWatcher Verify` run `28852945785` passed on
  commit `9d02eaa` in `3m16s` for the pushed Push notification proof evidence
  propagation slice.
- Push notification proof evidence
  propagation passed focused provider/reminder/readiness tests `124/124`, the
  full zero-dependency suite `594/594`, root TypeScript, mobile TypeScript,
  direct JSON mobile beta doctor source-backed checks including `push
  notification proof evidence propagation is source-backed`, and PixelLab
  `ok=149 missing=0 invalid=0`. Dependency-complete branch proof is current for
  commit `9d02eaa`.
- Store Accounts proof evidence propagation now keeps saved Apple/Google proof
  evidence durable and visible to the focused Store Accounts QA mission. It
  passed focused provider/store/readiness tests `125/125`, the full
  zero-dependency suite `594/594`, root TypeScript, mobile TypeScript, direct
  JSON mobile beta doctor source-backed checks including `store accounts proof
  evidence propagation is source-backed`, and PixelLab `ok=149 missing=0
  invalid=0`. Branch CI proved implementation commit `b5286de` in
  `WoofWatcher Verify` run `28863131822`, completed success in `3m6s`. Rerun CI
  after this proof-record docs commit before dependency-complete proof is
  current for the final branch tip.
- Account Deletion proof evidence propagation now keeps saved deletion/legal
  proof evidence visible to the focused Account Deletion QA mission.
  `/care-twin-qa?qaSurface=account-deletion-proof` feeds
  `state.launchProviderProfile.accountDeletionEvidence` into the structured
  proof manifest instead of rendering an empty manifest. Local red/green proof
  passed mobile readiness `114/114`, the full zero-dependency suite `594/594`,
  root TypeScript, mobile TypeScript, direct JSON mobile beta doctor
  source-backed checks including `account deletion proof evidence propagation is
  source-backed`, PixelLab `ok=149 missing=0 invalid=0`, and `git diff --check`
  with expected Windows CRLF warnings only; real destructive deletion, provider
  data deletion, legal/store approval, public launch, and Apollo sign-off remain
  blocked. Branch CI proved implementation commit `4ca69a1` in `WoofWatcher
  Verify` run `28874371159`, job `85645338456`; rerun CI after this proof-record
  docs commit before dependency-complete proof is current for the final branch
  tip.
- Support Legal Readiness proof evidence propagation now keeps saved
  support/legal proof evidence visible to the focused Support Legal QA mission.
  `/care-twin-qa?qaSurface=support-legal-readiness-proof` feeds
  `state.launchSupportProfile.supportLegalReadinessEvidence` into the structured
  proof manifest instead of rendering an empty manifest. Local red/green proof
  passed mobile readiness `114/114`, the full zero-dependency suite `594/594`,
  root TypeScript, mobile TypeScript, direct JSON mobile beta doctor
  source-backed checks including the support/legal proof checks, PixelLab
  `ok=149 missing=0 invalid=0`, and `git diff --check` with expected Windows
  CRLF warnings only; real legal/privacy approval, refund/subscription policy,
  support operations, public launch, and Apollo sign-off remain blocked. Rerun
  branch CI after this proof-record docs commit before dependency-complete proof
  is current for the final branch tip. Branch CI proved the implementation
  commit `cbaa5684` in `WoofWatcher Verify` run `28885884154`, job
  `85685820048`, with install, JSON mobile beta doctor, focused behavior tests,
  and Typecheck plus CI-safe builds all passing.
- Care-entry Provider Sync and WoofGuide AI focused proof missions now consume
  saved Provider Launch Setup proof evidence instead of rendering empty
  manifests. `careEntryProviderSyncEvidence` is durable in the care document and
  reaches `deriveCareEntryProviderSyncProof`; saved `aiProviderEvidence` reaches
  `buildAiProviderProofManifest`. Focused proof/readiness tests passed
  `127/127`, the full zero-dependency suite passed `594/594`, root TypeScript,
  mobile TypeScript, direct JSON mobile beta doctor source-backed checks, and
  PixelLab `ok=149 missing=0 invalid=0` passed. Real Supabase/RLS/migration
  proof, mobile incremental sign-off, OpenAI/model/source/write-gate/veterinary
  proof, live AI approval, public launch, and Apollo sign-off remain blocked.
  Branch CI proved implementation commit `f0b1a5b` in `WoofWatcher Verify` run
  `28896885332`, completed success in `3m4s`; rerun CI after this proof-record
  docs commit before dependency-complete proof is current for the final branch
  tip.
- Premium and the focused Payments Provider Proof mission now consume saved
  Provider Launch Setup `paymentsProviderEvidence` instead of rendering empty
  payment manifests. `/premium` and
  `/care-twin-qa?qaSurface=payments-provider-proof` both feed saved evidence
  into `buildPaymentsProviderProofManifest`, while checkout remains disabled
  until complete product catalog, billing path, iOS App Store and Android Google
  Play sandbox receipt, restore, entitlement, refund/support, checkout-gate, and
  Apollo approval proof exists. Local proof passed mobile readiness `114/114`,
  the full zero-dependency suite `594/594`, root TypeScript, mobile TypeScript,
  direct JSON mobile beta doctor source-backed checks, PixelLab `ok=149 missing=0
  invalid=0`, and `git diff --check` with expected Windows CRLF warnings only.
  Direct JSON mobile beta doctor remains blocked only by local pnpm `11.7.0`
  versus pinned `10.24.0` and missing Corepack. Branch CI proved implementation
  commit `721ebe69` in `WoofWatcher Verify` run `28906351424`, completed success
  in about `3m04s`.
- AuthShell, Setup, and the focused Auth/Setup proof mission now consume saved
  Provider Launch Setup `authSetupProofEvidence` instead of rendering empty
  Auth/Setup manifests. `LaunchProviderProfile` preserves the structured
  Auth/Setup proof object and CareContext persists it, so saved Clerk
  production, redirect/deep-link, household membership, Apollo auth launch, and
  iOS/Android Auth/Setup screenshot evidence can reach
  `buildAuthSetupProofManifest`. Local red/green proof passed focused mobile
  readiness plus provider setup tests `121/121`; the full zero-dependency
  API/mobile/PWA/care-domain suite, root TypeScript, mobile TypeScript,
  PixelLab asset verification, and `git diff --check` passed. Direct JSON
  mobile beta doctor source-backed checks passed for Auth/Setup proof surfaces
  while remaining truthfully `BLOCKED` only because local pnpm is `11.7.0`
  versus pinned `10.24.0` and Corepack is not on PATH. Branch CI proved
  implementation commit `deeda5d9` in `WoofWatcher Verify` run `28913476038`,
  completed success in `3m5s` on `automation/premium-revenue-product-builder`.
  Real Clerk configuration, OAuth, provider-backed household creation, native
  screenshots, store review, public launch, and Apollo sign-off remain blocked.
- The machine-readable beta doctor now explicitly guards Auth/Setup and Payments
  proof-evidence propagation. It reports `auth setup proof evidence propagation
  is source-backed` only when saved Auth/Setup evidence reaches AuthShell, Setup,
  and the focused Auth/Setup proof mission; it reports `payments proof evidence
  propagation is source-backed` only when saved payments evidence reaches
  Premium, Privacy & Safety, and the focused Payments proof mission. Local
  red/green proof first failed on the missing doctor labels, then passed mobile
  readiness `114/114`, direct JSON doctor source-backed checks for both labels,
  the zero-dependency suite `561/561`, root TypeScript, mobile TypeScript,
  PixelLab `ok=149 missing=0 invalid=0`, and `git diff --check` with expected
  CRLF warnings only. Direct JSON doctor remains locally blocked by pnpm
  `11.7.0` versus pinned `10.24.0` and missing Corepack; branch CI must be
  rerun after this commit before dependency proof is current.

Latest known passing `main` CI after the Full Log search slice:

- Workflow: `WoofWatcher Verify`
- Branch: `main`
- Evidence: run `27370209662`, completed success on 2026-06-11 UTC

## Required Before Claiming Full Release

Do not mark Full Premium Release complete until every gate above is either passing with evidence or explicitly waived by Apollo in writing.

## 2026-07-08 Records File-Proof Evidence

Latest local Records file-proof evidence: mobile readiness passed `114/114`,
direct JSON mobile beta doctor reported `records local file proof evidence
propagation is source-backed` as `PASS`, the zero-dependency
API/mobile/PWA/care-domain suite passed `543/543`, root TypeScript passed,
PixelLab verifier passed `ok=149 missing=0 invalid=0`, and `git diff --check`
passed with expected CRLF warnings only. This clears only local proof that saved
Records local-file handoff evidence can persist through Provider Launch
Setup/CareContext and reach
`/care-twin-qa?qaSurface=records-local-file-handoff`; it does not clear real
iOS/Android share-sheet proof, Android content URI or saved-file proof,
fallback-copy capture, native PDF/PNG share/reopen proof, provider storage
proof, public launch, or Apollo sign-off.
## 2026-07-28 Avatar selected-template contrast

- PASS, source: selected ivory template artwork uses a constant translucent
  brand-navy edge and has red/green readiness coverage.
- OPEN, native: iOS/Android dark screenshots, touch/accessibility traversal,
  phone-size sprite review, and Apollo approval.

## 2026-07-29 Plus recommended-plan label contrast

- PASS, source: the fixed-light `Recommended` label uses constant brand-navy
  ink and has red/green readiness coverage.
- OPEN, native/provider: iOS/Android dark screenshots, accessibility review,
  payments proof, store review, and Apollo approval. Checkout remains gated.

## 2026-07-29 Avatar mood-badge contrast

- PASS, source: inactive fixed-light mood badges use constant brand-navy ink
  and edges with red/green readiness coverage.
- OPEN, native: iOS/Android dark screenshots, mood-state interaction,
  accessibility traversal, phone-size sprite review, and Apollo approval.

## 2026-07-29 Records Dog ID metadata contrast

- PASS, source: fixed-light breed and weight metadata uses full-strength
  constant brand-navy ink with red/green readiness coverage.
- OPEN, native: iOS/Android dark screenshots, local-file and generated
  PNG/share proof, accessibility traversal, and Apollo approval.
