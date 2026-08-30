# Task 3 Implementer Report — Local dates and strict care validation

## Scope

- Base: `739d8ed`
- Task: Slice 0 Task 3 only
- Commit subject: `fix: apply local dates and strict care validation`
- No Task 4, navigation-shell, deployment, or production-release work was performed.

## RED evidence

Production changes were held until the required tests failed for the missing behavior.

1. The initial Task 3 library suite failed at the test-only boundary: 167 tests, 159 passed, 8 failed. The failures covered the absent workflow validator and local-date-parts helper, unpadded month keys, missing strict integer/amount parsing, mixed-fraction misparsing, and acceptance of trailing input.
2. The first route/source regression run failed 2/2: the route wiring was absent and WoofGuide bucketed a Los Angeles late-evening action into the following UTC date.
3. The Calendar editor regression failed because blank event titles and routine labels had no inline error state.
4. The Records regression failed before production wiring because an unchanged malformed legacy `due` value could clear quarantine without validation.
5. The mixed-shape editor regression failed because quarantined array, object, and null date/time/due values were passed directly into string input state.

Representative RED command:

```sh
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

## Implementation

### Canonical local calendar behavior

- Added `localDateKeyFromParts` and adopted the canonical local-day helpers across Calendar, calendar-month, Log, Records, More, WoofGuide, and WoofGuide actions.
- Kept calendar-month APIs zero-based while emitting and parsing padded `YYYY-MM-DD` keys.
- Kept real instants as ISO timestamps; only user-facing day/month bucketing uses the device-local calendar.
- Covered UTC boundary crossings, year rollover, and 23-hour/25-hour daylight-saving transitions.

### Strict care workflow validation

- Added pure routine, event, profile-weight, and record-due validators.
- Added strict non-negative-integer parsing and strict positive amount-with-unit parsing.
- The amount parser consumes the whole input, supports complete decimals, proper fractions, and mixed fractions, and accepts only the explicit unit/alias table. It rejects prose, ranges, suffix garbage, unknown units, invalid fractions, and non-positive values.
- Meal validation requires a positive served amount and prevents an eaten amount from exceeding served in the same unit.
- Log numeric and count fields no longer accept numeric prefixes or silently coerce malformed values.

### Correction and editor behavior

- Invalid migrated routines, events, and records remain visible and editable with their preserved value, but are excluded from scheduling, countdown, due-state, and completion consumers.
- Calendar surfaces routine-label, routine-time, event-title, event-date, and event-time errors without closing the editor. A fresh Add Event resets cancelled edit state.
- Records treats `due` as optional-but-strict: blank clears it, a valid canonical local date saves it, and any other nonblank value keeps the sheet open with an error. Correction metadata clears only after a valid or blank correction.
- Mixed-shape legacy values seed editors through safe correction presentation rather than entering string input state as arrays, objects, or null.
- Calendar and Records edit/delete controls use separate non-overlapping 44-pixel targets.

## GREEN evidence

### Exact affected suite

```text
tests 196
pass 196
fail 0
```

### Timezone/DST matrix

The local-calendar and month-calendar suite passed 23/23 in each required environment:

| TZ | Result |
| --- | ---: |
| process default | 23/23 |
| America/Los_Angeles | 23/23 |
| Asia/Tokyo | 23/23 |
| Pacific/Kiritimati | 23/23 |

Additional spot checks passed 23/23 under UTC and Australia/Sydney.

### Expanded and workspace gates

```text
pnpm run test:focused
tests 905
pass 905
fail 0

pnpm run typecheck
all scoped artifact projects and scripts passed
```

- `git diff --check`: passed.
- Forbidden UTC-day bucketing and permissive-number patterns: absent from affected routes.
- Mutation inventory is unchanged: Calendar 6, More 5, Records 3 `updateCareDoc` call sites.

## Files

- `artifacts/woofwatcher-mobile/app/(tabs)/calendar.tsx`
- `artifacts/woofwatcher-mobile/app/(tabs)/log.tsx`
- `artifacts/woofwatcher-mobile/app/(tabs)/more.tsx`
- `artifacts/woofwatcher-mobile/app/(tabs)/records.tsx`
- `artifacts/woofwatcher-mobile/app/calendar-month.tsx`
- `artifacts/woofwatcher-mobile/app/woofguide.tsx`
- `artifacts/woofwatcher-mobile/lib/careWorkflowValidation.ts`
- `artifacts/woofwatcher-mobile/lib/careWorkflowValidation.test.ts`
- `artifacts/woofwatcher-mobile/lib/inputValidation.ts`
- `artifacts/woofwatcher-mobile/lib/inputValidation.test.ts`
- `artifacts/woofwatcher-mobile/lib/localCalendar.ts`
- `artifacts/woofwatcher-mobile/lib/localCalendar.test.ts`
- `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
- `artifacts/woofwatcher-mobile/lib/monthCalendar.ts`
- `artifacts/woofwatcher-mobile/lib/monthCalendar.test.ts`
- `artifacts/woofwatcher-mobile/lib/quickLogEntry.ts`
- `artifacts/woofwatcher-mobile/lib/quickLogEntry.test.ts`
- `artifacts/woofwatcher-mobile/lib/woofGuideActions.ts`
- `artifacts/woofwatcher-mobile/lib/woofGuideActions.test.ts`
- `.superpowers/sdd/2026-08-05-woofwatcher-truth-data-integrity/task-3-implementer-report.md`

## Assumptions and boundaries

- Device-local time is authoritative for calendar-day presentation; ISO timestamps remain authoritative for instants.
- Calendar month parameters remain zero-based, and persisted/compared date keys remain padded.
- Blank record due dates intentionally clear `due`; non-date reference identifiers belong in notes.
- Blank profile-weight input preserves the existing optional weight rather than deleting it.
- Quarantined values remain recoverable and editable, but never drive scheduling or care-status calculations until corrected.

## Independent-review closure

The first adversarial review found six gaps that the original green suite did not cover: corrected record dates still reached shared due consumers; routine/event/record edits could drop forward metadata; correction rows appeared before valid rows; Calendar retained lexical/duplicate clock handling; and unsafe integer components could be rounded in configured meal amounts. The first added regression boundary failed 6 of 168 tests. A later narrow review found one additional attachment-identity leak; its route contract failed 1 of 132 tests before filename state was wired through selection, reopen, replacement, and save.

The accepted correction pass now:

- treats a `due` correction as non-schedulable at the shared record-status choke point while retaining the record in vault/export/inclusion surfaces;
- prevents corrected dates from generating record, medication, Reminder Center, Health, WoofGuide, or Care Pass due claims;
- preserves opaque fields and unknown correction metadata, clearing only the field the owner actually repaired;
- preserves WoofGuide event provenance and notes while allowing blank event time/location to clear;
- preserves original and replacement attachment filenames;
- places correction rows after valid Calendar/Records rows and orders valid events with the canonical clock parser; and
- rejects unsafe integer components before amount arithmetic.

Final accepted evidence:

```text
exact Task 3 suite: 200/200
required TZ matrix: 23/23 in each of America/Los_Angeles, Asia/Tokyo, Pacific/Kiritimati, and UTC
full focused suite: 913/913
workspace typecheck: passed
git diff hygiene: passed
independent final rereview: APPROVED
```
