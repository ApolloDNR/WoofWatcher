# WoofWatcher Universal Shell and Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the confusing `Log / Plan / Today / Pack / Story` shell with one predictable, accessible `Home / Log / Plans / Health / More` navigation system while preserving every real workflow and legacy deep link.

**Architecture:** Keep Expo SDK 54 and Expo Router 6. Make the five primary tab routes canonical: `/`, `/log`, `/calendar`, `/health`, and `/more`. Represent Health- and More-owned destinations through validated `section` parameters on their canonical parent roots so the correct tab remains selected without route-group collisions. Existing `/records`, `/pack`, `/story`, `/profile`, `/portrait`, `/adventure`, `/woofguide`, `/privacy`, and `/legal` files become replace-only compatibility redirects after their screen content is extracted into canonical components. One pure ownership module validates every redirect/query and is consumed by routes, help copy, and QA manifests.

**Tech Stack:** TypeScript 5.9, Expo SDK 54, Expo Router 6, React Native 0.81, Reanimated 4, Node 24 built-in test runner, pnpm 10.24.0.

## Global constraints

- Do not migrate Expo, Expo Router, or React Native in this slice.
- The only visible primary tabs are Home, Log, Plans, Health, and More, in that order.
- Home is a normal single-purpose tab. The floating center paw and conditional Home/Fast Log behavior are removed.
- Core tasks use visible labels. No required action depends on a long press or unlabeled icon.
- Legacy URLs remain valid and replace to canonical owners without stacking duplicate roots.
- Re-tapping a selected tab only returns/scrolls that tab root; it never performs a second product action.
- Pack supplies/travel data and Story/progress data remain intact; only their ownership and presentation change.
- Health owns Diet, Records, Dog ID, Care Pass, and professional reports. More owns Dog Profile, Care Team, Supplies & Travel, Story & Progress, Adventure, settings, privacy, and legal.
- Historical handoff/progress documents remain historical. Update only active instructions and executable QA manifests.
- Every production change begins with a failing behavioral test and ends with an Expo export/runtime proof.

---

### Task 1: Canonical Navigation Ownership Contract

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/navigationOwnership.ts`
- Create: `artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts`

**Interfaces:**

```ts
export type PrimaryTab = "home" | "log" | "plans" | "health" | "more";

export type HealthSection =
  | "overview"
  | "health-watch"
  | "bile-watch"
  | "medications"
  | "diet"
  | "trends"
  | "records"
  | "dog-id"
  | "care-pass";

export type MoreSection =
  | "root"
  | "dog-profile"
  | "avatar-studio"
  | "care-team"
  | "care-team-supplies"
  | "story-progress"
  | "adventure"
  | "woofguide"
  | "settings"
  | "privacy"
  | "legal";

export interface CanonicalDestination {
  parent: PrimaryTab;
  pathname: "/" | "/log" | "/calendar" | "/health" | "/more" | "/fastlog";
  params?: Readonly<Record<string, string>>;
  replace: boolean;
}

export function resolveCanonicalDestination(input: {
  pathname: string;
  params?: Readonly<Record<string, string | string[] | undefined>>;
}): CanonicalDestination;
```

Supported incoming mappings:

| Incoming | Canonical result |
| --- | --- |
| `/` | Home |
| `/log` | Log |
| `/fastlog` | Log-owned explicit flow |
| `/calendar` | Plans |
| `/reminders` | Plans; preserve only a validated `item` identifier |
| `/health?tab=health|bile` | Health overview or Bile Watch |
| `/records` | Health `section=records`; preserve validated `entry`/`report` identifiers |
| `/pack` | More `section=care-team-supplies`; preserve validated `item` identifier |
| `/story` | More `section=story-progress`; preserve validated `entry`/`walk` identifier |
| `/profile` | More `section=dog-profile` |
| `/portrait` | More `section=avatar-studio` |
| `/adventure` | More `section=adventure` |
| `/woofguide` | More `section=woofguide`; preserve one scalar prompt only when it is at most 280 printable characters |
| `/privacy` | More `section=privacy` |
| `/legal` | More `section=legal`; preserve only `doc=privacy|terms` |
| `/more?section=diet` | Health `section=diet` |
| `/more?section=care-pass|carepass` | Health `section=care-pass` |
| `/more?section=household|access` | More `section=care-team` |
| `/more?section=career` | More `section=story-progress` |
| unknown More/Health section | calm parent root fallback |

Identifiers are accepted only when they match `/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/`; unknown query keys are dropped.

- [ ] **Step 1: Write the redirect table as failing tests**

Cover every mapping above, selected parent, `replace`, recognized identifier preservation, array query normalization, malicious/oversized identifier rejection, unknown section fallback, and the fact that `/fastlog` remains explicit Log ownership rather than Home.

Run:

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts
```

Expected: FAIL because `navigationOwnership.ts` does not exist.

- [ ] **Step 2: Implement the pure normalizer**

Use closed `Set`/record maps for recognized paths and sections. Never reflect an unknown path or query value into a destination.

- [ ] **Step 3: Verify and commit**

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts
git add artifacts/woofwatcher-mobile/lib/navigationOwnership.ts artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts
git commit -m "feat: define universal navigation ownership"
```

Expected: PASS.

---

### Task 2: Five Labeled Tabs and Single-Purpose Home

**Files:**
- Create: `artifacts/woofwatcher-mobile/components/navigation/UniversalTabButton.tsx`
- Create: `artifacts/woofwatcher-mobile/lib/universalTabBar.ts`
- Create: `artifacts/woofwatcher-mobile/lib/universalTabBar.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/_layout.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**

```ts
export const UNIVERSAL_PRIMARY_TABS = [
  { name: "index", label: "Home", parent: "home" },
  { name: "log", label: "Log", parent: "log" },
  { name: "calendar", label: "Plans", parent: "plans" },
  { name: "health", label: "Health", parent: "health" },
  { name: "more", label: "More", parent: "more" },
] as const;
```

`UniversalTabButton` receives the Expo tab-bar button props, presents a minimum 48×48 target, exposes the visible label and selected state to accessibility, gives immediate visual/haptic acknowledgment on press-in, and delegates navigation to Expo on press. It must not push another route itself.

- [ ] **Step 1: Make the old shell fail the new contract**

Add tests asserting exact tab order/labels, regular Home tab button, hidden compatibility routes, no `CenterToday`, no empty Home tab button, and no conditional `/fastlog` action in the layout.

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/universalTabBar.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
```

Expected: FAIL against the current Log/Plan/Today/Pack/Story layout.

- [ ] **Step 2: Implement the exact five-tab declaration**

Register `index`, `log`, `calendar`, `health`, and `more` visibly in that order. Label `calendar` as Plans. Register `pack`, `story`, and `records` with `href: null` only for compatibility until Task 5 converts them to redirects. Keep `initialRouteName: "index"` and a meaningful back behavior.

- [ ] **Step 3: Remove the floating paw and duplicate-root pushes**

Delete `CenterToday`, its route-dependent action, and its decorative/empty normal tab slot. Use Expo’s tab navigation event for re-tap behavior; do not call `router.push("/")` from a custom button.

- [ ] **Step 4: Verify touch and accessibility source contracts**

Assert every tab has a visible text label, accessibility role/state, 48×48 minimum target, selected shape plus color, and press-in feedback. Icon-only rendering is not accepted.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/universalTabBar.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run typecheck
git add artifacts/woofwatcher-mobile/app/'(tabs)'/_layout.tsx artifacts/woofwatcher-mobile/components/navigation artifacts/woofwatcher-mobile/lib/universalTabBar.ts artifacts/woofwatcher-mobile/lib/universalTabBar.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
git commit -m "feat: install the universal five-tab shell"
```

Expected: tests and mobile typecheck PASS.

---

### Task 3: Health Owns Records, Reports, Diet, and Care Pass

**Files:**
- Create: `artifacts/woofwatcher-mobile/components/health/RecordsScreen.tsx`
- Create: `artifacts/woofwatcher-mobile/components/health/HealthSectionRouter.tsx`
- Create: `artifacts/woofwatcher-mobile/lib/healthSectionRouting.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/health.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/records.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/more.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/trends.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/healthReviewPacket.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/healthReviewPacket.test.ts`

`HealthSectionRouter` accepts a validated `HealthSection` and renders Overview/Health Watch/Bile Watch/Medications/Diet/Trends/Records/Dog ID/Care Pass while the `/health` tab remains selected. It uses `resolveCanonicalDestination`; it does not parse arbitrary query values itself.

- [ ] **Step 1: Write failing ownership and selected-parent tests**

Prove `/records`, More diet, and More Care Pass resolve to `/health` sections; Health accepts its supported legacy `tab=health|bile` values; unknown values render Health overview; Records/Dog ID/Care Pass share one implementation; and direct child entry retains Health parent selection.

- [ ] **Step 2: Extract the existing Records implementation without deleting behavior**

Move the substantive `records.tsx` screen into `components/health/RecordsScreen.tsx`, preserving its state, report, attachment, Dog ID, and Care Pass flows. The route file becomes a thin redirect only after the canonical Health renderer imports the extracted screen.

- [ ] **Step 3: Add validated Health sections**

Read `section` through `useLocalSearchParams`, normalize it with the ownership helper, and render the canonical Health surface. Move/compose Diet and report entry points here. Existing Health/Bile `tab` deep links stay compatible.

- [ ] **Step 4: Remove duplicate report generation from More**

More may show one “Share Care Pass” shortcut, but it navigates to `/health?section=care-pass`. It does not build, save, or share a second report.

- [ ] **Step 5: Convert `/records` into a replace-only compatibility route**

Use Expo Router `Redirect`/`router.replace` with the normalized parameters. Direct `/records` must finish on `/health?section=records` with Health selected and Back behavior free of a redirect loop.

- [ ] **Step 6: Verify and commit**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts \
  artifacts/woofwatcher-mobile/lib/healthSectionRouting.test.ts \
  artifacts/woofwatcher-mobile/lib/healthReviewPacket.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run typecheck
git add artifacts/woofwatcher-mobile
git commit -m "refactor: make Health the records and reports owner"
```

Expected: PASS.

---

### Task 4: More Owns Care Team, Supplies, and Story & Progress

**Files:**
- Create: `artifacts/woofwatcher-mobile/components/more/DogProfileScreen.tsx`
- Create: `artifacts/woofwatcher-mobile/components/more/AvatarStudioScreen.tsx`
- Create: `artifacts/woofwatcher-mobile/components/more/CareTeamSuppliesScreen.tsx`
- Create: `artifacts/woofwatcher-mobile/components/more/StoryProgressScreen.tsx`
- Create: `artifacts/woofwatcher-mobile/components/more/AdventureScreen.tsx`
- Create: `artifacts/woofwatcher-mobile/components/more/WoofGuideScreen.tsx`
- Create: `artifacts/woofwatcher-mobile/components/more/SettingsScreen.tsx`
- Create: `artifacts/woofwatcher-mobile/components/more/PrivacyDataScreen.tsx`
- Create: `artifacts/woofwatcher-mobile/components/more/LegalScreen.tsx`
- Create: `artifacts/woofwatcher-mobile/components/more/MoreSectionRouter.tsx`
- Create: `artifacts/woofwatcher-mobile/lib/moreSectionRouting.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/more.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/pack.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/story.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/profile.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/portrait.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/adventure.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/woofguide.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/privacy.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/legal.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/packSupplies.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/packSupplies.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/travelBag.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/travelBag.test.ts`

- [ ] **Step 1: Write failing More ownership tests**

Prove Pack maps to Care Team & Supplies, Story/Career maps to Story & Progress, Profile maps to Dog Profile, Portrait maps to Avatar Studio, Adventure/WoofGuide/Privacy/Legal map to their exact More sections, household/access maps to Care Team, unknown sections fall back to More root, and More never owns Diet or Care Pass generation. Assert every canonical child keeps More visibly selected and Back returns to the previous meaningful More screen/root.

- [ ] **Step 2: Extract Pack behavior into the canonical More component**

Move/compose the real care-team, supplies, and travel UI into `CareTeamSuppliesScreen`. Preserve `PACK_SUPPLIES_KEY`, travel state, migration semantics, and existing data. Do not rename or clear persisted keys.

- [ ] **Step 3: Extract Story behavior into Story & Progress**

Move/compose Day Trail, memories, walk story, badges, and Adventure entry into `StoryProgressScreen`. Keep reward/progress content secondary to care tasks and use the plain label “Story & Progress.”

- [ ] **Step 4: Extract every other More-owned child and add validated routing**

Move the functional Dog Profile, Avatar Studio, Adventure, WoofGuide, Settings, Privacy & Data, and Legal UI into the exact bounded components above. More root groups are Dog, People & Home, Experiences, and App & Privacy. Every labeled row opens a `MoreSection`; no row exposes a standalone route string. `MoreSectionRouter` consumes only normalized sections and is the sole canonical owner. Preserve WoofGuide's validated prompt and Legal's `privacy|terms` document selection.

- [ ] **Step 5: Convert every old standalone entry point to a replace-only compatibility redirect**

Convert `/pack`, `/story`, `/profile`, `/portrait`, `/adventure`, `/woofguide`, `/privacy`, and `/legal`. Preserve only the supported identifiers/prompt/legal enum through `resolveCanonicalDestination`. Verify no redirect loop, direct-link Back fallback, and that More stays selected.

- [ ] **Step 6: Verify and commit**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts \
  artifacts/woofwatcher-mobile/lib/moreSectionRouting.test.ts \
  artifacts/woofwatcher-mobile/lib/packSupplies.test.ts \
  artifacts/woofwatcher-mobile/lib/travelBag.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run typecheck
git add artifacts/woofwatcher-mobile
git commit -m "refactor: move Pack and Story under More"
```

Expected: PASS.

---

### Task 5: Migrate Callers, Reminders, and Legacy Deep Links

**Files:**
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/log.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/calendar.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/fastlog.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/reminders.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/setup.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/care-twin-qa.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/+not-found.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/homeMissionDeck.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/homeMissionDeck.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/woofGuideActions.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/woofGuideActions.test.ts`

- [ ] **Step 1: Turn stale route expectations red**

Update route-union and action tests to expect canonical owners. Add first-screen reachability assertions showing Quick Log/Fast Log, next Plan item, Health alert/status, Log History, Dog Profile, and Privacy/export/delete within two visible taps from their primary tabs.

- [ ] **Step 2: Replace hard-coded ownership drift**

Use canonical destination builders at every caller. Home and Log open `/fastlog` through visible “Log care” actions. Records/Reports routes use Health. Profile/avatar/household/supplies/story/adventure/WoofGuide/settings/privacy/legal use More sections. Plans owns reminder destinations.

- [ ] **Step 3: Make `/reminders` a compatibility bridge to Plans**

Preserve only a validated `item` identifier and replace to `/calendar`. If the current reminder screen contains unique functional controls, compose them into Plans before reducing the route to a redirect.

- [ ] **Step 4: Correct labels and fallbacks**

Remove visible “Today tab,” “Pack tab,” and “Story tab” directions. Not-found and setup completion return to Home. Back/cancel returns to the meaningful parent rather than pushing another root.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts \
  artifacts/woofwatcher-mobile/lib/homeMissionDeck.test.ts \
  artifacts/woofwatcher-mobile/lib/woofGuideActions.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run typecheck
git add artifacts/woofwatcher-mobile
git commit -m "fix: route every care task to its canonical owner"
```

Expected: PASS.

---

### Task 6: Instruction, Accessibility, and QA Manifest Parity

**Files:**
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReleaseQa.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReleaseSmokeChecklist.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReleaseSmokeChecklist.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/betaHandoffPacket.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/betaHandoffPacket.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/launchReadiness.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/launchReadiness.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/releasePacket.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/releasePacket.test.ts`
- Modify: `artifacts/woofwatcher-mobile/scripts/smoke-runtime-preview.js`
- Modify: `artifacts/woofwatcher-mobile/scripts/live-preview-handoff-proof.js`
- Modify: `docs/QA_TEST_PLAN.md`
- Modify: `docs/release/MOBILE_RELEASE_RUNBOOK.md`
- Modify: `docs/design/UI_IMPLEMENTATION_NOTES.md`

- [ ] **Step 1: Make active instructions fail parity tests**

Add a shared executable navigation manifest and test that help/onboarding/QA copy uses exactly Home, Log, Plans, Health, More and only promises canonical destinations/actions that exist.

- [ ] **Step 2: Update executable release manifests**

Include canonical Health/More sections and legacy `/records`, `/pack`, `/story`, `/reminders`, `/profile`, `/portrait`, `/adventure`, `/woofguide`, `/privacy`, and `/legal` redirect checks. Remove old-tab assertions and hidden Health/More expectations.

- [ ] **Step 3: Update active consumer instructions**

Describe the five tabs in plain language. State that Pack is now Care Team & Supplies under More and Story is Story & Progress under More. Do not rewrite historical handoff/progress files.

- [ ] **Step 4: Verify route and instruction parity**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileLaunchQaEvidence.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReleaseSmokeChecklist.test.ts \
  artifacts/woofwatcher-mobile/lib/betaHandoffPacket.test.ts \
  artifacts/woofwatcher-mobile/lib/launchReadiness.test.ts \
  artifacts/woofwatcher-mobile/lib/releasePacket.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the task**

```bash
git add artifacts/woofwatcher-mobile docs/QA_TEST_PLAN.md docs/release/MOBILE_RELEASE_RUNBOOK.md docs/design/UI_IMPLEMENTATION_NOTES.md
git commit -m "docs: align instructions with universal navigation"
```

---

### Task 7: Slice 1 Export, Runtime, and Rendered Navigation Gate

**Files:**
- Create: `docs/qa/2026-08-05-universal-navigation-evidence.md`

- [ ] **Step 1: Run the complete focused suite**

```bash
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs run test:focused
```

Expected: all tests pass.

- [ ] **Step 2: Run workspace typecheck and CI/export**

```bash
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs run typecheck
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs run build:ci
```

Expected: workspace types, API/PWA/mockup builds, Expo export, asset audit, all runtime routes, and all handoff routes pass.

- [ ] **Step 3: Run mobile smoke routes**

```bash
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run smoke:web
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run smoke:runtime
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run proof:live-preview
```

Expected: PASS for canonical and legacy routes.

- [ ] **Step 4: Exercise rendered behavior**

At 390×844 and 1365×700, verify exact five visible labels/order; selected state by shape and color; 48×48 targets; Home re-tap; every canonical child keeping its parent selected; direct `/records`, `/pack`, `/story`, `/reminders`, `/profile`, `/portrait`, `/adventure`, `/woofguide`, `/privacy`, and `/legal`; Back semantics; unknown query fallback; no duplicate root stacking; no app-origin console errors.

- [ ] **Step 5: Run accessibility navigation checks**

Verify VoiceOver/TalkBack tab order, selected value, useful labels/hints, and large-text navigation without clipping. Physical device evidence is required before merge; browser accessibility inspection is supplemental.

- [ ] **Step 6: Record exact-build evidence and commit**

Document build SHA, routes, viewports/devices, results, screenshots/video links, and remaining blockers in `docs/qa/2026-08-05-universal-navigation-evidence.md`.

```bash
git add docs/qa/2026-08-05-universal-navigation-evidence.md
git commit -m "docs: record universal navigation verification"
```

- [ ] **Step 7: Final diff audit**

```bash
git diff --check origin/main...HEAD
rg -n "Log / Plan / Today / Pack / Story|Today tab|Pack tab|Story tab" artifacts/woofwatcher-mobile docs/QA_TEST_PLAN.md docs/release/MOBILE_RELEASE_RUNBOOK.md docs/design/UI_IMPLEMENTATION_NOTES.md
```

Expected: no whitespace errors and no active consumer instruction using the retired navigation. Historical fixtures are not in this scan.
