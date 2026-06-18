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
