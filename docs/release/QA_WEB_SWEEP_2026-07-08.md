# WoofWatcher Mobile Web Export — Functional QA Sweep Findings

Date: 2026-07-08. Target: static Expo web export served at http://127.0.0.1:4194 (viewport 390x844, headless Chromium).
Method: automated Playwright sweep of 14 routes — element enumeration, ~25 representative clicks/route with before/after DOM-signature diffing, every DEAD verdict reproduced twice (CONFIRMED), plus targeted re-verification with richer signatures (innerHTML/scroll), a `navigator.share` spy, `filechooser` listeners, and history-aware back-button tests. Raw data: `scratchpad/qa-out/*.json`, logs `qa-out-A3.log`, `qa-out-B2.log`, `qa-verify*.log`.

**Build note:** the served export was rebuilt mid-sweep (03:26) from the actively-edited tree. All findings below were produced or re-confirmed against the CURRENT build (`entry-dfd66135e4c5147152eb0ff78118a8af.js`), a production-channel export where /premium and /care-twin-qa intentionally show boundary screens and More/Privacy hide internal owner-ops sections — those boundaries are NOT reported as defects. Findings that only existed in the pre-rebuild export were discarded.

## Global results

- **Console errors:** 0 across all 14 routes and ~200 interactions.
- **Page errors:** 1 — `/health`, clicking "Share health review": `Error: Share is not supported in this browser` (uncaught promise rejection, reproduced 2x).
- **Broken links / not-found / blank screens:** none. Every navigation landed on a real screen (including `/legal` and boundary screens). No "+not-found" ("This trail goes nowhere") hits.
- **Dialogs (window.alert/confirm):** none fired anywhere — because React Native Web's `Alert.alert` is a **no-op on web**. The app has ~58 `Alert.alert` and ~28 `Share.share` call sites and no web fallbacks; this single fact explains most confirmed dead buttons below.

## Root-cause classes

- **CLASS A — Share dead-ends:** `Share.share()` requires the Web Share API, absent in desktop-class browsers. The rejection handler is `Alert.alert(...)` (no-op on web) → total silence. Verified the handlers themselves are correct: with a `navigator.share` polyfill injected, every Share button produced a well-formed payload (export JSON, Care Pass text, Dog ID, health packet).
- **CLASS B — Alert-driven flows invisible:** any confirmation, info, or follow-up action inside `Alert.alert` buttons never renders on web (e.g. setup's "Open Today" action).
- **CLASS C — Calendar fallback rows not wired:** `/calendar` shows a demo schedule when no routines exist; its rows/toggles guard on `sourceRoutine` which is `undefined` for fallback rows → silent no-ops (source: `app/(tabs)/calendar.tsx` ~L272 fallback array; ~L833 row onPress; ~L854 "Mark … done"; ~L618 Next Mission card).
- **CLASS D — `router.back()` no-ops on deep load:** back/close buttons do nothing when the screen is the first history entry (direct URL/refresh). Verified they work when reached in-app.
- **CLASS E — benign active-chip re-taps:** clicking the already-active tab/segment does nothing (expected), but chips expose no `aria-selected`/pressed state, so state is invisible to assistive tech.

## Per-route findings

### `/` (Home / Phoenix Room)
- Console/page errors: none. 40 role=button, 4 tabs, 4 anchors, 47 aria-labeled.
- 20 clicks navigated correctly (Health Watch, Avatar Studio, mood/play details, Quick Log, Adventure, Care Pass, today logs, story). 4 changed in place (home "Log Meal/Walk/Potty/Water" tiles log + show in-place feedback — works).
- No confirmed dead buttons. No broken links. Healthiest route.

### `/log` (Quick Log)
- **Core loop WORKS:** tapping tile "Quick log Meal. Long press for details." incremented TODAY 13→14 and updated the console text ("Tap Meal. Hold for proof, notes, and corrections."). Timeline/text delta confirmed.
- Suspected-then-cleared: "Open full Quick Log composer" and "Add details to the selected log" only **scroll** to a section (SCROLL_ONLY) — functional but feedback is subtle; on a short viewport it can look dead.
- Benign: "Show Favorites quick log actions" is the active filter chip (CLASS E).
- Errors: none.

### `/calendar` (Plan) — worst route
- **CONFIRMED dead (13 labels, reproduced 2x + source-verified, CLASS C):** schedule rows "7:00 AM Breakfast", "8:00 AM Walk", "10:00 AM Training", "12:30 PM Alone Time", "5:30 PM Walk" and done-toggles "Mark Breakfast done", "Mark Walk done", "Mark Training done", "Mark Alone Time done", "Mark Dinner done", "Mark Bedtime Snack done", plus command card "Open Next Mission: Alone Time". Expected: open routine detail / toggle done. Actual: nothing (fallback demo rows have no backing routine; handlers silently bail).
- Benign: "Today" segment (active, CLASS E). "Tomorrow"/"Week" work. "Add Plan", quiet-hours save, "No routines yet…" row all respond.
- Errors: none.

### `/pack`
- Benign dead only: "Pets" (active segment) and "  Pack" (current tab) — CLASS E. "People", "Access", "Care Pass" segments switch content; 11 navigations OK.
- Errors: none.

### `/story`
- Benign dead only: "Adventures" (active segment), "  Story" (current tab) — CLASS E. "Memories"/"Badges" switch; Adventure links, walk records, quick-log links all navigate.
- Errors: none.

### `/health` (Health Watch / Bile Watch)
- **CONFIRMED + pageerror:** "Share health review" throws an **uncaught** `Error: Share is not supported in this browser` (CLASS A, and unlike privacy/records the call has no `.catch`). With share polyfill it produces a proper "WoofWatcher Health Review Packet" — handler is fine, web path is broken and noisy.
- Benign: "Open Health" (active tab chip, label template `Open ${tab.label}`), "Show Health 7-day rhythm" (active range toggle) — CLASS E.
- 15 navigations OK (records, bile tab, symptom/meal/water logs, woofguide health-review prompt).

### `/records` (Records & Care Pass)
- **CONFIRMED dead (CLASS A, silent):** "Share dog ID card", "Share local printable Dog ID source file", "Share local SVG Dog ID image source", "Share generated Dog ID PNG", "My Dog credential. …. Share", "Month progress. …. Share". All fire correct payloads with a share polyfill; on desktop-class web they do nothing, no message.
- Benign: "Filter medication history: All" (active filter, CLASS E).
- 14 in-place interactions (sheets, sections) and 4 navigations OK. Errors: none.

### `/more`
- **CONFIRMED dead:** "Care Pass. Share a summary for sitters or the vet" (CLASS A — `generateCarePass` ends in `Share.share`, `app/(tabs)/more.tsx` ~L933), "Share Access Pass draft summary" (CLASS A, ~L2962).
- **CONFIRMED, minor:** "Refresh household sync" (~L3127) — react-query refetch with no provider configured; no spinner/feedback change. "My Dog. Live care twin. My Dog is the active dog for logs, routines, records, and the room." — tapping the already-active dog gives only a pressed-style flicker; no feedback (arguably benign, but reads as a tappable row).
- 14 navigations OK (setup checklist, privacy, portrait, household section, records…). Errors: none.

### `/adventure`
- **CONFIRMED dead:** "Share Adventure summary" (CLASS A — payload verified via polyfill). "Back to More" dead **on deep load only** (CLASS D — verified working with in-app history: /→Adventure→Back returned to /).
- "Start quest: Calm Sniffari Walk" navigates to `/log?entry=temp_…` (works); "Run next Adventure quest" updates in place. Errors: none.

### `/portrait` (Avatar Studio)
- **Cleared (sweep false positives):** "Choose dog photo from gallery" and "Take dog photo" DO open a real browser file chooser (verified via Playwright `filechooser` event) — invisible to DOM diffing but functional.
- "Back": dead on deep load only (CLASS D; works with history). "Avatar Studio Scan" tab: no-op until a photo exists (gated, no disabled state shown — minor polish).
- "Save avatar", "Save Avatar Studio draft", template chips respond. Errors: none.

### `/setup` (Care Foundation)
- **Flow verified end-to-end:** filling all fields (name/breed/weight/food/portion/schedule/routine/caregiver) drives progress 0/4 → 4/4, "Save foundation" enables and **does persist** (Home switches from "Set up My Dog" card to configured state "Breakfast at 7:30 AM", Next Up shows the routine).
- **CONFIRMED dead-end feel (CLASS B):** after "Save foundation" the app **stays on /setup with zero confirmation** — the success alert ("Care foundation saved" with an "Open Today" button that navigates home) is `Alert.alert` = no-op on web (`app/setup.tsx` L114-121). User cannot tell it worked.
- Cleared: routine TYPE chips (" Meal"/" Walk"/" Medication"/" Care") and household mode cards do update selection — style-only change (missed by first-pass diffing). A11y gap: no `accessibilityState.selected`, so chips report no state (CLASS E note). "Create household" card is the default-selected mode → re-tap no-op.
- "Finish later" works (→ Home). Save button also lacks `accessibilityRole`/`accessibilityLabel` (`app/setup.tsx` ~L377).

### `/woofguide`
- Zero defects. 7 in-place interactions (prompt chips, sections) + 2 navigations all respond. Errors: none.

### `/privacy`
- **CONFIRMED dead (CLASS A, silent):** "Export WoofWatcher care data" — with polyfill it shares a well-formed JSON export ("WoofWatcher care export – My Dog"); on desktop web `Share.share` rejects and the fallback `Alert.alert("Export unavailable", …)` never renders (`app/privacy.tsx` ~L200). **Export does not respond at all on web** — this was the specific mission check, answered: broken/silent. Same for "Prepare account deletion request" (~L209).
- "Close Privacy and Safety": dead on deep load only (CLASS D; works via in-app history).
- Legal documents link navigates to `/legal` (renders fine). Errors: none.

### `/premium`
- Current production-channel build shows an intentional boundary screen ("WoofWatcher Plus preview unavailable") with one button, "Back to Today", which navigates correctly. No defects.

## Routes visited during sweep (all rendered real screens)
`/`, `/log` (+`?type=…&detail=1` variants, `?entry=temp_…`), `/calendar`, `/pack`, `/story`, `/health` (`?tab=health`, `?tab=bile`), `/records`, `/more` (`?section=diet`, `?section=household`), `/adventure`, `/portrait`, `/setup`, `/woofguide` (`?prompt=health-review`), `/privacy`, `/premium`, `/legal`, `/care-twin-qa?qaSurface=…` (boundary screen on this channel). No blank or not-found landings.

---

# TOP ISSUES (ranked, most launch-blocking first)

1. **CONFIRMED — Web export has no working share/export path; every "Share/Export" button is a silent dead button (CLASS A).** 12+ buttons across /privacy (care-data export, deletion request), /records (4 Dog ID buttons + credential + month report), /more (Care Pass, Access Pass), /adventure, /health. Handlers are correct (payloads verified via `navigator.share` polyfill), but on browsers without Web Share API the failure fallback is `Alert.alert` — a no-op in react-native-web. Fix direction: web fallback (download blob / clipboard copy / in-DOM toast) or hide-with-explanation on web. Privacy-export in particular is a guardrail surface ("Export care data" must respond).
2. **CONFIRMED — Setup completes silently and appears to dead-end (CLASS B).** `/setup` "Save foundation" persists the care doc but the confirmation alert and its "Open Today" navigation never render on web (`app/setup.tsx` L114-121). User is left on /setup with no signal. One-line repro: complete 4/4, tap Save foundation → nothing visible. (Same `Alert.alert` no-op affects ~58 call sites app-wide, including confirm dialogs not exercised here because destructive buttons were skipped.)
3. **CONFIRMED — /calendar fallback schedule is a wall of dead buttons on fresh installs (CLASS C).** 13 interactive elements (5 schedule rows, 6 "Mark … done" toggles, "Open Next Mission" card) silently no-op because demo rows have no backing routine (`app/(tabs)/calendar.tsx` ~L272/~L833/~L854/~L618). Violates the "no dead buttons" hard rule on a primary tab. Fix direction: route fallback-row taps into routine creation, or mark rows as sample content and disable affordances.
4. **CONFIRMED — /health "Share health review" throws an uncaught runtime error on web** (`Error: Share is not supported in this browser`) — the only page error in the entire sweep; the `Share.share` call lacks the `.catch` other screens have. Subset of #1 but also a crash-log noise source.
5. **CONFIRMED — back/close buttons no-op on deep load / refresh (CLASS D):** /adventure "Back to More", /portrait "Back", /privacy "Close Privacy and Safety". Verified working with in-app history; dead when the screen is the first history entry (any bookmarked/refreshed URL — common on web/PWA). Fix direction: `router.canGoBack() ? back() : replace("/…")`.
6. **SUSPECTED (minor) — silent no-op utility buttons on /more:** "Refresh household sync" (no feedback in local-only mode) and "My Dog. Live care twin…" row (tap on active dog does nothing visible). Both reproduced twice, but plausibly intended; need product ruling + feedback state.
7. **SUSPECTED (polish/a11y) — selection chips expose no selected state and re-taps give no feedback (CLASS E):** /setup routine-type chips + household-mode cards (style-only change, no `accessibilityState.selected`; Save button also missing `accessibilityRole`/`accessibilityLabel`), plus active-segment chips everywhere (Pets/Adventures/Today/Favorites/All-filter/Health tab). Not functional defects, but they read as dead to assistive tech and to DOM-based tests.

**Explicitly cleared (not defects):** /portrait photo buttons (open real file chooser), /log "composer"/"details" buttons (scroll-to-section), /premium & /care-twin-qa boundary screens (intentional on this channel), quick-log core loop (works), setup persistence (works), all navigation links (no broken links, no not-found, no blanks), console hygiene (zero console errors).
