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
- Setup shows a truthful post-save confirmation that summarizes the saved care foundation and routes the owner back to Today, while pointing provider-backed household invite/sync controls to More instead of implying onboarding has completed cloud administration.
- Setup confirmation now reads the active household context from `/me` when available, names the active pack, and tells multi-household caregivers to manage invite, sync, and switching for their packs in More while clarifying setup only saved the care foundation.
- Setup now captures household sync intent as Share invite, Join pack, or Decide later before saving the care foundation, and routes invite/join/sync/switching next steps to the real More household tools instead of pretending setup itself completed provider-backed household administration.
- Setup-to-More handoff is now intent-aware. Share invite and Join pack setup choices land in More with a visible next-step card and accessible actions for the existing invite share or invite-code join modal, while provider-backed invite approval, arbitrary membership changes, and cloud onboarding remain gated.
- The setup-to-More handoff now clears after the owner takes the handoff action, so Share invite and Join pack prompts do not linger as stale onboarding tasks after the existing invite share or invite-code modal is opened.
- Successful invite-code joins now show a confirmation that names the joined pack as the active care sync pack, refreshes `/me` and care state, and keeps household switching, Household Access, Sync Health, and provider-backed invite approval boundaries in More.
- More display-name copy now names the active pack in the row, edit modal, and save confirmation, matching the active-household member update boundary instead of implying a global all-households identity change.
- Log entries have a detail sheet with sticky notes, audit trail history, sync/error visibility, edit/delete actions, and shareable handoff text.
- Server-backed care-entry deletes create a retained non-health household audit note with the deleted-entry snapshot, and mobile Log avoids duplicate local audit notes when the server already retained the delete audit.
- Log exposes a durable Offline Outbox banner for local, pending, and failed care-entry changes with retryable create/update counts and a Retry sync action.
- More exposes household Sync Health with healthy/loading/syncing/attention status, care-log count, household member count, outbox count, and retry/refresh guidance.
- Calendar and More expose Household Responsibility derived from routine-board truth, including care-team routine ownership, open/overdue/unassigned counts, visible today log activity, and a next household action.
- More exposes Household Access derived from synced account members, local-only caregivers, routine-only owners, invite readiness, permission labels, and next-step copy.
- Calendar exposes Reminder Center derived from routine-board status, medication follow-ups, record reminders, and grooming due dates, with urgency counts, explicit notification-readiness copy, and row routing to routine edit, Records, Medication log, or Grooming log before provider-backed push delivery exists.
- Log search combines text query and type filters across titles, notes, caregivers, nested details, route/place fields, medication fields, and sticky notes with owner-readable summary and empty-state copy.
- Care document refresh keeps newer local/offline profile, routine, record, and report changes when server care-state data is older, then pushes the newer doc back to the household.
- API care-state writes use an atomic household-and-version optimistic update and return a refreshed 409 response if another device wins the write race, so stale devices do not clobber newer shared care documents after the initial version read.
- API household member display-name updates are scoped to the authenticated user and active household, so a caregiver who belongs to more than one household does not accidentally rename their membership across unrelated packs.
- API household rename requires owner/admin membership in the active household, so ordinary invited caregivers cannot rename the shared pack before full provider-backed role enforcement exists.
- API household invite joins provision the authenticated user directly, ensure the invited household has care state, avoid duplicate memberships, and add first-time invitees as normal members without creating a throwaway default pack first.
- API `/me` withholds the household invite code from non-owner/admin members, so ordinary caregivers can contribute care without being able to spread pack access before provider-backed caregiver administration exists.
- API household activation persists the joined household on the user row when an invite is accepted, so later active-household care-state, care-entry, profile, and household routes continue using the joined pack instead of reverting to an older default household.
- API active-household switching is membership-scoped, so `PATCH /me/active-household` can move care-state and care-entry routes between a caregiver's existing packs without accepting arbitrary household ids.
- Mobile More exposes active-household switching from the Care Team surface. `/me` returns the authenticated user's existing household list, invite-code visibility stays owner/admin gated for each pack, and successful switches refresh care state so later routines and logs use the selected household.
- API household audit review is owner/admin scoped. `GET /household/audit-events` lists durable household-scoped audit rows with bounded `limit`, `action`, and `lifecycleState` filters before final provider-backed retention and account audit policy exists.
- Sensitive API household actions now write durable audit rows before final provider-backed account audit policy exists. Default household creation, household rename, active-household switching, and invite acceptance produce owner/admin-reviewable `household.created`, `household.renamed`, `household.active_changed`, and `household.member_joined` events.
- API household member role updates are owner/admin scoped before full caregiver administration exists. `PATCH /household/members/{memberId}` only updates existing active-household memberships, refuses owner demotion, writes a durable `household.member_role_changed` audit row, and returns the refreshed `/me` household context.
- Mobile More exposes bounded role management for existing synced non-owner members. The Care Team surface uses the generated role-update hook, keeps chips accessible with selected/disabled state, refreshes `/me`, refetches Pack Audit after success, and keeps owner transfer, member removal, invite approval, and final permission policy provider-gated.
- Household Access presents owner, admin, sitter, trainer, and vet viewer roles with truthful permission summaries, and Mobile More shows those boundaries under each Care Team person before provider-backed final enforcement exists.
- API shared care writes now enforce launch role boundaries before final provider-backed permission policy. Owner, admin, and member roles can update the shared care plan through `PUT /care-state` and correct household logs; sitter and trainer roles can create care evidence and only patch/delete their own `caregiverUserId` entries; vet viewers receive a clear 403 on both care-plan and care-log writes.
- Mobile More exposes Pack Audit review for the active household. The surface lists recent owner/admin trust events through the generated audit-events hook, summarizes stored event details in owner-readable rows and screen-reader labels, shows loading, empty, and offline states, and keeps lifecycle actions provider-gated.
- Pack Audit role-change rows use target caregiver identity, owner-readable role labels, and previous-to-new transition copy, avoiding internal role ids in visible rows and screen-reader labels before final provider-backed audit policy exists.
- Care Team role-management rows and success confirmations use the same owner-readable launch role labels as Pack Audit and Household Access, so visible admin/member/sitter/trainer/vet viewer copy stays consistent before final provider-backed caregiver administration exists.
- Care Pass reports can be previewed by audience before sharing.
- Shared Care Passes are stored as report-history artifacts for quick resend, with visible print-ready/restored metadata and escaped HTML payloads for future PDF/export flows.
- Records show expired, due-soon, current, and reference status for saved record rows.
- WoofGuide shows deterministic suggested actions tied to health watch, record attention, diet setup, routines, meal logging, Care Pass preview, owner-reviewed Mood & Energy summaries from shared mood evidence, and owner-reviewed Records Attachment Prep from local receipt/document readiness.
- Records includes a 90-day Mood Timeline that reuses shared mood-trend evidence for household-visible check-ins, showing caregiver, relative date, energy, context, and notes while keeping private/stale logs excluded and non-diagnostic.
- Records Mood Trend now includes accessible Week, Month, and Quarter period controls plus compact period comparison visuals from shared care-domain mood logic, while private/stale mood logs stay excluded and mood/energy remain framed as owner-reported care context.
- Records Mood Trend now includes accessible caregiver and care-context filters from the same shared mood evidence boundary, narrowing the summary and 90-day timeline without including private/stale logs or changing the non-diagnostic framing.
- Records Mood Trend now includes an accessible Mood sparkline from `deriveMoodTrendSparkline`, bucketing the selected-period, caregiver-filtered, and care-context-filtered shared evidence without including private/stale logs or changing the non-diagnostic framing.
- Records Progress Reports now include a report-ready Mood & Energy snapshot from `deriveMoodEnergyReportSnapshot`, carrying shared recent mood evidence, low/steady/high energy counts, latest caregiver/context, and owner-reported/non-diagnostic boundary language into the share payload.
- Records Progress Reports now save report-history artifacts with escaped print-ready HTML, stable filenames, section metadata, and Mood & Energy boundary copy, and Report History can resend or share printable source for both Care Pass and Progress Report artifacts.
- Records Vault now summarizes local receipt/document attachment readiness from shared record-vault logic. Mobile Records shows per-section attachment counts, missing local file titles, and a local-only storage boundary before provider-backed document storage is approved.
- Records Dog ID now shows shared credential readiness before sharing. `derivePetCredentialReadiness` uses Dog Profile fallbacks plus saved records, counts ready-versus-missing credential fields, lists missing Dog ID fields, and keeps image/PDF/provider-backed credential storage gated.
- Care Pass and Progress Reports now include Records Attachment Prep lines from the same local attachment summary, so sitter/vet/trainer handoffs show which receipts/documents are attached locally and which still need local files without claiming cloud storage or binary PDF export is ready.
- WoofGuide Records Attachment Prep reuses the same local attachment summary and stays non-mutating: applying the draft inserts only a reviewed assistant note, routes owners to Records, and states that cloud storage is not enabled.
- Empty, loading, error, offline, pending, synced, and failed states are visible.

Current gaps:

- Shared onboarding readiness exists and is used by the Today setup nudge. The care foundation setup route exists and now confirms saved setup context plus household sync intent before returning to Today or More, the More handoff clears once the owner opens the real invite/join tool, and successful invite-code joins name the active care sync pack, but auth-connected account provisioning, invite approval, and richer multi-household management remain incomplete.
- Multiple dogs, broader provider-backed role enforcement, binary PDF generation, server-backed report storage, provider-backed record document storage, provider-backed reminder delivery, formal Alone Time trigger plans, richer weight-goal plans, credential image/PDF export, and broader role/document/account audit policy need implementation.
- Runtime smoke has not been added.

## Gate 3: Care Domain Correctness

Status: Partially passing.

Passing evidence:

- Focused tests cover event normalization, day status, care sync, Today Command, setup wizard, diet progress, medication quick-log defaults, medication composer wiring, medication adherence, medication follow-ups, medication history search/outcome filters, water quick-log defaults, hydration summaries, hydration Care Pass language, mobile Records hydration wiring, walk quick-log visibility, walk activity summaries, saved walk route templates, walk activity and Saved Routes Care Pass language, mobile Records walk activity wiring, full Log walk route fields, Full Log search derivation and mobile wiring, potty quick-log visibility, potty composer detail fields, Potty Health summaries, Potty Health color/context review evidence, Potty Health Care Pass language, mobile Records Potty Health wiring, Weekly Care Trends derivation, Care Pass trend language, mobile Records trend wiring, Mood Trend derivation, Mood Trend period summaries, Mood Trend caregiver/context filters, Mood Trend sparkline buckets, mobile Records mood period/filter/sparkline controls, Training Progress derivation, Log composer training fields, trainer Care Pass training language, mobile Records training wiring, Alone Time derivation, Log composer Alone Time fields, Care Pass Alone Time language, mobile Records Alone Time wiring, Weight Trend derivation, Care Pass Weight Trend language, mobile Records Weight Trend wiring, Grooming Care derivation, Log composer grooming fields, Care Pass Grooming Care language, mobile Records Grooming Care wiring, Reminder Center derivation, Calendar wiring, and action routing, Household Responsibility derivation, Calendar/More responsibility wiring, Household Access derivation and More wiring, Care Log Audit Trail derivation and mobile Log wiring, Care Pass medication language, mobile Records medication wiring, health handoff, care pass, Care Pass artifact snapshots, print-ready Care Pass HTML, legacy printable artifact recovery, record vault, pet credential fallbacks, Dog ID credential readiness, print-ready Dog ID credentials, record due-status, routine board, sticky notes, and WoofGuide action cards.
- Focused tests also cover report-ready Mood & Energy snapshots from the same shared mood-trend evidence boundary, including Progress Report mobile wiring, saved artifact creation, print-source escaping, and non-diagnostic share copy.
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
- Focused API route readiness now protects authenticated household scoping, active-household member profile updates, membership-scoped active-household switching, owner/admin household rename gating, owner/admin member role updates, vet viewer read-only shared care writes, split care-plan versus care-log write roles, sitter/trainer own-entry correction scoping, owner/admin invite-code visibility, invite joins that do not create default packs first, joined-household activation for later care sync routes, optimistic care-state conflict responses, atomic care-state update predicates, household-isolated care-entry create/update/delete behavior, server-retained delete audit notes, and care-entry list query contracts across OpenAPI, zod, and generated React client types.

Current gaps:

- Need live integration tests for authenticated household-scoped routes against a test database/provider-auth harness, including the care-entry delete audit retention path, household audit review list path, and sensitive household audit event producers.
- Need storage for record documents and generated reports.
- Need role-aware permissions, broader audit trail policy for documents/accounts/roles, and provider-backed data export/delete paths.
- Need deeper multi-device conflict policy, final server-backed delete/edit restore and retention rules, and native offline recovery QA.

## Gate 5: AI Safety And Usefulness

Status: In progress.

Passing evidence:

- WoofGuide direction is documented.
- Medical boundary is documented.
- AI helper routes exist.
- Deterministic WoofGuide action-card model and tests exist before action writes are enabled, including owner-reviewed Mood & Energy summaries that reuse shared mood trend evidence without mutating care records.

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
- Mood logging captures structured energy level, optional care context, sticky notes, and household visibility while preserving the mood field used by Records Mood Trend and care-twin state.
- Records Mood Trend now uses shared care-domain logic to exclude private/stale mood logs, summarize low/steady/high energy, show latest caregiver/context, and provide safe household next-step copy.
- Care Pass reports now include a Mood & Energy handoff section when shared recent mood check-ins exist. The section reuses shared mood-trend logic, carries energy counts plus latest caregiver/context, excludes private/stale mood logs, and keeps owner-reported/non-diagnostic boundary language for sitter, trainer, and vet review.
- WoofGuide suggested actions now include an owner-reviewed Mood & Energy summary when shared recent mood check-ins exist. The draft reuses shared mood-trend logic, keeps private/stale mood logs out, and inserts only reviewed assistant text without changing care records.
- Records Mood Timeline now shows a longer-range 90-day history from the same shared mood-trend logic, with caregiver, date, energy, context, and notes for recent household-visible check-ins plus owner-reported/non-diagnostic boundary copy.
- Records Mood Trend filters now let owners review mood evidence by caregiver and care context while preserving the same household-visible evidence boundary as the period views and timeline.
- Records Mood Trend sparklines now give owners a compact visual read of selected-period mood check-in density and tone from the same shared evidence boundary, without predictive or diagnostic claims.
- Progress Reports now show and share a Mood & Energy snapshot from shared mood evidence, keeping energy counts and latest caregiver/context report-ready while avoiding diagnosis, emergency triage, predictive analytics, or live AI claims.
- Progress Reports now persist print-ready report-history artifacts with the same Mood & Energy boundary, so the paid report workflow is reusable before binary PDF generation or server-backed report storage exists.

Current gaps:

- Need design system.
- Need screen-by-screen polish.
- Need full motion spec, Rive/Lottie/Reanimated asset pipeline, transition rules, and runtime animation QA.
- Need full accessibility pass. Critical action screen-reader labels, shared board touch targets, route-local action and error-recovery touch targets, keyboard avoidance, inline action hit slop, and living Phoenix room tap cues are covered by focused static smoke, but contrast, dynamic type, and native screen-reader traversal still need QA.
- Shared auth action touch targets are now covered by focused static smoke for primary and Google SSO buttons before native screen-reader traversal is available.
- Onboarding and Avatar Studio creation actions now expose explicit screen-reader roles, labels, and selected/disabled/busy state where relevant for shared auth primary/Google buttons, Setup starter-routine/save/finish-later actions, and Avatar Studio reset/save controls before native accessibility traversal is available.
- Need visual regression or screenshot review.
- Need Figma alignment if Figma becomes the canonical design source.

## Gate 7: QA And CI

Status: Partially passing.

Passing evidence:

- GitHub Actions `WoofWatcher Verify` passes on `main`.
- CI installs with frozen lockfile, runs focused tests, typechecks, builds API, builds web prototype, and builds mockup sandbox.
- Local zero-dependency focused tests can run with bundled Node.

Current gaps:

- Local `pnpm run build:ci` remains blocked in this Windows shell because the root `preinstall` script invokes `sh`, which is not available on PATH before typecheck/build scripts start.
- Need API integration tests, including live validation for care-entry delete audit retention.
- Need mobile runtime smoke.
- Critical mobile action accessibility labels are covered by focused static smoke.
- Home avatar motion state and wiring are covered by focused tests.
- Shared mobile layout tests cover WoofGuide composer bottom clearance on flat native, notched native, and web surfaces before native screenshot QA is available.
- Shared mobile layout tests cover docked modal-sheet bottom clearance on flat and notched native devices, and static readiness protects Plans, Log, More, Records, and error recovery sheets from route-local inset math before native screenshot QA is available.
- Shared mobile layout tests cover floating feedback bottom offsets on tabbed, standalone, notched, and web surfaces, and static readiness protects Home and Avatar Studio toasts from route-local inset math before native screenshot QA is available.
- Shared mobile layout tests cover centered modal backdrop top/bottom/horizontal clearance on flat and notched native devices, and static readiness protects the Log sticky-note prompt plus More household/name prompt modals from fixed horizontal-only padding before native screenshot QA is available.
- Shared mobile layout tests cover route header top clearance on flat native, notched native, and web surfaces, and static readiness protects core tabbed routes, Avatar Studio, Setup, Premium, Privacy, and the shared auth shell from route-local top inset math before native screenshot QA is available.
- Shared mobile layout tests cover floating debug-control top clearance on flat native, notched native, and web surfaces, and static readiness protects the app error fallback from route-local `insets.top + 16` math before native screenshot QA is available.
- Shared mobile readiness now protects WoofGuide's owner-reviewed draft sheet with the same modal-sheet bottom safe-area contract used by other docked workflow sheets before native screenshot QA is available.
- Shared mobile layout tests cover keyboard avoidance offsets for tabbed, setup, standalone, notched-device, and web surfaces, and static readiness protects Setup, WoofGuide, Log sticky-note prompt, and Records sheet keyboard flows before native screenshot QA is available.
- Shared mobile layout tests now define a 48px `MIN_MOBILE_TOUCH_TARGET`, and static readiness protects shared board route icon buttons, compact pills, and care rows from falling below mobile-safe tap sizes before native accessibility traversal is available.
- Shared mobile layout tests now define `MOBILE_INLINE_HIT_SLOP`, and static readiness protects Home, Plans, More, Records, Privacy, and WoofGuide inline route actions from reverting to route-local literal hit slop before native accessibility traversal is available.
- Static mobile readiness now protects route-local Plans, Log, Premium, and Setup action controls from reverting to local 40-42px tap boxes instead of `MIN_MOBILE_TOUCH_TARGET`.
- Static mobile readiness now protects Avatar Studio tabs, coat swatches, and face-marking option pills from reverting to local 40/42/36px sizing instead of `MIN_MOBILE_TOUCH_TARGET`.
- Static mobile readiness now protects Health/Bile Watch segmented tabs plus Log health note and Records hero actions from reverting to local 36/42px tap boxes instead of `MIN_MOBILE_TOUCH_TARGET`.
- Static mobile readiness now protects Plans schedule tabs, schedule mark-done status control, Daily Routine add button, and routine done button from reverting to local 21/30/32/36px tap boxes instead of `MIN_MOBILE_TOUCH_TARGET`.
- Static mobile readiness now protects Log type chips, timeline filters, search clear, Records medication search/filter controls, report artifact actions, report period tabs, More invite, and dog-profile unit pills from reverting below the shared 48px `MIN_MOBILE_TOUCH_TARGET` contract.
- Static mobile readiness now protects Calendar event discovery and upcoming-event controls from reverting to route-local 28/38/40px tap boxes instead of `MIN_MOBILE_TOUCH_TARGET`.
- Static mobile readiness now protects ErrorFallback recovery controls from reverting to route-local 44px tap boxes instead of `MIN_MOBILE_TOUCH_TARGET`.
- Static mobile readiness now protects Home header navigation controls from reverting to route-local 42px tap boxes instead of `MIN_MOBILE_TOUCH_TARGET`.
- Static mobile readiness now protects Plans routine/event modal controls from reverting to padding-only sub-48px tap areas instead of `MIN_MOBILE_TOUCH_TARGET`.
- Static mobile readiness now protects shared auth action buttons from relying only on visual padding instead of `MIN_MOBILE_TOUCH_TARGET`.
- Static mobile readiness now protects the living Phoenix room pressable and visible status/next-action cue chips with `MOBILE_INLINE_HIT_SLOP` and `MIN_MOBILE_TOUCH_TARGET`.
- Static mobile readiness now protects remaining high-frequency route actions from reverting to sub-48px or padding-only tap areas, including Quick Log launcher tabs/outbox retry, Records empty-add/delete, More Care Intelligence/tool/premium/profile-edit actions, and Privacy export/delete controls.
- Static mobile readiness now protects onboarding and Avatar Studio creation actions from regressing to unlabeled/text-only tappables, including auth primary/Google buttons, Setup starter-routine/save/finish-later actions, and Avatar Studio reset/save controls.
- Static mobile readiness now protects the Setup post-save confirmation path so a completed care foundation does not silently redirect before telling the owner what was saved, which active household is selected when `/me` provides one, and where household invite/sync/switching controls remain available.
- Static mobile readiness now protects the Setup household sync choice, including Share invite, Join pack, Decide later, the More route for invite/join tools, and the confirmation context passed into `buildSetupConfirmation`.
- Static mobile readiness now protects the setup-to-More handoff route param and the More setup next-step card, including accessible Share invite and Enter invite code actions.
- Static mobile readiness now protects successful invite-code join confirmation in More, including the generated `/household/join` response, joined-pack name, and provider-backed invite approval boundary copy.
- Static mobile readiness now protects More's active-pack display-name copy, including the row text, edit modal, and save confirmation for multi-household caregivers.
- Static mobile readiness now protects Avatar Studio owner-input controls from regressing below the shared mobile target floor, including scan gallery/camera actions, template tiles, accessory tiles, and mood preview chips. Face-marking options also have explicit labels before native screen-reader traversal is available.
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
- Care Log Audit Trail derivation and Log edit/sticky/delete/detail wiring are covered by focused tests.
- Server-backed care-entry delete audit retention and mobile duplicate-audit suppression are covered by focused API readiness.
- Full Log search derivation, normalized type filters, sticky-note/detail search, and mobile Log wiring are covered by focused tests.
- Durable sync outbox derivation, household Sync Health derivation, conflict-safe care document refresh reconciliation, and mobile Log/More/CareContext wiring are covered by focused tests.
- API care-state optimistic write conflict safety is covered by focused readiness so concurrent household document writes use the version predicate in the update itself before live database integration tests are available.
- API household profile update scoping is covered by focused readiness so member display-name writes stay constrained to the active household before provider-backed role enforcement exists.
- API household rename role gating is covered by focused readiness so only active-household owner/admin members can rename the shared pack before provider-backed role enforcement exists.
- API household invite join provisioning, active-household persistence, active-household switching, `/me.households`, invite-code visibility, owner/admin member role updates, vet viewer read-only care-write enforcement, split care-plan versus care-log write roles, sitter/trainer own-entry correction scoping, owner/admin audit review, sensitive household audit event producers, the mobile More switcher, mobile Care Team role-management controls, and the mobile Pack Audit surface are covered by focused readiness so first-time invite accepts join the intended shared household, later care sync routes stay pointed at the selected pack, ordinary members cannot share the invite code, existing member roles can be adjusted by owner/admin members with an audit trail, sitters/trainers can log without changing the shared care document or editing another caregiver's evidence, vet viewers cannot mutate care plans or logs, and audit review contains real household trust events while staying visible only as a provider-gated review surface before full admin tools exist.
- Mobile Pack Audit role-change label readiness is covered so role updates render owner-readable caregiver-specific previous-to-new details instead of leaking internal ids like `vet_viewer`.
- Household Access role labels and permission summaries are covered by focused domain tests, and Mobile More's visible permission line is covered by readiness so the launch role set stays owner-readable while final provider-backed enforcement remains separate.
- Animated care-twin tap accessibility is covered by mobile readiness so Phoenix's full-scene response action has a button role, mood-aware label, and non-mutating hint before native screen-reader traversal is available.
- Need broader report/export tests beyond the current Care Pass artifact, print source, and Mood & Energy handoff coverage.
- Need release smoke checklist.

## Gate 8: Security, Privacy, And Compliance

Status: Not passing.

Passing evidence:

- Secrets are not documented in plaintext.
- Production CORS requirement is documented.
- Medical boundary is documented.

Current gaps:

- Need privacy copy and data handling policy.
- Need role-based access control.
- Care-log edit/delete audit trail exists in mobile/domain, and synced care-entry deletes now retain server-side audit notes; broader role, record, household, and account audit policy remains open.
- Need provider-backed document storage access rules.
- AI usage disclosure, owner care-data export, and non-destructive deletion request preparation exist in mobile; provider-backed policy and destructive deletion still need approval.

## Gate 9: Deployment And Operations

Status: In progress.

Passing evidence:

- Environment docs exist.
- CI exists.
- Expo app identity uses release-grade WoofWatcher slug/scheme and Pegasus Dreamscapes native package identifiers instead of generated Replit placeholders.

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
