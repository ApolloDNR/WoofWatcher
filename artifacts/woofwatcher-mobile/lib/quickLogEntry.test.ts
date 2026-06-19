import { test } from "node:test";
import assert from "node:assert/strict";

import { buildQuickLogEntry, getQuickLogPolicy, type QuickLogState } from "./quickLogEntry.ts";

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
      { id: "water", label: "Fresh water", type: "water", time: "8:45 AM", owner: "Apollo" },
      { id: "potty", label: "Potty break", type: "potty", time: "8:50 AM", owner: "Emma" },
      { id: "meds", label: "Apoquel", type: "medication", time: "9:00 AM", owner: "Apollo", note: "1 tablet with breakfast" },
    ],
    entries: [],
    ...overrides,
  };
}

test("meal quick log starts an outcome-pending served meal lifecycle", () => {
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
    mealCompletion: "served",
    mealLifecycle: "outcome-pending",
    logInteraction: "quick-tap",
    trustState: "confirmed",
    confirmationRequired: false,
    householdVisible: true,
    servedAmount: 1,
    servedUnit: "cup",
  });
});

test("kid quick logs stay household-visible but require adult confirmation", () => {
  const entry = buildQuickLogEntry(
    { type: "meal", title: "Meal" },
    state(),
    { caregiver: "Maya", caregiverRole: "Kid", now: NOW },
  );

  assert.equal(entry.type, "meal");
  assert.equal(entry.details?.trustState, "pending-confirmation");
  assert.equal(entry.details?.confirmationRequired, true);
  assert.equal(entry.details?.confirmationReason, "kid-log");
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
    logInteraction: "detail-sheet",
    trustState: "confirmed",
    confirmationRequired: true,
    confirmationReason: "safety-critical",
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
    logInteraction: "quick-tap",
    trustState: "confirmed",
    confirmationRequired: false,
    householdVisible: true,
  });
});

test("water quick log records a household-visible fresh water refill", () => {
  const entry = buildQuickLogEntry(
    { type: "water", title: "Water" },
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

  assert.equal(entry.type, "water");
  assert.equal(entry.title, "Fresh water");
  assert.deepEqual(entry.details, {
    routineId: "water",
    routineLabel: "Fresh water",
    routineTime: "8:45 AM",
    waterAmount: "refill",
    logInteraction: "quick-tap",
    trustState: "confirmed",
    confirmationRequired: false,
    householdVisible: true,
  });
});

test("potty quick log records a parent potty attempt instead of pretending pee or poop happened", () => {
  const entry = buildQuickLogEntry(
    { type: "potty", title: "Potty break" },
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
          details: { routineId: "walk", householdVisible: true },
        },
        {
          id: "water_1",
          type: "water",
          title: "Fresh water",
          caregiver: "Apollo",
          occurredAt: "2026-06-06T08:44:00-07:00",
          details: { routineId: "water", householdVisible: true },
        },
      ],
    }),
    { caregiver: "Emma", now: NOW },
  );

  assert.equal(entry.type, "potty");
  assert.equal(entry.title, "Potty break");
  assert.deepEqual(entry.details, {
    routineId: "potty",
    routineLabel: "Potty break",
    routineTime: "8:50 AM",
    pottyOutcome: "attempt",
    logInteraction: "quick-tap",
    trustState: "confirmed",
    confirmationRequired: false,
    householdVisible: true,
  });
  assert.equal(entry.details?.kind, undefined);
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
  assert.equal(entry.details?.mealCompletion, "served");
  assert.equal(entry.details?.mealLifecycle, "outcome-pending");
  assert.equal(entry.details?.householdVisible, true);
});

test("quick log policy keeps safety-critical logs in the detail sheet", () => {
  assert.equal(getQuickLogPolicy("meal").tapBehavior, "quick-log");
  assert.equal(getQuickLogPolicy("meal").longPressBehavior, "detail-sheet");
  assert.equal(getQuickLogPolicy("medication").tapBehavior, "detail-required");
  assert.equal(getQuickLogPolicy("vomit").tapBehavior, "detail-required");
  assert.equal(getQuickLogPolicy("potty").detailContract, "parent-outcome");
});
