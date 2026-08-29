import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CURRENT_CARE_DOC_DATA_VERSION,
  hasCorrectionIssue,
  isFutureCareDocDataVersion,
  isSchedulableRoutine,
  migrateCareDoc,
  restoreDeviceOnlyRecordAttachments,
  sanitizeCareDocForProviderSync,
} from "./careDocMigration.ts";
import {
  deriveCareHandoff,
  deriveCareIntelligence,
  deriveCareReminderCenter,
  deriveMedicationAdherence,
  deriveMyCareToday,
  deriveRoutineBoard,
} from "../../../lib/care-domain/src/index.ts";
import { deriveAvatarMotion } from "./avatarMotion.ts";
import { buildQuickLogEntry } from "./quickLogEntry.ts";
import { deriveTodayCommand } from "./todayCommand.ts";

test("preserves malformed legacy values and attaches field-specific correction issues", () => {
  const legacy = {
    createdAt: "2026-01-01T00:00:00.000Z",
    householdSetup: { mode: "local", householdName: "Phoenix Pack" },
    routines: [
      { id: "bad-routine", label: "Mystery care", time: "7:99 PM", note: "Do not lose me" },
    ],
    records: [
      { id: "bad-record", title: "Refill", due: "2026-02-31", attachmentName: "refill.pdf" },
    ],
    calendarEvents: [
      { id: "bad-event", title: "Vet", date: "2026-13-40", time: "9ish", location: "Downtown" },
    ],
  };

  const migrated = migrateCareDoc(legacy);

  assert.equal(migrated.dataVersion, CURRENT_CARE_DOC_DATA_VERSION);
  assert.equal(migrated.routines?.[0].time, "7:99 PM");
  assert.equal(migrated.records?.[0].due, "2026-02-31");
  assert.equal(migrated.calendarEvents?.[0].date, "2026-13-40");
  assert.equal(migrated.calendarEvents?.[0].time, "9ish");
  assert.deepEqual(migrated.routines?.[0].correctionIssues, [
    { field: "time", rawValue: "7:99 PM", message: "Enter a valid routine time." },
  ]);
  assert.deepEqual(migrated.records?.[0].correctionIssues, [
    { field: "due", rawValue: "2026-02-31", message: "Enter a valid due date." },
  ]);
  assert.deepEqual(migrated.calendarEvents?.[0].correctionIssues, [
    { field: "date", rawValue: "2026-13-40", message: "Enter a valid event date." },
    { field: "time", rawValue: "9ish", message: "Enter a valid event time." },
  ]);
  assert.deepEqual(migrated.householdSetup, legacy.householdSetup);
  assert.equal(migrated.routines?.[0].note, "Do not lose me");
  assert.equal(migrated.records?.[0].attachmentName, "refill.pdf");
  assert.equal(migrated.calendarEvents?.[0].location, "Downtown");
  assert.deepEqual(legacy.routines?.[0], {
    id: "bad-routine",
    label: "Mystery care",
    time: "7:99 PM",
    note: "Do not lose me",
  });
});

test("leaves valid and intentionally absent values unmarked", () => {
  const migrated = migrateCareDoc({
    routines: [{ id: "breakfast", time: "7:05 AM" }, { id: "walk", time: "18:30" }],
    records: [{ id: "vaccine", due: "2027-08-15" }, { id: "photo", due: "" }],
    calendarEvents: [
      { id: "vet", date: "2026-08-15", time: "09:30" },
      { id: "birthday", date: "2026-08-16" },
    ],
  });

  for (const item of [
    ...(migrated.routines ?? []),
    ...(migrated.records ?? []),
    ...(migrated.calendarEvents ?? []),
  ]) {
    assert.equal(item.correctionIssues, undefined);
  }
  assert.equal(isSchedulableRoutine(migrated.routines?.[0] ?? {}), true);
  assert.equal(hasCorrectionIssue(migrated.records?.[0] ?? {}, "due"), false);
});

test("repairs missing record ids deterministically so record actions always have an identity", () => {
  const legacy = {
    records: [
      { type: "vaccine", title: "Rabies", due: "2027-08-15" },
      { id: "", type: "document", title: "Lab report", due: "" },
      { id: "record_migrated_2", type: "receipt", title: "Receipt", due: "" },
      { id: "existing", type: "insurance", title: "Policy", due: "" },
    ],
  };

  const first = migrateCareDoc(legacy);
  const second = migrateCareDoc(first);

  assert.equal(first.records?.[0].id, "record_migrated_1");
  assert.equal(first.records?.[1].id, "record_migrated_2_2");
  assert.equal(first.records?.[2].id, "record_migrated_2");
  assert.equal(first.records?.[3].id, "existing");
  assert.deepEqual(second, first);
});

test("provider sync strips device-only record attachments and restores only this device's copy", () => {
  const local = {
    dataVersion: CURRENT_CARE_DOC_DATA_VERSION,
    records: [
      {
        id: "rabies",
        title: "Rabies certificate",
        attachmentUri: "file:///device-a/woofwatcher-attachments/rabies.pdf",
        attachmentName: "rabies.pdf",
        attachmentMimeType: "application/pdf",
      },
    ],
  };

  const outgoing = sanitizeCareDocForProviderSync(local);
  assert.deepEqual(outgoing.records, [{ id: "rabies", title: "Rabies certificate" }]);
  assert.equal(local.records[0].attachmentUri, "file:///device-a/woofwatcher-attachments/rabies.pdf");

  const provider = {
    dataVersion: CURRENT_CARE_DOC_DATA_VERSION,
    records: [
      {
        id: "rabies",
        title: "Rabies certificate from provider",
        attachmentUri: "file:///device-b/private/rabies.pdf",
        attachmentName: "device-b-rabies.pdf",
        attachmentMimeType: "application/pdf",
      },
      {
        id: "insurance",
        title: "Insurance card",
        attachmentUri: "file:///device-b/private/card.jpg",
        attachmentName: "card.jpg",
        attachmentMimeType: "image/jpeg",
      },
    ],
  };

  const restored = restoreDeviceOnlyRecordAttachments(provider, local);
  assert.deepEqual(restored.records, [
    {
      id: "rabies",
      title: "Rabies certificate from provider",
      attachmentUri: "file:///device-a/woofwatcher-attachments/rabies.pdf",
      attachmentName: "rabies.pdf",
      attachmentMimeType: "application/pdf",
    },
    { id: "insurance", title: "Insurance card" },
  ]);
  assert.equal(provider.records[0].attachmentUri, "file:///device-b/private/rabies.pdf");
});

test("is idempotent and does not duplicate existing matching correction issues", () => {
  const legacy = {
    dataVersion: CURRENT_CARE_DOC_DATA_VERSION,
    routines: [
      {
        id: "bad-routine",
        time: "tomorrow morning",
        correctionIssues: [
          { field: "time", rawValue: "tomorrow morning", message: "Enter a valid routine time." },
        ],
      },
    ],
  };

  const first = migrateCareDoc(legacy);
  const second = migrateCareDoc(first);

  assert.deepEqual(second, first);
  assert.equal(first.routines?.[0].correctionIssues?.length, 1);
  assert.equal(hasCorrectionIssue(first.routines?.[0] ?? {}, "time"), true);
  assert.equal(isSchedulableRoutine(first.routines?.[0] ?? {}), false);
});

test("keeps absent arrays absent and safely versions empty documents", () => {
  assert.deepEqual(migrateCareDoc({}), { dataVersion: CURRENT_CARE_DOC_DATA_VERSION });
  assert.deepEqual(migrateCareDoc({ routines: undefined, records: undefined, calendarEvents: undefined }), {
    dataVersion: CURRENT_CARE_DOC_DATA_VERSION,
    routines: undefined,
    records: undefined,
    calendarEvents: undefined,
  });
});

test("quarantines mixed malformed collection elements without changing their raw shapes", () => {
  const malformedArray = ["nested", 3];
  const migrated = migrateCareDoc({
    routines: [null, "routine text", 12, malformedArray, { id: "walk", time: "9:00 AM" }],
    records: [null, ["record"], "record text", 27, { id: "rabies", due: "2027-01-01" }],
    calendarEvents: [null, ["event"], "event text", 99, { id: "vet", date: "2027-01-02" }],
  } as unknown as Record<string, unknown>);

  assert.deepEqual(migrated.routines, [{ id: "walk", time: "9:00 AM" }]);
  assert.deepEqual(migrated.records, [{ id: "rabies", due: "2027-01-01" }]);
  assert.deepEqual(migrated.calendarEvents, [{ id: "vet", date: "2027-01-02" }]);
  assert.deepEqual(
    migrated.migrationQuarantine?.map((item: { collection: string; index: number; rawValue: unknown }) =>
      [item.collection, item.index, item.rawValue]),
    [
      ["routines", 0, null],
      ["routines", 1, "routine text"],
      ["routines", 2, 12],
      ["routines", 3, ["nested", 3]],
      ["records", 0, null],
      ["records", 1, ["record"]],
      ["records", 2, "record text"],
      ["records", 3, 27],
      ["calendarEvents", 0, null],
      ["calendarEvents", 1, ["event"]],
      ["calendarEvents", 2, "event text"],
      ["calendarEvents", 3, 99],
    ],
  );
  assert.deepEqual(malformedArray, ["nested", 3]);
  assert.deepEqual(migrateCareDoc(migrated), migrated);
});

test("preserves a malformed field's raw runtime shape in its correction issue", () => {
  const rawTime = ["9:00", { period: "AM" }];
  const migrated = migrateCareDoc({
    routines: [{ id: "shape", time: rawTime }],
  } as unknown as Record<string, unknown>);

  assert.strictEqual(migrated.routines?.[0].time, rawTime);
  assert.strictEqual(
    (migrated.routines?.[0].correctionIssues as Array<{ rawValue: unknown }>)[0]?.rawValue,
    rawTime,
  );
  assert.deepEqual(rawTime, ["9:00", { period: "AM" }]);
});

test("preserves future documents and forward correction metadata without interpretation", () => {
  const future = {
    dataVersion: CURRENT_CARE_DOC_DATA_VERSION + 1,
    futureField: { untouched: true },
    routines: [{ time: " 9:00 AM " }],
  };
  assert.equal(isFutureCareDocDataVersion(future), true);
  assert.strictEqual(migrateCareDoc(future), future);

  const current = migrateCareDoc({
    routines: [{
      time: " 9:00 AM ",
      correctionIssues: [
        { field: "future-time-zone", rawValue: "Mars/Olympus", message: "Future metadata", codec: 3 },
        { field: "time", rawValue: "old", message: "Old message", source: "future-client" },
      ],
    }],
  });
  assert.deepEqual(current.routines?.[0].correctionIssues, [
    { field: "future-time-zone", rawValue: "Mars/Olympus", message: "Future metadata", codec: 3 },
    {
      field: "time",
      rawValue: " 9:00 AM ",
      message: "Enter a valid routine time.",
      source: "future-client",
    },
  ]);
});

test("a valid JSON version exponent that overflows to positive Infinity stays future and opaque", () => {
  const overflowFuture = JSON.parse(
    '{"dataVersion":1e400,"futureCounter":9007199254740993}',
  ) as Record<string, unknown>;

  assert.equal(overflowFuture.dataVersion, Number.POSITIVE_INFINITY);
  assert.equal(isFutureCareDocDataVersion(overflowFuture), true);
  assert.strictEqual(migrateCareDoc(overflowFuture), overflowFuture);
  assert.equal(isFutureCareDocDataVersion({ dataVersion: Number.NaN }), false);
  assert.equal(
    isFutureCareDocDataVersion({ dataVersion: Number.NEGATIVE_INFINITY }),
    false,
  );
});

test("migrated unsafe routine times stay quarantined from every scheduling consumer", () => {
  const now = new Date("2026-06-11T08:00:00-07:00").getTime();
  for (const rawTime of [
    " 9:00 AM",
    "9:00 AM ",
    "9:00  AM",
    null,
    ["9:00 AM"],
    900,
    { clock: "9:00 AM" },
  ]) {
    const routine = migrateCareDoc({
      routines: [{ id: "legacy", label: "Legacy walk", type: "walk", time: rawTime, owner: "Apollo", note: "" }],
    }).routines![0];
    const medication = migrateCareDoc({
      routines: [{ id: "legacy-med", label: "Legacy med", type: "medication", time: rawTime, owner: "Apollo", note: "1 tablet" }],
    }).routines![0];

    const board = deriveRoutineBoard({ routines: [routine], entries: [], now });
    assert.equal(board.items[0].status, "needs-correction", rawTime);
    assert.equal(board.next, null, rawTime);
    assert.equal(board.correctionCount, 1, rawTime);

    const handoff = deriveCareHandoff({ routines: [routine], entries: [], now });
    assert.equal(handoff.next, null, rawTime);
    assert.ok(handoff.sections.needsAttention.some((item) => /needs correction/i.test(item.label)), rawTime);

    assert.equal(deriveMedicationAdherence({ routines: [medication], entries: [], now }).total, 0, rawTime);
    assert.equal(deriveCareReminderCenter({ routines: [routine], entries: [], now }).routineCount, 0, rawTime);

    const intelligence = deriveCareIntelligence({ routines: [routine], entries: [], now });
    assert.equal(intelligence.correctionCount, 1, rawTime);
    assert.equal(intelligence.metrics[0].value, "0%", rawTime);

    const motion = deriveAvatarMotion({ routines: [routine], entries: [], now });
    assert.equal(motion.label, "Steady", rawTime);

    const todayCommand = deriveTodayCommand({
      profile: { name: "Phoenix" },
      routines: [routine],
      entries: [
        {
          id: "meal-1",
          type: "meal",
          title: "Breakfast one",
          occurredAt: "2026-06-11T06:30:00-07:00",
          details: { householdVisible: true, mealCompletion: "complete" },
        },
        {
          id: "meal-2",
          type: "meal",
          title: "Breakfast two",
          occurredAt: "2026-06-11T07:00:00-07:00",
          details: { householdVisible: true, mealCompletion: "complete" },
        },
      ],
      caregivers: [],
    }, now);
    assert.equal(todayCommand.primaryAction.label, "Log walk", rawTime);

    const quick = buildQuickLogEntry(
      { type: "walk", title: "Walk" },
      { routines: [routine], entries: [], caregivers: [], dietProfile: { normalPortion: "" } },
      { caregiver: "Apollo", now },
    );
    assert.equal(quick.details?.routineId, undefined, rawTime);

    const access = deriveMyCareToday({
      routines: [routine], entries: [], personName: "Apollo", petName: "Phoenix", now,
    });
    assert.equal(access.status, "needs-correction", rawTime);
    assert.equal(access.assignedCount, 0, rawTime);
    assert.equal(access.correctionCount, 1, rawTime);
  }
});
