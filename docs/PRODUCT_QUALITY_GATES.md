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
- Empty, loading, error, offline, pending, synced, and failed states are visible.

Current gaps:

- Shared onboarding readiness exists and is used by the Today setup nudge, but full first-run onboarding is incomplete.
- Multiple dogs, roles, invites, report export, record document storage, and sticky note UI need implementation.
- Runtime smoke has not been added.

## Gate 3: Care Domain Correctness

Status: Partially passing.

Passing evidence:

- Focused tests cover event normalization, day status, care sync, Today Command, diet progress, health handoff, care pass, record vault, routine board, and sticky notes.
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

Current gaps:

- Need action-card schema and tests.
- Need assistant source/context display.
- Need vet-note/report drafting flow.
- Need hard checks that AI does not diagnose or claim emergency certainty.

## Gate 6: Premium UI, Motion, And Accessibility

Status: Not passing.

Passing evidence:

- Warm brand assets and Phoenix art exist.
- Mobile screens have functional product surfaces.

Current gaps:

- Need design system.
- Need screen-by-screen polish.
- Need motion spec and implementation.
- Need accessibility pass.
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
- Need AI usage disclosure.
- Need data export/delete plan.

## Gate 9: Deployment And Operations

Status: Not passing.

Passing evidence:

- Environment docs exist.
- CI exists.

Current gaps:

- Need production environment matrix.
- Need Vercel/API/mobile deployment targets confirmed.
- Need migration runbook.
- Need monitoring/logging configuration.
- Need Expo/EAS or iOS release path.
- Need rollback and support triage process.

## Gate 10: Business Readiness

Status: Not passing.

Passing evidence:

- Monetization options are documented in the release plan.

Current gaps:

- Need Apollo decision on pricing, packaging, free tier, paid tier, and support scope.
- Need legal/privacy terms before paid launch.

## Current CI Baseline

Latest known passing CI:

- Workflow: `WoofWatcher Verify`
- Branch: `main`
- Evidence: run `27116074649`, completed success on 2026-06-08 UTC

## Required Before Claiming Full Release

Do not mark Full Premium Release complete until every gate above is either passing with evidence or explicitly waived by Apollo in writing.
