---
name: premium-living-app
description: >-
  The operating discipline for building and polishing WoofWatcher - or any
  premium "living app" where a simulated world (a pixel care twin, a game
  scene) sits on top of real user data. Use this skill for ANY substantive
  work in this repo: building a new screen or feature, a design or polish
  pass, animation/motion work, fixing bugs in care logic or persistence,
  preparing release assets (screenshots, video, store pack), running quality
  audits, or when the owner asks to "make it premium", "add design appeal",
  "keep improving", or "get it ready". Also use it when judging whether work
  is DONE - it defines the verification bar. If you are about to change
  product code in this repo and have not read this skill, read it first.
---

# Premium Living-App Craft

The SOP that produced WoofWatcher's launch-grade state. Two ideas power all
of it: **honesty** (the world on screen is derived from real state, never
invented) and **proof** (a change is not done until its behavior has been
observed, not assumed). Everything else is procedure built on those two.

## 0. Before touching code

1. Read `docs/handoff/HANDOFF_<latest>.md` - it is the live state of the app
   and the open queue. Update it when your work changes scope or status.
2. Read `CLAUDE.md` (hard rules) and hold every change against
   `docs/design/APOLLO_MASTER_VISION_PROMPT.md`.
3. Know the baseline before you change it: `pnpm run typecheck` and
   `pnpm run test:focused` (Node 22 fails exactly one test - the Node-24
   doctor gate; any OTHER failure is yours to explain before proceeding).

## 1. The Honesty Law (product soul - never trade away)

- **Every number, meter, waypoint, and status is derived from real logged
  data.** If there is no log, there is no marker. A scene may be painted;
  the actors on it must be true. (Pattern: LivingPhoenixRoom and
  DayTrailScene - hand-painted stage, live data layer on top.)
- **Motion only presents real state.** No fake progress, invented counts,
  or delays that simulate work.
- **Empty states are honest and preview the shape of future content**
  (dashed placeholder tiles sized like the real grid), never stock imagery
  or fake-looking data.
- **No dead ends.** Every navigation target resolves; every button does
  what it says; gated features say so plainly ("Not in this build").
- **Health language never diagnoses.** Owner notes, patterns, vet handoffs
  - not medicine.
- **Failures are visible.** A failed save, sync, or wipe must surface to
  the owner. Silence that implies success is a lie (see
  `references/data-safety.md`).

## 2. The Craft Bar (what "premium" measurably means)

Read `references/design-system.md` before styling and
`references/motion.md` before animating. The bar, in one screen:

- Colors come from `constants/colors.ts` tokens only. Anything on a
  `primary`/`forest` surface uses `primaryForeground` (these flip in dark
  mode - hardcoded white fails WCAG AA at ~2.3:1 there). Pixel-art asset
  colors are the one legitimate hardcode.
- One motion vocabulary: `SPRING` / `MOTION_MS` / `PressScale` / `useBounce`
  / `enterUp` from `components/motion/GameFeel.tsx`. Do not invent new
  spring constants; extend GameFeel if a new voice is genuinely needed.
- **Every loop honors Reduce Motion** and settles to a meaningful static
  pose. Every layout-affecting animation runs on the UI thread (Reanimated
  shared values - never RN `Animated` with `useNativeDriver:false`).
- Haptic map: `hapticSelect` for tabs/rows/segments/toggles, `hapticLight`
  for action starts, `hapticSuccess` for saves/milestones. High-frequency
  surfaces (nav, list rows, headers) must not tap dead.
- Entrance coverage: content cards use `BoardCard enter={i}` staggering.
- Shared primitives first: `BoardCard`, `BoardActionButton`,
  `BoardSegmentTabs`, `CareRow`, `StatusMeter`. Upgrading a primitive
  upgrades the whole app; a bespoke one-off styles a single screen and rots.

## 3. The Loop (how every slice ships)

1. **Audit before building.** For any sizable effort, run the relevant
   audit from `references/audits.md` first (design, motion, correctness,
   or data-integrity). Fix confirmed findings before adding features.
2. **Smallest coherent slice.** One theme per commit; a commit message that
   states the defect/goal, the mechanism, and the evidence.
3. **Verify empirically - render, measure, or drive it.** Typecheck and
   tests are gates, not proof. The proof recipes (offline boot with HTTP
   cache disabled, dual-frame Reduce-Motion comparison, DOM transform
   readback for parallax, seeding real data through the app's own UI) live
   in `references/verification.md`. If a claim in your commit message has
   not been observed, do not write it.
4. **Gates before push:** workspace `typecheck` clean; `test:focused` at
   baseline (only the Node-24 gate failing); web export smoke passing;
   for UI work, a rendered screenshot you actually looked at critically.
5. **Push every slice**; update the handoff doc when the queue changes.
6. **Your own first cut is a draft.** Look at the render as a hostile
   design lead (clipping? contrast? alignment? does it read cheap next to
   the painted art?) and fix what you find before shipping. Programmer-art
   next to hand-painted pixel art always reads cheap - reuse the painted
   assets as stages instead of drawing rectangles.

## 4. Data safety (the one bug class that kills a local-first app)

Read `references/data-safety.md` before touching `CareContext`,
`AvatarContext`, persistence, sync, or the wipe flow. The laws in short:

- Never overwrite data you failed to read; back up before any reset.
- Never run side effects inside setState updaters.
- Every post-`await` write path checks the erase generation.
- Pristine default docs must never win reconciliation (epoch `updatedAt`).
- Creates carry a client idempotency key (`details.clientKey`).
- A failed local persist surfaces as `storageWarning` - never swallow it.

## 5. Release assets

`references/release-assets.md` documents the one-command store screenshot
pack, the tour-film pipeline, and the landing page. All of them film the
REAL app with data seeded through its own UI - marketing inherits the
honesty law.

## 6. Judgment calls this repo has already made (do not relitigate)

- Corner-radius consolidation (~750 literals) was assessed and skipped:
  invisible at render, high churn. Do not "clean it up".
- White-on-copper is a legitimate exception (copper stays saturated in
  both themes); white-on-primary is always a bug.
- The `.expo-smoke` export IS the deployed web app (see `.replit`). The
  web dashboard in `artifacts/woofwatcher` is not the product surface.
- Source-anatomy tests in `lib/mobileReadiness.test.ts` pin JSX shapes; a
  legitimate refactor may require widening their regexes - update the pin,
  never delete the test.

## Verify commands

```bash
pnpm run typecheck
pnpm run test:focused   # Node 24 for full pass; Node 22 fails only the doctor gate
pnpm --filter @workspace/woofwatcher-mobile run smoke:web
node docs/release/tools/store-pack.mjs   # store screenshot pack (after smoke:web)
```
