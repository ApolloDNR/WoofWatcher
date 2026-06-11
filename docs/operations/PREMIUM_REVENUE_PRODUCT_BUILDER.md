# Premium Revenue Product Builder

## Purpose

`Premium Revenue Product Builder` is the recurring autonomous build loop for WoofWatcher. Its job is to keep moving the app toward a premium mobile-first dog-care operating system without requiring Apollo to approve routine engineering decisions.

## Operating Mode

- Name: Premium Revenue Product Builder
- Product: WoofWatcher
- Canonical app: `artifacts/woofwatcher-mobile`
- Shared domain logic: `lib/care-domain`
- API: `artifacts/api-server`
- Sandbox: workspace-write
- Approval policy target: approve for routine local work where the platform allows it; never request approval for normal code edits, tests, docs, commits, or queue updates
- Cadence target: every 3 hours
- Worktree target: `../woofwatcher-premium-revenue-product-builder`
- Branch target: `automation/premium-revenue-product-builder`

## Required Read Order

Every run must read:

1. `AGENTS.md`
2. `docs/APOLLO_VISION_SYNTHESIS.md`
3. `docs/30_YEAR_NORTH_STAR.md`
4. `docs/MONEY_RELEASE_PLAN.md`
5. `docs/AUTONOMOUS_BUILD_QUEUE.md`
6. `docs/QUALITY_GATES.md`
7. `docs/QA_TEST_PLAN.md`
8. `docs/ULTIMATE_RELEASE_PLAN.md`
9. `docs/DECISION_LOG.md`
10. `docs/BLOCKERS_FOR_APOLLO.md`

## Work Loop

1. Inspect `git status --short --branch`.
2. Pull `main`.
3. Ensure the dedicated worktree exists.
4. Read the required docs.
5. Pick the highest-impact unfinished task from `docs/AUTONOMOUS_BUILD_QUEUE.md`.
6. Write or update behavior tests before implementation when the slice changes behavior.
7. Implement the smallest complete product slice.
8. Run focused tests.
9. Run typecheck/build when dependencies are available.
10. Fix introduced failures.
11. Update docs, decisions, blockers, quality gates, and the queue.
12. Commit with a clear product-facing message.
13. Push.
14. Check GitHub Actions `WoofWatcher Verify`.
15. If CI fails, fetch logs, fix, commit, push, and re-check.

## Verification Commands

Focused behavior tests:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts lib\care-domain\test\*.test.ts
```

Full CI-equivalent command when `pnpm` and dependencies are installed:

```powershell
pnpm run build:ci
```

GitHub Actions:

```powershell
& "C:\Users\Apoll\OneDrive\Documentos\New project\tools\gh\bin\gh.exe" run list --repo ApolloDNR/WoofWatcher --limit 3
```

Manual verification trigger if a push updates `main` without creating an Actions run:

```powershell
& "C:\Users\Apoll\OneDrive\Documentos\New project\tools\gh\bin\gh.exe" workflow run verify.yml --repo ApolloDNR/WoofWatcher --ref main
```

## Normal Decisions The Automation May Make

- Implementation order within the active queue.
- Small UI copy, layout, routing, and empty-state decisions.
- Test additions and focused refactors.
- Domain helper extraction.
- Queue and docs updates after verified work.
- Bug fixes discovered while implementing the chosen slice.

## Stop Conditions

Stop only for:

- missing secrets or credentials,
- destructive database or user-data risk,
- production deployment approval,
- App Store or Play Store submission approval,
- legal/compliance review,
- money movement,
- regulated health advice boundaries,
- source-of-truth contradictions.

## Current Next Slice

As of 2026-06-11, the current queue points to mobile runtime QA and premium polish: native simulator/device smoke, full accessibility pass, visual regression, App Store prep, premium design/motion, deeper multi-device conflict policy, provider-backed notification delivery, report export hardening, medication search/filters, water goal customization, hydration trends, saved walk routes/maps, dog park templates, formal training plans, potty trend history, accident/urgency follow-up workflows, and stricter medication scheduling. CI-safe static route/safety smoke, critical action screen-reader label smoke, Expo web export smoke, Free/Plus/Family entitlement policy, release-grade Expo app identity, a tested Home avatar motion state model, durable sync outbox derivation, Log recovery banner, More Sync Health dashboard, Household Responsibility Center, Care Log Audit Trail, conflict-safer care-document refresh, print-ready Care Pass artifact HTML, Records report-history print-source sharing, printable Dog ID credential source, medication adherence status, medication-specific log defaults, Medication Follow-ups, Medication History, Home water quick logs, shared daily hydration summaries, Records Hydration UI, Home walk quick-log visibility, shared Walk Activity summaries, Saved Routes templates, Records Walk Activity/Saved Routes UI, weekly Care Trends, structured Training Progress, Home potty quick-log visibility, potty stool color/context capture, shared Potty Health summaries, Records Potty Health UI, and Care Pass walk/hydration/training/potty/medication/trend report language exist, but native rendering, screen-reader traversal, screenshots, final Rive/Lottie/Reanimated assets, binary PDF generation, real push notifications, richer role permissions, server-backed report storage, EAS/App Store credentials, and real checkout remain blocked.
