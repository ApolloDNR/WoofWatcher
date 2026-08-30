# WoofWatcher Core Workflow Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Log, Plans, Health, and More into four clear, truthful, accessible owners whose visible actions match their real persisted behavior and stay within the universal two-visible-tap contract.

**Architecture:** This slice consumes the implemented Slice-0 truth/data services, Slice-1 canonical section routers, and Slice-2 shared care-log/routine/browser foundations after their automated gates pass. Each primary route receives a pure model and serializable decision contract, focused presentation components, and a seeded exact-export `E2E_SCOPE` that is the executable JSX render/callback harness. When the declared browser launches, that scope passes before the next route changes; under the single allowed `BROWSER_UNAVAILABLE` branch, implementation may continue but that scope remains explicitly PENDING, no rendered claim is made, and merge waits for all deferred scopes to pass. Health and More modify the exact components created by Slice 1—`HealthSectionRouter`, `RecordsScreen`, `MoreSectionRouter`, `CareTeamSuppliesScreen`, and `StoryProgressScreen`—rather than adding nested routes or duplicate screens.

**Tech Stack:** TypeScript 5.9, Expo SDK 54, Expo Router 6, React Native 0.81, Reanimated 4, AsyncStorage, Slice-0 report/share/attachment adapters, Node 24 built-in test runner, Playwright against the exact Expo web export, pnpm 10.24.0.

## Global Constraints

- Implementation prerequisites: rebase onto the production changes from Slice 0, Slice 1, and Slice 2 (including Home Task 0's repaired shared routine matcher, source-aware Privacy recovery, recorder contracts, hermetic Playwright runner, and pinned/five-tab root-doctor repair) and require their focused tests, typecheck, build/export, and all automated gates that can run in the available environment before Task 1. Physical iOS/Android, signing, accessibility, observed usability, regenerated store screenshots, owner evidence, and a launchable browser executable after runner declaration may remain unavailable; carry all such evidence forward as one explicit final merge/release blocker instead of stopping downstream implementation. If Slice 2 reported `BROWSER_UNAVAILABLE`, continue pure/component implementation while every `E2E_SCOPE` remains explicitly pending and make no rendered-JSX/callback PASS claim; merge is blocked until all scopes pass with the declared/explicit browser.
- Verify these prerequisite paths exist: `lib/navigationOwnership.ts`, `components/health/HealthSectionRouter.tsx`, `components/health/RecordsScreen.tsx`, `components/more/MoreSectionRouter.tsx`, `components/more/DogProfileScreen.tsx`, `components/more/AvatarStudioScreen.tsx`, `components/more/CareTeamSuppliesScreen.tsx`, `components/more/StoryProgressScreen.tsx`, `components/more/AdventureScreen.tsx`, `components/more/WoofGuideScreen.tsx`, `components/more/SettingsScreen.tsx`, `components/more/PrivacyDataScreen.tsx`, `components/more/LegalScreen.tsx`, `lib/quickLogWorkflow.ts`, `lib/quickLogWorkflow.typecheck.ts`, `lib/protectedCareEnvelope.ts`, `lib/privacyDataProtection.ts`, `context/CareLogWorkflowContext.tsx`, `scripts/verify-playwright-browser.mjs`, `scripts/verify-playwright-browser.test.mjs`, and the repository-root doctor/test files named in Task 6.
- Consume the Slice-1 amendment recorded in plan commit `c6e243c`: `MoreSection` includes `"adventure"`, `"woofguide"`, and `"legal"` in addition to Dog Profile, Avatar Studio, Settings, and Privacy; the nine bounded More components exist; and legacy `/profile`, `/portrait`, `/adventure`, `/woofguide`, `/privacy`, and `/legal` inputs are typed replace-only bridges to `/more?section=...`. If that implementation is absent, stop and finish/rebase Slice 1 rather than recreating it here.
- Consume `CanonicalDestination`, `HealthSection`, the amended `MoreSection`, `resolveCanonicalDestination`, `FinalizedCareInput`, `LocalCaregiverIdentity`, `CareLogWorkflowResult`, and `useCareLogWorkflow`; do not parse route ownership, derive auth-based attribution, or mutate Quick Log entries a second way.
- `app/(tabs)/records.tsx`, `pack.tsx`, and `story.tsx` remain Slice-1 compatibility redirects only. Do not move consumer UI back into them and do not create `app/(tabs)/health/records.tsx`, `screens/RecordsScreen.tsx`, or `screens/StoryProgressScreen.tsx`.
- Keep Expo SDK 54/Router 6, all existing persisted entry/doc shapes, and keys `woofwatcher.v2.state`, `woofwatcher.packSupplies.v1`, and `woofwatcher.travelBag.v1`.
- The seven primary Log actions do not remove Treat, Play, Training, Mood/Anxious, Weight, Vomit, Symptom, Incident, Grooming, or any other existing `CARE_EVENT_TYPES` value. The visible **More care types** launcher uses Slice 2's `SECONDARY_CARE_TYPES`, which is exhaustive and disjoint from primary kinds; the detailed composer inventory remains full `CARE_EVENT_TYPES`, so primary types can still be edited there.
- Meal, Medication, Potty, Walk, Alone Time, Water, and Note always obey the finalized Slice-2 safety matrix. No screen may reintroduce `taken`, portion, outcome, location, duration, or completion defaults that bypass it.
- Plans uses Slice-0 local calendar, strict `parseClockTime`, strict date parsing, correction issues, and full-string numeric validation. Invalid legacy values remain visible as **Needs correction** and stay out of due/next calculations.
- Health consumes Slice-0 `reportDocument`, `nativeFileShare`, and `recordAttachmentLifecycle`; it never creates a second report exporter, text-only file share, or attachment lifecycle.
- More uses typed destination intents and Slice-1 section routing. No `route: string` field is allowed in the directory model.
- One primary action per screen state; measured core tasks reach their first actionable screen within two visible taps from any primary tab.
- Empty states contain no fabricated schedule, completion, health evidence, cloud/provider success, or sample activity.
- Every model receives `storageWarning`. Under `"newer-version"`, Log, Plans, Health, and More enter one explicit read-only state before invoking any mutation. They state that the last supported snapshot and entries remain viewable while the future document is not interpreted; show update plus canonical Privacy & Data recovery/support guidance; and never treat `addEntry() === ""`, `deleteEntry() === false`, or a fail-closed update as success. Privacy consumes Slice 2's source-aware `ProtectedCareEnvelopeRecovery`: an exact local-storage backup exports its original bytes before reset, while a decoded provider/conflict source disables export and truthfully offers update/support/separately confirmed reset because exact source bytes do not exist. It never serializes exposed defaults as a backup. Undo remains available only for a previously captured real create ID or concrete-revision update receipt and may report failure; it never invents a reversible mutation.
- Home, Log, and Fast Log use Slice 2's one provider-resolved `LocalCaregiverIdentity`. This slice must not restore Log's auth-display-name precedence or a surface-specific first-caregiver fallback; persisted History attribution must match the label/role shown before save.
- Minimum touch target is 48×48; body text targets 16px; secondary text is at least 14px; screen-reader and keyboard order follow visual order.
- `mobileReadiness.test.ts` remains a narrow import/wiring guard. Pure models/contracts prove decisions and serialization only; each task's seeded exact-export `E2E_SCOPE` proves visible JSX labels, disabled state before callbacks, route composition, navigation, and persisted behavior.
- Every production change begins with a failing behavioral test, observes the expected failure, implements the smallest change, and reruns focused tests before commit.
- Use `node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs` from the repository root. Production deployment is outside this plan.
- Execute this plan in a dedicated clean worktree. Before Task 1 require `test -z "$(git status --porcelain)"`; if it is non-empty, stop rather than mix another worker's changes. Before each commit run `git diff --check`, stage only the exact paths in that task's Files block (never a whole product directory), and run `git diff --cached --check` before committing.

---

### Task 1: Log Recorder, History, Corrections, and Legacy Care Types

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/logScreenModel.ts`
- Create: `artifacts/woofwatcher-mobile/lib/logScreenModel.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/logScreenContract.ts`
- Create: `artifacts/woofwatcher-mobile/lib/logScreenContract.test.ts`
- Create: `artifacts/woofwatcher-mobile/components/log/LogRecorder.tsx`
- Create: `artifacts/woofwatcher-mobile/components/log/CareComposer.tsx`
- Create: `artifacts/woofwatcher-mobile/components/log/LogTodayList.tsx`
- Create: `artifacts/woofwatcher-mobile/components/log/LogHistory.tsx`
- Create: `artifacts/woofwatcher-mobile/components/log/LogEntrySheet.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/log.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/fastlog.tsx`
- Modify: `lib/care-domain/src/events.ts`
- Modify: `lib/care-domain/test/care-domain.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/quickLogWorkflow.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/quickLogWorkflow.typecheck.ts` through the mobile source compiler, not Node's test runner
- Test: `artifacts/woofwatcher-mobile/lib/careLogWorkflowRuntime.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/quickLogScreenContract.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
- Modify: `artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs`

**Interfaces:**

```ts
export type CareTypeResolution =
  | { status: "known"; type: CareEventType }
  | { status: "unknown"; raw: string };

export function resolveCareEventTypeInput(value: string | null | undefined): CareTypeResolution;

export type LogRouteIntent =
  | { kind: "recorder" }
  | { kind: "details"; careType: CareEventType }
  | { kind: "history" }
  | { kind: "entry"; entryId: string }
  | { kind: "finish-walk"; entryId: string }
  | { kind: "finish-alone"; entryId: string }
  | { kind: "unknown"; message: string };

export interface LogScreenModel {
  view: "recorder" | "history";
  routeIntent: LogRouteIntent;
  readOnly: boolean;
  readOnlyMessage: string | null;
  primaryKinds: typeof PRIMARY_QUICK_LOG_KINDS;
  secondaryTypes: typeof SECONDARY_CARE_TYPES;
  todayEntries: readonly Entry[];
  historyEntries: readonly Entry[];
  activeWalkId: string | null;
  activeAloneId: string | null;
  selectedEntry: Entry | null;
  fallbackMessage: string | null;
}

export function normalizeLogRouteParams(input: {
  params: Readonly<Record<string, string | string[] | undefined>>;
  entries: readonly Entry[];
}): LogRouteIntent;

export function deriveLogScreenModel(input: {
  entries: readonly Entry[];
  params: Readonly<Record<string, string | string[] | undefined>>;
  query: string;
  typeFilter: CareEventType | "all";
  storageWarning: "save-failed" | "read-failed" | "reset" | "newer-version" | null;
  now: number;
}): LogScreenModel;

export interface LogScreenContract {
  segmentLabels: readonly ["Log", "History"];
  identityLabel: string;
  identityRole: string | null;
  readOnly: boolean;
  readOnlyMessage: string | null;
  privacyDataDestination: CanonicalDestination;
  primaryActionLabels: readonly ["Meal", "Water", "Potty", "Walk", "Medication", "Alone Time", "Note"];
  moreCareTypesLabel: "More care types";
  todayHeading: "Today";
  historyHeading: "History";
  qaIds: {
    recorder: "log-recorder";
    history: "log-history";
    today: "log-today";
    moreTypes: "log-more-care-types";
  };
}

export function buildLogScreenContract(input: {
  model: LogScreenModel;
  caregiver: LocalCaregiverIdentity;
}): LogScreenContract;
```

`resolveCareEventTypeInput` recognizes all `CARE_EVENT_TYPES` and the existing aliases in `events.ts` (`anxiety`, `anxious`, medication aliases, incident/conflict aliases, `pee`, `poop`, vomit aliases, and `zoomies`). Unlike `normalizeCareEventType`, it returns `unknown` for unrecognized raw input instead of silently converting it to Note.

- [ ] **Step 1: Verify prerequisite authority and write the failing type-preservation tests**

Run the prerequisite suites first, then add a table proving every `CARE_EVENT_TYPES` value and every existing alias resolves intentionally while `mystery-care` returns `{ status: "unknown", raw: "mystery-care" }`.

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/quickLogWorkflow.test.ts \
  artifacts/woofwatcher-mobile/lib/careLogWorkflowRuntime.test.ts \
  lib/care-domain/test/care-domain.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs \
  --filter @workspace/woofwatcher-mobile exec tsc -p tsconfig.json --noEmit --pretty false
```

Expected after the new test is written: FAIL because unknown input currently normalizes to Note and no explicit resolver exists.

- [ ] **Step 2: Implement explicit care-type resolution without changing stored normalization**

Export a read-only alias resolver from `events.ts`. Preserve `normalizeCareEventType` for tolerant reads of legacy stored entries; route/composer input uses `resolveCareEventTypeInput` so unknown query values cannot create a Note.

- [ ] **Step 3: Write the failing Log model and pure contract tests**

Assert:

- exact seven-action policy order and one Details descriptor per primary action through the Slice-2 recorder contract;
- `secondaryTypes === SECONDARY_CARE_TYPES`; it is disjoint from `primaryKinds`, their union covers every `CARE_EVENT_TYPES` value exactly once for launcher purposes, and the separate detailed-composer inventory still equals all `CARE_EVENT_TYPES`;
- History is one visible root tap;
- today's entries use `todayLocalDateKey`, are newest-first, and exclude tomorrow/previous-local-day fixtures;
- open Walk/Alone derives only from persisted entries and survives model reconstruction;
- valid `type`, `detail`, `intent`, `entry`, and `walk` parameters open the expected flow/entry;
- invalid arrays, oversized IDs, unknown care types, or missing entry IDs produce the calm fallback and no mutation;
- each today/history row decision exposes Edit/Delete availability, recorded `entry.caregiver` plus `entry.details.caregiverRole`, and the existing sticky note once rather than twice;
- `storageWarning: "newer-version"` sets `readOnly`, uses exact copy `Update WoofWatcher before changing care data. The last supported care view is still available; newer-version data is not interpreted. Open Privacy & Data for available recovery options or support.`, marks recorder/Edit/Delete disabled, and leaves History plus the canonical Privacy & Data destination reachable; Privacy itself renders the source-specific exact-export or exact-unavailable message;
- the Slice-2 `Avery`/`Parent`, blank-first `Jordan`/`Helper`, and empty-fallback fixtures render exactly the provider's local name/role and persist that same attribution despite a conflicting auth display name and route changes.

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/logScreenModel.test.ts \
  artifacts/woofwatcher-mobile/lib/logScreenContract.test.ts
```

Expected: FAIL because the model/contract files do not exist.

These pure suites do not claim JSX rendering or callback wiring. Step 8's seeded `E2E_SCOPE=log` export is the executable render/wiring authority for visible labels, disabled controls, navigation, and mutations.

- [ ] **Step 4: Implement the pure Log model with canonical local dates and search**

Use `todayLocalDateKey`, `localDateKey`, `deriveCareLogSearch`, `findOpenWalkSession`, `findOpenAloneTimeSession`, and Slice-1's identifier rule. Import `SECONDARY_CARE_TYPES` for the visible launcher and `ALL_DETAILED_CARE_TYPES` for the composer; do not recompute either list in Log. Build supported canonical destinations with `resolveCanonicalDestination({ pathname: "/log", params })`.

- [ ] **Step 5: Extract the recorder and detailed composer without changing domain lifecycles**

`LogRecorder` composes `QuickLogActions`, `QuickLogFlowSheet`, `ActiveSessionCard`, `LoggingIdentity`, today's list, and **More care types**. `CareComposer` contains detailed fields for every existing care type and receives only a validated `FinalizedCareInput` or the existing explicit legacy detailed-entry callback. Route all primary safety types through `useCareLogWorkflow`; do not leave Meal/Potty/Medication/Walk/Alone/Water/Note builders inside the route. When read-only, forms stay inspectable but every create/update/delete/finish confirmation is disabled and the canonical Privacy & Data action remains visible.

- [ ] **Step 6: Extract History and correction surfaces**

`LogHistory` owns search/filter/grouping; `LogEntrySheet` composes trust/proof, meal/potty follow-up, sticky notes, audit trail, share, edit, and delete. Each row/sheet displays the role recorded at save time from `entry.details.caregiverRole` (including an explicit `Role not recorded` for `null`) rather than resolving the caregiver's current household role. Delete remains confirmed; canceled delete changes nothing. Existing correction/audit/sticky-note fields and attachment proof stay intact. An unknown/retired stored entry is still readable and correctable; it is never rewritten merely by opening it.

- [ ] **Step 7: Make the route a bounded composition shell**

`log.tsx` owns search params, `useCare`, `useCareLogWorkflow`, selected Log/History segment, and modal visibility. It passes the provider's exact local label/role and CareContext's storage warning; it does not call `useGetMe` for attribution. Remove the decorative Quick Care Console, Favorites/All/Health launcher split, doctrine rail, route-local save/dedupe/feedback/Undo, duplicated sticky-note render, and competing mood/support/sync panels from the primary path. `fastlog.tsx` renders the same `LogRecorder` in modal form, not its old six-tile policy.

- [ ] **Step 8: Add persisted exact-export Log checks**

Extend `e2e-web-workflows.mjs` with `E2E_SCOPE=log`. Against the fresh export, exercise all seven primary actions and Details, configured/unconfigured Meal, explicit Potty, explicit Medication, non-empty Note, Walk/Alone reload and Finish, the secondary-only More-care-types launcher, primary-type detailed editing, History, Edit, canceled Delete, confirmed Delete, and global Undo after navigation. This is the route's JSX render/callback harness: locate real visible labels, invoke real controls, and prove disabled controls produce no callback/storage effect. Parse `localStorage["woofwatcher.v2.state"]` and compare exact entry IDs/types/details/trust/caregiver/recorded-role fields—not only feedback copy. Change the current household role after save and prove History retains the recorded role. Seed a conflicting auth name and prove local attribution is unchanged. Seed a newer-version raw envelope, snapshot it, attempt every mutation class, open Privacy & Data, export and compare its exact UTF-8 bytes before reset, and prove the stored raw value remains byte-identical while last-supported History and update/export/reset/support copy remain reachable.

- [ ] **Step 9: Verify and commit Log**

Run:

```bash
node --experimental-strip-types --test \
  lib/care-domain/test/care-domain.test.ts \
  artifacts/woofwatcher-mobile/lib/logScreenModel.test.ts \
  artifacts/woofwatcher-mobile/lib/logScreenContract.test.ts \
  artifacts/woofwatcher-mobile/lib/quickLogWorkflow.test.ts \
  artifacts/woofwatcher-mobile/lib/careLogWorkflowRuntime.test.ts \
  artifacts/woofwatcher-mobile/lib/mealOutcomeUpdate.test.ts \
  artifacts/woofwatcher-mobile/lib/pottyLogDetail.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs \
  --filter @workspace/woofwatcher-mobile exec tsc -p tsconfig.json --noEmit --pretty false
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run smoke:web
```

Run `E2E_SCOPE=log node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run e2e:web`. The Slice-2 wrapper validates the declared browser, starts/stops the exact preview, and supplies `BASE_URL`. Expected: focused tests, typecheck, export, executable route harness, and persisted Log flow PASS.

```bash
git diff --check
git add -- artifacts/woofwatcher-mobile/lib/logScreenModel.ts artifacts/woofwatcher-mobile/lib/logScreenModel.test.ts artifacts/woofwatcher-mobile/lib/logScreenContract.ts artifacts/woofwatcher-mobile/lib/logScreenContract.test.ts artifacts/woofwatcher-mobile/components/log/LogRecorder.tsx artifacts/woofwatcher-mobile/components/log/CareComposer.tsx artifacts/woofwatcher-mobile/components/log/LogTodayList.tsx artifacts/woofwatcher-mobile/components/log/LogHistory.tsx artifacts/woofwatcher-mobile/components/log/LogEntrySheet.tsx artifacts/woofwatcher-mobile/app/'(tabs)'/log.tsx artifacts/woofwatcher-mobile/app/fastlog.tsx lib/care-domain/src/events.ts lib/care-domain/test/care-domain.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs
git diff --cached --check
git commit -m "feat: simplify Log without losing care types"
```

---

### Task 2: Truthful Plans Today, Range Views, and Editors

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/plansOverview.ts`
- Create: `artifacts/woofwatcher-mobile/lib/plansOverview.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/plansScreenContract.ts`
- Create: `artifacts/woofwatcher-mobile/lib/plansScreenContract.test.ts`
- Create: `artifacts/woofwatcher-mobile/components/plans/PlansToday.tsx`
- Create: `artifacts/woofwatcher-mobile/components/plans/PlanRangePicker.tsx`
- Create: `artifacts/woofwatcher-mobile/components/plans/RoutineEditorSheet.tsx`
- Create: `artifacts/woofwatcher-mobile/components/plans/EventEditorSheet.tsx`
- Create: `artifacts/woofwatcher-mobile/components/plans/PlansEmptyState.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/calendar.tsx`
- Test: `lib/care-domain/test/routine-board.test.ts`
- Test: `artifacts/woofwatcher-mobile/app/reminders.tsx` through Slice-1 route tests; keep it a compatibility redirect
- Test: `artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
- Modify: `artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs`

**Interfaces:**

```ts
export type PlansRange = "day" | "week" | "month";
export type PlansWeekStart = 0 | 1;

export type PlansNextCare =
  | { kind: "routine"; id: string; label: string; detail: string; status: "overdue" | "due" | "upcoming"; destination: CanonicalDestination }
  | { kind: "event"; id: string; label: string; detail: string; destination: CanonicalDestination }
  | { kind: "none"; label: "Nothing scheduled"; detail: string; destination: CanonicalDestination };

export type PlansRangeItem =
  | {
      kind: "routine";
      key: string;
      dateKey: string;
      id: string;
      label: string;
      minutesSinceMidnight: number;
      status: RoutineBoardStatus;
      destination: CanonicalDestination;
    }
  | {
      kind: "event";
      key: string;
      dateKey: string;
      id: string;
      label: string;
      minutesSinceMidnight: number | null;
      dateOnly: boolean;
      destination: CanonicalDestination;
    };

export interface PlansRangeView {
  range: PlansRange;
  anchorDateKey: string;
  weekStartsOn: PlansWeekStart;
  visibleDateKeys: readonly string[];
  items: readonly PlansRangeItem[];
}

export interface PlansOverviewModel {
  empty: boolean;
  readOnly: boolean;
  readOnlyMessage: string | null;
  nextCare: PlansNextCare;
  today: readonly RoutineBoardItem[];
  reminders: CareReminderCenter;
  responsibility: HouseholdResponsibility;
  invalidRoutines: readonly Routine[];
  invalidEvents: readonly CalendarEvent[];
  rangeView: PlansRangeView;
  month: MonthView;
}

export function derivePlansOverview(input: {
  routines: readonly Routine[];
  entries: readonly Entry[];
  events: readonly CalendarEvent[];
  records: readonly Record[];
  caregivers: readonly Caregiver[];
  notificationPreferences: ReminderNotificationPreferences;
  range: PlansRange;
  anchorDateKey: string;
  weekStartsOn: PlansWeekStart;
  storageWarning: "save-failed" | "read-failed" | "reset" | "newer-version" | null;
  now: number;
}): PlansOverviewModel;

export interface PlansScreenContract {
  title: "Plans";
  primaryAction:
    | { kind: "add-routine"; label: "Add routine" }
    | { kind: "open-next-care"; label: "Open next care"; destination: CanonicalDestination }
    | { kind: "add-plan"; label: "Add plan" }
    | { kind: "privacy-data"; label: "Open Privacy & Data"; destination: CanonicalDestination };
  readOnly: boolean;
  readOnlyMessage: string | null;
  privacyDataDestination: CanonicalDestination;
  rangeLabels: readonly ["Day", "Week", "Month"];
  qaIds: {
    nextCare: "plans-next-care";
    empty: "plans-empty";
    today: "plans-today";
    range: "plans-range";
    reminders: "plans-reminders";
  };
}


export function buildPlansScreenContract(model: PlansOverviewModel): PlansScreenContract;
```

`nextCare` uses a single `kind: "none"` representation. Invalid correction items remain in `invalidRoutines`/`invalidEvents`, sorted after valid items, and never become next/due/completed. A writable empty model uses **Add routine**; a writable non-empty model with `nextCare.kind === "none"` uses **Add plan**; read-only always uses the Privacy recovery action.

Range semantics are exact. Day exposes only `anchorDateKey`. Week exposes seven consecutive local keys beginning on the injected Sunday (`0`) or Monday (`1`) at/before the anchor. Month exposes every real local date in the anchor's calendar month and passes that same anchor/today key to `buildMonthView`. V1 daily routines produce one range item per visible key; manual events produce one item only on their stored valid date. Sort by `dateKey`, then timed items before date-only events, then `minutesSinceMidnight`; at the same minute routines precede events, followed by case-folded label and ID. Date-only events sort after all timed items on that date by label/ID. Invalid items are not range items.

- [ ] **Step 1: Write failing truthful-empty and completion tests**

Prove an empty fixture renders only `Nothing scheduled` plus **Add routine**; it contains no Breakfast/Walk/Training sample rows or completed styling. Add one real routine and prove it is scheduled, not complete. Add one matching real log and prove only that routine becomes complete. Add an unrelated log and prove it does not complete the routine.

First run Home Task 0's matcher suite as a prerequisite. In the Plans model suite, reuse its Breakfast/Dinner and Medication fixtures to prove rendered completion consumes that shared result: valid exact ID plus exact normalized type; linked wrong-type or unknown-ID entries complete nothing and are not reassigned; unlinked same-type entries match only inside the inclusive window; future/out-of-day entries match nothing; and each entry ID is consumed at most once. Do not repair or reimplement matching in this task.

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/plansOverview.test.ts \
  artifacts/woofwatcher-mobile/lib/plansScreenContract.test.ts \
  lib/care-domain/test/routine-board.test.ts
```

Expected: the prerequisite matcher suite PASS, while the new model/contract suites FAIL because those files do not exist and the current route renders Sample Day.

- [ ] **Step 2: Add local-date/range/correction/read-only tests**

Use fixed epoch fixtures on both sides of local midnight, UTC evening rollover, year rollover, and DST spring/fall. `plansOverview.test.ts` contains an explicit expected-date-key table keyed by `process.env.TZ` for `UTC`, `America/Los_Angeles`, `America/New_York`, and `Asia/Tokyo`; run it in four separate subprocesses with `TZ` set before Node starts. The shared `routine-board.test.ts` runs under the same four-process seam from Home Task 0. Never change `process.env.TZ` after module load or rely on the host zone. For Day, Sunday-start Week, Monday-start Week, and Month, assert exact `visibleDateKeys`, routine expansion, event inclusion, and the complete ordering rule above—including equal-time routine/event ties and date-only events after timed items. Prove anchor changes deterministically replace the range and `buildMonthView` receives the same canonical anchor/today key. Malformed time/date items render **Needs correction**, preserve raw values, sort after valid items, and stay out of next/due/range calculations. Add a non-empty fixture containing only past or correction data so `nextCare.kind === "none"`, and assert **Add plan** rather than the impossible `open-next-care`. With `storageWarning: "newer-version"`, assert exact last-supported/future-uninterpreted plus source-neutral Privacy recovery/support copy, `readOnly: true`, and disabled Add/Edit/Delete policy while ranges, schedule viewing, reminders, and canonical Privacy & Data remain reachable.

- [ ] **Step 3: Implement the Plans model from existing domain authorities**

Compose Home Task 0's `deriveRoutineBoard`, `deriveCareReminderCenter`, `deriveHouseholdResponsibility`, `buildMonthView`, `todayLocalDateKey`, `addLocalCalendarDays`, `parseClockTime`, `parseLocalDateKey`, and `hasCorrectionIssue`. Build `PlansRangeView` exactly as specified; do not change `routine-board.ts` or create a Plans-only matcher. Use `resolveCanonicalDestination` for next routine/event and Log completion routes. Do not create a recurrence schema; V1 routines remain daily.

- [ ] **Step 4: Extract focused Plans components and strict editors**

`PlansToday` visually separates scheduled rows from real completion evidence. `PlanRangePicker` exposes labeled Day/Week/Month buttons and the selected anchor. The route renders events only through bounded `rangeView.items`; it never feeds an unbounded `events` list to presentation. `RoutineEditorSheet` and `EventEditorSheet` use native pickers where available and Slice-0 parsers for text/import; malformed values show field-specific copy and do not call `updateCareDoc`. **Add plan** opens one routine/event choice when real data exists but nothing is next. Under newer-version read-only protection, no editor opens a mutable confirmation and no `updateCareDoc` call occurs. `PlansEmptyState` has one **Add routine** action only when writable; the read-only empty state instead offers canonical Privacy & Data guidance.

- [ ] **Step 5: Replace the monolith's competing hierarchy**

`calendar.tsx` becomes a composition shell over `PlansOverviewModel`. Remove `SAMPLE_SCHEDULE`, Plans Command Deck, Today’s Missions, fabricated completion, server-event discovery from the consumer primary path, and the dead clear-reminder haptic. Keep real schedule, event, reminder, daily routine, and responsibility functionality. Copy says `Reminders stay in WoofWatcher in this build; push delivery is not available.` unless Slice 0 has actual provider-delivery proof.

- [ ] **Step 6: Add the Plans route/component and exact-export harness**

Pure tests inject empty, valid, two-routine same-type, matching-completion, routine-ID wrong-type/mismatch, out-of-window/future log, invalid-legacy, local-midnight, all ranges/anchors, non-empty-none-next, and newer-version fixtures and assert decisions/canonical destinations only. Extend `E2E_SCOPE=plans` as the executable JSX render/callback harness: wipe to empty state, assert real visible labels/no sample rows, create Breakfast and Dinner (then two Medication routines) through the real editor, reload, log unrelated/out-of-window/wrong-type-linked care, confirm all stay pending, then log one explicitly linked same-type care item and confirm only its intended routine displays completion. Exercise exact Day/Week/Month date keys/order, anchor changes, non-empty/no-next **Add plan**, and `/reminders?item=<valid-id>` with Plans selected. Finally seed newer-version storage, snapshot the raw value, attempt routine/event mutations, and prove storage remains byte-identical while last-supported viewing and protected-envelope Privacy export remain reachable.

- [ ] **Step 7: Verify and commit Plans**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/plansOverview.test.ts \
  artifacts/woofwatcher-mobile/lib/plansScreenContract.test.ts \
  artifacts/woofwatcher-mobile/lib/localCalendar.test.ts \
  artifacts/woofwatcher-mobile/lib/inputValidation.test.ts \
  artifacts/woofwatcher-mobile/lib/careDocMigration.test.ts \
  artifacts/woofwatcher-mobile/lib/monthCalendar.test.ts \
  artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts \
  lib/care-domain/test/routine-board.test.ts \
  lib/care-domain/test/care-reminders.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
TZ=UTC node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/plansOverview.test.ts lib/care-domain/test/routine-board.test.ts
TZ=America/Los_Angeles node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/plansOverview.test.ts lib/care-domain/test/routine-board.test.ts
TZ=America/New_York node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/plansOverview.test.ts lib/care-domain/test/routine-board.test.ts
TZ=Asia/Tokyo node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/plansOverview.test.ts lib/care-domain/test/routine-board.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run typecheck
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run smoke:web
```

Run `E2E_SCOPE=plans node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run e2e:web`. Expected: tests, typecheck, exact export render/wiring, truthful empty state, real completion, local ranges, correction state, and legacy reminder ownership PASS.

```bash
git diff --check
git add -- artifacts/woofwatcher-mobile/lib/plansOverview.ts artifacts/woofwatcher-mobile/lib/plansOverview.test.ts artifacts/woofwatcher-mobile/lib/plansScreenContract.ts artifacts/woofwatcher-mobile/lib/plansScreenContract.test.ts artifacts/woofwatcher-mobile/components/plans/PlansToday.tsx artifacts/woofwatcher-mobile/components/plans/PlanRangePicker.tsx artifacts/woofwatcher-mobile/components/plans/RoutineEditorSheet.tsx artifacts/woofwatcher-mobile/components/plans/EventEditorSheet.tsx artifacts/woofwatcher-mobile/components/plans/PlansEmptyState.tsx artifacts/woofwatcher-mobile/app/'(tabs)'/calendar.tsx artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs
git diff --cached --check
git commit -m "feat: make Plans reflect real scheduled care"
```

---

### Task 3: Evidence-Based Health and Canonical Records

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/healthOverview.ts`
- Create: `artifacts/woofwatcher-mobile/lib/healthOverview.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/healthScreenContract.ts`
- Create: `artifacts/woofwatcher-mobile/lib/healthScreenContract.test.ts`
- Create: `artifacts/woofwatcher-mobile/components/health/HealthOverviewScreen.tsx`
- Create: `artifacts/woofwatcher-mobile/components/health/HealthStatusCard.tsx`
- Create: `artifacts/woofwatcher-mobile/components/health/HealthSignalList.tsx`
- Create: `artifacts/woofwatcher-mobile/components/health/HealthDirectory.tsx`
- Create: `artifacts/woofwatcher-mobile/components/health/HealthReviewActions.tsx`
- Create: `artifacts/woofwatcher-mobile/components/health/records/DocumentsSection.tsx`
- Create: `artifacts/woofwatcher-mobile/components/health/records/TrendsSection.tsx`
- Create: `artifacts/woofwatcher-mobile/components/health/records/DogIdSection.tsx`
- Create: `artifacts/woofwatcher-mobile/components/health/records/CarePassSection.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/health/HealthSectionRouter.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/health/RecordsScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/health.tsx`
- Test: `artifacts/woofwatcher-mobile/app/(tabs)/records.tsx` through Slice-1 redirect tests; keep it redirect-only
- Modify: `artifacts/woofwatcher-mobile/lib/healthReviewPacket.ts` only to consume the canonical Slice-0 report/share interface
- Test: `artifacts/woofwatcher-mobile/lib/reportDocument.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/nativeFileShare.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/recordAttachmentLifecycle.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
- Modify: `artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs`

**Interfaces:**

```ts
export type HealthEvidenceState = "unknown" | "observed" | "watch" | "alert";
export type HealthLaneKind = "activity" | "hydration" | "appetite" | "potty" | "medication";
export type HealthEvidenceWindow =
  | { kind: "local-today" }
  | { kind: "trailing-local-days"; dayCount: 7 };

export const HEALTH_EVIDENCE_WINDOWS = {
  activity: { kind: "trailing-local-days", dayCount: 7 },
  hydration: { kind: "local-today" },
  appetite: { kind: "local-today" },
  potty: { kind: "local-today" },
  medication: { kind: "local-today" },
} as const satisfies Record<HealthLaneKind, HealthEvidenceWindow>;

export function isEntryInHealthEvidenceWindow(
  lane: HealthLaneKind,
  occurredAt: string,
  now: number,
  resolveParts?: LocalCalendarPartsResolver,
): boolean;

export function classifyHealthLaneEntry(
  lane: HealthLaneKind,
  entry: Entry,
): "irrelevant" | "observed" | "watch" | "alert";

export interface HealthEvidenceLane {
  kind: HealthLaneKind;
  state: HealthEvidenceState;
  label: string;
  detail: string;
  evidenceEntryIds: readonly string[];
  destination: CanonicalDestination;
}

export interface HealthOverviewModel {
  readOnly: boolean;
  readOnlyMessage: string | null;
  status: { state: "calm" | "watch" | "alert"; label: string; detail: string; destination: CanonicalDestination };
  lanes: readonly HealthEvidenceLane[];
  signals: readonly CareHealthSignal[];
  directory: readonly {
    section: Exclude<HealthSection, "overview">;
    label: string;
    destination: CanonicalDestination;
  }[];
  vetBoundary: string;
}

export function deriveHealthOverview(input: {
  state: Pick<CareState, "profile" | "entries" | "routines" | "records" | "dietProfile" | "reportArtifacts">;
  storageWarning: "save-failed" | "read-failed" | "reset" | "newer-version" | null;
  now: number;
  resolveParts?: LocalCalendarPartsResolver;
}): HealthOverviewModel;

export interface HealthScreenContract {
  title: "Health";
  readOnly: boolean;
  readOnlyMessage: string | null;
  privacyDataDestination: CanonicalDestination;
  directoryLabels: readonly ["Health Watch", "Bile Watch", "Medications", "Diet", "Trends", "Records", "Dog ID", "Care Pass"];
  qaIds: {
    status: "health-status";
    signals: "health-signals";
    lanes: "health-lanes";
    directory: "health-directory";
  };
}

export function buildHealthScreenContract(model: HealthOverviewModel): HealthScreenContract;
```

Lane semantics are factual: no evidence is `unknown` with **Not enough data**; relevant recent non-alert evidence is `observed` with copy such as **Water care logged**, never “Well hydrated”; only relevant entries can change a lane. `classifyHealthLaneEntry` is the closed severity authority, and a lane takes the maximum `alert > watch > observed > unknown` over in-window relevant entries. `deriveHealthWatch` supplies the separate non-diagnostic signal list/global context; it does not silently reclassify a lane.

The classifier predicates are exact after normalized type filtering. For every lane, entry severity `alert` or `urgent` is `alert`, and `watch` is `watch`. Activity accepts Walk/Play/Training and otherwise returns `observed`. Hydration accepts Water and otherwise returns `observed`. Appetite accepts Meal: `mealCompletion` `partial`, `skipped`, or `grazing` is `watch`; `served`, `complete`, `most`, outcome-pending, or an otherwise valid Meal log is `observed`. Potty is `alert` for `condition` `blood`/`diarrhea`, pee detail `straining`, or context `straining`; it is `watch` for outcome `accident`, pee detail `frequent`/`dark`/`accident`, condition `soft`/`hard`/`mucus`/`unusual-color`, context `accident`/`urgent`, or a non-empty stool color other than `brown`/`normal`/`not-sure`; other valid Potty evidence is `observed`. Medication is `watch` for outcome `skipped`, `missed`, `held`, or `not taken`; `taken`, `logged`, or another valid explicit Medication log is `observed`. No count, missing entry, or unrelated `deriveHealthWatch` signal manufactures a lane state.

Window semantics are closed and local-calendar based. Hydration, Appetite, Potty, and Medication accept timestamps whose injected-resolver local key equals `now`'s local key and whose instant is at or before `now`. Activity accepts keys in the set `[today - 6 local calendar days, ..., today]` and instants at or before `now`—seven named local dates, not `7 * 86_400_000` milliseconds. Every lane rejects an invalid timestamp and any `occurredAt > now`. `resolveParts` is passed to every `localDateKey` call, so Los Angeles and New York DST fixtures run deterministically in one process without changing global `TZ`.

- [ ] **Step 1: Write failing lane-isolation and directory tests**

Prove a lone symptom, meal, record, Walk, Water, Potty, or Medication fixture cannot change an unrelated lane. Table-test every classifier predicate above, including severity precedence and the exact Meal/Potty/Medication outcome sets. No water entries yields Hydration `unknown`; a water-refresh entry yields `observed` and its exact ID. Assert the exact eight Health directory labels and typed `HealthSection` destinations. For each lane, test the inclusive first allowed instant/key, one millisecond before it, exact `now`, `now + 1 ms`, and invalid timestamp. Inject `Intl.DateTimeFormat`-backed Los Angeles and New York resolvers for local midnight and both DST transitions: Activity uses exactly seven local keys; the other four lanes use today's key. Add a newer-version fixture that exposes only the last supported evidence/records, never a future-only field, sets `readOnly`, displays exact protected-export/reset/support guidance, and marks attachment add/replace/delete plus Care Pass generate/share-with-history disabled.

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/healthOverview.test.ts \
  artifacts/woofwatcher-mobile/lib/healthScreenContract.test.ts
```

Expected: FAIL because the model/contract files do not exist and current aggregate data can label unrelated lanes Good.

- [ ] **Step 2: Implement lane-specific evidence and typed destinations**

Use `classifyHealthLaneEntry` plus `isEntryInHealthEvidenceWindow`; do not inline a different duration or severity mapping in a component. Preserve all relevant source IDs in deterministic occurredAt/ID order. Build every destination through `resolveCanonicalDestination({ pathname: "/health", params: { section } })`.

- [ ] **Step 3: Build the Health root and modify Slice-1's section router**

`HealthOverviewScreen` renders status, signals, lanes, directory, medical boundary, and the read-only guidance when applicable. `HealthSectionRouter` continues to accept only normalized `HealthSection` and renders this overview plus the exact Slice-1 owners. Preserve `?tab=health|bile`, unknown-section calm fallback, and selected Health tab. Medication and Diet open Health sections, not Plans or More. The read-only flag is passed through the router to every mutable Records/Care Pass child rather than implemented only on the root screen.

- [ ] **Step 4: Decompose the existing Slice-1 Records component in place**

Keep `components/health/RecordsScreen.tsx` as the only Records implementation. Extract its Documents, Trends, Dog ID, and Care Pass sections under `components/health/records/`. Preserve records, baselines, medication records, attachment metadata, report history, and correction state. `app/(tabs)/records.tsx` remains a redirect and contains no UI.

- [ ] **Step 5: Consume the single Slice-0 artifact/share/attachment services**

`HealthReviewActions` builds the complete `CarePassDocument`, awaits `shareFile`, records only `share-sheet-opened`/`copied`/`downloaded`, and displays canceled/failed without success history. `DocumentsSection` uses `addRecordAttachment`, `replaceRecordAttachment`, `cancelDraftAttachment`, and `deleteRecordAttachment`; Open/Preview/Share/Download remain labeled. Under newer-version protection, existing artifacts/attachments may be opened, previewed, or downloaded without state mutation, but creation, replacement, deletion, and any share/generate path that records history are blocked before the adapter. `DogIdSection` renders all seven visible rows including Microchip and Insurance. Delete any route-level `Share.share({ url })` or second report generator left in Health/Records.

- [ ] **Step 6: Add the Health route/component and exact-export harness**

Pure suites inject empty, unrelated-log, water-only, activity-only, every exact severity predicate, invalid-record, long Unicode report, attachment, and newer-version fixtures and assert decisions/evidence IDs/typed destinations. Extend `E2E_SCOPE=health` as the executable JSX render/callback harness: seed/reload each isolated fixture, compare real visible lanes, navigate every directory row, prove `/records` → `/health?section=records` selected-parent behavior, open a record attachment, generate the complete Care Pass preview, inspect Dog ID priority fields, and verify More has only a canonical shortcut. For newer-version storage, snapshot the raw value, attempt attachment/report mutations through real controls, prove it stays byte-identical with no callback success/history, and verify last-supported viewing plus canonical protected-envelope Privacy guidance.

- [ ] **Step 7: Verify and commit Health**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/healthOverview.test.ts \
  artifacts/woofwatcher-mobile/lib/healthScreenContract.test.ts \
  artifacts/woofwatcher-mobile/lib/healthSectionRouting.test.ts \
  artifacts/woofwatcher-mobile/lib/healthReviewPacket.test.ts \
  artifacts/woofwatcher-mobile/lib/reportDocument.test.ts \
  artifacts/woofwatcher-mobile/lib/nativeFileShare.test.ts \
  artifacts/woofwatcher-mobile/lib/recordAttachmentLifecycle.test.ts \
  artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts \
  lib/care-domain/test/health-handoff.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
TZ=UTC node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/healthOverview.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run typecheck
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run smoke:web
```

Run `E2E_SCOPE=health node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run e2e:web`. Expected: tests, typecheck, exact-export render/wiring, evidence isolation, canonical ownership, report/record composition, and legacy redirects PASS. Native recipient-open proof remains part of the consolidated physical-device merge gate and cannot be replaced here.

```bash
git diff --check
git add -- artifacts/woofwatcher-mobile/lib/healthOverview.ts artifacts/woofwatcher-mobile/lib/healthOverview.test.ts artifacts/woofwatcher-mobile/lib/healthScreenContract.ts artifacts/woofwatcher-mobile/lib/healthScreenContract.test.ts artifacts/woofwatcher-mobile/components/health/HealthOverviewScreen.tsx artifacts/woofwatcher-mobile/components/health/HealthStatusCard.tsx artifacts/woofwatcher-mobile/components/health/HealthSignalList.tsx artifacts/woofwatcher-mobile/components/health/HealthDirectory.tsx artifacts/woofwatcher-mobile/components/health/HealthReviewActions.tsx artifacts/woofwatcher-mobile/components/health/records/DocumentsSection.tsx artifacts/woofwatcher-mobile/components/health/records/TrendsSection.tsx artifacts/woofwatcher-mobile/components/health/records/DogIdSection.tsx artifacts/woofwatcher-mobile/components/health/records/CarePassSection.tsx artifacts/woofwatcher-mobile/components/health/HealthSectionRouter.tsx artifacts/woofwatcher-mobile/components/health/RecordsScreen.tsx artifacts/woofwatcher-mobile/app/'(tabs)'/health.tsx artifacts/woofwatcher-mobile/lib/healthReviewPacket.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs
git diff --cached --check
git commit -m "feat: make Health the evidence and records owner"
```

---

### Task 4: Searchable More Directory and Canonical Secondary Experiences

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/moreDirectory.ts`
- Create: `artifacts/woofwatcher-mobile/lib/moreDirectory.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/moreScreenContract.ts`
- Create: `artifacts/woofwatcher-mobile/lib/moreScreenContract.test.ts`
- Create: `artifacts/woofwatcher-mobile/components/more/MoreRootScreen.tsx`
- Create: `artifacts/woofwatcher-mobile/components/more/MoreSearch.tsx`
- Create: `artifacts/woofwatcher-mobile/components/more/MoreGroup.tsx`
- Create: `artifacts/woofwatcher-mobile/components/more/MoreDestinationRow.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/DogProfileScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/AvatarStudioScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/AdventureScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/WoofGuideScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/SettingsScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/PrivacyDataScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/LegalScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/MoreSectionRouter.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/moreSectionRouting.test.ts`
- Modify: `artifacts/woofwatcher-mobile/components/more/CareTeamSuppliesScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/StoryProgressScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/more.tsx`
- Test: `artifacts/woofwatcher-mobile/app/profile.tsx` through Slice-1 redirect tests; keep it replace-only
- Test: `artifacts/woofwatcher-mobile/app/portrait.tsx` through Slice-1 redirect tests; keep it replace-only
- Test: `artifacts/woofwatcher-mobile/app/adventure.tsx` through Slice-1 redirect tests; keep it replace-only
- Test: `artifacts/woofwatcher-mobile/app/woofguide.tsx` through Slice-1 redirect tests; keep it replace-only
- Test: `artifacts/woofwatcher-mobile/app/privacy.tsx` through Slice-1 redirect tests; keep it replace-only
- Test: `artifacts/woofwatcher-mobile/app/legal.tsx` through Slice-1 redirect tests; keep it replace-only
- Test: `artifacts/woofwatcher-mobile/app/(tabs)/pack.tsx` through Slice-1 redirect tests; keep it redirect-only
- Test: `artifacts/woofwatcher-mobile/app/(tabs)/story.tsx` through Slice-1 redirect tests; keep it redirect-only
- Test: `artifacts/woofwatcher-mobile/lib/packSupplies.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/travelBag.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/avatarStudio.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/protectedCareEnvelope.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
- Modify: `artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs`

**Interfaces:**

```ts
export type MoreGroupId = "dog" | "people-home" | "experiences" | "app-privacy";

export type MoreDestinationIntent =
  | { kind: "more-section"; section: Exclude<MoreSection, "root"> }
  | { kind: "health-section"; section: "care-pass" };

export interface MoreDestination {
  id: string;
  group: MoreGroupId;
  label: string;
  keywords: readonly string[];
  intent: MoreDestinationIntent | null;
  available: boolean;
  unavailableReason?: string;
}

export const MORE_GROUP_ORDER = ["dog", "people-home", "experiences", "app-privacy"] as const;

export function buildMoreDirectory(): readonly MoreDestination[];
export function searchMoreDirectory(query: string, items: readonly MoreDestination[]): readonly MoreDestination[];
export function destinationForMoreIntent(intent: MoreDestinationIntent): CanonicalDestination;

export interface MoreScreenContract {
  title: "More";
  searchLabel: "Search More";
  readOnly: boolean;
  readOnlyMessage: string | null;
  privacyDataDestination: CanonicalDestination;
  groupLabels: readonly ["Dog", "People & Home", "Experiences", "App & Privacy"];
  qaIds: { search: "more-search"; results: "more-results"; groups: "more-groups" };
}

export function buildMoreScreenContract(input: {
  storageWarning: "save-failed" | "read-failed" | "reset" | "newer-version" | null;
}): MoreScreenContract;
```

No directory item contains `route: string` or a standalone pathname. Every available More row has a non-null typed intent and serializes through the amended Slice-1 section router, so selected parent remains More. The unavailable multi-dog row has `intent: null` and cannot navigate. **Share Care Pass** is the only cross-parent directory intent and serializes to canonical Health `section=care-pass`.

- [ ] **Step 1: Write the failing directory/group/search tests**

Require this consumer directory and exact intent mapping:

| Group | Row | Typed intent |
| --- | --- | --- |
| Dog | Dog Profile | `more-section: dog-profile` |
| Dog | Avatar Studio | `more-section: avatar-studio` |
| Dog | Add another dog | unavailable; no navigation intent is invoked |
| People & Home | Care Team | `more-section: care-team` |
| People & Home | Supplies & Travel | `more-section: care-team-supplies` |
| Experiences | Story & Progress | `more-section: story-progress` |
| Experiences | Adventure | `more-section: adventure` |
| Experiences | WoofGuide | `more-section: woofguide` |
| App & Privacy | Settings | `more-section: settings` |
| App & Privacy | Privacy & Data | `more-section: privacy` |
| App & Privacy | Legal | `more-section: legal` |
| App & Privacy | Share Care Pass | `health-section: care-pass` |

Search must find profile/dog, avatar/photo, caregiver/helper/team, supplies/travel, story/progress, adventure, guide/help, settings, privacy/export/delete, legal, and vet report/care pass synonyms. Empty query returns grouped directory order; no results returns a plain empty result. **Share Care Pass** returns `health-section: care-pass`; Diet is absent from More. No launch/provider QA row is consumer-visible. Add a route-table test proving all six legacy standalone inputs normalize to their More sections and Back preserves the More parent; only WoofGuide's one printable prompt of at most 280 characters and Legal's `doc=privacy|terms` survive, exactly as frozen by Slice 1.

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/moreDirectory.test.ts \
  artifacts/woofwatcher-mobile/lib/moreSectionRouting.test.ts \
  artifacts/woofwatcher-mobile/lib/moreScreenContract.test.ts
```

Expected: FAIL because the directory/contract files do not exist and the current root is a launch dashboard.

- [ ] **Step 2: Implement typed directory normalization and search**

Normalize query with lowercase, whitespace collapse, and punctuation removal; match label/keywords without changing result group order. Convert both intent kinds through `resolveCanonicalDestination`; reject any More intent whose section is not in the amended closed enum. Unavailable rows stay visible, announce `Unavailable`, and display their exact reason instead of navigating.

- [ ] **Step 3: Build the More root and modify Slice-1's router in place**

`MoreRootScreen` renders title, visible search, grouped rows, results, and no provider console. `MoreSectionRouter` continues to consume only normalized `MoreSection` and the exact nine bounded section components created by Slice 1. Add the searchable/root and read-only props without moving functional UI back into any route file. Dog Profile and Avatar Studio therefore open `/more?section=dog-profile|avatar-studio`, not `/profile` or `/portrait`; Care Pass opens canonical Health.

- [ ] **Step 4: Preserve extracted Pack/Story state and remove duplicate owners**

Keep `PACK_SUPPLIES_KEY` and `TRAVEL_BAG_KEY` serialization unchanged and prove saved data survives route rename/reload. Keep Story/progress/adventure data in `StoryProgressScreen`. Remove More's inline Dog Profile editor, Diet editor, Care Pass generator, launch command hub, provider QA panels, Career-first dashboard, and visible Add Pet action. The unavailable row says `One dog is supported in this build. Multi-dog care is not available yet.`

- [ ] **Step 5: Preserve truthful Avatar and local caregiver copy**

Avatar Studio row/copy uses Slice 0's manual template/photo-reference language. Care Team says `People and roles are local household labels for coordination; they are not signed-in accounts or enforced permissions.` Under newer-version protection, Profile, Avatar, Care Team, Supplies/Travel, Story-progress edits, and Settings mutations are marked disabled; last-supported data, Adventure/WoofGuide/Legal, search, and Privacy & Data remain reachable. Do not re-own the Privacy callback here: the already-wired `PrivacyDataScreen` calls Home Task 2's `getProtectedCareEnvelopeRecovery()`. For `exact-backup` it exports `backup.utf8Bytes` with the protected filename/MIME before offering reset; for `exact-unavailable` it disables export and shows the provider/conflict-specific update/support/separately-confirmed-reset message. It says the future document was not interpreted and must never pass exposed/default `state` to the normal exporter as a future-version backup. No search result or secondary screen implies cloud sync, invites, live AI, payments, or push delivery.

- [ ] **Step 6: Add the More route/component and exact-export harness**

Pure suites inject normal, empty-search, no-results, unavailable-multi-dog, persisted supplies/travel, provider-disabled, and newer-version fixtures and assert directory decisions, typed destinations, and read-only policy only. Extend `E2E_SCOPE=more` as the executable JSX render/callback harness: operate the real keyboard/screen-reader-searchable field, search every synonym family, open each result, verify Back returns to More, load legacy `/profile`/`portrait`/`adventure`/`woofguide`/`privacy`/`legal` and assert More remains selected, verify direct `/pack` and `/story` redirects preserve item IDs, reload supplies/travel fixtures, and reach Privacy/export/delete in one More-root action. With newer-version storage, snapshot the raw value, attempt each ordinary section mutation through real controls, prove no callback changes storage or emits success, export the protected envelope and compare exact bytes before reset, and verify explicit last-supported/future-uninterpreted update/reset/support guidance.

- [ ] **Step 7: Verify and commit More**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/moreDirectory.test.ts \
  artifacts/woofwatcher-mobile/lib/moreScreenContract.test.ts \
  artifacts/woofwatcher-mobile/lib/moreSectionRouting.test.ts \
  artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts \
  artifacts/woofwatcher-mobile/lib/packSupplies.test.ts \
  artifacts/woofwatcher-mobile/lib/travelBag.test.ts \
  artifacts/woofwatcher-mobile/lib/avatarStudio.test.ts \
  artifacts/woofwatcher-mobile/lib/protectedCareEnvelope.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run typecheck
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run smoke:web
```

Run `E2E_SCOPE=more node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run e2e:web`. Expected: tests, typecheck, exact-export render/wiring, search-to-route behavior, persisted Pack data, compatibility redirects, and truthful protected-envelope privacy recovery PASS.

```bash
git diff --check
git add -- artifacts/woofwatcher-mobile/lib/moreDirectory.ts artifacts/woofwatcher-mobile/lib/moreDirectory.test.ts artifacts/woofwatcher-mobile/lib/moreScreenContract.ts artifacts/woofwatcher-mobile/lib/moreScreenContract.test.ts artifacts/woofwatcher-mobile/components/more/MoreRootScreen.tsx artifacts/woofwatcher-mobile/components/more/MoreSearch.tsx artifacts/woofwatcher-mobile/components/more/MoreGroup.tsx artifacts/woofwatcher-mobile/components/more/MoreDestinationRow.tsx artifacts/woofwatcher-mobile/components/more/DogProfileScreen.tsx artifacts/woofwatcher-mobile/components/more/AvatarStudioScreen.tsx artifacts/woofwatcher-mobile/components/more/AdventureScreen.tsx artifacts/woofwatcher-mobile/components/more/WoofGuideScreen.tsx artifacts/woofwatcher-mobile/components/more/SettingsScreen.tsx artifacts/woofwatcher-mobile/components/more/PrivacyDataScreen.tsx artifacts/woofwatcher-mobile/components/more/LegalScreen.tsx artifacts/woofwatcher-mobile/components/more/MoreSectionRouter.tsx artifacts/woofwatcher-mobile/lib/moreSectionRouting.test.ts artifacts/woofwatcher-mobile/components/more/CareTeamSuppliesScreen.tsx artifacts/woofwatcher-mobile/components/more/StoryProgressScreen.tsx artifacts/woofwatcher-mobile/app/'(tabs)'/more.tsx artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs
git diff --cached --check
git commit -m "feat: replace More with a searchable directory"
```

---

### Task 5: Dog-Name Setup, Three-Step Introduction, and Permanent Five-Tab Help

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/setupExperience.ts`
- Create: `artifacts/woofwatcher-mobile/lib/setupExperience.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/deviceLocaleContext.ts`
- Create: `artifacts/woofwatcher-mobile/lib/deviceLocaleContext.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/howWoofWatcherWorks.ts`
- Create: `artifacts/woofwatcher-mobile/lib/howWoofWatcherWorks.test.ts`
- Create: `artifacts/woofwatcher-mobile/components/more/HowWoofWatcherWorksScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/setupWizard.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/setupWizard.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/setup.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/firstUseIntroduction.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/firstUseIntroduction.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/navigationOwnership.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/moreDirectory.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/moreDirectory.test.ts`
- Modify: `artifacts/woofwatcher-mobile/components/more/MoreSectionRouter.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/moreSectionRouting.test.ts`
- Modify: `artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**

```ts
export interface MinimalSetupDraft {
  dogName: string;
  breed?: string;
  weight?: string;
  weightUnit?: string;
  careFocus?: string;
  primaryVet?: string;
  caregiver?: { name: string; role?: string | null };
  primaryFood?: string;
  normalPortion?: string;
  mealSchedule?: string;
  routineStarter?: { type: string; label: string; time: string };
}

export type MinimalSetupValidation =
  | { ok: true; dogName: string }
  | { ok: false; field: "dogName"; message: "Enter your dog's name to finish setup." };

export function validateMinimalSetup(input: MinimalSetupDraft): MinimalSetupValidation;
export function applyMinimalSetup(doc: CareDoc, input: MinimalSetupDraft): CareDoc;

export interface DeviceLocaleContext {
  locale: string;
  timeZone: string;
}

export function readDeviceLocaleContext(
  dateTimeFormat?: typeof Intl.DateTimeFormat,
): DeviceLocaleContext;

export type HowTab = "home" | "log" | "plans" | "health" | "more";

export interface HowWoofWatcherWorksItem {
  tab: HowTab;
  label: "Home" | "Log" | "Plans" | "Health" | "More";
  body: string;
  actionLabel: string;
  destination: CanonicalDestination;
}

export const HOW_WOOFWATCHER_WORKS_ITEMS: readonly HowWoofWatcherWorksItem[];

export interface InstructionAcceptanceCase {
  tab: HowTab;
  instructionLabel: HowWoofWatcherWorksItem["label"];
  destination: CanonicalDestination;
  requiredVisibleLabels: readonly string[];
}

export const INSTRUCTION_ACCEPTANCE_MATRIX: readonly InstructionAcceptanceCase[];
```

Extend Slice 1's closed `MoreSection` with `"how-it-works"`. `resolveCanonicalDestination({ pathname: "/more", params: { section: "how-it-works" } })` keeps More selected; unknown values still fall back calmly. Add this exact App & Privacy directory row:

| Row | Keywords | Typed intent |
| --- | --- | --- |
| How WoofWatcher works | `help`, `instructions`, `tabs`, `home`, `log`, `plans`, `health`, `more` | `more-section: how-it-works` |

The five help items use these promises and canonical roots: Home — `See what is happening now, what care is next, and quick logging.` → `/`; Log — `Record care, finish active sessions, and open History to correct entries.` → `/log`; Plans — `Schedule daily routines and events, then review Day, Week, or Month.` → `/calendar`; Health — `Review non-diagnostic alerts, trends, Records, Dog ID, and Care Pass.` → `/health`; More — `Manage Dog Profile, local care-team labels, app settings, help, and Privacy & Data.` → `/more`. The screen offers labeled **Open Home/Log/Plans/Health/More** controls from those typed destinations.

- [ ] **Step 1: Make dog-name-only completion red**

Replace setup tests that require profile, diet, routine, caregiver, or household completion. Assert a trimmed `dogName: " Phoenix "` alone returns `{ ok: true, dogName: "Phoenix" }`, changes only `profile.name`/`profile.publicLabel`, and routes Home; no nonexistent completion field or storage key is introduced. Blank name is the only blocking error. For each supported optional field in `MinimalSetupDraft`, assert a visible **Skip for now** path and prove skipping preserves the existing neutral value—no invented food, medication, health status, caregiver, schedule, locale, or timezone. Valid optional breed/weight/unit/care focus/vet/caregiver/diet/routine values save to their exact existing `CareDoc` fields through current strict parsers and remain editable later. The setup does not render or accept photo, birth date, sex, allergies, medications, or persisted locale/timezone because the current schema has no such owners; it directs people to actual later editors only where one exists and makes no “saved for later” claim for unsupported data. Under newer-version protection, **Save name** is disabled before `updateCareDoc`.

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/setupExperience.test.ts \
  artifacts/woofwatcher-mobile/lib/setupWizard.test.ts \
  artifacts/woofwatcher-mobile/lib/deviceLocaleContext.test.ts
```

Expected: FAIL because setup currently requires multiple readiness sections.

- [ ] **Step 2: Implement minimal setup without deleting optional editors**

Make `validateMinimalSetup` the only completion gate. `applyMinimalSetup` trims the name, maps only supplied and validated fields to the existing owners (`profile.breed`, `profile.weight`, `profile.careFocus`, `profile.primaryVet`, `caregivers`, `dietProfile`, and `routines`), and preserves every unrelated field. Weight requires one strict positive amount plus the existing supported unit; a caregiver requires a nonblank name and stores a trimmed role or the existing `"Caregiver"` fallback; a routine requires a normalized supported type, nonblank label, and strict time; and a supplied portion uses Slice 0's full-string amount/unit parser. Invalid optional input stays in its editor with field copy or may be explicitly skipped; it is never guessed or silently persisted. `readDeviceLocaleContext` is a real, separately tested adapter around `Intl.DateTimeFormat().resolvedOptions()` used only to localize the setup's existing weight/routine-time presentation; locale/timezone are not persisted into `CareDoc`. It trims resolved values and falls back exactly to `{ locale: "en-US", timeZone: "UTC" }` for a missing/throwing formatter. Remove required progress percentages, `householdReady`, proof-mission controls, unsupported input controls, and copy claiming one complete profile/diet/routine/caregiver pass is necessary. Keep supported optional sections clearly labeled **Optional** with **Skip for now**, and return to Home after name save.

- [ ] **Step 3: Verify the approved three-step first-use introduction**

Run Home's `FIRST_USE_INTRO_STEPS` tests and add integration fixtures proving setup completion may show at most its three exact steps; **Next**, **Done**, and **Dismiss introduction** are visible buttons; it never requires swipe or blocks tab navigation; and Done/Dismiss stores the existing `woofwatcher.homeWelcomeDismissed.v1` key. Seed that existing key as `"true"` and prove the introduction never reappears across reload. Do not create a replacement dismissal key.

- [ ] **Step 4: Add the permanent help owner and searchable row**

Add `"how-it-works"` to `MoreSection`, the ownership normalizer, More directory, search, and `MoreSectionRouter`; render `HowWoofWatcherWorksScreen` as the tenth bounded More component. Test exact five-item order/copy/actions, More parent selection, Back to More, keyboard/screen-reader order, search hits for every keyword above, and plain no-results behavior. The help screen is permanent even after first-use dismissal.

- [ ] **Step 5: Freeze every instruction against executable acceptance labels**

Populate `INSTRUCTION_ACCEPTANCE_MATRIX` with all five items. Import Slice 2's `HOME_ACCEPTANCE_LABELS` and use `HOME_ACCEPTANCE_LABELS.nextCare`/`.allLogging` directly for Home; do not restate those literals in this module. Do the same with the exported owner-label constants/fields for Log, Plans, Health, and More: Log `History`, `More care types`; Plans `Add routine`, `Day`, `Week`, `Month`; Health `Records`, `Dog ID`, `Care Pass`; More `Dog Profile`, `How WoofWatcher works`, `Privacy & Data`. For each case, assert exact label/destination, referential/value parity with its owning screen contract, and failure when help names a tab/control/outcome absent from that contract. Pure tests establish parity data only; they do not claim JSX.

- [ ] **Step 6: Run the setup/help JSX render and callback harness**

Add `E2E_SCOPE=setup-help`. Against the exact export, complete setup with dog name only, exercise every optional Skip path, verify neutral Home/Plans/Health states, traverse/dismiss the three steps without swiping, reload and prove no reappearance, search/open permanent help, activate all five canonical actions, and verify Back/selected-parent behavior. Repeat with a future-version envelope and prove setup save is disabled while protected-envelope Privacy recovery remains reachable.

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/setupExperience.test.ts \
  artifacts/woofwatcher-mobile/lib/setupWizard.test.ts \
  artifacts/woofwatcher-mobile/lib/deviceLocaleContext.test.ts \
  artifacts/woofwatcher-mobile/lib/firstUseIntroduction.test.ts \
  artifacts/woofwatcher-mobile/lib/howWoofWatcherWorks.test.ts \
  artifacts/woofwatcher-mobile/lib/moreDirectory.test.ts \
  artifacts/woofwatcher-mobile/lib/moreSectionRouting.test.ts \
  artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run typecheck
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run smoke:web
E2E_SCOPE=setup-help \
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run e2e:web
```

Expected: setup/domain tests, instruction parity, typecheck, export, and real setup/introduction/permanent-help wiring PASS.

```bash
git diff --check
git add -- artifacts/woofwatcher-mobile/lib/setupExperience.ts artifacts/woofwatcher-mobile/lib/setupExperience.test.ts artifacts/woofwatcher-mobile/lib/deviceLocaleContext.ts artifacts/woofwatcher-mobile/lib/deviceLocaleContext.test.ts artifacts/woofwatcher-mobile/lib/howWoofWatcherWorks.ts artifacts/woofwatcher-mobile/lib/howWoofWatcherWorks.test.ts artifacts/woofwatcher-mobile/components/more/HowWoofWatcherWorksScreen.tsx artifacts/woofwatcher-mobile/lib/setupWizard.ts artifacts/woofwatcher-mobile/lib/setupWizard.test.ts artifacts/woofwatcher-mobile/app/setup.tsx artifacts/woofwatcher-mobile/lib/firstUseIntroduction.ts artifacts/woofwatcher-mobile/lib/firstUseIntroduction.test.ts artifacts/woofwatcher-mobile/lib/navigationOwnership.ts artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts artifacts/woofwatcher-mobile/lib/moreDirectory.ts artifacts/woofwatcher-mobile/lib/moreDirectory.test.ts artifacts/woofwatcher-mobile/components/more/MoreSectionRouter.tsx artifacts/woofwatcher-mobile/lib/moreSectionRouting.test.ts artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
git diff --cached --check
git commit -m "feat: add minimal setup and permanent help"
```

---

### Task 6: Cross-Workflow Instruction, Exact-Export, Accessibility, and Native Gate

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/coreWorkflowAcceptance.ts`
- Create: `artifacts/woofwatcher-mobile/lib/coreWorkflowAcceptance.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/quickLogWorkflow.typecheck.ts` through the mobile source compiler
- Test: `artifacts/woofwatcher-mobile/scripts/verify-playwright-browser.test.mjs` from Slice 2
- Test: `scripts/mobile-beta-doctor.test.mjs` from Slice 2
- Test: `scripts/native-qa-tooling-doctor.test.mjs` from Slice 2
- Modify: `artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs`
- Modify: `artifacts/woofwatcher-mobile/scripts/smoke-runtime-preview.js`
- Modify: `artifacts/woofwatcher-mobile/scripts/live-preview-handoff-proof.js`
- Modify: `docs/QA_TEST_PLAN.md`
- Modify: `docs/release/MOBILE_RELEASE_RUNBOOK.md`
- Modify: `docs/design/UI_IMPLEMENTATION_NOTES.md`
- Create: `docs/qa/2026-08-05-core-workflows-evidence.md`

**Interfaces:**

```ts
export interface TwoTapAcceptanceCase {
  id: "water" | "walk-start" | "walk-finish" | "alone-start" | "alone-finish" | "next-plan" | "health-status" | "history" | "dog-profile" | "privacy-data";
  owner: PrimaryTab;
  rootLabel: string;
  expectedDestination: CanonicalDestination | MoreDestinationIntent;
  safeImmediateMutation: boolean;
}

export const TWO_TAP_ACCEPTANCE_CASES: readonly TwoTapAcceptanceCase[];
```

- [ ] **Step 1: Write failing cross-workflow parity tests**

Build the exact ten-case matrix from the approved spec. Assert each task needs one owner-tab press plus at most one labeled root action; no case counts Back, scrolling, long press, unlabeled icon, swipe, or center-paw state. Cross-check Task 5's five-tab `INSTRUCTION_ACCEPTANCE_MATRIX` so active instructions use Home/Log/Plans/Health/More and match existing labels/routes. This pure test proves the matrix only; Step 3's exact export proves rendered reachability.

Run:

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/coreWorkflowAcceptance.test.ts
```

Expected: FAIL because the executable acceptance matrix does not exist.

- [ ] **Step 2: Make exact-export fixture storage explicit**

In `e2e-web-workflows.mjs`, require the declared Slice-2 Playwright runner; accept `E2E_SCOPE=all|home|log|plans|health|more|setup-help`; and use `BASE_URL` supplied by `run-e2e-web.mjs`. Add helpers that wipe, seed, and read the exact `woofwatcher.v2.state` value. Every seeded fixture includes `dataVersion`, preserves Slice-0 migration semantics, and reloads before assertions. Include a real unsupported-newer-version envelope—not only a mocked prop—then preserve its raw storage string and UTF-8 bytes for comparison. Compare stored IDs/types/details/recorded roles/correction issues rather than toast text alone. A missing package is `BROWSER_RUNNER_UNDECLARED` and fails implementation; only a declared runner with no launchable bundled/explicit executable may report `BROWSER_UNAVAILABLE`.

- [ ] **Step 3: Execute the complete rendered matrix**

At 390×844 and 1365×700, run `E2E_SCOPE=all` against one fresh exact export. Verify five-tab selected-parent behavior; Home measured-chrome hierarchy/control inventory; all seven Log actions, Details, secondary-only More-care-types plus full composer, persistence, recorded attribution, correction, Delete, exact Undo; Plans empty/real type-safe completion and exact ranges/order; lane-specific Health evidence, Records/Dog ID/Care Pass; More search/privacy; dog-name-only setup, three-step introduction, permanent five-tab help; Back/Cancel; keyboard order; and no app-origin console errors. With the real newer-version envelope, attempt create/update/delete across Log, routine/event edits in Plans, record/report mutations in Health, setup save, and ordinary More-section mutations; assert the raw stored envelope remains byte-identical, no success feedback/history appears, last-supported views work, and update plus Privacy & Data guidance remains visible. Export the protected envelope and assert exact bytes **before** reset; do not run reset in this non-destructive all-scope gate.

- [ ] **Step 4: Run all automated repository gates**

Run:

```bash
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs run doctor:mobile-beta
node --test scripts/mobile-beta-doctor.test.mjs scripts/native-qa-tooling-doctor.test.mjs artifacts/woofwatcher-mobile/scripts/verify-playwright-browser.test.mjs
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs run test:focused
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile exec tsc -p tsconfig.json --noEmit --pretty false
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs run typecheck
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs run build:ci
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run smoke:web
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run smoke:runtime
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run proof:live-preview
E2E_SCOPE=all node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run e2e:web
```

Expected: `READY_FOR_EXPORT`; pinned-pnpm and five-tab doctor regressions PASS; the explicit mobile source compiler includes `quickLogWorkflow.typecheck.ts`, consumes all three transport-field `@ts-expect-error` directives, and verifies the derived Slice-0 amount shape; complete focused suite, workspace typecheck, API/PWA/mockup/mobile builds, fresh Expo export, declared-browser self-check, exact JSX render/callback scopes, asset audit, canonical and legacy runtime routes, and handoff routes PASS. If the validator reports only `BROWSER_UNAVAILABLE`, the non-rendered checks may pass and implementation may finish, but every JSX scope remains PENDING and the consolidated merge gate stays blocked.

- [ ] **Step 5: Run physical iOS and Android core-workflow checks**

On the recorded Release-build baselines, run the ten two-tap cases, all seven safety actions, Walk/Alone process-death recovery, History correction/Delete cancellation, Plans empty/real completion, Health evidence, Records attachment open/share, More search/help, minimal setup/introduction, and Privacy protected export/delete. Verify VoiceOver/TalkBack visual order; iOS Accessibility Large and accessibilityExtraExtraExtraLarge; Android fontScale 2.0/largest display; 48×48 targets; useful roles/hints; no modal focus trap. Native report/attachment recipient-open evidence must reference Slice 0's actual proof. If physical devices, signing, accessibility lab access, or owner access are unavailable, finish implementation/automated work and list them together under one final merge/release blocker.

- [ ] **Step 6: Run the external usability and store-screenshot merge gates**

These are downstream evidence gates against the exact release candidate, never prerequisites for Tasks 1–5 and never browser-automation claims. Run the observed protocol with five first-time participants: the owner; one adult aged 60+; one responsible caregiver aged 13–17 with guardian permission; one self-described low-technical-confidence adult; and one additional target caregiver. A person may satisfy multiple demographics, but the set still contains five distinct participants. From the same seeded, previously unseen build and without revealing navigation, record per-participant elapsed time, wrong turns, facilitator hints, data errors, recovery outcome, and accessibility notes for:

1. Presence, next care, and attention state within 15 seconds.
2. Water plus one detailed Meal/Potty log within 45 seconds.
3. Walk start, active state, and Finish within 30 seconds.
4. Find/correct an older log within 60 seconds.
5. Find a health record and Care Pass preview within 45 seconds.
6. Find Dog Profile and Privacy/export/delete within 45 seconds each.
7. Recover from one mistaken tap within 15 seconds.

Acceptance requires at least 4/5 to finish **every** task within its limit with no facilitator hint; all five to finish logging, active-session, correction, and privacy safety tasks with no unrecovered data error; and both the older and younger participant to finish those safety tasks. Any misleading label, repeated wrong turn, accidental medication completion, inaccessible text/control, or required hidden gesture blocks acceptance regardless of time.

Regenerate the complete App Store and Google Play screenshot sets from that same release-candidate build after the five-tab renovation. Record each asset's store/platform slot, locale, device dimensions, fixture, source screen, capture timestamp, byte hash, build/tree SHA, and reviewer. Visually verify **Home, Log, Plans, Health, More** ownership, truthful local-only/provider copy, current dog/fixture data, accessible readable text, and the absence of retired Plan/Today/Pack/Story tabs, sample care, fake health/provider results, debug/QA panels, or unshipped capabilities. Stale assets or captures from a different tree fail the gate. Store screenshots and the usability sessions require human/device evidence; browser captures cannot satisfy them.

If either protocol cannot run, record it alongside device/signing/accessibility/owner evidence as one consolidated merge/release blocker. Do not block implementation commits and do not mark the corresponding evidence PASS.

- [ ] **Step 7: Update active instructions and record exact evidence**

Document what Setup, Home, Log, Plans, Health, and More actually do, including dog-name-only completion, the permanent help location, local caregiver labels/recorded roles, in-app-only reminders, Health's non-diagnostic boundary, More's unavailable multi-dog row, source-aware protected-envelope recovery, and canonical report ownership. Do not rewrite historical handoffs. Record exact commit/tree SHA, export hash, declared Playwright/browser versions and executable source, device/OS/build, fixture hashes, stored field assertions, screenshots/video, accessibility results, the five-person raw task/timing/wrong-turn/hint/error/recovery table, the regenerated store-screenshot manifest/hashes/review, and the consolidated external blocker in `docs/qa/2026-08-05-core-workflows-evidence.md`.

- [ ] **Step 8: Final claim/path/diff audit and commit**

Run:

```bash
git diff --check
rg -n "Tap saves\. Hold|Long press for details|Sample Day|Active daily|Well hydrated|Share\.share\(\{ url|Add pet|Launch Command Hub" artifacts/woofwatcher-mobile docs/QA_TEST_PLAN.md docs/release/MOBILE_RELEASE_RUNBOOK.md docs/design/UI_IMPLEMENTATION_NOTES.md
rg -n "screens/RecordsScreen|screens/StoryProgressScreen|health/records\.tsx" artifacts/woofwatcher-mobile docs/superpowers/plans
```

Expected: no unstaged whitespace errors; no retired consumer claim/path; any legitimate historical/test-fixture match is reviewed and excluded from active consumer copy. If declared-browser rendered scopes, physical devices, signing, accessibility, five-person usability, regenerated store screenshots, or owner access are unavailable, mark the slice implementation and available automated gates complete but merge-blocked on the single consolidated external-evidence gate; never substitute browser evidence.

```bash
git add -- artifacts/woofwatcher-mobile/lib/coreWorkflowAcceptance.ts artifacts/woofwatcher-mobile/lib/coreWorkflowAcceptance.test.ts artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs artifacts/woofwatcher-mobile/scripts/smoke-runtime-preview.js artifacts/woofwatcher-mobile/scripts/live-preview-handoff-proof.js docs/QA_TEST_PLAN.md docs/release/MOBILE_RELEASE_RUNBOOK.md docs/design/UI_IMPLEMENTATION_NOTES.md docs/qa/2026-08-05-core-workflows-evidence.md
git diff --cached --check
git commit -m "docs: record core workflow verification"
```

---

## Self-Review Record

- Spec coverage: Log, Plans (including four-zone subprocess proof), Health/Records, More, schema-real minimal Setup, the three-step introduction, and permanent five-tab help each have pure decision/parity coverage plus a concrete exact-export JSX render/callback scope, commit boundary, and native acceptance path. The five-person protocol and exact-build regenerated store screenshots are explicit external merge gates.
- Safety preservation: seven primary actions plus all legacy care types/deep links, provider-owned local attribution, newer-version read-only protection, routine-ID-first one-entry/one-routine completion, exact local health windows, exact IDs, local dates, correction issues, complete reports, file sharing, attachment lifecycle, and persisted storage keys are explicit.
- Slice-1 path alignment: implementation consumes plan commit `c6e243c`. Health modifies `HealthSectionRouter.tsx` and `RecordsScreen.tsx`; More modifies `MoreSectionRouter.tsx` and the nine Slice-1 bounded components, then Task 5 adds the single tenth `HowWoofWatcherWorksScreen`. Compatibility route files remain typed replace-only bridges.
- Navigation typing: models use `CanonicalDestination`, `HealthSection`, amended `MoreSection`, or the closed non-standalone `MoreDestinationIntent`; no model field is `route: string`.
- Current-source path check: every base-owned Modify/Test path exists on audited plan base `c6e243c`; other Modify/Test paths are explicit outputs of the Slice-0/1/2 implementation prerequisites, including `quickLogWorkflow.typecheck.ts`, protected-envelope, and first-use modules. Every slice-owned absent path is explicitly Create. `lib/care-domain/test/care-domain.test.ts` is the verified current events test path.
- Type consistency: the non-excluded `quickLogWorkflow.typecheck.ts` is explicitly compiled in Core Tasks 1 and 6; it carries forward `CareEntryCreateInput` transport rejection and derived `ParsedStrictPositiveAmountWithUnit`. `LogRouteIntent`, `PlansNextCare`, `HealthEvidenceLane`, `HealthEvidenceWindow`, `MoreDestinationIntent`, and `TwoTapAcceptanceCase` use one declaration and spelling throughout.
- Placeholder scan: this plan contains no deferred implementation marker; unavailable declared-browser/device/signing/accessibility/usability/store-screenshot/owner access is consolidated as an explicit final evidence blocker, not a reason to claim a pass. `BROWSER_UNAVAILABLE` leaves rendered scopes pending and never becomes JSX proof.
