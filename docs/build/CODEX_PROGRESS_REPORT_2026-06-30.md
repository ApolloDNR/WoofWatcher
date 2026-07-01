# Codex Progress Report - 2026-06-30

## Slice

Mobile design-system recovery pass focused on Health Watch, Quick Log, and the current visual north star.

## What Changed

- Mirrored Apollo's newest design references into `docs/design/reference/`.
- Added `docs/design/MOBILE_DESIGN_SYSTEM_RECOVERY_PLAN_2026-06-30.md`.
- Reworked the mobile Health Watch route around a stricter screen recipe:
  - pixel stage
  - compact care-status panel
  - selected Health/Bile module
  - trimmed review packet
  - pattern board and care boundary below
- Removed the old top metric rail and status meter rail from Health Watch.
- Replaced the cramped Health Snapshot grid with touch-target-safe rows.
- Kept Bile Watch scoped to the Bile Watch tab.
- Added Avatar Studio motion preview model coverage from the active care-twin work.
- Reworked the mobile Quick Log first screen around a stricter command hierarchy:
  - tighter pixel command stage bounds for sprite, speech bubble, HUD, and action footer
  - `Quick Log Flow` action console
  - action grid before teaching rail
  - support metrics between the launcher and detail composer
  - full composer preserved as a secondary detail dock
- Added a mobile readiness guard that protects the Quick Log design-system recovery recipe.

## Verification

Passed:

- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/avatarPreviewModel.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
- `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
- `node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`
- `node --experimental-strip-types --test artifacts/api-server/test/*.test.ts artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts`
- `node artifacts/woofwatcher-mobile/scripts/smoke-web-export.js` with bundled Node on PATH
- Live preview route smoke for `/`, `/health`, and `/log` at `http://127.0.0.1:4194/`

Result:

- Focused readiness: 109/109 passed.
- Quick Log/mobile readiness: 102/102 passed.
- Mobile TypeScript: passed.
- Broader focused suite: 485/485 passed.
- Expo web export: passed with 218 assets / 222 files.

Remote:

- Commit `f400c6c` was pushed to `automation/premium-revenue-product-builder`.
- GitHub Actions run `28477776271` failed before useful execution in 6
  seconds; `gh run view --log-failed` returned `log not found:
  84406620473`. Treat this as the standing remote runner/account blocker, not
  as a local product regression.

## Remaining Design Work

- Plans needs a mission/responsibility layout pass.
- More needs grouped navigation hierarchy and less wall-of-options density.
- Records needs a vault/credential scanability pass.
- Home needs final dark RPG board alignment after the core utility screens share this stricter design system.

## Later Health Watch Polish Slice

Apollo called out the current design as too ugly, overlapping, and confusing,
so Health Watch received a second, stricter mobile layout pass.

What changed:

- Replaced the centered/plain Health header with a normal app header:
  `Health`, `Health Watch`, and the explicit boundary subtitle
  `Calm patterns. Clear owner notes. No diagnosis.`
- Added a compact Health command deck inside the first card for Appetite,
  Potty, Vomit, and Water, each routing to the correct detailed health/log flow.
- Reduced the Health pixel stage height and sprite footprint so the live
  health-watch sprite, speech bubble, HUD, and card content have clearer
  boundaries on phone screens.
- Reworked Health Snapshot rows into a two-line row anatomy: icon, title/status
  line, detail line, and a small `Log` action pill. This removes the cramped
  one-line label/status/action collision.
- Tightened the Review Packet spacing so it reads as a professional vet-share
  module below the primary Health status, not a competing dashboard.
- Added readiness guards for the Health command deck and safer signal row
  anatomy.

Verification:

- Mobile readiness passed 102/102.
- Mobile TypeScript passed with
  `node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`.
- Broader focused mobile/domain/API/PWA suite passed 485/485.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files.
- Static preview route smoke passed for `/`, `/health`, `/log`, and
  `/calendar` at `http://127.0.0.1:4194/`.

Preview:

- The local static preview server is running at `http://127.0.0.1:4194/`.
- Local screenshot capture through Playwright and Chrome headless was blocked
  by local browser tooling timeouts / no screenshot file output, so visual proof
  still needs Apollo or a later device/browser QA capture.

## Later Plans Mission Hierarchy Slice

Plans received the next design-system recovery pass so the screen reads like a
care mission cockpit instead of a loose schedule stack.

What changed:

- Added a `PlanMissionRow` model and `Today's Missions` board beneath the pixel
  Plans Command Deck.
- The new mission board connects:
  - next scheduled care item
  - household responsibility state
  - lead Reminder Center action
- Added a `Mission Schedule` header with open-count pill before the
  Today/Tomorrow/Week tabs.
- Preserved route-backed behavior for routine editing, one-tap done logging,
  Reminder Center actions, Daily Routine owner loads, and household
  responsibility metrics.
- Added readiness coverage for the mission-first Plans hierarchy.

Verification:

- Mobile readiness passed 103/103.
- Mobile TypeScript passed with
  `node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`.
- Broader focused mobile/domain/API/PWA suite passed 486/486.
- `git diff --check` passed with expected Windows CRLF warnings only.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files after
  prepending bundled Node to `PATH`.
- Static preview route smoke passed for `/`, `/calendar`, `/health`, and `/log`
  at `http://127.0.0.1:4194/`.
- The in-app browser was opened to `http://127.0.0.1:4194/calendar`; DOM
  verification found the command deck, Today's Missions, Mission Schedule, and
  Reminder Center content.

Preview:

- Local screenshot capture through the in-app browser still timed out on
  `Page.captureScreenshot`, so visual proof remains pending real browser/device
  screenshots even though the live route is navigable.

## 2026-07-01 More Command Directory Slice

More received the next design-system recovery pass so the screen has a clear
front door before exposing the deep launch and household systems.

What changed:

- Added a typed `MoreDirectoryItem` model and a `Command Directory` board under
  the pixel Launch Command Hub.
- Added four first-screen, route-backed workflow exits:
  - Care Today, using the current Care Intelligence next action.
  - Household, using the household responsibility summary and `/more?section=household`.
  - Records & passes, routing to `/records`.
  - Launch QA, routing to the focused `/care-twin-qa` mission.
- Kept the existing CareTwin roster, Care Intelligence, Launch Readiness,
  provider setup, Native QA captures, household access, Access Pass, My Care
  Today, Tools & Sharing, and Diet Profile behavior intact below the directory.
- Added mobile readiness coverage for the grouped More hierarchy.

Verification:

- Mobile readiness passed 104/104.
- Mobile TypeScript passed with
  `node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`.
- Broader focused mobile/domain/API/PWA suite passed 487/487.
- `git diff --check` passed with expected Windows CRLF warnings only.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files after
  prepending bundled Node to `PATH`.
- Static preview route smoke passed for `/more`, `/health`, `/calendar`, and
  `/` at `http://127.0.0.1:4194/`.

Preview:

- The local static preview server remains available at
  `http://127.0.0.1:4194/`.
- This pass improves local web/mobile structure only; native iOS/Android visual
  QA screenshots and Apollo launch sign-off remain required.

## 2026-07-01 Records Vault Command Slice

Records received the next design-system recovery pass so the screen starts with
owner actions before the dense vault evidence.

What changed:

- Added a typed `RecordsCommandItem` model and a `Vault Command` board under the
  live Records Command Vault pixel stage.
- Added four first-screen, behavior-backed workflow exits:
  - Dog ID, wired to `shareCredential`.
  - Record vault, wired to `openRecordForm("document")`.
  - Care Pass, wired to `openCarePassPreview("vet")`.
  - Reports, wired to `shareReport`.
- Kept the existing Dog ID card, Record Vault, reminders, trend panels,
  medication history, Care Pass options, report history, progress report, and
  records cabinet below the new command layer.
- Added mobile readiness coverage for the Records vault-command hierarchy.

Verification:

- Mobile readiness passed 105/105.
- Mobile TypeScript passed with
  `node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`
  through the bundled Node runtime.
- Broader focused mobile/domain/API/PWA suite passed 488/488.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files after
  prepending bundled Node to `PATH`.
- Static preview route smoke passed for `/records`, `/more`, `/health`, and
  `/` at `http://127.0.0.1:4194/`.
- The in-app browser was opened to `http://127.0.0.1:4194/records`; DOM
  verification found Vault Command, Dog ID, Record Vault, Care Pass, and
  Reports.

Preview:

- The local static preview server remains available at
  `http://127.0.0.1:4194/records`.
- This pass improves local web/mobile structure only; native iOS/Android visual
  QA screenshots and Apollo launch sign-off remain required.

## 2026-07-01 Home Care Status Board Slice

Home received the final first-screen design recovery pass in this route group.
The goal was to make the flagship screen read like a planned care world rather
than a room followed by loose metrics.

What changed:

- Wrapped the Happiness, Energy, Hunger, and Bond tiles in a `Care Status`
  board.
- Added a source-backed presence pill to the Care Status header:
  `Alone`, `On walk`, or `With [caregiver]`.
- Kept the existing interaction model intact: each status tile still opens its
  exact care workflow, and Today Command, Next Up, Quick Log, and Today's
  Missions remain in their current order.
- Added mobile readiness coverage for the first-screen Care Status hierarchy.

Verification:

- Mobile readiness passed 106/106.
- Mobile TypeScript passed with
  `node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`
  through the bundled Node runtime.
- Broader focused mobile/domain/API/PWA suite passed 489/489.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files after
  prepending bundled Node to `PATH`.
- Static preview route smoke passed for `/`, `/log`, `/calendar`, `/health`,
  `/records`, and `/more` at `http://127.0.0.1:4194/`.
- The in-app browser was opened to `http://127.0.0.1:4194/`; DOM verification
  found Phoenix Room, Care Status, Today Command, and Today's Missions.

Preview:

- The local static preview server remains available at
  `http://127.0.0.1:4194/`.
- This pass improves local web/mobile structure only; native iOS/Android visual
  QA screenshots and Apollo launch sign-off remain required.

## 2026-07-01 Route Visual Consistency QA Slice

The final route-to-route design recovery pass now has a durable product surface.
Instead of relying on chat critique, the app now carries a launch-critical QA
target for whether the six main routes feel like one planned premium mobile app.

What changed:

- Added `Route Visual Consistency` to `MOBILE_RELEASE_QA_SURFACES`.
- The QA surface checks Home, Log, Plans, Health, Records, and More for:
  - one pixel or command stage;
  - one practical command board;
  - compact section headers and consistent card rhythm;
  - bottom-nav clearance;
  - no clipped or overlapping first-screen text;
  - no dead-end primary action.
- Added `Design QA` to More's first-screen `Command Directory`, routed to the
  focused QA cockpit for `route-visual-consistency`.
- Tightened shared board primitives with crisper framed cards, compact header
  pills, one-line header behavior, and lighter shadows.

Verification:

- `mobileReleaseQa.test.ts` passed 14/14.
- Mobile readiness passed 106/106.
- Mobile TypeScript passed with
  `node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`
  through the bundled Node runtime.
- Broader focused mobile/domain/API/PWA suite passed 490/490.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files after
  prepending bundled Node to `PATH`.
- Static preview route smoke passed for `/`, `/log`, `/calendar`, `/health`,
  `/records`, `/more`, and `/care-twin-qa?qaSurface=route-visual-consistency`
  at `http://127.0.0.1:4194/`.
- The in-app browser was opened to the focused QA target and `/more`; DOM
  verification found Route Visual Consistency, the six route checklist labels,
  and the More `Design QA` command row.

Preview:

- The local static preview server remains available at
  `http://127.0.0.1:4194/more`.
- This pass improves local web/mobile design governance only; native
  iOS/Android screenshots, exact pnpm 10.24 doctor proof, CI completion,
  provider-backed services, store approval, and Apollo launch sign-off remain
  required.

## 2026-07-01 Compact Web Preview Shell Recovery

After the route-level design recovery, headless and browser visual QA still
showed a major preview defect: the 390px mobile capture was showing a left navy
margin and cutting off the right side of the phone. This made otherwise valid
route work look broken.

What changed:

- Reworked the web `AppFrame` to clamp the exported HTML/body/root to the
  visible viewport.
- Added `visualViewport`-aware sizing so compact captures use the actual phone
  viewport instead of a hidden wider layout canvas.
- Left-anchored compact preview widths while keeping larger desktop previews
  centered.
- Removed extra tab-route horizontal padding in web preview mode and ensured
  Home, Log, Health, More, Records, Plans, Premium, and Care Twin QA do not
  start invisible during native entry animations.
- Pulled Home's notification badge back inside the alert button.

Verification:

- `mobileReadiness.test.ts` passed 110/110.
- Mobile TypeScript passed with
  `node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`
  through the bundled Node runtime.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files after
  prepending bundled Node to `PATH`.
- Headless Chrome captured current 390x844 web proof for:
  - Home: `tmp/route-home-final-badge.png`
  - Log: `tmp/route-log-anchorfix.png`
  - Health: `tmp/route-health-anchorfix.png`
  - More: `tmp/route-more-anchorfix.png`

Remaining:

- The compact web frame is now usable for local route polish, but it is still
  not native iOS/Android screenshot proof.
- Continue native `Route Visual Consistency` QA, exact pnpm 10.24 beta doctor
  proof, CI completion, provider-backed services, PDF output, store approval,
  and Apollo sign-off before calling this launch-complete.

## 2026-07-01 Health Compact Hierarchy Pass

After the preview shell was fixed, Health Watch still read too much like a
large art poster. The most important information was technically present but
not high enough in the mobile hierarchy.

What changed:

- Promoted `Health Snapshot` to the first card after the Health/Bile tab rail.
- Added a compact health status summary with score, `CARE STATUS`, status copy,
  and a progress track.
- Kept 7-day rhythm and tappable health rows in the first card so appetite,
  stool, hydration, energy, and vomiting are visible sooner.
- Reduced the pixel health room and sprite sizes so the scene supports the
  product instead of replacing it.
- Added `mobileReadiness.test.ts` coverage for Health Snapshot appearing before
  the pixel stage on compact phones.

Verification:

- `mobileReadiness.test.ts` passed 111/111.
- Mobile TypeScript passed with
  `node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`
  through the bundled Node runtime.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files after
  prepending bundled Node to `PATH`.
- Static preview route smoke passed for `/`, `/log`, `/calendar`, `/health`,
  `/records`, and `/more` at `http://127.0.0.1:4194/`.

Remaining:

- Local headless Chrome stopped emitting new PNG screenshots after the compact
  shell proof; route smoke/export stayed green. Native iOS/Android screenshots
  remain the real visual proof needed for launch.

## 2026-07-01 Home Compact Hero Recovery

Home had the right operating pieces but the compact first screen still felt too
crowded and visually risky. The room could open on a sleep/bed state, the
experimental avatar/accessory runtime could distort Phoenix above the fold, and
the floating next-chip sat across the dog.

What changed:

- Reduced the Home first-screen room density and status tile sizing while
  preserving accessible touch targets.
- Added a compact `LivingPhoenixRoom` mode for Home that hides duplicate HUD
  chrome and bottom room chips.
- Compact Home now uses a launch-safe, approved crisp Phoenix hero asset with a
  simple breathing/tail-wag presentation instead of the experimental layered
  sprite/accessory runtime.
- Tightened the speech bubble and anchored Phoenix on the rug so the dog remains
  readable in the 390px mobile preview.
- Preserved full/studio room behavior for Avatar Studio and Care Twin QA.

Verification:

- `homeFirstScreenLayout.test.ts` passed 3/3.
- `mobileReadiness.test.ts` passed 112/112 as part of the focused run.
- Combined focused Home/readiness tests passed 115/115.
- Mobile TypeScript passed with
  `node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`
  through the bundled Node runtime.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files after
  prepending bundled Node to `PATH`.
- Static preview route smoke passed for `/`, `/log`, `/calendar`, `/health`,
  `/records`, and `/more` at `http://127.0.0.1:4194/`.
- Chrome screenshot proof captured at
  `tmp/route-home-compact-hero-final.png`.

Remaining:

- This is local web/mobile proof only. Actual iOS and Android screenshots,
  exact pnpm 10.24 beta doctor proof, CI completion, provider-backed services,
  generated PDF output, store approval, and Apollo launch sign-off remain open.

## 2026-07-01 Compact Route Visual QA Polish

Apollo called out the current preview as still too ugly, overlapping, and
confusing. This pass used the exported mobile preview as the design QA source
and tightened the worst first-viewport issues across Quick Log, Health Watch,
and Avatar Studio.

What changed:

- Quick Log's pixel command stage is shorter, with a smaller live sprite,
  tighter speech bubble, and a compact dock so the action grid appears sooner.
- Health Watch now uses shorter boundary copy, compact route spacing, and a
  first Health Snapshot that shows the four highest-priority signals before
  the pixel stage instead of forcing the whole report under the floating nav.
- Avatar Studio now starts with a shorter header, a cleaner pixel room, one
  main dog, a reduced identity card, no duplicate template HUD, and a compact
  `Live PixelLab sprite rig.` caption instead of a truncated debug-style
  summary.
- Mobile readiness coverage was updated to protect the new Quick Log command
  sizing, Health compact hierarchy, and Avatar Studio hero-caption guardrails.

Verification:

- Focused mobile/design proof passed 134/134:
  `mobileReadiness.test.ts`, `mobileReleaseQa.test.ts`, and
  `avatarStudio.test.ts`.
- Expo web export passed twice to `artifacts/woofwatcher-mobile/.expo-smoke`
  with 218 assets / 222 files after prepending bundled Node to `PATH`.
- Clean static preview served the exported build at `http://127.0.0.1:4196/`.
- Playwright drove installed Chrome against the exported preview and captured:
  - `tmp/design-audit-2026-07-01-final/home.png`
  - `tmp/design-audit-2026-07-01-final/log.png`
  - `tmp/design-audit-2026-07-01-final/health.png`
  - `tmp/design-audit-2026-07-01-final/avatar-studio-final.png`

Remaining:

- This is still local web/mobile proof, not native iOS/Android device proof.
- Continue native screenshots, safe-area review, gesture/haptic timing, exact
  pnpm 10.24 beta doctor proof, CI completion, provider-backed
  sync/storage/AI/payments/push, generated PDF output, store approval, and
  Apollo launch sign-off before calling the app launch-ready.

## 2026-07-01 Plans Compact Schedule-First Recovery

The earlier Plans route still felt like a tall poster before a useful schedule:
the pixel scene, speech bubble, dog sprite, HUD, and mission rows pushed the
actual routine list too far down the first phone viewport.

What changed:

- Kept the live Plans Command Deck but reduced its stage height from 238px to
  168px.
- Reduced the Plans sprite from 136px to 104px, tightened the speech bubble and
  HUD, and kept the status signal inside the compact stage.
- Moved `Mission Schedule` above `Today's Missions` so the real care plan is the
  primary work surface.
- Tightened mission rows, icons, detail lines, and action chips so secondary
  mission context no longer crowds the first route.
- Preserved routine edit, routine completion logging, Reminder Center routing,
  household responsibility, and WoofGuide discovery behavior.
- Added mobile readiness coverage for schedule-first order, compact stage
  height, and compact mission rows.

Verification:

- `mobileReadiness.test.ts` passed 112/112.
- Mobile TypeScript passed with
  `node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`
  through the bundled Node runtime.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files after
  prepending bundled Node to `PATH`.
- Static preview route smoke returned `200` for `/calendar`, `/`, `/log`, and
  `/health` at `http://127.0.0.1:4196/`.

Remaining:

- The first export attempt failed because the smoke script could not resolve
  bare `node` on Windows PATH; the bundled-Node PATH rerun passed.
- Fresh in-app browser screenshot capture timed out during this pass. Earlier
  Plans proof at `tmp/route-plans-visualqa-20260701.png` was used to identify
  the oversized layout, but updated native/iOS/Android or repaired browser
  screenshot proof is still required before visual sign-off.

## 2026-07-01 Quick Log And Health Artwork Chrome Polish

The next visual pass targeted the remaining mismatch on `/log` and `/health`:
the app was functionally stronger, but the artwork framing still drifted from
the saved neo-retro pixel boards.

What changed:

- Quick Log now stretch-frames the approved pixel-room artwork so the command
  scene shows more of the room instead of cropping into a blank wall.
- The Quick Log live Phoenix sprite is larger, lower in the scene, and paired
  with a lighter shade layer plus a wider speech bubble.
- Health keeps `Health Snapshot` as the primary first-screen utility panel, but
  its support pixel room is more compact and less likely to collide with the
  floating paw nav.
- The Health support sprite, stage, speech bubble, and HUD were tightened so the
  route feels more like a useful health screen with a pixel heart, not a poster.
- Mobile readiness coverage was updated to lock the new Quick Log and Health
  artwork/chrome constraints.

Verification:

- `mobileReadiness.test.ts` passed 112/112.
- Mobile TypeScript passed with
  `node node_modules/typescript/bin/tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`
  through the bundled Node runtime.
- The combined mobile/care-domain focused suite passed 456/456.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files after
  prepending bundled Node to `PATH`.
- Static preview route smoke returned `200` for `/`, `/log`, and `/health` at
  `http://127.0.0.1:4197/`.

Remaining:

- Local Chrome screenshot commands exited `0` but produced no PNG files, so this
  slice still needs repaired screenshot capture or native iOS/Android visual
  proof.
- Exact pnpm 10.24 beta doctor proof, provider-backed sync/storage/AI/payments/
  push, generated PDF output, CI completion, store approval, public launch, and
  Apollo sign-off remain blocked until real artifacts exist.

## 2026-07-01 Branch CI Doctor Assertion Repair

After pushing the Quick Log and Health polish, branch run `28527740311` reached
the real focused test step and failed one brittle assertion in
`mobileReadiness.test.ts`.

What changed:

- The machine-readable mobile beta doctor test still requires a Corepack status
  check.
- It now expects `Corepack available for pnpm bootstrap` in `warnings` only when
  that check is not `PASS`.
- This preserves the intended truth boundary: local shells can remain blocked
  and warn about Corepack, while CI-ready environments do not have to emit a
  fake warning.

Verification:

- `mobileReadiness.test.ts` passed 112/112.
- The CI-equivalent focused suite passed 496/496 with the bundled Node runtime.

Remaining:

- Rerun `WoofWatcher Verify` on `automation/premium-revenue-product-builder`
  after pushing this assertion repair.

## 2026-07-01 API Server Typecheck CI Repair

The next branch run, `28528291630`, passed the focused test blocker and then
failed during `pnpm run build:ci` at the API server typecheck step:

- `src/lib/household-sharing-cleanup.ts(4,8): error TS5097`
- `src/lib/household-sharing-cleanup.ts(8,8): error TS5097`

What changed:

- Kept the `.ts` source imports in `household-sharing-cleanup.ts` so Node's
  `--experimental-strip-types` focused tests can resolve the TypeScript source.
- Added `allowImportingTsExtensions: true` to
  `artifacts/api-server/tsconfig.json`, matching the package's no-emit
  typecheck path.

Verification:

- Direct API typecheck passed with
  `node node_modules/typescript/bin/tsc -p artifacts/api-server/tsconfig.json --noEmit`.
- The CI-equivalent focused suite passed 496/496 with the bundled Node runtime.

Remaining:

- Direct local API build did not run in this Windows worktree because the local
  install is missing esbuild's optional native package `@esbuild/win32-x64`.
- Push this repair and rerun `WoofWatcher Verify` on
  `automation/premium-revenue-product-builder`.

CI follow-up:

- Branch run `28529223713` completed successfully on
  `automation/premium-revenue-product-builder` after the API typecheck repair.
- Earlier same-day current branch failures were `28527740311`
  (machine-readable beta doctor warning assertion) and `28528291630`
  (`TS5097` API server typecheck).

## 2026-07-01 Compact Bottom-Nav Chrome Recovery

Apollo's latest design review called out the remaining App Store polish problem:
the app was closer to the saved neo-retro pixel direction, but the floating paw
nav still felt oversized and was visually swallowing the lower half of important
mobile command cards.

What changed:

- Reduced the shared mobile tab-bar height and web bottom offset in
  `mobileLayout.ts`.
- Reduced the center paw FAB from the previous oversized chrome to a tighter
  app-store-style command button while preserving the WoofWatcher identity.
- Widened the horizontal inset slightly so the floating nav reads intentional
  instead of cramped.
- Lowered tabbed-route bottom padding because the chrome now needs less reserved
  space.
- Updated `_layout.tsx` so the visible FAB, icon, labels, tab padding, and
  shadow follow the shared compact metrics.
- Added regression coverage that keeps the floating paw chrome compact enough
  for first-screen command cards.

Verification:

- `mobileLayout.test.ts` passed 8/8 after the intended red/green update.
- `mobileReadiness.test.ts` passed 112/112.
- Mobile TypeScript passed with `tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`.
- Expo web export smoke passed to `.expo-smoke` with 218 assets / 222 files.
- Static preview route smoke returned `200` for `http://127.0.0.1:4194/` and
  `http://127.0.0.1:4197/`.
- The broad focused API/mobile/PWA/care-domain suite passed 497/497 with the
  bundled Node runtime.

Remaining:

- Fresh screenshot proof is still pending because the in-app browser screenshot
  control timed out during this pass.
- Next design proof should run route visual consistency on Home, Log, Plans,
  Health, Records, More, and Avatar Studio in actual iOS/Android frames.
- Keep provider-backed sync/storage/AI/payments/push, generated PDF output,
  store approval, public launch, and Apollo sign-off blocked until real
  artifacts exist.
