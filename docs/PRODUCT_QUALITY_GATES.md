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
- Records includes Medication History for recent household-visible medication logs with dose, outcome, caregiver, routine id, and notes.
- Home quick log can record household-visible water refills, and Records includes Hydration status derived from visible water logs.
- Home quick log can record household-visible walk logs, the full Log composer captures route/place, distance, dog interactions, social outcome notes, and household visibility, and Records includes Walk Activity plus Saved Routes derived from visible walk logs, duration, places/routes, dog interactions, social outcomes, and caregivers.
- Home quick log can record household-visible potty logs, the Log composer captures pee/poop kind, condition, stool color, and routine/accident/urgent/straining context, and Records includes Potty Health derived from visible potty logs, stool review signals, colors, context, conditions, and caregivers.
- Records includes Weekly Care Trends that compare current and previous 7-day household-visible care windows across meal completion, walk minutes, water refills, potty/medication/health watch signals, and caregiver participation.
- The Log composer captures structured training skill/cue, win/practice/struggle outcome, duration, next-practice notes, and household visibility, and Records includes Training Progress derived from visible training logs.
- Dedicated Setup route can save dog profile, diet baseline, starter routine, and household caregiver basics in one flow.
- Log entries have a detail sheet with sticky notes, audit trail history, sync/error visibility, edit/delete actions, and shareable handoff text.
- Log exposes a durable Offline Outbox banner for local, pending, and failed care-entry changes with retryable create/update counts and a Retry sync action.
- More exposes household Sync Health with healthy/loading/syncing/attention status, care-log count, household member count, outbox count, and retry/refresh guidance.
- Calendar and More expose Household Responsibility derived from routine-board truth, including care-team routine ownership, open/overdue/unassigned counts, visible today log activity, and a next household action.
- Care document refresh keeps newer local/offline profile, routine, record, and report changes when server care-state data is older, then pushes the newer doc back to the household.
- Care Pass reports can be previewed by audience before sharing.
- Shared Care Passes are stored as report-history artifacts for quick resend, with visible print-ready/restored metadata and escaped HTML payloads for future PDF/export flows.
- Records show expired, due-soon, current, and reference status for saved record rows.
- WoofGuide shows deterministic suggested actions tied to health watch, record attention, diet setup, routines, meal logging, and Care Pass preview.
- Empty, loading, error, offline, pending, synced, and failed states are visible.

Current gaps:

- Shared onboarding readiness exists and is used by the Today setup nudge. The care foundation setup route exists, but auth-connected account provisioning and household invite/join onboarding remain incomplete.
- Multiple dogs, roles, invites, binary PDF generation, server-backed report storage, record document storage, provider-backed reminder delivery, medication search/filters, credential image/PDF export, and broader role/document/account audit policy need implementation.
- Runtime smoke has not been added.

## Gate 3: Care Domain Correctness

Status: Partially passing.

Passing evidence:

- Focused tests cover event normalization, day status, care sync, Today Command, setup wizard, diet progress, medication quick-log defaults, medication composer wiring, medication adherence, medication follow-ups, medication history, water quick-log defaults, hydration summaries, hydration Care Pass language, mobile Records hydration wiring, walk quick-log visibility, walk activity summaries, saved walk route templates, walk activity and Saved Routes Care Pass language, mobile Records walk activity wiring, full Log walk route fields, potty quick-log visibility, potty composer detail fields, Potty Health summaries, Potty Health color/context review evidence, Potty Health Care Pass language, mobile Records Potty Health wiring, Weekly Care Trends derivation, Care Pass trend language, mobile Records trend wiring, Training Progress derivation, Log composer training fields, trainer Care Pass training language, mobile Records training wiring, Household Responsibility derivation, Calendar/More responsibility wiring, Care Log Audit Trail derivation and mobile Log wiring, Care Pass medication language, mobile Records medication wiring, health handoff, care pass, Care Pass artifact snapshots, print-ready Care Pass HTML, legacy printable artifact recovery, record vault, pet credential fallbacks, print-ready Dog ID credentials, record due-status, routine board, sticky notes, and WoofGuide action cards.
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

Current gaps:

- Need integration tests for authenticated household-scoped routes.
- Need storage for record documents and generated reports.
- Need role-aware permissions, broader audit trail policy for documents/accounts/roles, and provider-backed data export/delete paths.
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

Current gaps:

- Local environment does not currently have pnpm/node_modules installed in this Codex checkout.
- Need API integration tests.
- Need mobile runtime smoke.
- Critical mobile action accessibility labels are covered by focused static smoke.
- Home avatar motion state and wiring are covered by focused tests.
- Medication adherence, medication follow-ups, medication history, medication log defaults, Care Pass medication language, and Records/Log wiring are covered by focused tests.
- Water quick-log defaults, hydration summary logic, Care Pass hydration language, and Records hydration wiring are covered by focused tests.
- Walk quick-log visibility, full Log walk route fields, Walk Activity summary logic, Saved Routes derivation, Care Pass walk activity/Saved Routes language, and Records walk activity wiring are covered by focused tests.
- Potty quick-log visibility, potty composer stool color/context fields, Potty Health summary logic, color/context review evidence, Care Pass potty health language, and Records Potty Health wiring are covered by focused tests.
- Weekly Care Trends derivation, private-log exclusion, current-versus-previous window comparison, Care Pass trend language, and Records trend wiring are covered by focused tests.
- Training Progress derivation, private-log exclusion, Log composer skill/outcome/next-practice fields, trainer Care Pass language, and Records training wiring are covered by focused tests.
- Household Responsibility derivation and Calendar/More responsibility wiring are covered by focused tests.
- Care Log Audit Trail derivation and Log edit/sticky/delete/detail wiring are covered by focused tests.
- Durable sync outbox derivation, household Sync Health derivation, conflict-safe care document refresh reconciliation, and mobile Log/More/CareContext wiring are covered by focused tests.
- Need report/export tests.
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
- Care-log edit/delete audit trail exists in mobile/domain; broader role, record, household, and account audit policy remains open.
- Need document storage access rules.
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
- Need Expo/EAS or iOS release path.
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

Latest known passing CI for the Care Log Audit Trail implementation:

- Workflow: `WoofWatcher Verify`
- Branch: `main`
- Evidence: run `27362966353`, completed success on 2026-06-11 UTC

## Required Before Claiming Full Release

Do not mark Full Premium Release complete until every gate above is either passing with evidence or explicitly waived by Apollo in writing.
