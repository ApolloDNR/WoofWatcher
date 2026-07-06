final result: passed with native QA remaining

# Design QA - Avatar Studio Pixel Runtime Pass

Date: 2026-06-18

## Scope

- Target screen: WoofWatcher mobile `/portrait` Avatar Studio.
- Visual source: Apollo's Option B neo-retro digital pet reference boards.
- Implemented slice: PixelLab subscription seed strips, crisp pixel rendering, one-dog live Studio presentation, and Expo web export recovery.

## Evidence Completed

- PixelLab subscription path is active and produced local production seed strips for the `f0c6169b-88c0-4428-9089-31c0565c4129` Shepherd candidate.
- New seed strips were stitched, registered in asset verification, and saved as:
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/pixellab-idle-south-strip.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/pixellab-walk-south-strip.png`
- `pixelImageStyle` now keeps web-rendered PixelLab room, avatar, and sprite assets crisp instead of browser-smoothed.
- Avatar Studio now renders the live `LivingPhoenixRoom` with `presentation="studio"`, so the hero has one animated care twin and no Home HUD overlap.
- Expo web export now succeeds in this worktree through the package-local Expo CLI and Metro resolver fix.
- Chrome visual smoke captured `/portrait` and Home from the exported web build. The `/portrait` result showed a clean mobile Avatar Studio hero with the live pixel room, one dog, the top pixel ID card, and no overlay clipping.

## Checks Run

- PixelLab asset verification: passed, `ok=61 missing=0 invalid=0`.
- Mobile TypeScript: passed.
- Focused behavior/readiness suite: passed, 237 tests.
- Expo web export: passed.
- Headless Chrome visual smoke: passed for `/portrait` and Home export preview.

## Remaining QA

- Native iOS and Android simulator/device QA is still required for safe areas, frame timing, touch targets, and real device pixel crispness.
- Final illustrated night, bedtime, health-watch, and home-alone room variants still need replacement/approval.
- Non-Phoenix template emotes, body-class sprite strips, and overlay-aligned accessory layers remain production art tasks.

# Design QA - Premium Typography And Chrome Repair Pass

Date: 2026-07-06

## Scope

- Target: WoofWatcher mobile app-wide typography, stack-header chrome, Home header truth, Phoenix room speech bubble, WoofGuide/Plus console chips, Privacy export grid, auth gateway preview behavior, and the not-found route.
- Visual source: locked premium neo-retro pixel palette and existing board system.

## Findings Fixed

- `Inter_800ExtraBold` was referenced by 216 text elements and `PressStart2P_400Regular` by the WoofGuide/Plus consoles, but neither font was loaded, so console HUD values, chips, and primary action buttons rendered in the platform fallback serif across Log, Plans, Records, More, WoofGuide, and Plus. Inter ExtraBold is now loaded and the two console constants use the board-system `Fredoka_600SemiBold`.
- Stack headers for Setup, WoofGuide, WoofWatcher Plus, Privacy & Safety, Adventure Mode, and Care Twin QA used stale green-on-`#F7F5F1` chrome. They now use palette background, Fredoka titles, copper tint, and follow native dark mode.
- The Home header bell badge was hardcoded to `3`. It now derives from live Health/Bile watch signals, hides when calm, and carries the signal count in an accessibility hint.
- The Phoenix room speech bubble reserved a fixed-size box and rendered mostly empty for short lines; it now hugs its content.
- The WoofGuide "Owner review" console chip could be pushed past the card edge once real (wider) fonts loaded; console bubbles/chips can now shrink. The Plus checkout chip got the same guard.
- The Privacy & Safety export summary tiles wrapped to a single column at 390pt width; they now flex into a true two-up grid.
- `/sign-in` and `/sign-up` crashed to the error boundary in preview builds because Clerk hooks mounted without a configured provider. They now render a truthful local-preview gateway with a working continue action, and the Clerk forms mount only when Clerk is configured.
- The not-found route was the stock Expo template; it is now branded with a safe exit back to Home.

## Checks Run

- Focused behavior/readiness suite: passed, 594 tests, 0 failures (Node 24).
- Mobile TypeScript: passed.
- Expo web export smoke: passed.
- Headless Chromium screenshot QA at 390x844 across Home, Quick Log, Plans, Health, Records, More, WoofGuide, Plus, Setup, Privacy, sign-in, and not-found in the exported web build.

## Remaining QA

- Native iOS and Android simulator/device screenshot proof is still required for store-grade sign-off; this pass covers the exported web preview only.
- Dark mode remains native-only by design in `useColors`; native dark-mode screenshots are still pending.

# Design QA - Care Career Game Layer Pass

Date: 2026-07-06

## Scope

- Target: evidence-based Tamagotchi/RPG progression toward Apollo's care + adventure vision board.
- New shared logic: `artifacts/woofwatcher-mobile/lib/careCareer.ts` derives lifetime care XP, level, care-journey title (New Paw through Legendary Companion), per-level progress, and today's XP from real care logs only. No coins, no purchasable progress, future-dated and unparseable logs never mint XP.
- Home now shows a care level strip (level badge, title, pixel-segment XP bar, today's XP) between the presence panel and Care Status, announces the values to screen readers, appends "+N care XP" to quick-log toasts, and fires a celebrate-hop room reaction with success haptics when a real log crosses a level threshold.

## Checks Run

- careCareer unit + wiring tests: passed, 9 tests.
- Focused behavior/readiness suite: passed, 602 tests, 0 failures (Node 24).
- Mobile TypeScript: passed.
- Expo web export smoke: passed.
- Headless Chromium screenshot QA of Home at 390x844.

## Remaining QA

- Level thresholds and title ladder are a first tuning pass; Apollo may want different pacing before launch.
- Native haptics/celebration timing needs on-device QA.
- Adventure map, career stats board, and shareable Care Pass QR from the vision board remain future slices.
