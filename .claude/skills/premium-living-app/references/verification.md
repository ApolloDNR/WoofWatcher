# Verification: render it, measure it, drive it

Typecheck and the suite are gates. Proof means observing the behavior.
Every recipe below was used to catch (or prove fixed) a real bug in this
repo. The harness is cheap - use it liberally.

## The harness

Serve the real export and drive it with the preinstalled Chromium:

```js
// serve artifacts/woofwatcher-mobile/.expo-smoke with a tiny http server
// (fall back unknown paths to index.html - it's a SPA), then:
import { chromium } from "playwright-core"; // resolve from the mobile package
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
```

Rebuild first (`pnpm --filter @workspace/woofwatcher-mobile run smoke:web`)
or you are testing stale code. Run with
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. Do NOT run `playwright install`.

## Recipes (and the traps they encode)

- **Seed honestly.** Create data through the app's own UI (Fast Log tiles
  log instantly on tap; `getByText("Meal")` works). Never inject synthetic
  state - "every number on screen is real" applies to test evidence too.
- **Scroll with the wheel, not scrollTo.** `element.scrollTo()` bypasses
  RN-web's scroll pipeline - handlers never fire and you'll "prove" a
  false negative. `page.mouse.wheel(0, 420)` is the real input path.
- **SPA-navigate to preserve monkeypatches.** `page.goto()` reloads and
  resets any `page.evaluate` sabotage (e.g., a throwing `setItem`).
  Navigate by tapping in-app controls instead.
- **Reduce Motion proof = dual-frame comparison.** Two screenshots ~2s
  apart: `reducedMotion: "reduce"` context → pixel-identical (frozen);
  `"no-preference"` → different (alive). This proved the loop gating.
- **Offline proof = kill the crutches.** Serve every response with
  `Cache-Control: no-store`, load once, `context.setOffline(true)`,
  reload: the app must boot purely from the service worker. Without
  no-store, the browser's heuristic HTTP cache fakes a pass.
- **Transforms: read the DOM, don't eyeball.** Walk up from a testID
  element and parse `getComputedStyle(node).transform` matrices to assert
  translateY/opacity at rest and at depth (proved the parallax: 0 at rest,
  37.8px at scroll 420).
- **Mid-flight frames prove animation exists.** Click, screenshot at
  ~90ms, screenshot settled. A settled-only screenshot can't distinguish
  "animated" from "teleported" (used for the segment pill).
- **Clock-shift for time-of-day scenes**: `addInitScript` a Date subclass
  with a fixed offset so rooms/trail render the phase you need (the store
  pack shoots at 10 AM).
- **Storage-failure drill**: boot clean → `evaluate` a throwing
  `localStorage.setItem` → log care via in-app taps → assert the amber
  storage warning is VISIBLE on Home (`isVisible()`, not `count()` - tab
  screens stay mounted and text "exists" invisibly).
- **Corrupt-cache drill**: `addInitScript` seeds garbage at
  `woofwatcher.v2.state` → boot → assert the reset notice AND that
  `woofwatcher.v2.state.recovery` holds the original bytes.
- **setContent pages need a viewport meta** or mobile Chromium lays them
  out at 980px (the title-card top-left bug).

## Test-suite specifics

- Full suite needs Node 24; on Node 22 exactly one test fails (the
  mobile-beta-doctor Node-24 assertion). Baseline is "that one and nothing
  else".
- `lib/mobileReadiness.test.ts` pins source anatomy with regexes. A
  legitimate refactor (e.g., adding a shared prop to `<BoardCard`) may
  break pins whose INTENT still holds - widen the regex
  (`(?: enter=\{\d+\})?`), never delete the assertion. Run the suite after
  UI-shape changes; typecheck alone does not catch pin breaks.
- The api-server route tests drive the real Express router with a fake DI
  db. The harness mounts `express.json()` (production does); POST tests
  fail with empty bodies without it.
- Diet/care-domain tests run per-file in separate processes; TZ-sensitive
  suites set `process.env.TZ` at the top. Day-boundary logic must compare
  LOCAL dates (`getFullYear/Month/Date`), never `toISOString` - and tests
  for it must pin a western TZ and an evening `now`.

## Verifying claims end-to-end

Before writing "verified" in a commit: what exact observation backs each
sentence? If the answer is "it typechecked", the work is not verified.
State what was observed ("at rest translateY 0; wheel 420 → 37.8 /
opacity 0.82; zero console errors") so the next reader can re-run it.
