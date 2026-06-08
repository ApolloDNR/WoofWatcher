# WoofWatcher Agent Operating Notes

## Source Of Truth Order

When working in this repo, use this order:

1. `AGENTS.md`
2. `README.md` and `replit.md`
3. `docs/ULTIMATE_RELEASE_PLAN.md`
4. `docs/PRODUCT_QUALITY_GATES.md`
5. `docs/DECISION_LOG.md`
6. Product specs and implementation plans in `docs/superpowers`
7. Current app, API, package, test, CI, schema, and migration state
8. Brand/design screenshots and external references Apollo provides

## Product Identity

WoofWatcher is a premium mobile-first dog care operating system. It is the shared command center for a dog's routines, logs, health signals, records, caregiver coordination, sitter/vet/trainer handoffs, and WoofGuide AI assistance.

The canonical product surface is `artifacts/woofwatcher-mobile`. The API is `artifacts/api-server`. Shared care rules belong in `lib/care-domain`. The web app in `artifacts/woofwatcher` is a prototype/dashboard surface unless intentionally promoted.

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
- Do not paste secrets into chat, docs, commits, or tests.
- Use pnpm workspace commands for full verification when dependencies are installed.
- Use the root focused tests for zero-dependency behavior checks:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts lib\care-domain\test\*.test.ts
```

## Autonomous Work Loop

Before each implementation slice:

1. Inspect `git status --short --branch`.
2. Read `docs/ULTIMATE_RELEASE_PLAN.md`.
3. Choose the highest-impact unfinished task that moves the app toward Full Premium Release.
4. Write or update tests for the behavior when practical.
5. Implement the smallest coherent product slice.
6. Run focused tests locally.
7. Commit and push when the slice is ready.
8. Check GitHub Actions for `WoofWatcher Verify`.
9. Update release docs when scope, decisions, blockers, or status changes.

## Current Verification Baseline

As of the latest CI repair slice, GitHub Actions `WoofWatcher Verify` passes on `main` for:

- dependency install with frozen lockfile
- focused behavior tests
- workspace typecheck
- API build
- web prototype build
- mockup sandbox build
