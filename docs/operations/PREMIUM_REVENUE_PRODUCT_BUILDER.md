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

As of 2026-06-22, the current queue points to native runtime QA and premium polish. The mobile app now has a registered full Phoenix sprite manifest, first-pass dogless room variants, PixelLab frame-to-strip tooling, room-variant tooling, a 12-item Avatar Studio template preview catalog, a full 12-template base still pack, full animated launch template packs, premium board anatomy across the core routes, release-grade Expo identity, EAS profiles, local-first care workflows, report/handoff surfaces, medication/water/walk/potty/training/alone-time/weight/grooming derivations, bounded WoofGuide drafts, and shared safe-area/accessibility contracts for bottom route clearance, composers, modal sheets, floating feedback, centered prompts, route top clearance, error-recovery debug controls, keyboard avoidance, inline hit slop, and 48px touch targets.

Latest completed local runtime/accessibility hardening:

- Home header navigation controls now use the shared `MIN_MOBILE_TOUCH_TARGET` 48px contract. The More menu and Health Watch notification buttons have mobile readiness coverage before native accessibility traversal is available.
- Error recovery debug and close controls now use the shared `MIN_MOBILE_TOUCH_TARGET` 48px contract. The development error-details button and error-details modal close control have mobile readiness coverage before native accessibility traversal is available.
- Calendar event discovery and upcoming-event controls use the shared `MIN_MOBILE_TOUCH_TARGET` 48px contract. The discover icon, suggested-event icon, upcoming-event icon, and remove-event control have mobile readiness coverage before native accessibility traversal is available.
- Plans routine/event modal controls use the shared `MIN_MOBILE_TOUCH_TARGET` 48px contract. Routine type chips, owner quick chips, save buttons, delete routine, and add-event save controls have mobile readiness coverage before native accessibility traversal is available.
- Auth onboarding action controls use the shared `MIN_MOBILE_TOUCH_TARGET` 48px contract. The primary auth button and Google SSO button have mobile readiness coverage before native accessibility traversal is available.
- Living Phoenix room tap cues use the shared mobile tap contract. The animated care-twin room pressable uses `MOBILE_INLINE_HIT_SLOP`, and the visible status/next-action cue chips use `MIN_MOBILE_TOUCH_TARGET` before native accessibility traversal is available.
- Remaining high-frequency route actions use the shared `MIN_MOBILE_TOUCH_TARGET` 48px contract. Quick Log launcher tabs and outbox retry, Records empty-add/delete controls, More Care Intelligence/tool/premium/profile-edit actions, and Privacy export/delete buttons have mobile readiness coverage before native accessibility traversal is available.
- Onboarding and Avatar Studio creation actions expose explicit screen-reader roles, labels, and state where relevant. Shared auth primary/Google buttons, Setup starter-routine/save/finish-later actions, and Avatar Studio reset/save controls now have mobile readiness coverage before native accessibility traversal is available.
- Avatar Studio owner-input controls now finish the shared mobile touch-target pass. Scan gallery/camera actions, template tiles, accessory tiles, and mood preview chips use the shared `MIN_MOBILE_TOUCH_TARGET` floor, and face-marking choices expose explicit screen-reader labels before native accessibility traversal is available.
- API route contract readiness now runs in the focused test suite before live database/provider integration tests are available. Authenticated household scoping, care-state optimistic conflicts, household-isolated care-entry writes, and the `/care-entries?limit=` query contract are covered across the API routes, OpenAPI, zod, and generated React client types.
- Server-backed care-entry deletes now retain a household audit note before final live retention policy work. The API creates a non-health audit note with the deleted-entry snapshot and audit trail after a scoped delete, and mobile Log avoids duplicate local audit notes for synced deletes while preserving local/offline deletion audits.
- Care-state optimistic writes now use an atomic household-and-version update before live database/provider integration tests are available. A raced write refetches the latest household care document and returns the existing recoverable 409 response shape instead of clobbering newer shared care data.
- Household member profile updates now stay active-household scoped before provider-backed role enforcement. `PATCH /me` keeps the global user display-name update, but the household member display-name row is constrained by both authenticated user id and active household id.
- Household rename is now owner/admin gated before provider-backed role enforcement. `PATCH /household` checks the authenticated user's active-household membership role and returns 403 for non-owner/admin members before changing the shared pack name.
- Household invite joins now avoid creating a throwaway default pack before accepting an invite. `POST /household/join` provisions the authenticated user directly, ensures the invited household has care state, avoids duplicate memberships, and adds first-time invitees as `member`.
- Household invite codes are now visible only to owner/admin members in `/me` before provider-backed role enforcement. Ordinary members still receive the shared household context, but invite sharing stays unavailable so care contributors cannot spread pack access.
- Household invite accepts now persist the joined pack as the user's active household before explicit household switching exists. Later active-household care-state, care-entry, profile, and household routes stay pointed at the joined pack when that membership is still valid.
- Active-household switching now has a membership-scoped API contract before mobile switching UI exists. `PATCH /me/active-household` only accepts households where the authenticated user is already a member, ensures care-state readiness, updates `users.activeHouseholdId`, and returns the selected household context across the OpenAPI/zod/generated React client contract.

Next highest-impact work:

1. Run native iOS/Android simulator or device QA when provider/runtime access is available.
2. Continue accessibility traversal and visual runtime inspection for the live mobile app and Avatar Studio once simulator/device access is available.
3. Replace first-pass derived room variants with final illustrated room art.
4. Replace first-pass derived room variants with final illustrated night, bedtime, health-watch, and home-alone room art, then continue screen-by-screen polish, accessibility traversal, and visual regression.
5. Add live API integration tests for care-state write races and care-entry delete retention once a test database and provider-auth harness are available.
6. Add live household provisioning, invite-join, active-household persistence, active-household switching, role-gated household rename, invite-code visibility, and multi-household membership integration tests once a test database and provider-auth harness are available.
7. Prepare provider-backed auth, storage, AI, notifications, checkout, and app-store submission only after Apollo approves those production decisions.
