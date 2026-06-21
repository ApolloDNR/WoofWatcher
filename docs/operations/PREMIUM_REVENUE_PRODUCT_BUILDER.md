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

As of 2026-06-19, the current queue points to native runtime QA and premium polish. The mobile app now has a registered full Phoenix sprite manifest, a complete dogless PixelLab final-candidate room set for day, night, bedtime, health-watch, and home-alone states, PixelLab frame-to-strip tooling, room-variant tooling, two subscription seed strips for movement review, an archived supplemental subscription-backed bark reaction strip, a full current Option B hard-pixel Phoenix runtime candidate family for idle/tail-wag, walk, ear-perk, eat, drink, corrected curled sleep, comfort/home-alone, health-watch, celebrate, and dedicated bark/tap reaction, a tested care-twin native QA matrix for all 12 avatar motion states, live idle/walk sprite preview packs for every non-Phoenix launch template, crisp pixel rendering on web image paths, a cleaned Avatar Studio `LivingPhoenixRoom` Studio presentation, a tighter Option B-style Phoenix Home console with in-room status HUD readouts, live/still readiness badges in the Avatar Studio template picker, a stronger live-template pixel stage in Avatar Studio, a 12-item Avatar Studio template preview catalog, a full 12-template Avatar Studio base still pack, the first Shepherd/Phoenix accessory overlay PNG pack, the first Shepherd/Phoenix 10-state emote still pack, Retriever, Husky/Spitz, and Bully 10-state template emote packs, a 10-item PixelLab inventory accessory pack, premium board anatomy across the core routes, release-grade Expo identity, EAS profiles, local-first care workflows, report/handoff surfaces, medication/water/walk/potty/training/alone-time/weight/grooming derivations, and bounded WoofGuide drafts. Expo web export is locally working again in the premium revenue builder worktree through the package-local Expo CLI and Metro resolver patch. PixelLab asset verification should be rerun after each asset import and must show no missing or invalid files. Live Expo preview/browser screenshot capture has been unreliable in this desktop environment, so use mobile typecheck, focused tests, PixelLab verification, static Expo export, and visible in-app browser checks as the current verification evidence until device QA is available.

The 2026-06-19 subscription-backed Phoenix replacement review did not promote weaker PixelLab candidates over the current Option B runtime family. Continue by testing and refining the approved layered runtime on real phone-sized screens before spending another generation batch on main-character replacement art. An internal/development `/care-twin-qa` route now renders every care-twin matrix scenario through the production `LivingPhoenixRoom`, so the next device pass can inspect all states without manually manipulating care history. The route now also captures Pass/Needs tune status, per-state notes, summary counts, and a native shareable QA report for device-session evidence.

The 2026-06-20 unblocked care-workflow pass added Incident Watch as a canonical behavior-safety workflow while native QA remains blocked. Incident Watch now covers altercations, bites, rough greetings, escape/injury, and trigger/exposure/follow-up context across Log, Records, Care Pass, shared domain logic, and tests. Keep future polish non-diagnostic and trainer/vet-review friendly.

The follow-up 2026-06-20 Incident Watch polish pass added trend windows, rising/improving/steady/clear labels, owner follow-up tasks, trainer goal suggestions, Records follow-up routing, and Care Pass trend/follow-up/goal language. The 2026-06-20 mobile-release QA pass then extended `/care-twin-qa` beyond the 12-state animation matrix into an internal launch workflow cockpit for Phoenix Home, Care Twin State Lab, Avatar Studio, Incident Composer, Records Incident Watch, and Trainer Care Pass, with Pass/Needs tune controls, per-surface notes, screenshot prompts, route-open buttons, launch-risk copy, and a combined native share report. A follow-up persistence pass made that internal QA session local-durable via AsyncStorage so testers can leave the route, inspect target workflows, return, and keep their evidence notes. The next choreography pass made Phoenix room taps state-aware and QA-readable: `careTwinChoreography.ts` derives primary loop, ambient loops, tap reaction, reaction timing, and motion-recipe copy so rest and Health Watch states stay calm instead of always barking. The latest QA evidence passes let testers attach local screenshot evidence from device Photos to each release surface and care-twin state, persist those attachments in the same local session, include filenames/counts in the share report, distinguish iOS evidence from Android evidence, and show tested Native proof open/ready plus exact missing iOS/Android/flexible evidence copy without claiming provider-backed QA storage or launch approval. Future Incident Watch work should focus on native QA polish and provider-backed behavior goal persistence after account/storage rules are approved.

The 2026-06-20 mobile-layout passes centralized floating-paw tab chrome, tabbed route bottom spacing, standalone route bottom spacing, auth/setup spacing, and docked WoofGuide composer spacing in `mobileLayout.ts`. The tab shell now uses shared tab/FAB metrics; Home, Log, Plans, Health, More, and Records use `getTabbedRouteBottomPadding`; Adventure, Avatar Studio, Care Twin QA, Premium, Privacy, Setup, and AuthShell use `getStandaloneRouteBottomPadding`; and WoofGuide uses `getDockedComposerBottomPadding` instead of route-local fixed padding. This reduces mobile safe-area drift before the native device pass, but real iOS/Android QA still must confirm phone-size bottom-nav clearance, keyboard/composer fit, touch reach, and route scrolling.

The 2026-06-20 household setup pass turned first-run onboarding into a real account-aware decision surface without pretending provider invites are live. Setup now captures Create household, Join by invite, or Local preview intent; persists `householdSetup` in the local care document; exports it in owner privacy data; blocks join saves until an invite code is present; and shows post-save confirmation copy that distinguishes local-only, account-needed, and provider-ready states. The same pass locked Apollo's latest light/dark visual reference boards into `docs/design/reference/` and the design lock docs. Provider-backed household creation, invite acceptance, role enforcement, and multi-device membership sync remain the next account/provider work.

The 2026-06-21 mobile interaction contract pass ported the latest main-line
safe-area and touch hardening into this richer advanced branch without doing a
destructive merge. `mobileLayout.ts` now centralizes route top padding, modal
sheet bottom padding, centered modal padding, keyboard avoiding offsets, floating
feedback/debug offsets, minimum touch targets, and inline hit slop. Home, Log,
Plans, Health, More, Records, Adventure, Avatar Studio, Care Twin QA, Premium,
Privacy, Setup, AuthShell, WoofGuide, ErrorFallback, and board primitives use
those helpers. Static readiness tests reject the old route-local formulas.
Local verification passed focused mobile layout/readiness tests, the 306-test
behavior/readiness suite, mobile TypeScript, PixelLab asset verification at 149
files, and Expo web export to
`tmp/woofwatcher-mobile-interaction-contract-export`.

The 2026-06-21 launch-readiness pass made the release cockpit truthful in code.
`launchReadiness.ts` derives internal-preview, native-QA-open, provider-gated,
approval-open, and store-ready states from native evidence, local release
foundations, sync health, storage, AI, payments, push, account deletion, legal,
support, store-account, and Apollo approval gates. More now uses that model for
six actionable launch tiles instead of hard-coded optimistic copy, so the app can
show exactly why it is not store-ready yet.

The follow-up 2026-06-21 storage backbone pass added a shared attachment
manifest for the local-first media/report queue. `attachmentManifest.ts` now
collects medication proof photos, record attachments, Adventure memory photos,
Care Pass print artifacts, and QA screenshots; marks each item local-only,
upload-ready, or provider-saved; and feeds the queue into Launch Readiness. More
can now show a concrete local-file storage gate without claiming cloud upload,
cross-device persistence, or provider-backed deletion is active.

The privacy continuation pass wires the same queue into owner data controls.
Privacy export bundles now include the local attachment queue count/summary, the
Privacy screen Files stat uses that full queue, document-storage gate copy names
local queued files, and deletion requests explicitly call for attachment-queue
review before destructive deletion. Provider object ids, signed downloads,
retention, and deletion receipts are still future storage-provider work.

The privacy queue review pass makes that queue owner-visible. Privacy export
bundles now include grouped review rows and the mobile Privacy screen renders
care proof photos, record documents, Adventure memories, Care Pass reports, and
QA screenshots with counts, status labels, safe action copy, and sample
filenames. The product remains truthful: rows stay local/provider-gated until
approved storage rules exist.

The release packet pass turns Launch Readiness into a shareable owner/operator
handoff. `releasePacket.ts` derives a release score, verdict, gate rows, owner
approval checklist, blockers, next actions, and truthful handoff notes from the
same `launchReadiness.ts` plan that powers More. More now displays the packet
score/verdict and exposes Share Launch Packet through native sharing. This is a
handoff artifact only; it does not approve App Store, Play Store, payments, AI,
storage, provider sync, or account deletion.

The support runbook pass makes one of the remaining launch gates concrete.
`supportRunbook.ts` derives support inbox, refund/subscription policy,
veterinary/emergency boundary, privacy/terms links, deletion escalation,
incident response, blockers, and share text. Privacy & Safety now shows a
Support runbook card with explicit blockers and native sharing. It is still a
readiness packet, not legal approval or payment activation.

Next highest-impact work:

1. Finish full local verification for the support runbook slice, commit/push it,
   trigger GitHub verify, and document the remote CI blocker if it repeats.
2. Run native iOS/Android simulator or device QA with `/care-twin-qa` and `docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md`, complete both the Mobile Release QA checklist and the 12-state care-twin matrix, attach screenshots through the platform-aware in-app evidence controls, confirm iOS and Android counts are both satisfied, share/export the QA report, and fix the first visible stage/sprite/Incident Watch/safe-area/composer/setup/modal/touch issue.
3. Continue production-scale Avatar Studio animation packs: native phone-size QA for the wired Option B Phoenix family, review all template-matched sprite strips, refine weak gait loops where needed, add overlay layers, remaining emote stills, and body-class polish.
4. Continue screen-by-screen polish, accessibility traversal, and visual regression.
5. Prepare provider-backed auth, storage, AI, notifications, checkout, and app-store submission only after Apollo approves those production decisions.
