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
- Dedicated Setup route can save dog profile, diet baseline, starter routine, and household caregiver basics in one flow.
- Log entries have a detail sheet with sticky notes, sync/error visibility, edit/delete actions, and shareable handoff text.
- Care Pass reports can be previewed by audience before sharing.
- Shared Care Passes are stored as report-history artifacts for quick resend, with visible print-ready/restored metadata and escaped HTML payloads for future PDF/export flows.
- Records show expired, due-soon, current, and reference status for saved record rows.
- WoofGuide shows deterministic suggested actions tied to health watch, record attention, diet setup, routines, meal logging, and Care Pass preview.
- Empty, loading, error, offline, pending, synced, and failed states are visible.

Current gaps:

- Shared onboarding readiness exists and is used by the Today setup nudge. The care foundation setup route exists, but auth-connected account provisioning and household invite/join onboarding remain incomplete.
- Multiple dogs, roles, invites, binary PDF generation, server-backed report storage, record document storage, server reminders for expiring records, credential image/PDF export, and log audit policy need implementation.
- Runtime smoke has not been added.

## Gate 3: Care Domain Correctness

Status: Partially passing.

Passing evidence:

- Focused tests cover event normalization, day status, care sync, Today Command, setup wizard, diet progress, health handoff, care pass, Care Pass artifact snapshots, print-ready Care Pass HTML, legacy printable artifact recovery, record vault, pet credential fallbacks, print-ready Dog ID credentials, record due-status, routine board, sticky notes, and WoofGuide action cards.
- Shared logic lives in `lib/care-domain`.

Current gaps:

- Add more edge-case tests for recurring routines, medication schedules, multi-dog state, and report generation.
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
- Need role-aware permissions, audit trail, and data export/delete paths.
- Need durable offline outbox and conflict-safe care state mutation strategy.

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
- Need audit trail.
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

Latest known passing CI:

- Workflow: `WoofWatcher Verify`
- Branch: `main`
- Evidence: run `27120202026`, completed success on 2026-06-08 UTC

## Required Before Claiming Full Release

Do not mark Full Premium Release complete until every gate above is either passing with evidence or explicitly waived by Apollo in writing.
