# WoofWatcher Agent Operating Notes

> **PICKING THIS UP FRESH? START HERE:** `docs/release/STATUS.md` is the
> current release truth. Its exact release-branch SHA and browser/native
> verdicts override every dated handoff. Then read
> `docs/handoff/HANDOFF_2026-07-18.md` for historical context and the vision
> documents below. A paste-ready kickoff prompt for a new assistant is at
> `docs/handoff/NEXT_AGENT_PROMPT.md`.

## Source Of Truth Order

When working in this repo, use this order:

0. `docs/release/STATUS.md` (current exact release-branch SHA and verdicts)
1. `docs/handoff/HANDOFF_2026-07-18.md` (dated historical handoff)
2. `AGENTS.md`
3. `docs/V1_COMPLETION_AUDIT.md`
4. `docs/V1_PLAN.md`
5. `docs/FIGMA_BRIEF.md`
6. `docs/strategy/LOCKED_BUSINESS_PLAN_AND_PRD.md`
7. `docs/strategy/CODEX_BUILD_HANDOFF.md`
8. `docs/design/WOOFWATCHER_UI_DIRECTION_LOCK.md`
9. `docs/APOLLO_VISION_SYNTHESIS.md`
10. `docs/30_YEAR_NORTH_STAR.md`
11. `docs/MONEY_RELEASE_PLAN.md`
12. `docs/AUTONOMOUS_BUILD_QUEUE.md`
13. `docs/QUALITY_GATES.md`
14. `docs/QA_TEST_PLAN.md`
15. `docs/ULTIMATE_RELEASE_PLAN.md`
16. `docs/PRODUCT_QUALITY_GATES.md`
17. `docs/DECISION_LOG.md`
18. `docs/BLOCKERS_FOR_APOLLO.md`
19. `docs/operations/PREMIUM_REVENUE_PRODUCT_BUILDER.md`
20. `README.md` and `replit.md`
21. Product specs and implementation plans in `docs/superpowers`
22. Current app, API, package, test, CI, schema, and migration state
23. Brand/design screenshots and external references Apollo provides

Dated handoffs and the Premium Revenue Product Builder journal retain history,
but cannot override the exact release-branch SHA and browser/native verdict in
`docs/release/STATUS.md`.

## Product Identity

WoofWatcher is a premium mobile-first dog care operating system. It is the shared command center for a dog's routines, logs, health signals, records, caregiver coordination, sitter/vet/trainer handoffs, and WoofGuide AI assistance.

The v1.5 product direction is Premium Neo-Retro Pixel Care: "Real care. Pixel heart." and "Your dog's day, brought to life." The product promise is: "Care for your real dog. Watch their care twin come alive."

The canonical product surface is `artifacts/woofwatcher-mobile`. The API is `artifacts/api-server`. Shared care rules belong in `lib/care-domain`. The web app in `artifacts/woofwatcher` is a local-first PWA/dashboard surface that must preserve localStorage, backup/import, reports, Health Watch, Bile Watch, records, and assistant routing while it is upgraded toward the v1.5 app shell and visual direction.

Dog-first means dog-first. Do not dilute the first premium release by trying to serve all pets equally. Architecture may remain flexible for later species support, but the release target is the best shared dog-care command center.

Core product model:

- Routines = what should happen.
- Logs = what actually happened.
- Dog Profile = the living source of truth.
- Household Sync = everyone stays updated.
- WoofGuide = safe AI care assistant for summaries, patterns, owner-reviewed actions, and handoffs.

The mature loop is: Dog profile -> routines -> quick logs -> health patterns -> reminders -> caregiver handoff -> vet/sitter report -> WoofGuide.

## Premium Standard

Do not treat a basic demo as done. A release-quality change should improve one or more of these:

- A real owner can understand what the dog needs now.
- A caregiver can log care quickly and accurately.
- Another household member can trust the shared record.
- A sitter, trainer, or vet can receive a clear handoff or report.
- Health tracking helps organize patterns without diagnosing.
- WoofGuide produces bounded, useful, care-aware actions.
- The app has no dead buttons, blank states, fake flows, or hidden sync failures.

## Medical And AI Boundary

WoofGuide may summarize logs, explain patterns, draft vet notes, suggest reminders, prepare handoffs, and help organize care.

WoofGuide must not diagnose, replace a veterinarian, claim emergency certainty, or present medical advice as authoritative. Urgent red flags should direct the user to veterinary care.

## Engineering Rules

- Keep mobile as the primary user experience.
- Keep care event taxonomy, status derivation, diet progress, handoff, records, sticky notes, and health-watch logic in `lib/care-domain` when they are reusable.
- Keep API writes authenticated and household-scoped.
- Keep care logs append-safe and sync failures visible.
- Treat routines and logs as linked systems. A matching log should satisfy/update the corresponding routine instead of only creating unrelated history.
- Meal logging must support expected portion, served amount, eaten amount, skipped/partial completion, notes, and household visibility.
- Do not paste secrets into chat, docs, commits, or tests.
- Use pnpm workspace commands for full verification when dependencies are installed.
- Use the root focused tests for zero-dependency behavior checks:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts lib\care-domain\test\*.test.ts
```

## Autonomous Work Loop

Before each implementation slice:

1. Inspect `git status --short --branch`.
2. Read `docs/operations/PREMIUM_REVENUE_PRODUCT_BUILDER.md`.
3. Read `docs/ULTIMATE_RELEASE_PLAN.md`.
4. Choose the highest-impact unfinished task that moves the app toward Full Premium Release.
5. Write or update tests for the behavior when practical.
6. Implement the smallest coherent product slice.
7. Run focused tests locally.
8. Commit and push when the slice is ready.
9. Check GitHub Actions for `WoofWatcher Verify`.
10. Update release docs when scope, decisions, blockers, or status changes.

Default autonomous priority:

1. Keep CI green and repair failing verification before adding feature scope.
2. Preserve the routines/logs relationship and meal logging correctness.
3. Implement the v1.5 shell/navigation direction across mobile and PWA surfaces.
4. Improve Today Command, Phoenix Home, Quick Log, Health Watch, Bile Watch, Diet & Treats, Care Pass, WoofGuide, Avatar Studio, and household workflows without dead ends.
5. Continue premium design, motion, accessibility, App Store, privacy, export/delete, and production hardening.

Stop only for missing secrets, destructive data risk, app-store approval, legal/veterinary safety boundaries, production approval, or direct source-of-truth contradictions.

## Current Verification Baseline

As of the latest CI repair slice, GitHub Actions `WoofWatcher Verify` passes on `main` for:

- dependency install with frozen lockfile
- focused behavior tests
- workspace typecheck
- API build
- web prototype build
- mockup sandbox build
