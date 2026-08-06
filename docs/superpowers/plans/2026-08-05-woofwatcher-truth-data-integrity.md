# WoofWatcher Truth and Data Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every saved care value, generated report, file share, record attachment, and Avatar Studio claim accurate before the renovated interface exposes those workflows more prominently.

**Architecture:** Add zero-dependency parsing, calendar, migration, report-model, share-outcome, and attachment-lifecycle seams under `artifacts/woofwatcher-mobile/lib`. Route components consume those seams and remain composition layers. Persist malformed legacy values without coercion, attach explicit correction issues, and exclude invalid values from due/next calculations. Native adapters wrap Expo file, print, and sharing APIs behind dependency-injected interfaces so pure tests prove transaction order and outcome language.

**Tech Stack:** TypeScript 5.9, Expo SDK 54, React Native 0.81, Expo Router 6, AsyncStorage, `expo-file-system/legacy`, Node 24 built-in test runner, pnpm 10.24.0.

## Global constraints

- Keep the app local-first and preserve the existing care-domain safety and sync boundaries.
- Do not silently normalize an impossible legacy date, malformed time, or malformed number into a plausible value.
- Do not claim a file was delivered or shared. Without an external receipt, native success means only `share-sheet-opened`.
- Delete only manifest-owned files under the versioned Records attachment directory. Never delete external, cache, web, arbitrary `file://`, or `content://` URIs.
- Provider-backed auth, cloud sync, live AI, push delivery, payments, cloud report storage, and true multi-dog features remain gated.
- Every production change begins with a failing behavioral test and ends with the focused test, workspace typecheck, full CI/export, and applicable physical-device evidence.
- Use the pinned package manager from the repository parent:

```bash
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs <command>
```

---

### Task 1: Local Calendar and Strict Input Foundation

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/localCalendar.ts`
- Create: `artifacts/woofwatcher-mobile/lib/localCalendar.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/inputValidation.ts`
- Create: `artifacts/woofwatcher-mobile/lib/inputValidation.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/time.ts`

**Interfaces:**

```ts
export interface LocalCalendarParts {
  year: number;
  month: number;
  day: number;
}

export type LocalCalendarPartsResolver = (instant: Date) => LocalCalendarParts;

export interface ParsedClockTime {
  minutesSinceMidnight: number;
  canonical24Hour: string;
  display12Hour: string;
}

export interface MealAmountInput {
  completed: boolean;
  served: string;
  servedUnit: string;
  eaten: string;
  eatenUnit: string;
}

export type MealAmountValidation =
  | { ok: true; served: number | null; eaten: number | null }
  | { ok: false; field: "served" | "eaten"; message: string };
```

- `localDateKey(value, resolveParts?)` returns padded `YYYY-MM-DD` from local calendar parts.
- `todayLocalDateKey(now?, resolveParts?)` accepts an injected clock instant.
- `parseLocalDateKey(value)` accepts only a real round-tripping Gregorian `YYYY-MM-DD` value and returns `null` for rollovers.
- `addLocalCalendarDays(key, amount)` performs local calendar arithmetic through noon and returns a canonical key.
- `parseClockTime(value)` consumes the entire string and accepts only `H:MM`/`HH:MM` 24-hour or `h:mm AM/PM` input.
- `parseStrictNonNegativeDecimal(value)` consumes the entire trimmed string and rejects signs, exponent notation, `NaN`, infinity, and trailing text.
- `validateMealAmounts(input)` requires a positive served amount for a completed meal and rejects eaten greater than served when normalized units match.

- [ ] **Step 1: Write failing local-calendar tests**

Cover local-day keys immediately before and after midnight, an evening UTC rollover in `America/Los_Angeles`, an east-of-UTC rollover in `Asia/Tokyo`, year rollover, leap day, impossible `2026-02-31`, DST spring-forward, and DST fall-back. Use injected `LocalCalendarPartsResolver` instances backed by `Intl.DateTimeFormat(..., { timeZone })`; do not mutate global time.

Run:

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/localCalendar.test.ts
```

Expected: FAIL because `localCalendar.ts` does not exist.

- [ ] **Step 2: Implement the smallest calendar helper**

Use local getters for the default resolver and a `padStart(2, "0")` canonical key. `parseLocalDateKey` must compare the parsed year/month/day back to the input parts before returning.

- [ ] **Step 3: Write failing strict-input tests**

Cover valid 24-hour and 12-hour inputs plus rejection of `7:99 PM`, `7x:30 PM`, `24:00`, missing minutes, trailing text, `1abc`, `-1`, exponent notation, completed meal without served amount, completed meal with zero served, and same-unit eaten greater than served.

Run:

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/inputValidation.test.ts
```

Expected: FAIL because `inputValidation.ts` does not exist.

- [ ] **Step 4: Implement the strict parsers and meal invariant**

Return structured values/errors. Do not place route copy, React state, or persistence operations in these helpers.

- [ ] **Step 5: Make `time.ts` delegate to the canonical calendar helper**

Preserve the existing `relativeTime`, `dayKey`, `dayLabel`, `todayISO`, and `parseLocalDate` public names while making `dayKey`, `todayISO`, and `parseLocalDate` use the new strict/local behavior.

- [ ] **Step 6: Verify the focused foundation**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/localCalendar.test.ts \
  artifacts/woofwatcher-mobile/lib/inputValidation.test.ts \
  artifacts/woofwatcher-mobile/lib/monthCalendar.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the task**

```bash
git add artifacts/woofwatcher-mobile/lib/localCalendar.ts artifacts/woofwatcher-mobile/lib/localCalendar.test.ts artifacts/woofwatcher-mobile/lib/inputValidation.ts artifacts/woofwatcher-mobile/lib/inputValidation.test.ts artifacts/woofwatcher-mobile/lib/time.ts
git commit -m "fix: make local care dates and inputs strict"
```

---

### Task 2: Idempotent Legacy Correction Migration

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/careDocMigration.ts`
- Create: `artifacts/woofwatcher-mobile/lib/careDocMigration.test.ts`
- Create: `lib/care-domain/src/clock-time.ts`
- Create: `lib/care-domain/test/clock-time.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/inputValidation.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/inputValidation.test.ts`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`
- Modify: `lib/care-domain/src/index.ts`
- Modify: `lib/care-domain/src/routine-board.ts`
- Modify: `lib/care-domain/src/handoff.ts`
- Modify: `lib/care-domain/src/medication.ts`
- Modify: `lib/care-domain/test/routine-board.test.ts`
- Modify: `lib/care-domain/test/health-handoff.test.ts`
- Modify: `lib/care-domain/test/medication.test.ts`

**Interfaces:**

```ts
export const CURRENT_CARE_DOC_DATA_VERSION = 1;

export type CareCorrectionField = "time" | "date" | "due";

export interface CareCorrectionIssue {
  field: CareCorrectionField;
  rawValue: string;
  message: string;
}

export interface MigratableCareDoc {
  dataVersion?: number;
  routines?: Array<Record<string, unknown>>;
  records?: Array<Record<string, unknown>>;
  calendarEvents?: Array<Record<string, unknown>>;
}

export function migrateCareDoc<T extends MigratableCareDoc>(doc: T): T & {
  dataVersion: typeof CURRENT_CARE_DOC_DATA_VERSION;
};
```

Add `dataVersion` to `CareDoc` and optional `correctionIssues` to `Routine`, `Record`, and `CalendarEvent`. The raw legacy value stays in the original field and is duplicated in the issue for explicit recovery. Valid values receive no issue.

The care-domain clock parser owns the canonical implementation:

```ts
export interface ParsedClockTime {
  minutesSinceMidnight: number;
  canonical24Hour: string;
  display12Hour: string;
}

export function parseClockTime(value: string): ParsedClockTime | null;
```

`artifacts/woofwatcher-mobile/lib/inputValidation.ts` re-exports that parser and type so mobile callers keep the Task 1 import path. `RoutineBoardStatus` adds `"needs-correction"`; invalid routines remain visible at the end of `RoutineBoard.items`, use `minutesFromNow: null`, and are excluded from `next`. Handoff and medication calculations omit invalid-time routines from next/due/missed/upcoming results rather than converting them to midnight.

- [ ] **Step 1: Write failing migration tests**

Prove that malformed routine time, event date/time, and record due date are preserved and marked; valid values are unchanged; unrelated fields survive; a second migration is deeply equal to the first; and absent arrays/default documents remain safe.

Run:

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/careDocMigration.test.ts
```

Expected: FAIL because the migration module does not exist.

- [ ] **Step 2: Implement pure migration and validity predicates**

Use Task 1 parsers. Export narrow helpers `hasCorrectionIssue(item, field)` and `isSchedulableRoutine(item)` so routes/domain logic do not re-interpret issue arrays.

- [ ] **Step 3: Integrate migration at hydration and write boundaries**

Call `migrateCareDoc` from `mergeDoc()` before state is exposed. Ensure `getDefaultDoc()` includes the current `dataVersion`. Ensure locally updated and server-adopted documents are migrated once and serialized with that version.

- [ ] **Step 4: Write failing due/next tests**

Add cases proving invalid legacy routine times remain visible as `needs-correction` after valid Routine Board items, have `minutesFromNow: null`, and are excluded from Routine Board `next`, handoff `next`, and medication due/missed/upcoming calculations. Add direct parser parity tests to both the care-domain and mobile suites.

- [ ] **Step 5: Update care-domain consumers**

Replace permissive `parseInt` time handling with a shared full-string parser in the zero-dependency care domain. Because the mobile helper cannot be imported into the lower-level package, add `lib/care-domain/src/clock-time.ts` with the same canonical parser contract and export it from `lib/care-domain/src/index.ts`; mobile `parseClockTime` may wrap or re-export it rather than duplicate logic.

- [ ] **Step 6: Verify migration and domain behavior**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/careDocMigration.test.ts \
  artifacts/woofwatcher-mobile/lib/inputValidation.test.ts \
  lib/care-domain/test/clock-time.test.ts \
  lib/care-domain/test/routine-board.test.ts \
  lib/care-domain/test/health-handoff.test.ts \
  lib/care-domain/test/medication.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the task**

```bash
git add artifacts/woofwatcher-mobile/lib/careDocMigration.ts artifacts/woofwatcher-mobile/lib/careDocMigration.test.ts artifacts/woofwatcher-mobile/lib/inputValidation.ts artifacts/woofwatcher-mobile/lib/inputValidation.test.ts artifacts/woofwatcher-mobile/context/CareContext.tsx lib/care-domain/src lib/care-domain/test
git commit -m "fix: preserve and quarantine invalid legacy care values"
```

---

### Task 3: Adopt Local Dates and Strict Validation in Care Workflows

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/careWorkflowValidation.ts`
- Create: `artifacts/woofwatcher-mobile/lib/careWorkflowValidation.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/calendar.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/log.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/records.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/more.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/calendar-month.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/woofguide.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/woofGuideActions.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/localCalendar.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/localCalendar.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/inputValidation.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/inputValidation.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/quickLogEntry.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/quickLogEntry.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/monthCalendar.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/monthCalendar.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

- [ ] **Step 1: Strengthen pure workflow behavior before source edits**

Create a zero-dependency form seam whose result is either a canonical value or one plain field-specific error. Add behavioral tests for local Today/Tomorrow keys, local history/streak grouping, invalid routine/event save messages, invalid legacy “Needs correction” presentation, strict detailed-log values, and configured quick-meal portions that contain trailing garbage. Route/source checks may verify imports and wiring, but they are not the behavior authority.

The form seam must cover at least these contracts:

```ts
export type CareDraftValidation<T> =
  | { ok: true; value: T }
  | { ok: false; field: "label" | "title" | "time" | "date" | "weight"; message: string };

export function validateRoutineDraft(input: RoutineDraftInput): CareDraftValidation<CanonicalRoutineDraft>;
export function validateCalendarEventDraft(input: CalendarEventDraftInput): CareDraftValidation<CanonicalCalendarEventDraft>;
```

Prove that failed results do not expose a persistable value. Valid 12-hour or 24-hour times return one canonical display value; impossible dates and non-empty malformed optional times fail rather than being trimmed into validity.

Run the changed tests and record the expected failures against the current permissive implementation.

- [ ] **Step 2: Replace every user-facing UTC day key**

Migrate all current `new Date(...).toISOString().slice(0, 10)` and timestamp-prefix day grouping paths in Calendar, Month Calendar, Log, Records, More, WoofGuide, and `woofGuideActions.ts` to `localDateKey`/`todayLocalDateKey`. Export one validated `localDateKeyFromParts` helper and make `monthCalendar.ts` emit padded `YYYY-MM-DD` keys while preserving its documented zero-based month input/output API for callers. Update `calendar-month.tsx` to create selections through that helper rather than interpolating old `${year}-${month0}-${day}` keys. Use `addLocalCalendarDays` for Tomorrow and streak iteration. Preserve UTC ISO timestamps for actual instants; only local day bucketing changes.

Run the local-calendar and month suites under the default zone plus `America/Los_Angeles`, `Asia/Tokyo`, and `Pacific/Kiritimati`. Include east/west UTC-boundary fixtures, year rollover, and both Los Angeles DST transitions.

- [ ] **Step 3: Use one strict routine/event validation path**

`submitRoutine` and `submitEvent` consume the pure form seam, reject malformed values with plain field-specific messages, and never persist them. Routine sorting consumes parsed minutes, with invalid legacy routines sorted last. Impossible dates and malformed optional event times block save. User-entered valid time values may be stored in the parser's canonical display form; migration-owned malformed raw values are never coerced.

- [ ] **Step 4: Use full-string numeric and meal validation**

Replace `parseNonNegativeNumber` in Log with `parseStrictNonNegativeDecimal`; integral count fields must additionally reject fractions. Route completed meal saves through `validateMealAmounts`. Validate More's profile weight as a strict positive full-string decimal and keep the editor open with a field error instead of silently retaining the old value.

Add and use a single `parseStrictPositiveAmountWithUnit` in `inputValidation.ts` for configured quick meals. It accepts complete decimal/fraction/mixed-fraction amounts plus an explicit supported unit/plural table, returns a canonical amount/unit, and rejects zero, ranges, prose, unknown units, and suffix garbage such as `1 cup trailing`. Remove `quickLogEntry.ts`'s permissive numeric-prefix matcher.

- [ ] **Step 5: Show correction state without coercion**

Plans/Records render “Needs correction” and the preserved value. Invalid items are editable but do not appear as due/next/completed. Do not drop them from lists.

- [ ] **Step 6: Verify all affected workflow tests**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/careWorkflowValidation.test.ts \
  artifacts/woofwatcher-mobile/lib/localCalendar.test.ts \
  artifacts/woofwatcher-mobile/lib/inputValidation.test.ts \
  artifacts/woofwatcher-mobile/lib/careDocMigration.test.ts \
  artifacts/woofwatcher-mobile/lib/monthCalendar.test.ts \
  artifacts/woofwatcher-mobile/lib/quickLogEntry.test.ts \
  artifacts/woofwatcher-mobile/lib/woofGuideActions.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the task**

```bash
git add artifacts/woofwatcher-mobile/app artifacts/woofwatcher-mobile/lib lib/care-domain
git commit -m "fix: apply local dates and strict care validation"
```

---

### Task 4: Complete Unicode Reports and Dog ID Layout

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/reportDocument.ts`
- Create: `artifacts/woofwatcher-mobile/lib/reportDocument.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/reportGeneratedBinaryArtifact.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/reportGeneratedBinaryArtifact.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/reportArtifactExportFile.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/reportArtifactExportFile.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/records.tsx`
- Modify: `artifacts/woofwatcher-mobile/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

```ts
export interface ReportSection {
  id: string;
  heading: string;
  lines: string[];
}

export interface CarePassDocument {
  title: string;
  summary: string;
  sections: ReportSection[];
}

export interface DogIdLayoutRow {
  id: "name" | "breed" | "weight" | "vet" | "emergency" | "microchip" | "insurance";
  label: string;
  value: string;
  lines: string[];
  top: number;
  bottom: number;
}
```

The document builder must preserve Unicode and expose semantic sections/layout rows for tests. Native PDF generation uses complete HTML with CSS page breaking through an SDK-54-compatible print adapter. The Dog ID renderer computes wrapped rows before choosing canvas/page height; it never relies on metadata to satisfy visible-field requirements.

- [ ] **Step 1: Add failing completeness and layout tests**

Use a worst-case fixture with unique sentinels in every Care Pass section, long Unicode dog/caregiver/medication text, many records, long emergency contact, long microchip, and long insurance values. Assert every sentinel exists in the document source, pagination has more than one page for the fixture, and all seven Dog ID rows have non-overlapping visible bounds inside the output canvas.

- [ ] **Step 2: Implement semantic report and Dog ID layout models**

Build from the existing care-domain Care Pass printable view. Escape HTML without stripping Unicode. Make page content deterministic and testable before invoking any native API.

- [ ] **Step 3: Add the SDK-compatible print dependency**

Use Expo’s installer from the pinned CLI to select the SDK 54 compatible package version:

```bash
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile exec expo install expo-print
```

Review the exact `package.json` and lockfile diff; do not change Expo/Router SDK versions.

- [ ] **Step 4: Replace one-page ASCII generation**

Remove the 28-line cap and ASCII sanitizer from the PDF path. Generate native PDFs from the complete document HTML and expose web download fallback from the same source. Keep artifact filenames, MIME types, and SHA/byte metadata accurate.

- [ ] **Step 5: Make Dog ID output visibly complete**

Render every priority row, including Microchip and Insurance, with deterministic wrapping and either a fitted dynamic canvas or documented multi-page/card strategy. Assert no row falls outside the bitmap.

- [ ] **Step 6: Verify report/domain tests**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/reportDocument.test.ts \
  artifacts/woofwatcher-mobile/lib/reportGeneratedBinaryArtifact.test.ts \
  artifacts/woofwatcher-mobile/lib/reportArtifactExportFile.test.ts \
  lib/care-domain/test/care-pass.test.ts
```

Expected: PASS with all sentinels and visible fields present.

- [ ] **Step 7: Commit the task**

```bash
git add artifacts/woofwatcher-mobile/lib artifacts/woofwatcher-mobile/app/'(tabs)'/records.tsx artifacts/woofwatcher-mobile/package.json pnpm-lock.yaml
git commit -m "fix: generate complete Unicode care reports"
```

---

### Task 5: Native File Sharing and Truthful Outcome History

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/nativeFileShare.ts`
- Create: `artifacts/woofwatcher-mobile/lib/nativeFileShare.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/shareText.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/reportArtifactExportFile.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/reportGeneratedBinaryArtifact.ts`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/records.tsx`
- Modify: `artifacts/woofwatcher-mobile/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

```ts
export type FileShareOutcome =
  | { status: "share-sheet-opened" }
  | { status: "copied" }
  | { status: "downloaded" }
  | { status: "canceled" }
  | { status: "failed"; message: string };

export interface ShareableFile {
  uri: string;
  fileName: string;
  mimeType: string;
  uniformTypeIdentifier?: string;
}

export interface NativeFileShareDependencies {
  isAvailable(): Promise<boolean>;
  open(uri: string, options: { mimeType: string; UTI?: string; dialogTitle: string }): Promise<void>;
}

export async function shareFile(
  file: ShareableFile,
  dependencies: NativeFileShareDependencies,
): Promise<FileShareOutcome>;
```

- [ ] **Step 1: Write failing outcome tests**

Cover unavailable adapter, open success, thrown cancel-shaped error, thrown ordinary error, and web copy/download plans. Assert no outcome string says delivered or shared.

- [ ] **Step 2: Add the SDK-compatible sharing dependency**

```bash
node ../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs --filter @workspace/woofwatcher-mobile exec expo install expo-sharing
```

Review the package/lockfile diff and retain SDK 54.

- [ ] **Step 3: Implement the narrow Expo adapter**

Wrap `Sharing.isAvailableAsync()` and `Sharing.shareAsync()` behind the injected dependency. A resolved `shareAsync` call records only `share-sheet-opened`; it cannot prove recipient delivery.

- [ ] **Step 4: Make report history await the result**

Generate/write the file, await `shareFile`, then append a Care Pass history entry only for `share-sheet-opened`, `copied`, or `downloaded`, recording that exact status. Canceled and failed attempts remain visible in current UI feedback but are never stored as successful shares.

- [ ] **Step 5: Remove Android text/URL attachment claims**

Delete route-level `Share.share({ url })` paths for generated artifacts. Keep `shareTextPayload` only for explicitly text-only workflows and normalize its cancellation result to `canceled`.

- [ ] **Step 6: Verify adapter and report tests**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/nativeFileShare.test.ts \
  artifacts/woofwatcher-mobile/lib/reportGeneratedBinaryArtifact.test.ts \
  artifacts/woofwatcher-mobile/lib/reportArtifactExportFile.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the task**

```bash
git add artifacts/woofwatcher-mobile pnpm-lock.yaml
git commit -m "fix: share generated reports as real files"
```

---

### Task 6: Manifest-Owned Record Attachment Lifecycle

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/recordAttachmentLifecycle.ts`
- Create: `artifacts/woofwatcher-mobile/lib/recordAttachmentLifecycle.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/attachmentManifest.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/attachmentManifest.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/durablePickedMedia.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/durablePickedMedia.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/records.tsx`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`

**Interfaces:**

```ts
export interface OwnedRecordAttachment {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
}

export interface AttachmentLifecycleDependencies {
  copyToOwnedStorage(sourceUri: string, fileName: string): Promise<OwnedRecordAttachment>;
  persistReference(recordId: string, attachment: OwnedRecordAttachment | null): Promise<void>;
  deleteOwnedFile(uri: string): Promise<void>;
  isManifestOwned(uri: string): boolean;
}
```

Export `addRecordAttachment`, `replaceRecordAttachment`, `cancelDraftAttachment`, and `deleteRecordAttachment`. Replacement order is copy new -> persist new reference -> delete old. Persistence failure deletes the new draft and keeps the old reference/file. Cleanup is idempotent.

- [ ] **Step 1: Write failing transaction tests**

Prove success order, new-copy failure, metadata-persist failure rollback, old-file cleanup failure recovery, double cancel/delete safety, and refusal to delete arbitrary external/cache/web/content URIs.

- [ ] **Step 2: Extend the manifest model**

Version the Records attachment directory and manifest. Classify legacy app-owned URIs only when they are inside the known historical directory; all other URIs remain external/transient.

- [ ] **Step 3: Implement lifecycle controller**

Keep file APIs injected. Return structured retryable cleanup state instead of swallowing errors.

- [ ] **Step 4: Wire Records UI actions**

Add labeled Open/Preview, Share, Download, Replace, and Delete actions. Canceling a modal cleans a copied draft. Deleting a record removes metadata and then its manifest-owned file with visible retry if cleanup fails. Web references are labeled temporary and are never promised after reload.

- [ ] **Step 5: Verify attachment and route contracts**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/recordAttachmentLifecycle.test.ts \
  artifacts/woofwatcher-mobile/lib/attachmentManifest.test.ts \
  artifacts/woofwatcher-mobile/lib/durablePickedMedia.test.ts \
  artifacts/woofwatcher-mobile/lib/nativeFileShare.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the task**

```bash
git add artifacts/woofwatcher-mobile
git commit -m "fix: make record attachments durable and recoverable"
```

---

### Task 7: Remove False Avatar Photo-Scan Claims

**Files:**
- Modify: `artifacts/woofwatcher-mobile/lib/avatarStudio.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/avatarStudio.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/portrait.tsx`
- Modify: `artifacts/woofwatcher-mobile/context/AvatarContext.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/more.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interface changes:**

- Remove `scanAssisted`, `AvatarScanSuggestion`, confidence, detected traits, and `buildTemplateScanSuggestion`.
- Add `referencePhotoUri?: string` and `selectionMethod: "manual-template" | "profile-suggestion"` to the persisted avatar configuration through a backward-compatible normalizer.
- If a profile-based suggestion remains, name it `buildProfileTemplateSuggestion(profile)` and derive only from fields explicitly supplied by the owner; it must not inspect or claim to inspect a photo.

- [ ] **Step 1: Replace tests that bless the false scan model**

Write failing tests proving legacy `scanAssisted` is discarded during normalization, selected photos are reference-only, suggestions never include confidence/detected claims, and the configured predicate accepts a manual template.

- [ ] **Step 2: Remove analyzer-shaped domain state**

Delete the fake scan workflow and timer-dependent suggestion builder. Preserve compatible avatar colors, template, accessories, and saved owner choices.

- [ ] **Step 3: Rewrite Portrait and More copy**

Use “Photo reference,” “Choose a starting template,” and “Adjust your pixel dog.” Remove scanning delay, progress, detected-trait chips, “high confidence,” and “scan-assisted.” Every visible action must correspond to manual selection or saved configuration.

- [ ] **Step 4: Verify avatar truthfulness**

Run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/avatarStudio.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
```

Expected: PASS and `rg -n "scan-assisted|high confidence|detected traits|Analyzing photo" artifacts/woofwatcher-mobile` returns no consumer-facing matches.

- [ ] **Step 5: Commit the task**

```bash
git add artifacts/woofwatcher-mobile
git commit -m "fix: make Avatar Studio claims truthful"
```

---

### Task 8: Slice 0 Integration and Physical-Device Gate

**Files:**
- Modify: `docs/QA_TEST_PLAN.md`
- Modify: `docs/release/MOBILE_RELEASE_RUNBOOK.md`
- Create: `docs/qa/2026-08-05-truth-data-integrity-device-evidence.md`

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

Expected: workspace types, API/PWA/mockup builds, Expo export, asset audit, and route/handoff checks pass.

- [ ] **Step 3: Inspect generated long-form artifacts**

Using the worst-case fixture, record parsed sentinel completeness and screenshots of every PDF page plus the Dog ID image. Confirm no clipped priority field and no replacement-glyph/ASCII stripping.

- [ ] **Step 4: Run physical iOS and Android evidence**

On a Release build, share Care Pass PDF, Dog ID PNG, and a saved record attachment into a recipient app and open each. Record device, OS, build SHA, filename, MIME, byte size, recipient app, outcome wording, and screenshot/video. Exercise cancellation, successful save/open, replace, injected metadata-save failure, delete, and idempotent cleanup retry. Browser/simulator evidence cannot check this box.

- [ ] **Step 5: Update active QA instructions**

Document the new validation, report, sharing, attachment, and Avatar Studio behavior. Do not edit historical handoff reports.

- [ ] **Step 6: Final diff and claim audit**

```bash
git diff --check origin/main...HEAD
rg -n "delivered|scan-assisted|detected traits|high confidence" artifacts/woofwatcher-mobile docs/QA_TEST_PLAN.md docs/release/MOBILE_RELEASE_RUNBOOK.md
```

Expected: no whitespace errors and no unproven consumer claims. Any legitimate historical/test fixture match must be reviewed explicitly.

- [ ] **Step 7: Commit the evidence/docs task**

```bash
git add docs/QA_TEST_PLAN.md docs/release/MOBILE_RELEASE_RUNBOOK.md docs/qa/2026-08-05-truth-data-integrity-device-evidence.md
git commit -m "docs: record truth and data integrity verification"
```
