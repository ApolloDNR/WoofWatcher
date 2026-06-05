---
name: WoofWatcher web app structure
description: Where the real code lives in the vanilla-JS web artifact, and routing quirks.
---

# WoofWatcher web (artifacts/woofwatcher)

- Vanilla JS app. **Real render entry is `src/vanilla/app-entry.js`** (exports
  `initApp`, imported by `App.tsx`). `src/vanilla/app.js` has no exports and is
  DEAD CODE — do not edit it.
- Data/summary getters live in `src/vanilla/woof-core.js` (e.g. the monthly
  `summary` object and `getDayCounts`). When adding a new metric tile, add the
  count to BOTH summary builders there before referencing it in render funcs.
- Tab routing: `PRIMARY_TABS` = phoenix/log/plans/health/more shown in nav;
  sub-views (calendar, report, reminders, diet, assistant) map to a parent tab
  via `TAB_PARENT` and are reached by in-app buttons, not nav. They still need
  CSS — easy to miss when restyling since they aren't in the bottom nav.
- Dashboard hero uses AI-generated painted dog art (one PNG per mood), NOT the
  earlier inline-SVG cartoon dog (that approach was rejected on aesthetics).
  **Why:** illustrated/painterly look was the explicit design direction.
  **How to apply:** web and mobile share the same 5 mood paintings — keep them in
  sync. Import images as ES modules (Vite handles base-path URLs); selecting art
  by mood lives near `renderDogScene`. Leftover `dog-*`/`scene-*` SVG CSS is dead.
