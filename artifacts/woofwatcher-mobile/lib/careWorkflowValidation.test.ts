import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareCalendarEventsBySchedule,
  getCareCorrectionPresentation,
  mergeValidatedCalendarEventEdit,
  mergeValidatedRecordEdit,
  mergeValidatedRoutineEdit,
  orderCareItemsCorrectionsLast,
  validateCalendarEventDraft,
  validateProfileWeightDraft,
  validateRecordDueDraft,
  validateRoutineDraft,
} from "./careWorkflowValidation.ts";
import { migrateCareDoc } from "./careDocMigration.ts";

test("validateRoutineDraft returns one canonical routine or one field error", () => {
  assert.deepEqual(
    validateRoutineDraft({
      label: "  Breakfast  ",
      type: "meal",
      time: "19:05",
      owner: "  Emma  ",
      note: "  sensitive food  ",
    }),
    {
      ok: true,
      value: {
        label: "Breakfast",
        type: "meal",
        time: "7:05 PM",
        owner: "Emma",
        note: "sensitive food",
      },
    },
  );

  for (const [input, field] of [
    [{ label: "", type: "meal", time: "7:00 AM", owner: "", note: "" }, "label"],
    [{ label: "Breakfast", type: "meal", time: " 7:00 AM", owner: "", note: "" }, "time"],
    [{ label: "Breakfast", type: "meal", time: "7:00 AM later", owner: "", note: "" }, "time"],
  ] as const) {
    const result = validateRoutineDraft(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.field, field);
    assert.equal("value" in result, false, "an invalid draft must not expose persistable data");
  }
});

test("validateCalendarEventDraft rejects impossible dates and malformed optional times", () => {
  assert.deepEqual(
    validateCalendarEventDraft({
      title: "  Vet visit  ",
      type: "vet",
      date: "2026-02-28",
      time: "07:05",
      location: "  Harbor Clinic  ",
      note: "  bring records  ",
      source: "manual",
    }),
    {
      ok: true,
      value: {
        title: "Vet visit",
        type: "vet",
        date: "2026-02-28",
        time: "7:05 AM",
        location: "Harbor Clinic",
        note: "bring records",
        source: "manual",
      },
    },
  );

  assert.deepEqual(
    validateCalendarEventDraft({
      title: "All-day outing",
      type: "event",
      date: "2026-03-01",
      time: "",
      source: "manual",
    }),
    {
      ok: true,
      value: {
        title: "All-day outing",
        type: "event",
        date: "2026-03-01",
        source: "manual",
      },
    },
  );

  for (const [date, time, field] of [
    ["2026-02-31", "", "date"],
    ["2026-2-28", "", "date"],
    ["2026-02-28", "7:99 PM", "time"],
    ["2026-02-28", " 7:00 PM", "time"],
  ] as const) {
    const result = validateCalendarEventDraft({
      title: "Vet visit",
      type: "vet",
      date,
      time,
      source: "manual",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.field, field);
    assert.equal("value" in result, false, "an invalid draft must not expose persistable data");
  }
});

test("validateProfileWeightDraft accepts an optional strict positive decimal", () => {
  assert.deepEqual(validateProfileWeightDraft(""), { ok: true, value: null });
  assert.deepEqual(validateProfileWeightDraft(" 31.5 "), { ok: true, value: 31.5 });

  for (const value of ["0", "-1", "1e2", "31 lb", "31 trailing"]) {
    const result = validateProfileWeightDraft(value);
    assert.equal(result.ok, false, value);
    if (!result.ok) assert.equal(result.field, "weight");
    assert.equal("value" in result, false);
  }
});

test("validateRecordDueDraft only clears quarantine for a blank or canonical real date", () => {
  assert.deepEqual(validateRecordDueDraft(""), { ok: true, value: "" });
  assert.deepEqual(validateRecordDueDraft("2026-02-28"), { ok: true, value: "2026-02-28" });

  for (const value of ["2026-02-31", "2026-2-28", "2026-02-28 later"]) {
    const result = validateRecordDueDraft(value);
    assert.equal(result.ok, false, value);
    if (!result.ok) assert.equal(result.field, "due");
    assert.equal("value" in result, false, "an invalid due date must not clear its correction issue");
  }
});

test("getCareCorrectionPresentation keeps malformed legacy values visible without scheduling them", () => {
  assert.deepEqual(
    getCareCorrectionPresentation(
      {
        time: " 7:00 PM ",
        correctionIssues: [
          { field: "time", rawValue: " 7:00 PM ", message: "Enter a valid routine time." },
        ],
      },
      "time",
    ),
    {
      label: "Needs correction",
      preservedValue: " 7:00 PM ",
    },
  );
  assert.deepEqual(
    getCareCorrectionPresentation(
      { correctionIssues: [{ field: "time", rawValue: ["7:00", "PM"] }] },
      "time",
    ),
    { label: "Needs correction", preservedValue: '["7:00","PM"]' },
  );
  assert.deepEqual(
    getCareCorrectionPresentation(
      { correctionIssues: [{ field: "date", rawValue: null }] },
      "date",
    ),
    { label: "Needs correction", preservedValue: "null" },
  );
  assert.deepEqual(
    getCareCorrectionPresentation(
      { correctionIssues: [{ field: "due", rawValue: { year: 2026 } }] },
      "due",
    ),
    { label: "Needs correction", preservedValue: '{"year":2026}' },
  );
  assert.equal(getCareCorrectionPresentation({ time: "7:00 PM" }, "time"), null);
});

test("lossless correction edits remove only resolved owned issues", () => {
  const unknownIssue = {
    field: "future-time-zone",
    rawValue: "Mars/Olympus",
    message: "Future metadata",
    codec: 3,
  };
  const routine = mergeValidatedRoutineEdit(
    {
      id: "walk",
      label: "Old walk",
      type: "walk",
      time: "9ish",
      owner: "Apollo",
      note: "Old note",
      opaque: { retain: true },
      correctionIssues: [
        unknownIssue,
        { field: "time", rawValue: "9ish", message: "Old message", source: "legacy" },
      ],
    },
    {
      label: "Morning walk",
      type: "walk",
      time: "9:00 AM",
      owner: "Emma",
      note: "Harness",
    },
  );
  const migratedRoutine = migrateCareDoc({ routines: [routine] }).routines?.[0];
  assert.deepEqual(migratedRoutine?.opaque, { retain: true });
  assert.deepEqual(migratedRoutine?.correctionIssues, [unknownIssue]);

  const event = mergeValidatedCalendarEventEdit(
    {
      id: "vet",
      title: "Old visit",
      type: "vet",
      date: "2026-13-40",
      time: "9ish",
      location: "Clinic",
      note: "Bring labs",
      source: "woofguide",
      opaque: { retain: true },
      correctionIssues: [
        unknownIssue,
        { field: "date", rawValue: "2026-13-40", message: "Old date" },
        { field: "time", rawValue: "9ish", message: "Old time" },
      ],
    },
    {
      title: "Vet visit",
      type: "vet",
      date: "2026-03-04",
      source: "manual",
    },
  );
  const migratedEvent = migrateCareDoc({ calendarEvents: [event] }).calendarEvents?.[0];
  assert.equal(migratedEvent?.source, "woofguide", "editing must preserve provenance");
  assert.equal("time" in (migratedEvent ?? {}), false, "blank time must clear");
  assert.equal("location" in (migratedEvent ?? {}), false, "blank location must clear");
  assert.equal(migratedEvent?.note, "Bring labs");
  assert.deepEqual(migratedEvent?.opaque, { retain: true });
  assert.deepEqual(migratedEvent?.correctionIssues, [unknownIssue]);

  const record = mergeValidatedRecordEdit(
    {
      id: "rabies",
      type: "vaccine",
      title: "Old rabies",
      due: "2026-02-31",
      note: "Old note",
      attachmentUri: "file:///rabies.pdf",
      attachmentName: "Rabies original.pdf",
      opaque: { retain: true },
      correctionIssues: [
        unknownIssue,
        { field: "due", rawValue: "2026-02-31", message: "Old due", source: "legacy" },
      ],
    },
    {
      type: "vaccine",
      title: "Rabies",
      due: "2026-03-01",
      note: "Updated",
      attachmentUri: "file:///rabies.pdf",
      attachmentName: "Generic attachment",
    },
  );
  const migratedRecord = migrateCareDoc({ records: [record] }).records?.[0];
  assert.equal(migratedRecord?.attachmentName, "Rabies original.pdf");
  assert.deepEqual(migratedRecord?.opaque, { retain: true });
  assert.deepEqual(migratedRecord?.correctionIssues, [unknownIssue]);

  const replacementRecord = mergeValidatedRecordEdit(record, {
    type: "vaccine",
    title: "Rabies",
    due: "2026-03-01",
    note: "Replacement",
    attachmentUri: "file:///renewed-rabies.pdf",
    attachmentName: "Renewed rabies certificate.pdf",
  });
  assert.equal(replacementRecord.attachmentUri, "file:///renewed-rabies.pdf");
  assert.equal(replacementRecord.attachmentName, "Renewed rabies certificate.pdf");
});

test("calendar events use parsed chronological order and corrections stay last", () => {
  const correction = {
    id: "bad",
    date: "2026-02-31",
    time: "9ish",
    correctionIssues: [{ field: "date", rawValue: "2026-02-31" }],
  };
  const items = [
    { id: "ten", date: "2026-03-01", time: "10:00 AM" },
    correction,
    { id: "pm", date: "2026-03-01", time: "2:00 PM" },
    { id: "untimed", date: "2026-03-01" },
    { id: "nine", date: "2026-03-01", time: "9:00 AM" },
    { id: "noon", date: "2026-03-01", time: "12:00 PM" },
  ];
  const ordered = orderCareItemsCorrectionsLast(
    items,
    (item) => getCareCorrectionPresentation(item, "date") !== null,
    compareCalendarEventsBySchedule,
  );

  assert.deepEqual(
    ordered.map((item) => item.id),
    ["untimed", "nine", "ten", "noon", "pm", "bad"],
  );
});
