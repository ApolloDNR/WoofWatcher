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

As of 2026-06-18, the current queue points to native runtime QA and premium polish. The mobile app now has a registered full Phoenix sprite manifest, first-pass dogless room variants, PixelLab frame-to-strip tooling, room-variant tooling, two subscription seed strips for movement review, a supplemental subscription-backed bark reaction strip, the first non-Phoenix Retriever live sprite preview pack, crisp pixel rendering on web image paths, a cleaned Avatar Studio `LivingPhoenixRoom` Studio presentation, a tighter Option B-style Phoenix Home console with in-room status HUD readouts, a 12-item Avatar Studio template preview catalog, a full 12-template Avatar Studio base still pack, the first Shepherd/Phoenix accessory overlay PNG pack, the first Shepherd/Phoenix 10-state emote still pack, Retriever, Husky/Spitz, and Bully 10-state template emote packs, a 10-item PixelLab inventory accessory pack, premium board anatomy across the core routes, release-grade Expo identity, EAS profiles, local-first care workflows, report/handoff surfaces, medication/water/walk/potty/training/alone-time/weight/grooming derivations, and bounded WoofGuide drafts. Expo web export is locally working again in the premium revenue builder worktree through the package-local Expo CLI and Metro resolver patch. PixelLab asset verification currently passes with `ok=111 missing=0 invalid=0`. Live Expo preview/browser automation has been unreliable in this desktop environment, so use mobile typecheck, focused tests, PixelLab verification, and static Expo export as the current verification evidence until device QA is available.

Next highest-impact work:

1. Run native iOS/Android simulator or device QA when provider/runtime access is available.
2. Continue production-scale Avatar Studio animation packs: template-matched sprite strips, overlay layers, emote stills, and body-class sprite rigs for Husky, Bully, Doodle, and the remaining launch templates, plus a refined Retriever gait loop if phone-size QA calls for it.
3. Replace first-pass derived room variants with final illustrated room art.
4. Continue screen-by-screen polish, accessibility traversal, and visual regression.
5. Prepare provider-backed auth, storage, AI, notifications, checkout, and app-store submission only after Apollo approves those production decisions.
