# Primary Tab Motion Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every primary Home / Log / Plans / Health / More tab present its content immediately, while retaining small, reduced-motion-aware control feedback.

**Architecture:** Remove the route-wide React Native `Animated.Value` fade/translate mount wrappers from Log, Plans, and More. Keep the tab shell, local `PressScale`, shared board-card details, modal transitions, and Log's below-fold deferral unchanged. Keep BoardSegmentTabs deterministic: the active chip owns its primary fill and border instead of relying on a measured animated overlay. Encode the boundary in source-backed tests while leaving secondary Records and Premium preview guards alone.

**2026-09-07 visual-QA update:** Remove primary-route card staging as well: Home must not wrap Quick Log or Care Sense in `enterUp` or delay Next Up through `BoardCard`'s `enter` prop; Plans and Health must not pass `enter` to their primary `BoardCard`s. Keep interactive/state motion, and make the shared `enterUp` builder respect `ReduceMotion.System` for any remaining non-primary use.

**Tech Stack:** Expo Router, React Native, TypeScript, Node test runner, React Native Reanimated.

**Spec:** `docs/superpowers/specs/2026-06-14-woofwatcher-pixel-ui-lock-design.md`

## Global Constraints

- Mobile primary tabs remain exactly Home, Log, Plans, Health, More.
- Motion should feel like care feedback, not decoration.
- Preserve real routes, persistence, safety copy, local-first behavior, and the approved cream/navy/pixel visual system.
- Do not change secondary Records or Premium preview behavior in this slice.
- Preserve the untracked `output/` directory untouched.

---

### Task 1: Present primary tab content immediately

**Files:**
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/log.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/calendar.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/more.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/health.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/motion/GameFeel.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/board/BoardPrimitives.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/boardPrimitiveTouchTargets.test.ts`
- Modify: `docs/AUTONOMOUS_BUILD_QUEUE.md`
- Modify: `docs/DECISION_LOG.md`
- Modify: `docs/PRODUCT_QUALITY_GATES.md`
- Modify: `docs/QA_TEST_PLAN.md`
- Modify: `docs/operations/PREMIUM_REVENUE_PRODUCT_BUILDER.md`
- Modify if needed for a dedicated native boundary: `docs/BLOCKERS_FOR_APOLLO.md`

**Interfaces:**
- Consumes: existing Expo route components and the source-backed `readAppFile(...)` readiness helper.
- Produces: immediate primary-tab route content with no route-wide fade/translate wrapper; secondary preview guards remain intact.

- [ ] **Step 1: Replace the stale route-entry test with an immediate-primary-tab contract**

In `mobileReadiness.test.ts`, replace `keeps web route previews visible before native entry animation starts` with:

```ts
test("presents primary tab routes immediately while preserving secondary preview guards", () => {
  const primaryRoutes = {
    home: readAppFile(join("(tabs)", "index.tsx")),
    log: readAppFile(join("(tabs)", "log.tsx")),
    plans: readAppFile(join("(tabs)", "calendar.tsx")),
    health: readAppFile(join("(tabs)", "health.tsx")),
    more: readAppFile(join("(tabs)", "more.tsx")),
  };

  for (const [route, source] of Object.entries(primaryRoutes)) {
    assert.doesNotMatch(source, /const isWebRoutePreview = \(Platform\.OS as string\) === "web"/, route + " should not gate route-wide motion");
    assert.doesNotMatch(source, /new Animated\.Value\(isWebRoutePreview \? 1 : 0\)/, route + " should not fade the whole route");
    assert.doesNotMatch(source, /<Animated\.View style=\{\{ opacity: fade, transform: \[\{ translateY: slide \}\] \}\}>/, route + " should render immediately");
    assert.match(source, /backgroundColor: colors\.background/);
  }

  const secondaryRoutes = {
    records: readAppFile(join("(tabs)", "records.tsx")),
    premium: readAppFile("premium.tsx"),
  };
  for (const [route, source] of Object.entries(secondaryRoutes)) {
    assert.match(source, /const isWebRoutePreview = \(Platform\.OS as string\) === "web"/, route + " should keep its preview guard");
    assert.match(source, /new Animated\.Value\(isWebRoutePreview \? 1 : 0\)/, route + " should remain visible in web preview");
    assert.match(source, /new Animated\.Value\(isWebRoutePreview \? 0 : (?:16|18)\)/, route + " should keep its preview offset at rest");
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test --test-name-pattern="presents primary tab routes immediately" artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts
```

Expected: FAIL for Log, Plans, or More because each still defines the route-wide mount animation.

- [ ] **Step 3: Remove only the redundant route-wide animation**

In Log, Plans, and More:

- Remove the `Animated` import from `react-native`.
- Remove `isWebRoutePreview`, `fade`, `slide`, and the mount animation effect.
- Replace the outer route-wide `Animated.View` with a fragment.
- Keep all modal `animationType` values, shared component motion, tab feedback, and Log's `belowFoldReady` behavior unchanged.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\tabLayoutPresentation.test.ts artifacts\woofwatcher-mobile\lib\mobileReadiness.test.ts
```

Expected: all selected tests PASS with no failures.

- [ ] **Step 5: Update truthful proof documentation**

Add a dated entry explaining that primary tabs now present immediately and that motion remains on local feedback. Record the red/green test evidence and keep real-iPhone animation cadence, VoiceOver, thermal, and route-transition proof open until native capture exists.

- [ ] **Step 6: Run full verification**

Run the complete mobile library matrix, TypeScript, exact-source production Expo export, runtime smoke, live-preview proof, PixelLab validation, and `git diff --check`. Rebuild the production consumer preview and re-capture Home / Log / Plans / Health / More.

- [ ] **Step 7: Review and commit**

Run task-spec review, then code-quality review. Stage every listed implementation file (`log.tsx`, `calendar.tsx`, `more.tsx`, `index.tsx`, `health.tsx`, `GameFeel.tsx`, and `BoardPrimitives.tsx`) with the listed readiness tests (`mobileReadiness.test.ts` and `boardPrimitiveTouchTargets.test.ts`), plan, and proof-doc files only; never stage `output/`. Commit as `Present primary tabs without route fade`, push `automation/premium-revenue-product-builder`, trigger dependency-complete `WoofWatcher Verify`, and record exact-tip CI without overstating native evidence.

### 2026-09-07 Visual-QA follow-up: primary-card staging

- [x] Extend the readiness contract to reject `enterUp` and `BoardCard enter` staging on primary Home / Plans / Health content, retain secondary preview guards, and require `enterUp` to chain `.reduceMotion(ReduceMotion.System)`.
- [x] Observe the focused red failure on Home's prior `enterUp` wrapper.
- [x] Remove only the three Home entrance sites, Plans' six `BoardCard enter` props, Health's four `BoardCard enter` props, and add the shared system Reduce Motion builder setting.
- [x] The earlier `mobileReadiness` plus `tabLayoutPresentation` subset passed `204/204`; final combined `boardPrimitiveTouchTargets` + `mobileReadiness` + `tabLayoutPresentation` verification passes `206/206` with `git diff --check` before handoff.
- [ ] Native iPhone cadence, VoiceOver, thermal/performance, and route-capture evidence remain outside source proof.

### 2026-09-07 Visual-QA follow-up: deterministic active segments

- [x] Add source-backed regression coverage for an active segment that must not become transparent after layout and must paint its own primary fill and border.
- [x] Observe the focused red failure on the prior `measured ? "transparent"` branch.
- [x] Remove only BoardSegmentTabs' measured layout, shared-value, and animated overlay machinery; retain 48pt targets, 36pt visuals, selected state, haptics, press state, and other BoardPrimitive animation.
- [x] Run boardPrimitiveTouchTargets, mobileReadiness, and tabLayoutPresentation plus `git diff --check` before handoff.
- [x] Fresh root evidence: full behavior matrix `1233/1233`; runtime smoke `13/13` routes; live-preview handoff `19/19` routes PASS; PixelLab `150 ok / 0 missing / 0 invalid`; current consumer export `266` files / `1944` modules / bundle `aabe057a9ffd`.
- [ ] Local mobile typecheck remains a partial-Windows-checkout boundary: only four `expo-file-system` imports cannot resolve `expo-modules-core`; exact-tip dependency-complete CI remains required.
