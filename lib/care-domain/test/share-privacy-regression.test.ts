// Regression coverage for the pre-launch domain audit of the share/records
// layer:
//   1. Private (household-hidden) logs leaked into the shareable Care Pass -
//      the artifact denied the data existed in one section while printing it
//      in another.
//   2. Record due dates were anchored to UTC midnight, flipping to "expired"
//      at 5 PM local on the due date for owners west of UTC (and shifting
//      evening day-counts off by one). House rule: calendar days are local.
//   3. Care IQ's routine-fit metric read "in 0m" for a served meal awaiting
//      its outcome hours in the past.
process.env.TZ = "America/Los_Angeles";

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCarePass } from "../src/care-pass.ts";
import { deriveRecordReminders } from "../src/record-vault.ts";
import { deriveCareIntelligence } from "../src/care-intelligence.ts";

const NOW = new Date("2026-06-06T15:00:00-07:00").getTime();

test("private logs never appear anywhere in a shared Care Pass", () => {
  const pass = buildCarePass({
    now: NOW,
    audience: "sitter",
    profile: { name: "Phoenix" },
    dietProfile: {},
    caregivers: [{ name: "Emma", role: "Primary" }],
    routines: [],
    records: [],
    entries: [
      {
        id: "private_meal",
        type: "meal",
        title: "Private breakfast note",
        caregiver: "Emma",
        occurredAt: "2026-06-06T07:00:00-07:00",
        details: { householdVisible: false },
      },
      {
        id: "private_vomit",
        type: "vomit",
        title: "Private vomit log",
        caregiver: "Emma",
        occurredAt: "2026-06-06T06:00:00-07:00",
        severity: "watch",
        details: { householdVisible: false, kind: "yellow bile" },
      },
      {
        id: "shared_walk",
        type: "walk",
        title: "Morning walk",
        caregiver: "Emma",
        occurredAt: "2026-06-06T08:00:00-07:00",
        durationMinutes: 25,
      },
    ],
  });

  // The shared artifact must not carry private titles in any section.
  assert.doesNotMatch(pass.message, /Private breakfast note/);
  assert.doesNotMatch(pass.message, /Private vomit log/);
  // Shared data still flows.
  assert.match(pass.message, /Morning walk/);
});

test("a record is not expired while its due date is still today locally", () => {
  // 6 PM PDT on the due date - under UTC anchoring this already read expired.
  const evening = new Date("2026-06-06T18:00:00-07:00").getTime();
  const reminders = deriveRecordReminders(
    [{ id: "rabies", type: "vaccine", title: "Rabies", due: "Jun 6, 2026" }],
    { now: evening },
  );
  const rabies = reminders.find((item) => item.recordId === "rabies");
  assert.ok(rabies, "expected a reminder for the due-today record");
  assert.notEqual(rabies.kind, "expired");
});

test("evening day-counts to a due date use local calendar days with correct grammar", () => {
  const evening = new Date("2026-06-06T18:00:00-07:00").getTime();
  const reminders = deriveRecordReminders(
    [
      { id: "bord", type: "vaccine", title: "Bordetella", due: "Jun 8, 2026" },
      { id: "lepto", type: "vaccine", title: "Lepto", due: "Jun 7, 2026" },
    ],
    { now: evening },
  );
  const bord = reminders.find((item) => item.recordId === "bord");
  const lepto = reminders.find((item) => item.recordId === "lepto");
  assert.match(bord?.detail ?? "", /due in 2 days/);
  assert.match(lepto?.detail ?? "", /due in 1 day\b/);
});

test("routine fit reports outcome pending, not 'in 0m', for a served past meal", () => {
  const intelligence = deriveCareIntelligence({
    now: new Date("2026-06-06T15:00:00-07:00").getTime(),
    petName: "Phoenix",
    routines: [{ id: "breakfast", type: "meal", label: "Breakfast", time: "8:00 AM" }],
    entries: [
      {
        id: "meal_served",
        type: "meal",
        title: "Breakfast",
        occurredAt: "2026-06-06T08:05:00-07:00",
        details: { mealCompletion: "served", mealLifecycle: "outcome-pending" },
      },
    ],
  });
  const routineFit = intelligence.metrics.find((metric) => metric.label === "Routine fit");
  assert.ok(routineFit, "expected the Routine fit metric");
  assert.doesNotMatch(routineFit.detail, /in 0m/);
});
