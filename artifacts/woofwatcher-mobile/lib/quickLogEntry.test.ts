import { test } from "node:test";
import assert from "node:assert/strict";

import { buildQuickLogEntry, type QuickLogState } from "./quickLogEntry.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-06T09:00:00-07:00").getTime();

function state(overrides: Partial<QuickLogState> = {}): QuickLogState {
  return {
    caregivers: [
      { name: "Apollo", role: "Owner" },
      { name: "Emma", role: "Primary caregiver" },
    ],
    dietProfile: {
      normalPortion: "1 cup",
    },
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Emma" },
      { id: "walk", label: "Morning walk", type: "walk", time: "8:30 AM", owner: "Apollo" },
      { id: "meds", label: "Apoquel", type: "medication", time: "9:00 AM", owner: "Apollo", note: "1 tablet with breakfast" },
    ],
    entries: [],
    ...overrides,
  };
}

test("meal quick log attaches the open meal routine and full portion detail", () => {
  const entry = buildQuickLogEntry(
    { type: "meal", title: "Meal" },
    state(),
    { caregiver: "Apollo", now: NOW },
  );

  assert.equal(entry.type, "meal");
  assert.equal(entry.title, "Breakfast");
  assert.equal(entry.caregiver, "Apollo");
  assert.equal(entry.amount, "1");
  assert.deepEqual(entry.details, {
    routineId: "breakfast",
    routineLabel: "Breakfast",
    routineTime: "7:30 AM",
    expectedPortion: "1 cup",
    mealCompletion: "complete",
    householdVisible: true,
    servedAmount: 1,
    servedUnit: "cup",
    eatenAmount: 1,
    eatenUnit: "cup",
  });
});

test("medication quick log attaches the open medication routine and dose detail", () => {
  const entry = buildQuickLogEntry(
    { type: "medication", title: "Medication" },
    state({
      entries: [
        {
          id: "meal_1",
          type: "meal",
          title: "Breakfast",
          caregiver: "Emma",
          occurredAt: "2026-06-06T07:34:00-07:00",
          details: { routineId: "breakfast", mealCompletion: "complete", householdVisible: true },
        },
        {
          id: "walk_1",
          type: "walk",
          title: "Morning walk",
          caregiver: "Apollo",
          occurredAt: "2026-06-06T08:42:00-07:00",
          details: { routineId: "walk" },
        },
      ],
    }),
    { caregiver: "Apollo", now: NOW },
  );

  assert.equal(entry.type, "medication");
  assert.equal(entry.title, "Apoquel");
  assert.deepEqual(entry.details, {
    routineId: "meds",
    routineLabel: "Apoquel",
    routineTime: "9:00 AM",
    dose: "1 tablet with breakfast",
    medicationOutcome: "taken",
    householdVisible: true,
  });
});

test("walk quick log attaches the open walk routine after breakfast is handled", () => {
  const entry = buildQuickLogEntry(
    { type: "walk", title: "Walk" },
    state({
      entries: [
        {
          id: "meal_1",
          type: "meal",
          title: "Breakfast",
          caregiver: "Emma",
          occurredAt: "2026-06-06T07:34:00-07:00",
          details: { routineId: "breakfast", mealCompletion: "complete", householdVisible: true },
        },
      ],
    }),
    { caregiver: "Apollo", now: NOW },
  );

  assert.equal(entry.type, "walk");
  assert.equal(entry.title, "Morning walk");
  assert.deepEqual(entry.details, {
    routineId: "walk",
    routineLabel: "Morning walk",
    routineTime: "8:30 AM",
  });
});

test("meal quick log does not satisfy a future meal routine too early", () => {
  const entry = buildQuickLogEntry(
    { type: "meal", title: "Meal" },
    state({
      routines: [
        { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Emma" },
        { id: "dinner", label: "Dinner", type: "meal", time: "7:00 PM", owner: "Apollo" },
      ],
      entries: [
        {
          id: "meal_1",
          type: "meal",
          title: "Breakfast",
          caregiver: "Emma",
          occurredAt: "2026-06-06T07:34:00-07:00",
          details: { routineId: "breakfast", mealCompletion: "complete", householdVisible: true },
        },
      ],
    }),
    { caregiver: "Apollo", now: NOW },
  );

  assert.equal(entry.title, "Meal");
  assert.equal(entry.details?.routineId, undefined);
  assert.equal(entry.details?.mealCompletion, "complete");
  assert.equal(entry.details?.householdVisible, true);
});
