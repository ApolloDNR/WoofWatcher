# WoofWatcher Home Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give WoofWatcher one truthful shared Quick Log authority and rebuild Home so a caregiver can identify current status, next care, safe logging actions, health attention, and recent care in one predictable first viewport.

**Architecture:** Slice 2 is based on the implemented Slice-0 validation/data services and Slice-1 five-tab/section-router shell after their automated gates pass; unavailable physical-device, signing, and owner evidence remains a final merge/release gate rather than an implementation dependency. A pure `quickLogWorkflow` module decides what every primary care action may do and builds only finalized mutations; a root-level `CareLogWorkflowProvider` owns one captured action clock, same-turn intent locking, atomic update receipts, exact-entry Undo, feedback, and storage-risk semantics across Home, Log, and `/fastlog`. Home becomes a composition shell over a pure `HomeOverviewModel`, focused components, the existing fixed-room/spacer geometry, and typed `CanonicalDestination` values from Slice 1.

**Tech Stack:** TypeScript 5.9, Expo SDK 54, Expo Router 6, React Native 0.81, Reanimated 4, Node 24 built-in test runner, Playwright against the exact Expo web export, pnpm 10.24.0.

## Global Constraints

- Implementation prerequisite: rebase onto the production changes from the Slice-0 truth/data and Slice-1 universal-shell plans and require their focused tests, typecheck, build/export, and automated route gates to pass before Task 0. Physical iOS/Android recipient-open, accessibility, signing, owner evidence, and a launchable browser executable (after its package is declared) may remain pending; carry all unavailable external evidence forward as one explicit final merge/release blocker and do not stop downstream implementation for it.
- The prerequisite tree must contain `lib/navigationOwnership.ts`, `components/health/HealthSectionRouter.tsx`, `components/health/RecordsScreen.tsx`, `components/more/MoreSectionRouter.tsx`, `components/more/PrivacyDataScreen.tsx`, `components/more/CareTeamSuppliesScreen.tsx`, and `components/more/StoryProgressScreen.tsx`; do not create nested `health/records.tsx`, `screens/RecordsScreen.tsx`, or `screens/StoryProgressScreen.tsx` alternatives.
- Consume Slice 1's exported `CanonicalDestination`, `HealthSection`, `MoreSection`, and `resolveCanonicalDestination`; no Home model or component may expose a raw route string.
- Keep Expo SDK 54, Expo Router 6, React Native 0.81, `woofwatcher.v2.state`, existing entry shapes, and the current local-first/provider boundaries.
- The seven primary Log actions are Meal, Water, Potty, Walk, Medication, Alone Time, and Note. This primary union never removes the other existing care types or their deep links.
- Home's compact actions are Water, Meal, Potty, and Walk, in that order, followed by one visible **All logging** action. Every compact care action also has a visible **Details** control.
- No required behavior depends on long press, swipe, an unlabeled icon, or the retired center paw. Remove Home's Avatar Studio long press and unlabeled wand; Avatar Studio remains a labeled More destination.
- `Logging as` is one deterministic local-household attribution, never an authenticated account identity: select the first caregiver whose trimmed local name is non-empty, carry that same caregiver's trimmed role or `null`, and use the explicit empty fallback `Local caregiver`/`null`. Home, Log, `/fastlog`, finalized mutations, feedback, and History must all consume that provider-owned value; none may prefer `useGetMe().user.displayName` or derive its own fallback.
- A saved action keeps existing caregiver, household visibility, trust/proof, routine matching, meal lifecycle, correction/audit, and session fields. Do not invent authenticated identity or permission claims.
- Every optimistic save is described as local. `save-failed`, `read-failed`, or `reset` storage state must say the entry may not survive restart; `newer-version` is fail-closed read-only state and blocks the mutation before it starts. In that state the last supported snapshot and entries remain viewable, the future document is not interpreted, and Privacy & Data exports the protected raw envelope rather than serializing default/exposed state. No UI says “durable,” “synced,” “shared,” or “future-version backup” without the corresponding bytes or outcome proof.
- Undo always targets the exact ID returned by `addEntry`. A failed `deleteEntry` keeps the feedback and Undo retry visible.
- The existing fixed-room contract in `homeFixedHeroLayout.ts`, `homeSceneReady.ts`, and `LivingPhoenixRoom.tsx` stays intact unless a new failing geometry test proves a minimal change is required.
- Minimum touch target is 48×48 logical pixels; body text targets 16px; secondary text is at least 14px; controls remain labeled at accessibility text sizes.
- Every production edit starts with a failing behavioral test, observes the expected failure, implements the smallest change, and reruns the focused tests before commit.
- Use the pinned package manager invocation `node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs` from the repository root.
- Execute the plan in a dedicated clean worktree. Before Task 0, require `test -z "$(git status --porcelain)"`; if it is non-empty, stop rather than mixing another worker's changes. Before every commit run `git diff --check`, stage only the exact paths named by that task (never a broad product directory), then run `git diff --cached --check` before committing.
- Production deployment is outside this plan. Browser evidence does not replace the physical iOS/Android gates.

---

### Task 0: Type-Safe Shared Routine Matching Prerequisite

**Files:**
- Modify: `lib/care-domain/src/routine-board.ts`
- Modify: `lib/care-domain/test/routine-board.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/localCalendar.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/inputValidation.test.ts`

**Interfaces:**

`deriveRoutineBoard` remains the single matcher consumed by Quick Log, Home, and Plans. Its completion pass uses one deterministic candidate order and one consumed-entry-ID set; no screen implements a second matcher.

For each visible, finite-timestamp entry on the routine's local day and at or before injected `now`:

1. A non-empty `details.routineId` is authoritative. It may complete only the routine with that exact ID **and** only when `normalizeCareEventType(entry.type, entry.details) === normalizeCareEventType(routine.type)`. A missing ID target, type mismatch, or already-consumed exact target completes nothing; the linked entry is never reassigned through title or time fallback.
2. Only an entry with no routine ID may fall back. It must have the same normalized type and fall inside the existing inclusive `[-DUE_WINDOW_MINUTES, +FUZZY_MATCH_WINDOW_MINUTES]` window.
3. Same-title preference is only a tie-break inside that same type/window, never an out-of-window match. Remaining ties sort by absolute minute distance, then entry timestamp, then entry ID and routine ID lexically so input-array order cannot change the result.
4. Each entry ID completes at most one routine. Future entries, a previous/next local day, invalid timestamps, and invisible entries complete nothing.

- [ ] **Step 1: Add the red matcher matrix before any Quick Log/Home work**

Add Breakfast/Dinner Meal and morning/evening Medication fixtures. Prove exact-ID same-type completion; exact-ID wrong-type completion of nothing; linked unknown-ID completion of nothing; no reassignment after an exact-ID mismatch; unlinked same-type matching only inside the inclusive window; out-of-window same-title rejection; future/surrounding-day rejection; and one-entry/one-routine consumption. Reverse routine and entry arrays and assert the same IDs complete.

Add a fixed-epoch local-day fixture keyed by `process.env.TZ` for `UTC`, `America/Los_Angeles`, `America/New_York`, and `Asia/Tokyo`. Each process asserts the exact expected local date/routine match for its zone. Set `TZ` before Node starts; never mutate it inside a running test process or rely on the implementer's host zone.

Run:

```bash
node --experimental-strip-types --test lib/care-domain/test/routine-board.test.ts
```

Expected: FAIL because the current fallback can complete an out-of-window title and does not enforce normalized type on an exact ID.

- [ ] **Step 2: Repair the shared matcher only**

Implement the ordered rules above in `routine-board.ts` using the existing local-day and parsed-time authorities. Preserve `needs-correction` items, status windows, V1 daily routine shape, and public `RoutineBoard` types.

- [ ] **Step 3: Verify the prerequisite and commit**

```bash
node --experimental-strip-types --test \
  lib/care-domain/test/routine-board.test.ts \
  artifacts/woofwatcher-mobile/lib/localCalendar.test.ts \
  artifacts/woofwatcher-mobile/lib/inputValidation.test.ts
TZ=UTC node --experimental-strip-types --test lib/care-domain/test/routine-board.test.ts
TZ=America/Los_Angeles node --experimental-strip-types --test lib/care-domain/test/routine-board.test.ts
TZ=America/New_York node --experimental-strip-types --test lib/care-domain/test/routine-board.test.ts
TZ=Asia/Tokyo node --experimental-strip-types --test lib/care-domain/test/routine-board.test.ts
```

Expected: PASS.

```bash
git diff --check
git add -- lib/care-domain/src/routine-board.ts lib/care-domain/test/routine-board.test.ts
git diff --cached --check
git commit -m "fix: make routine completion type safe"
```

---

### Task 1: Finalized Quick Log Decisions and Mutations

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/quickLogWorkflow.ts`
- Create: `artifacts/woofwatcher-mobile/lib/quickLogWorkflow.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/quickLogWorkflow.typecheck.ts`
- Test: `artifacts/woofwatcher-mobile/lib/inputValidation.ts` as the Slice-0 parser authority; do not reimplement it
- Test: `artifacts/woofwatcher-mobile/lib/inputValidation.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/quickLogEntry.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/quickLogEntry.test.ts`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx` for the transport-free public create type/signature only
- Test: `artifacts/woofwatcher-mobile/lib/walkSession.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/aloneTimeSession.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/mealOutcomeUpdate.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/pottyLogDetail.test.ts`

**Interfaces:**

In `context/CareContext.tsx`:

```ts
export type CareEntryCreateInput = {
  [K in keyof CareEntryMutableFields]: CareEntryMutableFields[K];
};
```

In `lib/quickLogWorkflow.ts`:

```ts
export const PRIMARY_QUICK_LOG_KINDS = [
  "meal", "water", "potty", "walk", "medication", "alone", "note",
] as const;

export const HOME_QUICK_LOG_KINDS = [
  "water", "meal", "potty", "walk",
] as const;

export type UniversalQuickLogKind = typeof PRIMARY_QUICK_LOG_KINDS[number];

export type QuickLogWorkflowMode =
  | "immediate-save"
  | "configured-confirmation"
  | "outcome-chooser"
  | "start-session"
  | "finish-session"
  | "return-outcome"
  | "medication-confirmation"
  | "note-composer"
  | "details";

// Import the completed Slice-0 parser. Its Task-3 contract names no exported
// result type, so derive one from the function rather than inventing a
// prerequisite symbol.
import { parseStrictPositiveAmountWithUnit } from "./inputValidation";
import type { QuickLogRoutine } from "./quickLogEntry";
import type {
  CareEntryCreateInput,
  CareEntryMutableFields,
  Entry,
} from "../context/CareContext";

export type ParsedStrictPositiveAmountWithUnit = NonNullable<
  ReturnType<typeof parseStrictPositiveAmountWithUnit>
>;

export interface ConfiguredMeal {
  food: string;
  portion: ParsedStrictPositiveAmountWithUnit;
}

export interface ConfiguredMedication {
  routineId: string;
  name: string;
  dose: string;
  time: string;
}

export interface QuickLogWorkflowContext {
  routines: readonly QuickLogRoutine[];
  entries: readonly Entry[];
  caregivers: readonly { name: string; role?: string | null }[];
  dietProfile: { primaryFood?: string | null; normalPortion?: string | null };
  actionNow: number;
}

export interface LocalCaregiverIdentity {
  name: string;
  role: string | null;
  source: "local-household" | "empty-fallback";
}

export const EMPTY_LOCAL_CAREGIVER_IDENTITY: LocalCaregiverIdentity = {
  name: "Local caregiver",
  role: null,
  source: "empty-fallback",
};

export function resolveLocalCaregiverIdentity(
  caregivers: readonly { name: string; role?: string | null }[],
): LocalCaregiverIdentity;

export interface QuickLogDecision {
  kind: UniversalQuickLogKind;
  mode: QuickLogWorkflowMode;
  primaryLabel: string;
  detailsLabel: "Details";
  canUndoAfterSave: boolean;
  configuredMeal?: ConfiguredMeal;
  medicationOptions?: readonly ConfiguredMedication[];
  activeEntryId?: string;
  reason?:
    | "missing-meal-configuration"
    | "requires-outcome"
    | "safety-critical"
    | "requires-content";
}

export type FinalizedCareInput =
  | { action: "water-refresh"; occurredAt?: number }
  | { action: "water-quantity"; occurredAt?: number; amount: number; unit: string }
  | { action: "meal-served"; occurredAt?: number; food: string; servedAmount: number; servedUnit: string; source: "configured" | "details" }
  | { action: "potty-outcome"; occurredAt?: number; outcome: PottyDetailOutcome; location?: PottyLocation; peeDetail?: PottyPeeDetail; stoolCondition?: PottyStoolCondition; stoolColor?: string; context?: PottyContext }
  | { action: "walk-start"; occurredAt?: number; routineId?: string; routineLabel?: string }
  | { action: "walk-finish"; occurredAt?: number; entryId: string; durationMinutes?: number; routeName?: string; distanceMiles?: number; dogInteractions?: number; socialOutcome?: string; note?: string }
  | { action: "alone-start"; occurredAt?: number }
  | { action: "alone-return"; occurredAt?: number; entryId: string; outcome: AloneTimeReturnOutcome; recoveryMinutes?: number; note?: string }
  | { action: "medication"; occurredAt?: number; medicationId?: string; medicationName: string; dose: string; outcome: "taken" | "skipped" }
  | { action: "note"; occurredAt?: number; text: string };

export type FinalizedCareMutation =
  | { kind: "create"; intentKey: string; entry: CareEntryCreateInput; inverse: { kind: "delete-created-entry" } }
  | { kind: "update"; intentKey: string; entryId: string; patch: Partial<CareEntryMutableFields> }
  | { kind: "blocked"; reason: string; message: string };

export function resolveQuickLogDecision(kind: UniversalQuickLogKind, context: QuickLogWorkflowContext): QuickLogDecision;
export function buildFinalizedCareMutation(input: FinalizedCareInput, context: QuickLogWorkflowContext & { caregiver: LocalCaregiverIdentity }): FinalizedCareMutation;
```

`CareEntryCreateInput` is declared/exported once beside `CareEntryMutableFields` in `CareContext.tsx`; the declaration is shown above to freeze its shape and is imported (not redeclared) by `quickLogWorkflow.ts`. Change the public `CareContextValue.addEntry` signature to `addEntry(entry: CareEntryCreateInput): string`. Because the type is mapped only from owner-mutable keys, compile-time negative fixtures using `syncStatus`, `syncError`, or `pendingSyncPatch` must fail. CareContext may attach its own transport state only after accepting the owner input; callers cannot provide it. `FinalizedCareInput` is the only generic quick-recorder build boundary. It is impossible to construct Potty, Medication, or Note mutations without their required values. Existing detailed care types continue through the detailed composer and existing `CareEventType` storage shape.

`resolveLocalCaregiverIdentity` trims local caregiver values, selects the first non-empty local name without sorting, and takes the role from that same record only. It never combines one caregiver's name with another caregiver's role and never reads auth data. With no valid local caregiver it returns `EMPTY_LOCAL_CAREGIVER_IDENTITY`; the fallback is a visible attribution limitation, not a claim that the signed-in person performed the care.

- [ ] **Step 1: Verify the prerequisite contracts before adding tests**

Run:

```bash
test -f artifacts/woofwatcher-mobile/lib/navigationOwnership.ts
test -f artifacts/woofwatcher-mobile/lib/inputValidation.ts
test -f artifacts/woofwatcher-mobile/components/health/HealthSectionRouter.tsx
test -f artifacts/woofwatcher-mobile/components/more/MoreSectionRouter.tsx
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts \
  artifacts/woofwatcher-mobile/lib/inputValidation.test.ts
```

Expected: every file exists and both prerequisite suites plus Task 0's matcher suite PASS. If an implementation path is missing, finish/rebase that implementation before continuing; pending external device/signing/owner evidence is recorded for the final gate and does not block this step.

- [ ] **Step 2: Freeze the Slice-0 parser dependency, then write the failing seven-action decision table**

Do not modify `inputValidation.ts`. First confirm its completed Task-3 function contract: decimal/fraction/mixed-fraction values with explicit supported singular/plural units parse completely; `1 1/2 cups` is `{ amount: 1.5, unit: "cup", canonical: "1.5 cup" }`; trailing prose (`1 cup trailing`), prefixes (`about 1 cup`), ranges (`1-2 cups`, `1 to 2 cups`), missing whitespace (`1cup`), unknown units, zero/negative values, and division by zero return `null`. Slice 0 does not promise a named result-type export, so Home must derive `ParsedStrictPositiveAmountWithUnit` from this function and compile the structural probe in Step 4.

Run:

```bash
rg -n '1 1/2 cups|1 cup trailing|1-2 cups|1 to 2 cups' artifacts/woofwatcher-mobile/lib/inputValidation.test.ts
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/inputValidation.test.ts
```

Expected: all four prerequisite fixture families are present and the Slice-0 parser suite PASS. If not, stop and finish/rebase Slice 0; do not patch or shadow its parser in this slice.

Table-test the following fixtures in `quickLogWorkflow.test.ts`:

| Kind/state | Exact decision |
| --- | --- |
| Water | `immediate-save`, primary `Refresh water`, Details |
| Meal with `primaryFood="Chicken & rice"`, `normalPortion="1 1/2 cups"` | `configured-confirmation`, summary names food and canonical `1.5 cup` |
| Meal missing food/portion or portion equal to zero, trailing/prefix prose, a range, or an unknown unit | `details`, reason `missing-meal-configuration`; no guessed save |
| Potty | `outcome-chooser`, no mutation |
| Walk with no open persisted session | `start-session`, primary `Start walk` |
| Walk with persisted `walkLifecycle="in-progress"` | `finish-session`, exact active entry ID |
| Alone with no open persisted session | `start-session`, primary `Start Alone Time` |
| Alone with persisted `aloneLifecycle="active"` | `return-outcome`, exact active entry ID |
| Medication | `medication-confirmation`; options include only valid-time medication routines; no option or outcome is selected |
| Note | `note-composer`, reason `requires-content` |

Add attribution fixtures in this same red suite: `[{ name: " Avery ", role: " Parent " }]` resolves to `Avery`/`Parent`; a blank first record followed by `Jordan`/`Helper` resolves to that second record; a valid first name with blank role resolves to that name/`null`; and an empty or all-blank array resolves exactly to `EMPTY_LOCAL_CAREGIVER_IDENTITY`. Pass an auth display name in the surrounding fixture and prove it has no input position and cannot change the result.

Run:

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/quickLogWorkflow.test.ts
```

Expected: FAIL because `quickLogWorkflow.ts` does not exist.

- [ ] **Step 3: Implement pure decisions with the persisted session helpers**

Use `findOpenWalkSession`, `findOpenAloneTimeSession`, `parseClockTime`, and Slice 0's `parseStrictPositiveAmountWithUnit`. A configured meal exists only when `dietProfile.primaryFood.trim()` is non-empty and `normalPortion` parses completely; use the returned canonical amount/unit, including a valid mixed fraction such as `1 1/2 cups`. Prefix/suffix prose, ranges, and unrecognized legacy units route to Details without guessing. Delete `quickLogEntry.ts`'s permissive prefix parser and import the Slice-0 authority wherever compatibility code still needs portion parsing. A configured medication option exists only when the routine normalizes to Medication, has a non-empty label, has a valid `parseClockTime(routine.time)`, and exposes a non-empty dose from its existing configured dose/note field. Do not choose an option or `taken` outcome in the decision function.

- [ ] **Step 4: Write failing finalized-mutation tests**

Create `quickLogWorkflow.typecheck.ts` as a source type fixture, deliberately **not** a `.test.ts` file. The existing mobile `tsconfig.json` includes `**/*.ts` and excludes only `**/*.test.ts(x)`, so the normal mobile compiler must check this file. Freeze these compile-time cases:

```ts
import type { CareEntryCreateInput } from "../context/CareContext";
import {
  type ParsedStrictPositiveAmountWithUnit,
} from "./quickLogWorkflow";
import { parseStrictPositiveAmountWithUnit } from "./inputValidation";

type IsAny<T> = 0 extends (1 & T) ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;
type Assert<T extends true> = T;
type AmountIsNotAny = Assert<
  IsAny<ParsedStrictPositiveAmountWithUnit> extends false ? true : false
>;
type AmountIsNotNever = Assert<
  IsNever<ParsedStrictPositiveAmountWithUnit> extends false ? true : false
>;
type AmountHasTask3Shape = Assert<
  ParsedStrictPositiveAmountWithUnit extends Readonly<{
    amount: number;
    unit: string;
    canonical: string;
  }> ? true : false
>;
const amountTypeAssertions: [
  AmountIsNotAny,
  AmountIsNotNever,
  AmountHasTask3Shape,
] = [true, true, true];

const ownerEntry = {
  type: "water",
  title: "Water refreshed",
  caregiver: "Avery",
  occurredAt: "2026-08-05T12:00:00.000Z",
} satisfies CareEntryCreateInput;

const forbiddenSyncStatus: CareEntryCreateInput = {
  ...ownerEntry,
  // @ts-expect-error CareContext, not workflow callers, owns transport state.
  syncStatus: "local",
};
const forbiddenSyncError: CareEntryCreateInput = {
  ...ownerEntry,
  // @ts-expect-error CareContext, not workflow callers, owns transport errors.
  syncError: "nope",
};
const forbiddenPendingPatch: CareEntryCreateInput = {
  ...ownerEntry,
  // @ts-expect-error CareContext, not workflow callers, owns pending sync patches.
  pendingSyncPatch: {},
};

const parsed = parseStrictPositiveAmountWithUnit("1 1/2 cups");
if (parsed) {
  const frozenSlice0Shape: Readonly<{
    amount: number;
    unit: string;
    canonical: string;
  }> = parsed;
  const derivedHomeType: ParsedStrictPositiveAmountWithUnit = parsed;
  void [frozenSlice0Shape, derivedHomeType];
}
void [
  amountTypeAssertions,
  forbiddenSyncStatus,
  forbiddenSyncError,
  forbiddenPendingPatch,
];
```

Each `@ts-expect-error` is checked: if any forbidden transport field becomes legal, TypeScript emits an unused-directive error and fails the gate. `ParsedStrictPositiveAmountWithUnit` is derived with `NonNullable<ReturnType<typeof parseStrictPositiveAmountWithUnit>>`; Home does not require an unpromised `StrictAmountWithUnit` export from Slice 0. The non-`any`, non-`never`, structural assertions and parsed-value assignment freeze Task 3's `{ amount, unit, canonical }` result contract.

Assert the exact stored fields, not only the mode:

```ts
assert.deepEqual(meal.entry.details?.mealLifecycle, "outcome-pending");
assert.deepEqual(meal.entry.details?.mealCompletion, "served");
assert.deepEqual(meal.entry.details?.servedAmount, 1.5);
assert.deepEqual(meal.entry.details?.servedUnit, "cup");
assert.deepEqual(meal.entry.food, "Chicken & rice");
assert.deepEqual(potty.entry.details?.pottyOutcome, "both");
assert.deepEqual(medication.entry.details?.medicationOutcome, "skipped");
assert.equal(note.entry.note, "Door code changed");
```

Use the configured mixed-fraction fixture for the assertions above: `normalPortion: "1 1/2 cups"` must store `servedAmount: 1.5`, `servedUnit: "cup"`, and canonical amount text; do not pair that fixture with a later `servedAmount: 1` example.

Add one red validation table that proves every invalid finalized payload yields `{ kind: "blocked" }` and no persistable `entry` or `patch`:

- `occurredAt` is `NaN`, `Infinity`, `-Infinity`, or otherwise non-finite for every action; omitted timestamps instead use the one finite `context.actionNow`;
- Walk finish or Alone return occurs before the exact persisted session's `walkStartedAt`/`aloneStartedAt` (falling back to its valid `occurredAt`), or that persisted start is invalid;
- Walk `durationMinutes`, `distanceMiles`, or `dogInteractions` is negative/non-finite, and `dogInteractions` is fractional;
- Alone `recoveryMinutes` is negative/non-finite;
- Water quantity is non-positive/non-finite, or its trimmed unit is blank/unsupported by the Slice-0 amount-unit table;
- Meal amount is non-positive/non-finite or its unit is blank/unsupported; a `source: "configured"` input whose trimmed food, canonical amount, or canonical unit differs from the currently confirmed `ConfiguredMeal` is blocked as stale configuration;
- Note is blank; medication name/dose is blank or outcome absent; the Walk/Alone ID is not the exact open session; or Potty has no explicit outcome.

Prove Water refresh uses `waterAmount: "refill"`; Walk/Alone start and finish preserve the existing helper shapes after the boundary validates them; every create writes the provider identity's exact `caregiver` and `details.caregiverRole` (including an explicit `null`), `householdVisible: true`, and `buildCareLogTrustDefaults({ type, caregiverRole, interaction })`. For updates, prove the patch changes attribution/session owner fields only and preserves the entry's existing `logInteraction`, `trustState`, `confirmationRequired`, `confirmationReason`, `photoProofStatus`, `photoProofPolicy`, and every other proof/pending-confirmation field byte-for-byte; it must not recompute trust defaults. Medication never falls back to Taken.

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/quickLogWorkflow.test.ts \
  artifacts/woofwatcher-mobile/lib/quickLogEntry.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs \
  --filter @workspace/woofwatcher-mobile exec tsc -p tsconfig.json --noEmit --pretty false
```

Expected: FAIL because finalized mutation construction and the source type contract are absent and the old builder still permits unsafe defaults/long-press policy. A Node test result alone cannot satisfy this step.

- [ ] **Step 5: Implement finalized builders and retire unsafe generic defaults**

Implement a closed `switch (input.action)`. Resolve `occurredAt = input.occurredAt ?? context.actionNow` once and block unless it is finite before constructing an ISO string. Reuse `buildWalkSessionStartEntry`, `buildWalkSessionFinishPatch`, `buildAloneTimeStartEntry`, and `buildAloneTimeReturnPatch` only after the boundary checks exact session ID, valid persisted start, chronological finish, and every numeric invariant above. Meal writes served/outcome-pending fields and revalidates a configured confirmation against the current canonical diet configuration; Medication writes the explicitly supplied identity, dose, and outcome; Note trims and stores non-empty text.

For Potty create, first construct this real base entry (with the shared trust defaults merged into `details`), then pass that same object to `buildPottyLogDetailPatch`, and merge the returned title/severity/details back over the base:

```ts
const base: CareEntryCreateInput = {
  type: "potty",
  title: "Potty",
  caregiver: context.caregiver.name,
  occurredAt: new Date(occurredAt).toISOString(),
  details: {
    householdVisible: true,
    caregiverRole: context.caregiver.role,
    ...buildCareLogTrustDefaults({
      type: "potty",
      caregiverRole: context.caregiver.role,
      interaction: "detail-sheet",
    }),
  },
};
const detail = buildPottyLogDetailPatch(base, validatedPottyOptions);
```

Every finalized create uses `CareEntryCreateInput`, calls `buildCareLogTrustDefaults` with the created entry's normalized `type`, the provider-owned `caregiverRole`, and the actual `"quick-tap" | "detail-sheet"` interaction, and cannot name transport fields. An update reads the exact target from `context.entries`, preserves all pre-existing trust/proof/pending-confirmation keys while merging only validated owner fields plus `caregiverRole`, and blocks if the target is missing; it never calls the defaults builder. A create mutation carries `inverse: { kind: "delete-created-entry" }`. An update mutation carries only its exact ID and `Partial<CareEntryMutableFields>` patch: it does **not** snapshot or manufacture an inverse. Task 2's single storage owner atomically captures the before-image and applied revision. `buildQuickLogEntry` may remain only as a backward-compatible wrapper for safe finalized Water or legacy detailed-composer tests; it must not construct Meal, Potty, Medication, Alone, Walk completion, or Note without a `FinalizedCareInput`.

- [ ] **Step 6: Verify and commit the pure authority**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/inputValidation.test.ts \
  artifacts/woofwatcher-mobile/lib/quickLogWorkflow.test.ts \
  artifacts/woofwatcher-mobile/lib/quickLogEntry.test.ts \
  artifacts/woofwatcher-mobile/lib/walkSession.test.ts \
  artifacts/woofwatcher-mobile/lib/aloneTimeSession.test.ts \
  artifacts/woofwatcher-mobile/lib/mealOutcomeUpdate.test.ts \
  artifacts/woofwatcher-mobile/lib/pottyLogDetail.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs \
  --filter @workspace/woofwatcher-mobile exec tsc -p tsconfig.json --noEmit --pretty false
```

Expected: behavioral suites PASS; the explicit mobile `tsc` includes `lib/quickLogWorkflow.typecheck.ts`, all three checked `@ts-expect-error` directives are consumed, and the derived Slice-0 amount shape compiles.

```bash
git diff --check
git add -- artifacts/woofwatcher-mobile/lib/quickLogWorkflow.ts artifacts/woofwatcher-mobile/lib/quickLogWorkflow.test.ts artifacts/woofwatcher-mobile/lib/quickLogWorkflow.typecheck.ts artifacts/woofwatcher-mobile/lib/quickLogEntry.ts artifacts/woofwatcher-mobile/lib/quickLogEntry.test.ts artifacts/woofwatcher-mobile/context/CareContext.tsx
git diff --cached --check
git commit -m "feat: define safe universal care logging"
```

---

### Task 2: Shared Save, Feedback, Dedupe, and Exact Undo Runtime

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/careLogWorkflowRuntime.ts`
- Create: `artifacts/woofwatcher-mobile/lib/careLogWorkflowRuntime.test.ts`
- Create: `artifacts/woofwatcher-mobile/context/CareLogWorkflowContext.tsx`
- Create: `artifacts/woofwatcher-mobile/components/log/LogFeedbackHost.tsx`
- Create: `artifacts/woofwatcher-mobile/lib/careLogFeedback.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/protectedCareEnvelope.ts`
- Create: `artifacts/woofwatcher-mobile/lib/protectedCareEnvelope.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/privacyDataProtection.ts`
- Create: `artifacts/woofwatcher-mobile/lib/privacyDataProtection.test.ts`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/PrivacyDataScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/_layout.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**

```ts
export type CareLogPersistence = "local-pending" | "at-risk";

export type CareLogWorkflowResult =
  | { status: "saved"; entryId: string; feedbackToken: string; message: string; persistence: CareLogPersistence; undo: { kind: "delete-created-entry"; entryId: string } }
  | { status: "updated"; entryId: string; feedbackToken: string; message: string; persistence: CareLogPersistence; undo: { kind: "restore-updated-entry"; receipt: CareEntryUpdateReceipt } }
  | { status: "opened-flow"; kind: UniversalQuickLogKind; mode: Exclude<QuickLogWorkflowMode, "immediate-save" | "start-session"> }
  | { status: "deduped"; entryId: string; message: string }
  | { status: "blocked"; reason: string; message: string }
  | { status: "failed"; message: string };

export type CareLogUndoResult =
  | { status: "undone"; entryId: string; message: string }
  | { status: "failed"; entryId: string; message: string };

export interface CareEntryUpdateReceipt {
  entryId: string;
  before: CareEntryMutableFields;
  appliedRevision: number;
}

export type CareLogUndoAction =
  | { kind: "delete-created-entry"; entryId: string }
  | { kind: "restore-updated-entry"; receipt: CareEntryUpdateReceipt };

export interface CareLogFeedback {
  token: string;
  entryId: string;
  caregiver: string;
  caregiverRole: string | null;
  message: string;
  persistence: CareLogPersistence;
  undo: CareLogUndoAction;
  undoState: "ready" | "working" | "failed";
  warning?: string;
}

export interface CareLogWorkflowDependencies {
  addEntry(entry: CareEntryCreateInput): string;
  updateEntryWithReceipt(id: string, patch: Partial<CareEntryMutableFields>): CareEntryUpdateReceipt | null;
  restoreEntryFromReceipt(receipt: CareEntryUpdateReceipt): boolean;
  deleteEntry(id: string): Promise<boolean>;
  getContext(): Omit<QuickLogWorkflowContext, "actionNow">;
  getCaregiver(): LocalCaregiverIdentity;
  getStorageWarning(): "save-failed" | "read-failed" | "reset" | "newer-version" | null;
  now(): number;
}

export interface CareLogWorkflowRuntime {
  decide(kind: UniversalQuickLogKind): QuickLogDecision;
  runPrimary(kind: UniversalQuickLogKind): CareLogWorkflowResult;
  confirm(input: FinalizedCareInput): CareLogWorkflowResult;
  undo(feedback: CareLogFeedback): Promise<CareLogUndoResult>;
}

export function createCareLogWorkflowRuntime(dependencies: CareLogWorkflowDependencies): CareLogWorkflowRuntime;

export interface CareLogWorkflowController extends CareLogWorkflowRuntime {
  caregiverLabel: string;
  caregiverRole: string | null;
  caregiverSource: LocalCaregiverIdentity["source"];
  disclosure: "Local household label; it does not verify identity or permissions.";
  readOnly: boolean;
  readOnlyMessage: string | null;
  privacyDataDestination: CanonicalDestination;
  lastFeedback: CareLogFeedback | null;
  dismissFeedback(token: string): void;
  undoLast(): Promise<CareLogUndoResult>;
}

export function CareLogWorkflowProvider(props: { children: React.ReactNode }): React.JSX.Element;
export function useCareLogWorkflow(): CareLogWorkflowController;

export interface ProtectedCareEnvelopeBackup {
  fileName: "woofwatcher-protected-newer-version.json";
  mimeType: "application/json";
  raw: string;
  utf8Bytes: Uint8Array;
  byteLength: number;
}

export type ProtectedCareEnvelopeRecovery =
  | {
      status: "exact-backup";
      source: "local-storage";
      backup: ProtectedCareEnvelopeBackup;
    }
  | {
      status: "exact-unavailable";
      source: "provider-decoded-object" | "conflict-decoded-object";
      message: "WoofWatcher received newer-version data after it had already been decoded, so its exact source bytes are not available to export. Update the app or contact support before reset.";
    };

export function buildProtectedCareEnvelopeBackup(raw: string): ProtectedCareEnvelopeBackup;
export function exportExactProtectedCareEnvelope(
  recovery: ProtectedCareEnvelopeRecovery,
  write: (fileName: string, mimeType: string, bytes: Uint8Array) => Promise<void>,
): Promise<"exported" | "exact-unavailable">;
```

The provider is mounted inside `CareProvider` and above `AppFrame`, so feedback and Undo survive navigation among Home, Log, and `/fastlog`. It calls `resolveLocalCaregiverIdentity(state.caregivers)` once for its current render and supplies that exact name/role/source to controller copy, every finalized mutation, and save-time feedback attribution. It does not call `useGetMe` or accept an auth identity. Only the most recent action is offered by the global feedback host; older entries remain correctable in Log History. Feedback remains until explicit dismiss, successful Undo, or replacement by a newer saved action—there is no route-local timeout that can erase Undo during navigation.

`CareContextValue` also exposes `getProtectedCareEnvelopeRecovery(): ProtectedCareEnvelopeRecovery | null`. Local hydration captures the exact `woofwatcher.v2.state` string when its `doc.dataVersion` is newer and records `status: "exact-backup", source: "local-storage"`. The current API client returns an already-decoded `CareStateEnvelope`; therefore a future `doc` discovered by `getCareState()` records `status: "exact-unavailable", source: "provider-decoded-object"`, and a future decoded conflict source records `"conflict-decoded-object"`. The plan does **not** claim provider response bytes that the transport does not expose and never manufactures them with `JSON.stringify`. Every source stays opaque and is never passed to `mergeDoc`, migration, models, or components; the live read-only view remains the last supported `docRef`/`entriesRef` snapshot.

Task 2—not Core Task 4—owns the minimal Privacy recovery wiring. `PrivacyDataScreen` reads `getProtectedCareEnvelopeRecovery()` and calls the tested `exportExactProtectedCareEnvelope` callback before reset. For `exact-backup`, it writes/downloads/shares `backup.utf8Bytes` using the protected filename/MIME. For `exact-unavailable`, it hides/disables protected export and renders the exact source-specific update/support/reset warning above; reset remains separately labeled and confirmed and never implies a backup exists. A normal supported-state export continues through the ordinary exporter. The protected and normal artifacts, callbacks, and labels are never interchangeable.

- [ ] **Step 1: Write failing runtime tests for one mutation path**

Use an in-memory dependency harness with a spy clock. Prove each public `decide`, `runPrimary`, or `confirm` action calls `dependencies.now()` exactly once. A non-finite captured `actionNow` blocks before decision, pruning, or mutation. `runPrimary` must not call the public `decide` method and accidentally capture a second time; it uses an internal decision helper with its one `actionNow`. Prove Water calls `addEntry` once and returns the exact non-empty ID, unsafe primary actions return `opened-flow` without mutation, session finish updates only the declared ID and returns a restore receipt, and a thrown dependency returns `failed` with no success feedback. When `addEntry` returns `""`, assert `status: "failed"`, no intent lock, no feedback, and exact copy `Care was not saved because this app is in read-only protection. Update the app, then try again.`

Add table fixtures with `Avery`/`Parent`, `Jordan`/`Helper` after a blank record, and the empty `Local caregiver`/`null` fallback. Assert the exact same provider identity populates `caregiver`, `caregiverRole`, `Logging as`, feedback attribution, and History-facing entry fields. A supplied auth display name must not affect any expected value.

Run:

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/careLogWorkflowRuntime.test.ts
```

Expected: FAIL because the runtime module does not exist.

- [ ] **Step 2: Add the same-tick lock before any mutation call**

At the start of each public action, capture `const actionNow = dependencies.now()` once, prune with that value, and build `{ ...dependencies.getContext(), actionNow }` for both decision and mutation defaulting. Implement a runtime-owned `Map<string, { entryId: string; lockedAt: number }>` and prune only by `actionNow - lockedAt > QUICK_LOG_DEDUPE_WINDOW_MS`. Never put a care `occurredAt` into this lock: two same-turn confirmations backdated to the same old care time must still dedupe. Write the lock with `lockedAt: actionNow` only after `addEntry` returns a non-empty ID or `updateEntryWithReceipt` returns a receipt, and before returning to React. The intent key is the finalized mutation's stable key (`create:water-refresh`, `create:meal-served`, `update:walk-finish:<entryId>`, or `update:alone-return:<entryId>`); do not depend on a rerendered `state.entries` array to stop a second same-turn press.

Add the failing assertion:

```ts
const first = runtime.runPrimary("water");
const second = runtime.runPrimary("water");
assert.equal(first.status, "saved");
assert.deepEqual(second, { status: "deduped", entryId: "entry-1", message: "Already logged." });
assert.equal(saved.length, 1);
```

Add a backdated fixture whose `occurredAt` is one week before `actionNow`; invoke both confirmations synchronously without awaiting or advancing the injected clock and assert one mutation. Advance only `actionNow` past the dedupe window and assert a later deliberate confirmation may save.

- [ ] **Step 3: Write failing exact-Undo success and failure tests**

Create two entries of the same type from different caregivers. Assert create Undo calls `deleteEntry` with the saved feedback's exact `entryId`, never “newest same type.” When `deleteEntry` resolves `false` or rejects, assert `status: "failed"`, the same entry ID, and an Undo retry remains available. When it resolves `true`, assert `status: "undone"` and feedback clears.

For Walk finish and Alone return, prove the finalized mutation contains no `inverse`/`before`. `updateEntryWithReceipt` is the only before-image owner: inside the same serialized CareContext mutation it reads the exact current entry, clones all `CareEntryMutableFields` while omitting the transport-only `CARE_ENTRY_SYNC_REVISION_KEY` from `before.details`, applies the narrowed patch, advances the existing `clientSyncRevision`, and returns that concrete applied revision. Assert Undo calls `restoreEntryFromReceipt`, restores `walkLifecycle: "in-progress"` or `aloneLifecycle: "active"` and all original owner-mutable title/duration/details on the same ID, and never calls `deleteEntry`. `restoreEntryFromReceipt` compares `readCareEntrySyncRevision(current.details) === receipt.appliedRevision` inside its own serialized mutation before restoring, then advances revision/sync normally. If any later edit changed the revision or restoration returns false, keep retry/correction feedback and say `Undo could not be applied because this entry changed. Open History to correct it.`

Narrow the existing public `updateEntry`, the new receipt method, runtime dependencies, and finalized update mutation to `Partial<CareEntryMutableFields>`. Strip/preserve `CARE_ENTRY_SYNC_REVISION_KEY` inside CareContext so a workflow patch cannot set transport revision, `syncStatus`, `syncError`, or `pendingSyncPatch`.

- [ ] **Step 4: Define and test storage-warning semantics**

At save time, `save-failed`, `read-failed`, or `reset` returns `persistence: "at-risk"` and exact warning copy: `Saved for now, but device storage has a problem and this entry may not survive a restart.` A save with no warning returns `local-pending` and `Saved on this device.` If one of those warnings appears while feedback is visible, the provider upgrades that feedback to `at-risk`; it never removes a real inverse or relabels the save durable.

`newer-version` is different: before building or applying any mutation, return `{ status: "blocked", reason: "read-only-newer-version", message: "WoofWatcher found data from a newer app version. Update the app before logging. If the warning remains, export or reset from Privacy & Data, or contact support." }`. Assert `addEntry`, `updateEntryWithReceipt`, and `deleteEntry` are not called. If it appears after an earlier valid feedback, retain that feedback's real inverse; an Undo may fail closed and must display the failure instead of claiming removal.

Add protected-envelope tests with a future-version storage string containing whitespace, Unicode, entries, and unknown future fields. Assert the exposed model is the last supported snapshot, no future-only field is interpreted, the local recovery is `exact-backup`, `backup.raw` equals the seeded string byte-for-byte, `utf8Bytes` decodes to exactly that string, `byteLength` is exact, and the real Privacy export callback obtains those bytes before `eraseAllLocalData` clears protection. Add provider-decoded and conflict-decoded future fixtures and assert both produce `exact-unavailable`, never call the byte writer, never serialize exposed/default state, and expose their exact update/support/reset copy. A test that serializes `state`/defaults or enables export for either unavailable source must fail.

- [ ] **Step 5: Implement the provider and global feedback host**

Wrap the navigator as follows:

```tsx
<CareProvider>
  <CareLogWorkflowProvider>
    <WalkRouteRecorderBridge />
    <AvatarProvider>
      {/* existing gesture/keyboard/status/AppFrame tree */}
    </AvatarProvider>
    <LogFeedbackHost />
  </CareLogWorkflowProvider>
</CareProvider>
```

Add `updateEntryWithReceipt`, `restoreEntryFromReceipt`, and `getProtectedCareEnvelopeRecovery` to `CareContextValue`. All mutation methods fail closed under `newer-version`; the source-aware recovery getter remains available. The update method captures the before-image and concrete applied revision atomically as specified above; the restore method compares that revision atomically. `LogFeedbackHost` uses `accessibilityRole="alert"`, announces the exact persisted outcome, `feedback.caregiver`, recorded role (or `Role not recorded`), and storage warning, renders a 48×48 **Undo** control only for a real non-empty create ID or valid update receipt, shows `Undo failed — Try again` after failure, and exposes an explicit Dismiss control. It is one host above routes; Home, Log, and Fast Log do not render competing toasts.

The provider exposes `caregiverLabel`, `caregiverRole`, `caregiverSource`, `readOnly`, the exact newer-version message, and a canonical Privacy & Data destination from its one local resolver/storage call. Every successful save/update copies that same name and role into feedback; History reads `entry.caregiver` plus recorded `entry.details.caregiverRole` and never looks up the caregiver's current role. Do not retain Log's `me.data?.user?.displayName` precedence, Home/Fast Log's `caregivers[0] ?? "you"` fallback, or any surface-specific/current-role lookup.

- [ ] **Step 6: Verify runtime, type safety, and commit**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/careLogWorkflowRuntime.test.ts \
  artifacts/woofwatcher-mobile/lib/careLogFeedback.test.ts \
  artifacts/woofwatcher-mobile/lib/protectedCareEnvelope.test.ts \
  artifacts/woofwatcher-mobile/lib/privacyDataProtection.test.ts \
  artifacts/woofwatcher-mobile/lib/quickLogWorkflow.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run typecheck
```

Expected: PASS.

```bash
git diff --check
git add -- artifacts/woofwatcher-mobile/app/_layout.tsx artifacts/woofwatcher-mobile/components/log/LogFeedbackHost.tsx artifacts/woofwatcher-mobile/components/more/PrivacyDataScreen.tsx artifacts/woofwatcher-mobile/context/CareContext.tsx artifacts/woofwatcher-mobile/context/CareLogWorkflowContext.tsx artifacts/woofwatcher-mobile/lib/careLogWorkflowRuntime.ts artifacts/woofwatcher-mobile/lib/careLogWorkflowRuntime.test.ts artifacts/woofwatcher-mobile/lib/careLogFeedback.test.ts artifacts/woofwatcher-mobile/lib/protectedCareEnvelope.ts artifacts/woofwatcher-mobile/lib/protectedCareEnvelope.test.ts artifacts/woofwatcher-mobile/lib/privacyDataProtection.ts artifacts/woofwatcher-mobile/lib/privacyDataProtection.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
git diff --cached --check
git commit -m "feat: share logging feedback and exact undo"
```

---

### Task 3: Shared Visible Recorder Across Home, Log, and Fast Log

**Files:**
- Create: `artifacts/woofwatcher-mobile/components/log/QuickLogActions.tsx`
- Create: `artifacts/woofwatcher-mobile/components/log/QuickLogFlowSheet.tsx`
- Create: `artifacts/woofwatcher-mobile/components/log/ActiveSessionCard.tsx`
- Create: `artifacts/woofwatcher-mobile/components/log/LoggingIdentity.tsx`
- Create: `artifacts/woofwatcher-mobile/lib/quickLogScreenContract.ts`
- Create: `artifacts/woofwatcher-mobile/lib/quickLogScreenContract.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/log.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/fastlog.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**

```ts
export const ALL_DETAILED_CARE_TYPES: readonly CareEventType[] = CARE_EVENT_TYPES;
export const SECONDARY_CARE_TYPES: readonly CareEventType[] = CARE_EVENT_TYPES.filter(
  (type) => !PRIMARY_QUICK_LOG_KINDS.includes(type as UniversalQuickLogKind),
);

export interface QuickLogActionContract {
  kind: UniversalQuickLogKind;
  label: "Meal" | "Water" | "Potty" | "Walk" | "Medication" | "Alone Time" | "Note";
  primaryLabel: string;
  detailsLabel: "Details";
  primaryAccessibilityLabel: string;
  detailsAccessibilityLabel: string;
  disabled: boolean;
  disabledReason: string | null;
}

export interface QuickLogScreenContract {
  identityLabel: string;
  identityRole: string | null;
  identitySource: LocalCaregiverIdentity["source"];
  disclosure: string;
  readOnly: boolean;
  readOnlyMessage: string | null;
  privacyDataDestination: CanonicalDestination;
  actions: readonly QuickLogActionContract[];
  secondaryCareTypes: readonly CareEventType[];
  moreCareTypesLabel?: "More care types";
  allLoggingDestination?: CanonicalDestination;
}

export function buildQuickLogScreenContract(input: {
  kinds: readonly UniversalQuickLogKind[];
  decisions: Readonly<Record<UniversalQuickLogKind, QuickLogDecision>>;
  caregiver: LocalCaregiverIdentity;
  includeMoreCareTypes: boolean;
  readOnly: boolean;
  readOnlyMessage: string | null;
  privacyDataDestination: CanonicalDestination;
  allLoggingDestination?: CanonicalDestination;
}): QuickLogScreenContract;
```

`QuickLogActions` consumes this contract and callbacks; it never calls `useCare()` directly. `QuickLogFlowSheet` holds only finalized form state and calls `controller.confirm(FinalizedCareInput)`. Medication selection and outcome initialize as `null`; Note initializes empty; Potty requires a chooser value. `ActiveSessionCard` derives Walk/Alone status from decisions backed by persisted entries. `ALL_DETAILED_CARE_TYPES` is the complete composer/deep-link inventory; only `SECONDARY_CARE_TYPES` appears under **More care types**. Primary types may still be opened for edit/details in the detailed composer.

- [ ] **Step 1: Write the failing pure presentation-policy tests**

Assert the Log/Fast Log contract has exactly seven primary actions in `PRIMARY_QUICK_LOG_KINDS` order, two labeled control descriptors per action, the local-label disclosure before actions, and one **More care types** policy. Assert `SECONDARY_CARE_TYPES` and `PRIMARY_QUICK_LOG_KINDS` are disjoint and their set union equals `CARE_EVENT_TYPES`; separately assert `ALL_DETAILED_CARE_TYPES` equals the entire inventory so primary types remain editable in the composer. Assert the Home contract has exactly Water/Meal/Potty/Walk plus typed `/log` **All logging** destination. Assert no contract contains Hold, long press, or a preselected Medication outcome. Under `storageWarning: "newer-version"`, every action descriptor is disabled with the exact update/export-reset/support explanation and the contract exposes canonical Privacy & Data. For the same `Avery`/`Parent`, blank-first/`Jordan`/`Helper`, and empty-caregiver fixtures used by Task 2, assert Home, Log, and Fast Log policy contracts expose the same name, role, and source.

These pure tests prove order, decisions, and serialization only. They do not claim that JSX rendered a label or that a callback was disabled; Task 6's seeded `E2E_SCOPE=home` flow proves the shared Home rendering, and Core Task 1's `E2E_SCOPE=log` proves the Log/Fast Log wiring.

Run:

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/quickLogScreenContract.test.ts
```

Expected: FAIL because the screen contract does not exist.

- [ ] **Step 2: Implement the contract and accessible shared components**

Every primary and Details control has `minWidth`/`minHeight` of 48, a visible text label, `accessibilityRole="button"`, and an action-specific hint. Use `resolveCanonicalDestination({ pathname: "/log" })` for **All logging** and the canonical More `section=privacy` destination for recovery. The seven-item primary union is presentation policy only; **More care types** renders exactly `SECONDARY_CARE_TYPES`, while `ALL_DETAILED_CARE_TYPES` remains the complete `CARE_EVENT_TYPES` composer list. If `contract.readOnly`, primary, Details, and confirm callbacks are guarded before invocation and render disabled state/reason; History/Privacy navigation and feedback Dismiss stay active.

- [ ] **Step 3: Replace the three duplicated quick-action handlers**

Home, Log, and `/fastlog` call `useCareLogWorkflow()`. Remove their route-local quick-save, dedupe, feedback, Undo, and caregiver-attribution handlers. In particular, delete Log's auth-display-name precedence and Home/Fast Log's independent `caregivers[0]` fallbacks. Replace all quick-action `onLongPress` props and “Tap saves. Hold opens details.” copy with separate primary and Details buttons. Log and Fast Log render seven primary actions plus **More care types**, whose launcher contains exactly `SECONDARY_CARE_TYPES`; the detailed composer/deep-link inventory remains `ALL_DETAILED_CARE_TYPES`, including primary types opened for edit/details. Home temporarily renders the compact shared action block until Task 5 installs its final section.

- [ ] **Step 4: Prove every legacy care type/deep link remains reachable**

Extend tests for all values in `CARE_EVENT_TYPES` plus the existing normalized aliases. A valid `type`, `detail`, `intent`, `entry`, or `walk` parameter opens the same detailed composer/session/history target as before. Unknown/retired types render `This care type is not available. Choose another type or open History.` and never delete or rewrite an existing entry.

- [ ] **Step 5: Verify cross-surface behavior and commit**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/quickLogScreenContract.test.ts \
  artifacts/woofwatcher-mobile/lib/quickLogWorkflow.test.ts \
  artifacts/woofwatcher-mobile/lib/careLogWorkflowRuntime.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run typecheck
```

Expected: PASS and `rg -n "onLongPress|Tap saves\. Hold|Long press for details" artifacts/woofwatcher-mobile/app/'(tabs)'/index.tsx artifacts/woofwatcher-mobile/app/'(tabs)'/log.tsx artifacts/woofwatcher-mobile/app/fastlog.tsx artifacts/woofwatcher-mobile/components/log` finds no quick-recorder or Home Avatar-Studio behavior.

```bash
git diff --check
git add -- artifacts/woofwatcher-mobile/components/log/QuickLogActions.tsx artifacts/woofwatcher-mobile/components/log/QuickLogFlowSheet.tsx artifacts/woofwatcher-mobile/components/log/ActiveSessionCard.tsx artifacts/woofwatcher-mobile/components/log/LoggingIdentity.tsx artifacts/woofwatcher-mobile/lib/quickLogScreenContract.ts artifacts/woofwatcher-mobile/lib/quickLogScreenContract.test.ts artifacts/woofwatcher-mobile/app/'(tabs)'/index.tsx artifacts/woofwatcher-mobile/app/'(tabs)'/log.tsx artifacts/woofwatcher-mobile/app/fastlog.tsx artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
git diff --cached --check
git commit -m "refactor: share the visible care recorder"
```

---

### Task 4: Truthful Home Overview Model

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/homeOverview.ts`
- Create: `artifacts/woofwatcher-mobile/lib/homeOverview.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/navigationOwnership.ts` only if the Slice-1 normalizer does not yet preserve the validated Home identifiers below
- Modify: `artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts` with the corresponding route cases

**Interfaces:**

```ts
export type HomePresence = {
  label: string;
  detail: string;
  tone: "calm" | "watch" | "active";
};

export type HomeNextCare =
  | { kind: "open-walk"; entryId: string; label: string; detail: string; primaryLabel: "Finish walk"; destination: CanonicalDestination }
  | { kind: "open-alone"; entryId: string; label: string; detail: string; primaryLabel: "Finish Alone Time"; destination: CanonicalDestination }
  | { kind: "meal-outcome"; entryId: string; label: string; detail: string; primaryLabel: "Add meal outcome"; destination: CanonicalDestination }
  | { kind: "routine"; routineId: string; label: string; detail: string; primaryLabel: "Open plan"; destination: CanonicalDestination }
  | { kind: "none"; label: "No care due now"; detail: string; primaryLabel: "Open Plans"; destination: CanonicalDestination };

export interface HomeHealthSummary {
  label: string;
  detail: string;
  tone: "calm" | "watch" | "alert";
  destination: CanonicalDestination;
}

export interface HomeRecentCare {
  id: string;
  label: string;
  detail: string;
  occurredAt: string;
  destination: CanonicalDestination;
}

export interface HomeOverviewModel {
  dogName: string;
  caregiver: LocalCaregiverIdentity;
  presence: HomePresence;
  nextCare: HomeNextCare;
  health: HomeHealthSummary;
  recent: readonly HomeRecentCare[];
}

export function deriveHomeOverview(input: {
  state: Pick<CareState, "profile" | "routines" | "entries">;
  caregiver: LocalCaregiverIdentity;
  now: number;
}): HomeOverviewModel;
```

`nextCare` has one empty representation: `kind: "none"`. It is never `null` or `undefined`. Every route field is a `CanonicalDestination` returned by Slice 1's resolver.

- [ ] **Step 1: Write the failing fixture table**

Cover empty state, valid due routine, invalid `needs-correction` routine, open Walk, open Alone, both session kinds open, multiple same-kind sessions, pending Meal outcome, calm health, alert health, and unsorted recent entries. Session selection first compares the persisted `walkStartedAt`/`aloneStartedAt` (falling back only to a finite `occurredAt`) newest-first; equal timestamps use entry ID lexical ascending as the stable tie-breaker, independent of input-array order. The selected newest session wins before Meal outcome → real Routine → None. Assert recent is the newest three real entries with the same finite-time/ID deterministic sort; invalid routines never become next; no fabricated hunger/hydration/bond score appears anywhere. Pass the provider-resolved `LocalCaregiverIdentity` and assert the model preserves it byte-for-byte rather than reading caregivers or auth data itself.

Use exact route expectations, for example:

```ts
assert.deepEqual(model.nextCare.destination, {
  parent: "log",
  pathname: "/log",
  params: { intent: "finish-walk", entry: "walk-1" },
  replace: false,
});
assert.equal(empty.nextCare.kind, "none");
assert.equal("score" in empty.health, false);
```

Run:

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/homeOverview.test.ts
```

Expected: FAIL because `homeOverview.ts` does not exist.

- [ ] **Step 2: Implement deterministic priority and truthful presence**

Use persisted Walk/Alone predicates, the deterministic cross-kind session comparator above, Meal `mealLifecycle === "outcome-pending"`, Task 0's repaired `deriveRoutineBoard`, `isRoutineBoardScheduledItem`, and `deriveHealthWatch`. Do not choose Walk merely because its branch runs first. When no session supplies location, presence says `Status not logged` and explains that no active Walk or Alone Time session exists; never infer that the dog is home. Calm health copy says `No current Health Watch alerts` rather than “healthy” or “normal.”

- [ ] **Step 3: Build every destination through Slice 1**

Call `resolveCanonicalDestination` for `/log`, `/calendar`, and `/health`; preserve only validated `entry`, `intent`, `item`, and Health section parameters. Add/strengthen Slice-1 ownership tests if its normalizer currently drops these supported Home identifiers.

- [ ] **Step 4: Verify and commit**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/homeOverview.test.ts \
  artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts \
  lib/care-domain/test/routine-board.test.ts \
  lib/care-domain/test/health-handoff.test.ts
```

Expected: PASS.

```bash
git diff --check
git add -- artifacts/woofwatcher-mobile/lib/homeOverview.ts artifacts/woofwatcher-mobile/lib/homeOverview.test.ts artifacts/woofwatcher-mobile/lib/navigationOwnership.ts artifacts/woofwatcher-mobile/lib/navigationOwnership.test.ts
git diff --cached --check
git commit -m "feat: derive a truthful Home overview"
```

---

### Task 5: Home Composition, First-Viewport Geometry, and Hidden-Gesture Removal

**Files:**
- Create: `artifacts/woofwatcher-mobile/components/home/HomeIdentityHeader.tsx`
- Create: `artifacts/woofwatcher-mobile/components/home/HomeScene.tsx`
- Create: `artifacts/woofwatcher-mobile/components/home/NextCareCard.tsx`
- Create: `artifacts/woofwatcher-mobile/components/home/HomeQuickLog.tsx`
- Create: `artifacts/woofwatcher-mobile/components/home/HomeHealthLine.tsx`
- Create: `artifacts/woofwatcher-mobile/components/home/RecentCareSummary.tsx`
- Create: `artifacts/woofwatcher-mobile/components/home/FirstUseIntroduction.tsx`
- Create: `artifacts/woofwatcher-mobile/lib/firstUseIntroduction.ts`
- Create: `artifacts/woofwatcher-mobile/lib/firstUseIntroduction.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/homeScreenContract.ts`
- Create: `artifacts/woofwatcher-mobile/lib/homeScreenContract.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/homeFirstScreenLayout.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/homeFirstScreenLayout.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/homeFixedHeroLayout.test.ts`
- Test: `artifacts/woofwatcher-mobile/lib/homeSceneReady.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**

```ts
export const HOME_SECTION_ORDER = [
  "identity", "scene-presence", "next-care", "quick-log", "health", "recent",
] as const;

export const HOME_FIRST_VIEWPORT_CONTROL_ORDER = [
  "home-water-primary", "home-water-details",
  "home-meal-primary", "home-meal-details",
  "home-potty-primary", "home-potty-details",
  "home-walk-primary", "home-walk-details",
  "home-all-logging",
] as const;

export const HOME_ACCEPTANCE_LABELS = {
  nextCare: "Next care",
  allLogging: "All logging",
} as const;

export const HOME_WELCOME_DISMISSED_KEY = "woofwatcher.homeWelcomeDismissed.v1";

export const FIRST_USE_INTRO_STEPS = [
  { id: "home", title: "Home", body: "Home shows what is happening now." },
  { id: "log", title: "Log", body: "Log records care and supports corrections." },
  { id: "plans-health", title: "Plans and Health", body: "Plans schedules care. Health keeps trends and shareable records." },
] as const;

export interface HomeScreenContract {
  sectionOrder: typeof HOME_SECTION_ORDER;
  quickKinds: typeof HOME_QUICK_LOG_KINDS;
  labels: typeof HOME_ACCEPTANCE_LABELS;
  allLogging: CanonicalDestination;
  readOnly: boolean;
  readOnlyMessage: string | null;
  privacyDataDestination: CanonicalDestination;
  qaIds: {
    identity: "home-identity";
    scene: "home-scene";
    presence: "home-presence";
    nextCare: "home-next-care";
    health: "home-health";
    recent: "home-recent";
  };
}

export interface HomeFirstViewportGate {
  viewportWidth: 390;
  viewportHeight: 844;
  identityBottomMax: 94;
  scenePresenceBottomMax: 348;
  nextCareActionBottomMax: 458;
  quickLogControlsBottomMax: 686;
  minimumTouchTarget: 48;
}

export interface HomeRenderedMetrics {
  viewport: { width: number; height: number };
  bottomChrome: { top: number; bottom: number; safeAreaInsetBottom: number };
  identity: { top: number; bottom: number };
  scenePresence: { top: number; bottom: number };
  nextCareAction: { top: number; bottom: number };
  quickLogControls: readonly { id: typeof HOME_FIRST_VIEWPORT_CONTROL_ORDER[number]; label: string; top: number; right: number; bottom: number; left: number; width: number; height: number }[];
  health: { top: number; bottom: number; textVisible: boolean };
  recent: { top: number; bottom: number; textVisible: boolean; viewAll: { label: "View all"; top: number; right: number; bottom: number; left: number; width: number; height: number } };
}

export function evaluateHomeFirstViewport(metrics: HomeRenderedMetrics): readonly string[];
```

The gate applies to the settled 390×844 normal state with no storage-warning or first-use banner. `evaluateHomeFirstViewport` derives `contentBottom` from the exact rendered bottom-chrome bounding box (`bottomChrome.top`); it validates the bar is inside the 844px viewport, records its safe-area inset, and never assumes `746`. A storage warning takes visual priority and may push care content below the fold, but the warning and every primary action remain reachable and labeled. Large-text acceptance allows scrolling; it never allows clipped or unreachable controls.

- [ ] **Step 1: Replace mission-peek layout tests with failing care-first geometry tests**

Delete assertions for `todayCommandPeekPx`, `firstMissionPeekPx`, and `mockup-accurate`. Add tests for the numeric section ceilings above plus a measured bottom-chrome top. Require the nine controls in `HOME_FIRST_VIEWPORT_CONTROL_ORDER` exactly once and in that exact DOM/accessibility order; each has a non-empty visible label, is at least 48×48, and has no pairwise rectangle intersection. Require the complete Health line, complete Recent text, and 48×48 labeled **View all** action to end at or above derived `contentBottom`. A 1–2px heading sliver is a failure; if the complete content does not fit, reduce measured identity/scene/next/quick-log heights while preserving touch targets. Keep the existing expanded/mid-collapse/collapsed/remeasured fixed-hero tests unchanged.

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/homeFirstScreenLayout.test.ts \
  artifacts/woofwatcher-mobile/lib/homeScreenContract.test.ts \
  artifacts/woofwatcher-mobile/lib/homeFixedHeroLayout.test.ts \
  artifacts/woofwatcher-mobile/lib/homeSceneReady.test.ts
```

Expected: FAIL because the old layout still describes Today Command/Mission peeks and no screen contract exists.

- [ ] **Step 2: Implement the pure screen contract and focused sections**

`HomeIdentityHeader` renders dog name and `Logging as {caregiver.name}` with the same provider-owned role/source and local-label disclosure used by Log/Fast Log. `HomeScene` is a data-free adapter around the existing backdrop, spacer, and `LivingPhoenixRoom`. `NextCareCard` renders the `HOME_ACCEPTANCE_LABELS.nextCare` heading and exactly one model action. `HomeQuickLog` passes Water/Meal/Potty/Walk to `QuickLogActions`, assigns the nine stable IDs above, and renders typed `/log` with `HOME_ACCEPTANCE_LABELS.allLogging`. `HomeHealthLine` and `RecentCareSummary` consume only model fields and typed destinations. The read-only contract disables every care mutation before callback invocation and leaves canonical Privacy & Data, navigation, and feedback Dismiss enabled. Core help imports these owner constants through `HomeScreenContract.labels`; it does not duplicate the strings.

`FirstUseIntroduction` uses exactly `FIRST_USE_INTRO_STEPS`, visible **Next**, **Done**, and **Dismiss introduction** buttons, and the existing `HOME_WELCOME_DISMISSED_KEY`. It is non-modal/non-blocking, requires no swipe, never exceeds three steps, and does not reappear after either Done or Dismiss stores `"true"`. Tests begin from the existing key to prove this renovation does not strand previously dismissed users.

- [ ] **Step 3: Turn `index.tsx` into a composition shell**

The route owns `useCare`, `useCareLogWorkflow`, viewport/chrome measurements, first-use-introduction collapse state, and navigation serialization. Render `HOME_SECTION_ORDER`. Preserve `HOME_WELCOME_DISMISSED_KEY` exactly while replacing the old welcome card's behavior with the bounded introduction above. Remove Care Sense scores, Today Story, Career/XP, Missions, Today-at-a-glance duplication, full Health/Bile/Alone boards, Quest, Adventure promo, route-local feedback, and route-local logging mutations from Home. Those features remain reachable only from their canonical Log/Health/More owners.

- [ ] **Step 4: Remove hidden Avatar Studio behavior while preserving room touch ownership**

Delete the room `onLongPress`, `openAvatarStudio` long-press route, and unlabeled wand. Keep the ordinary Phoenix tap reaction and the transparent spacer as the scrolling/touch owner. Do not wrap the fixed painted layer in a full-room `Pressable` that can steal a swipe.

- [ ] **Step 5: Add pure contract assertions and stable render selectors**

Construct pure contracts for empty, active Walk, `save-failed`, `newer-version`, and health-alert fixtures. Assert section/control order, exact `CanonicalDestination` values, read-only decision flags, no fabricated numeric scores, no long-press policy, and no full History/mission/report ownership. Add stable test IDs/accessibility names to the real components for Task 6. The pure contract does **not** claim visible JSX or callback wiring. Task 6's exact export must prove the real newer-version screen disables every care mutation before callback invocation, renders `Update WoofWatcher before changing care data. You can still open Privacy & Data to export, reset, or find support.`, and keeps recovery navigation live. Keep `mobileReadiness.test.ts` only as a narrow import/wiring guard.

- [ ] **Step 6: Verify focused behavior and commit**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/homeOverview.test.ts \
  artifacts/woofwatcher-mobile/lib/homeScreenContract.test.ts \
  artifacts/woofwatcher-mobile/lib/homeFirstScreenLayout.test.ts \
  artifacts/woofwatcher-mobile/lib/homeFixedHeroLayout.test.ts \
  artifacts/woofwatcher-mobile/lib/homeSceneReady.test.ts \
  artifacts/woofwatcher-mobile/lib/firstUseIntroduction.test.ts \
  artifacts/woofwatcher-mobile/lib/quickLogScreenContract.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run typecheck
```

Expected: PASS.

```bash
git diff --check
git add -- artifacts/woofwatcher-mobile/app/'(tabs)'/index.tsx artifacts/woofwatcher-mobile/components/home/HomeIdentityHeader.tsx artifacts/woofwatcher-mobile/components/home/HomeScene.tsx artifacts/woofwatcher-mobile/components/home/NextCareCard.tsx artifacts/woofwatcher-mobile/components/home/HomeQuickLog.tsx artifacts/woofwatcher-mobile/components/home/HomeHealthLine.tsx artifacts/woofwatcher-mobile/components/home/RecentCareSummary.tsx artifacts/woofwatcher-mobile/components/home/FirstUseIntroduction.tsx artifacts/woofwatcher-mobile/lib/firstUseIntroduction.ts artifacts/woofwatcher-mobile/lib/firstUseIntroduction.test.ts artifacts/woofwatcher-mobile/lib/homeScreenContract.ts artifacts/woofwatcher-mobile/lib/homeScreenContract.test.ts artifacts/woofwatcher-mobile/lib/homeFirstScreenLayout.ts artifacts/woofwatcher-mobile/lib/homeFirstScreenLayout.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
git diff --cached --check
git commit -m "feat: rebuild Home around current care"
```

---

### Task 6: Exact-Export and Native Home Acceptance Gate

**Files:**
- Test: `artifacts/woofwatcher-mobile/lib/quickLogWorkflow.typecheck.ts` through the mobile source compiler
- Modify: `artifacts/woofwatcher-mobile/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/verify-playwright-browser.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/verify-playwright-browser.test.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/run-e2e-web.mjs`
- Modify: `artifacts/woofwatcher-mobile/scripts/smoke-runtime-preview.js`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReleaseQa.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReleaseSmokeChecklist.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReleaseSmokeChecklist.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/betaHandoffPacket.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/betaHandoffPacket.test.ts`
- Modify: `scripts/mobile-beta-doctor.mjs`
- Create: `scripts/mobile-beta-doctor.test.mjs`
- Modify: `scripts/native-qa-tooling-doctor.mjs`
- Create: `scripts/native-qa-tooling-doctor.test.mjs`
- Modify: `docs/QA_TEST_PLAN.md`
- Create: `docs/qa/2026-08-05-home-hierarchy-evidence.md`

- [ ] **Step 1: Declare, install, and validate the reproducible browser runner**

Pin the runner in the mobile workspace and lockfile; do not rely on a transitive/global module:

```bash
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs \
  --filter @workspace/woofwatcher-mobile add --save-dev --save-exact playwright@1.62.1
PLAYWRIGHT_BROWSERS_PATH=0 \
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs \
  --filter @workspace/woofwatcher-mobile exec playwright install chromium
```

Add the cross-platform `"e2e:web": "node scripts/run-e2e-web.mjs"` to `package.json`. `run-e2e-web.mjs` contains no static Playwright import: as its first executable statement it sets `process.env.PLAYWRIGHT_BROWSERS_PATH = "0"`, then dynamically imports/starts Playwright-owning children. Every Playwright child entry retains the same value, and the wrapper passes that environment to the validator, preview, and workflow children. `verify-playwright-browser.mjs` dynamically imports the declared package only after setting the variable, chooses an existing executable from `PLAYWRIGHT_CHROMIUM` or `chromium.executablePath()`, checks executable access, launches it with `--no-sandbox`, opens `about:blank`, and closes it. Without an explicit override, it derives the hermetic root from the real directory containing the declared `playwright-core/package.json` plus `.local-browsers` (so pnpm's real `.pnpm/...` path is valid), resolves both that root and the runtime executable with `realpath`, and fails if the executable is outside it. The module exports its path-resolution result behind an ESM main guard; `verify-playwright-browser.test.mjs` imports that function after the declared install and compares the real runtime executable/root with the install-time `PLAYWRIGHT_BROWSERS_PATH=0` root without requiring a browser launch. An explicit absolute `PLAYWRIGHT_CHROMIUM` is reported as an override and exempt from the hermetic-root assertion. A missing module/lock entry exits `BROWSER_RUNNER_UNDECLARED` and fails the implementation gate. Only after the package is declared may a missing or unlaunchable executable exit the single external blocker `BROWSER_UNAVAILABLE`.

`run-e2e-web.mjs` first runs that validator, starts `preview:smoke` against the freshly emitted export on an available loopback port, waits for an HTTP 200 with a bounded 20-second timeout, passes its exact `BASE_URL`, `E2E_SCOPE`, and hermetic browser environment to `e2e-web-workflows.mjs`, and always terminates the preview child on success, failure, or signal. This makes the gate one reproducible command rather than an undocumented background-server sequence.

Replace the workflow's hard-coded base/launcher with the declared runner:

```js
process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
const { chromium } = await import("playwright");
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4194";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || chromium.executablePath();
const launchOptions = { executablePath, args: ["--no-sandbox"] };
```

Remove old Today/Pack/Story/XP/sample assertions and the duplicated no-op text-length expression.

Repair the root doctors in this same foundation task. `mobile-beta-doctor.mjs` first uses the current package-runner path in `process.env.npm_execpath` when it resolves and reports the pinned `10.24.0`; otherwise it resolves `../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs` from the repository root. It invokes that `.cjs` through `process.execPath` for version/subcommands and never rediscovers a different PATH `pnpm`. Its focused test invokes the doctor through the pinned runner, prepends a fake `pnpm` reporting `11.7.0`, and proves the doctor still detects/uses `10.24.0`. Update both doctor payloads and their source-backed route checks, plus `mobileReleaseQa`, `mobileReleaseSmokeChecklist`, and `betaHandoffPacket`, to the active root vocabulary **Home, Log, Plans, Health, More**. Records is described and captured only as a Health section; legacy Plan/Today/Pack/Story names may appear only in a labeled redirect-compatibility list, never the active capture/checklist/next-action list. Tests assert the five active route names, ten platform screenshots, subordinate Records wording, and absence of the retired eight-route instruction.

- [ ] **Step 2: Add exact-export persisted Home/Quick Log checks**

At 390×844, locate the real `home-*` elements plus the rendered bottom tab bar, record its bounding-box top/bottom and safe-area inset, and derive the content boundary from that chrome. Assert `HOME_FIRST_VIEWPORT_CONTROL_ORDER` exactly (four primary, their four Details controls, then All logging), non-empty visible labels, 48×48 bounds, pairwise non-overlap, and complete Health/Recent/**View all** content above the measured chrome. Seed `Avery`/`Parent`, set a conflicting auth display name, navigate Home → Log → Fast Log → Home, and assert every `Logging as`, recorded role, saved entry `caregiver`/`details.caregiverRole`, feedback item, and History row remains local `Avery`/`Parent`. Change Avery's current household role after saving and prove History still displays the recorded role. Repeat once with no valid caregivers and assert explicit `Local caregiver`/`null` fallback in entry and feedback. Exercise Water, configured mixed-fraction Meal confirmation (`1.5 cup`), Potty chooser, Walk start, reload, Walk Finish entry point, Details, global Undo, and **All logging**. After each create, read `localStorage.getItem("woofwatcher.v2.state")`, parse it, and assert exact newest fields from Task 1; reload and assert the same fields and active session remain.

For same-turn dedupe, do **not** use two sequential Playwright `click()` calls. Use one `page.evaluate` callback that synchronously calls `dispatchEvent(new MouseEvent("click", { bubbles: true }))` twice on the same Water control before returning to the event loop; repeat with a backdated finalized confirmation and assert one stored entry/one feedback. Navigate before Undo and prove the global host still deletes the exact create ID. Finish a Walk and return from Alone Time, then Undo each and prove the same persisted entry returns to its original active snapshot rather than disappearing. Seed a newer-version raw envelope, snapshot its exact string/UTF-8 bytes, prove every mutation callback is blocked and no empty ID produces feedback, open Privacy & Data, export the protected envelope, compare exact bytes, and only then exercise reset in a separate destructive recovery fixture. Never label an export of exposed defaults as the future-document backup.

- [ ] **Step 3: Re-run the repaired scene proof**

At 390×844 and 1365×700, sample welcome expanded, every collapse frame, collapsed, and a resize. Fixed room/live spacer error stays ≤1px. Scroll 620px beginning over Phoenix: spacer/content moves −620px while room/backdrop moves 0px. Phoenix tap still reacts. A mouse drag is not recorded as native swipe proof.

- [ ] **Step 4: Run repository gates on the exact tree**

Run:

```bash
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs run doctor:mobile-beta
node --test scripts/mobile-beta-doctor.test.mjs scripts/native-qa-tooling-doctor.test.mjs artifacts/woofwatcher-mobile/scripts/verify-playwright-browser.test.mjs
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs run test:focused
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile exec tsc -p tsconfig.json --noEmit --pretty false
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs run build:ci
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile run smoke:web
```

Expected: `READY_FOR_EXPORT`, the doctor uses pinned pnpm 10.24.0 even with a conflicting PATH candidate, active route vocabulary is Home/Log/Plans/Health/More, the source compiler checks `quickLogWorkflow.typecheck.ts` and consumes its three negative directives, all other tests/builds/routes/assets PASS, and a fresh Expo export is emitted from the exact commit candidate.

- [ ] **Step 5: Run the exact exported browser flow**

Run the declared validator/server/workflow wrapper against the just-emitted export:

```bash
E2E_SCOPE=home \
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs \
  --filter @workspace/woofwatcher-mobile run e2e:web
```

Expected: runner self-check, installed/runtime browser-path equality, bounded preview startup/cleanup, Home order/derived-chrome geometry, the compact safety matrix, persisted fields/reload, exact Undo, navigation-owned feedback, scene alignment, short-desktop sizing, keyboard order, and no app-origin console errors PASS. An explicit `PLAYWRIGHT_CHROMIUM=/absolute/path/to/validated/chromium` may override the bundled binary. If neither declared runner path launches, record `BROWSER_UNAVAILABLE`, leave `E2E_SCOPE=home` and every later rendered scope explicitly **PENDING**, make no JSX/render/callback PASS claim, and continue pure implementation tasks; merge remains blocked until the same exact-export command passes every rendered scope on a launchable declared/explicit browser.

- [ ] **Step 6: Run physical iOS and Android Home checks**

On the recorded Release-build baselines (iPhone 13/iOS 18.6 and Pixel 7a/Android 15, or recorded agreed equivalents), verify swipe beginning on Phoenix scrolls without logging/opening Avatar Studio, tap still reacts, Water/Meal/Potty outcomes match persisted History, active Walk survives force-close/relaunch, global feedback/Undo survives route navigation, VoiceOver/TalkBack order is visual, and required large-text settings keep actions reachable. Browser or mouse evidence cannot check this step.

- [ ] **Step 7: Record evidence and commit**

Record exact commit/tree SHA, build/export hash, browser executable/version, viewport/device/OS, fixture, storage fields, geometry measurements, screenshots/videos, console state, native swipe result, accessibility result, and every unresolved blocker in `docs/qa/2026-08-05-home-hierarchy-evidence.md`.

```bash
git diff --check
rg -n "Today Command|Today's Missions|Tap saves\. Hold|Long press for details|hydrationScore = 72" artifacts/woofwatcher-mobile/app/'(tabs)'/index.tsx artifacts/woofwatcher-mobile/components/home artifacts/woofwatcher-mobile/components/log docs/QA_TEST_PLAN.md
git add -- artifacts/woofwatcher-mobile/package.json pnpm-lock.yaml artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs artifacts/woofwatcher-mobile/scripts/verify-playwright-browser.mjs artifacts/woofwatcher-mobile/scripts/verify-playwright-browser.test.mjs artifacts/woofwatcher-mobile/scripts/run-e2e-web.mjs artifacts/woofwatcher-mobile/scripts/smoke-runtime-preview.js artifacts/woofwatcher-mobile/lib/mobileReleaseQa.ts artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts artifacts/woofwatcher-mobile/lib/mobileReleaseSmokeChecklist.ts artifacts/woofwatcher-mobile/lib/mobileReleaseSmokeChecklist.test.ts artifacts/woofwatcher-mobile/lib/betaHandoffPacket.ts artifacts/woofwatcher-mobile/lib/betaHandoffPacket.test.ts scripts/mobile-beta-doctor.mjs scripts/mobile-beta-doctor.test.mjs scripts/native-qa-tooling-doctor.mjs scripts/native-qa-tooling-doctor.test.mjs docs/QA_TEST_PLAN.md docs/qa/2026-08-05-home-hierarchy-evidence.md
git diff --cached --check
git commit -m "docs: record Home hierarchy verification"
```

Expected: no whitespace errors, no retired Home/hidden-gesture instruction in active consumer paths, and evidence distinguishes implementation/automated PASS from one consolidated external merge/release blocker listing any unavailable declared-browser executable, physical iOS, physical Android, signing, accessibility, or owner evidence.

---

## Self-Review Record

- Spec coverage: the pre-Home type-safe routine matcher with four-zone subprocess proof; shared safe Quick Log authority with one captured action/lock clock; transport-free creates; complete finalized-input validation; exact create ID and atomic concrete-revision update Undo; persisted caregiver role/feedback attribution with preserved trust/proof on updates; source-aware future-envelope recovery wired into Privacy in Task 2; compact Home actions and separate secondary/composer inventories; deterministic session selection; measured-chrome first viewport with nine exact controls and exported acceptance labels; three-step first-use guidance; hidden-gesture removal; hermetic Playwright resolution; pinned/five-tab doctors; accessibility; persisted export checks; and native gates each map to a task above.
- Slice-1 path alignment: this plan consumes `components/health/HealthSectionRouter.tsx`, `components/health/RecordsScreen.tsx`, `components/more/MoreSectionRouter.tsx`, `components/more/CareTeamSuppliesScreen.tsx`, and `components/more/StoryProgressScreen.tsx` only as prerequisite proof; it creates no nested or duplicate owners.
- Current-source path check: every base-owned Modify/Test path exists on audited plan base `c6e243c`; `PrivacyDataScreen.tsx` is an explicit Slice-1 implementation-prerequisite output; every slice-owned absent path is explicitly listed as Create; Slice 0's strict amount parser is Test-only and is never shadowed. Slice-1 section-router files are implementation-prerequisite outputs rather than alternate owners.
- Type consistency: `CareEntryCreateInput`, derived `ParsedStrictPositiveAmountWithUnit`, `FinalizedCareInput`, `FinalizedCareMutation`, `LocalCaregiverIdentity`, `ProtectedCareEnvelopeRecovery`, `CareLogWorkflowResult`, `CareLogFeedback`, `CanonicalDestination`, `HomeNextCare`, `HOME_ACCEPTANCE_LABELS`, and the two action-order constants use one spelling throughout. The non-excluded `quickLogWorkflow.typecheck.ts` is compiled explicitly in Tasks 1 and 6.
- Placeholder scan: this plan contains no deferred implementation marker; external browser/device absence is represented as an explicit merge blocker rather than substituted evidence.
