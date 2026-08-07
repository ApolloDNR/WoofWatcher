import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildQuickLogEntry,
  describeQuickLogDetailSheet,
  describeQuickLogLauncherAction,
  findRecentQuickLogDuplicate,
  getQuickLogPolicy,
  QUICK_LOG_DEDUPE_WINDOW_MS,
  type QuickLogState,
} from "./quickLogEntry.ts";

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
  assert.equal(getQuickLogPolicy("incident").tapBehavior, "detail-required");
  assert.equal(getQuickLogPolicy("altercation").type, "incident");
  assert.equal(getQuickLogPolicy("incident").quickLabel, "incident detail");
  assert.equal(getQuickLogPolicy("potty").detailContract, "parent-outcome");
});

test("launcher presentation distinguishes quick tap logs from detail-first logs", () => {
  assert.deepEqual(describeQuickLogLauncherAction("meal", "Meal"), {
    modeLabel: "Tap log",
    detailRequired: false,
    accessibilityLabel: "Quick log Meal. Long press for details.",
    feedbackHint: "Tap saves the usual log. Long press opens more fields.",
  });

  assert.deepEqual(describeQuickLogLauncherAction("medication", "Medication"), {
    modeLabel: "Details",
    detailRequired: true,
    accessibilityLabel: "Open Medication details. This log needs context before saving.",
    feedbackHint: "Details first for health, medication, and incident logs.",
  });

  assert.equal(describeQuickLogLauncherAction("vomit", "Vomit").modeLabel, "Details");
  assert.equal(describeQuickLogLauncherAction("incident", "Incident").detailRequired, true);
});

test("detail sheet presentation explains quick logging, details, and safety boundaries", () => {
  const meal = describeQuickLogDetailSheet("meal", "Meal");
  assert.equal(meal.title, "Meal details");
  assert.equal(meal.canQuickLog, true);
  assert.equal(meal.primaryActionLabel, "Quick log now");
  assert.equal(meal.secondaryActionLabel, "Open full details");
  assert.match(meal.quickSummary, /serves the usual meal/i);
  assert.deepEqual(
    meal.interactionRail.map((item) => item.label),
    ["Tap", "Hold", "Edit later"],
  );
  assert.match(meal.editLaterCopy, /Timeline stays editable/i);
  assert.ok(meal.detailChecklist.some((item) => item.includes("served -> outcome")));
  assert.ok(meal.detailChecklist.some((item) => item.includes("Ate all")));

  const potty = describeQuickLogDetailSheet("potty", "Potty");
  assert.equal(potty.canQuickLog, true);
  assert.match(potty.quickSummary, /bathroom attempt/i);
  assert.ok(potty.detailChecklist.some((item) => item.includes("Potty stays the parent")));
  assert.ok(potty.detailChecklist.some((item) => item.includes("Pee, poop, both")));

  const medication = describeQuickLogDetailSheet("medication", "Medication");
  assert.equal(medication.canQuickLog, false);
  assert.equal(medication.primaryActionLabel, "Open full details");
  assert.equal(medication.secondaryActionLabel, "Cancel");
  assert.deepEqual(
    medication.interactionRail.map((item) => item.label),
    ["Details first", "Hold", "Edit later"],
  );
  assert.match(medication.safetyBoundary ?? "", /requires context/i);
  assert.ok(medication.detailChecklist.some((item) => item.includes("dose")));
});

test("meal detail sheet names the active dog in pending-outcome guidance", () => {
  const meal = describeQuickLogDetailSheet("meal", "Meal", "Luna");

  assert.equal(
    meal.quickSummary,
    "Quick tap serves the usual meal and keeps the meal outcome pending until someone confirms what Luna ate.",
  );
});

test("meal detail sheet keeps the canonical starter identity", () => {
  assert.equal(
    describeQuickLogDetailSheet("meal", "Meal", "My Dog").quickSummary,
    "Quick tap serves the usual meal and keeps the meal outcome pending until someone confirms what Phoenix ate.",
  );
  assert.match(
    describeQuickLogDetailSheet("meal", "Meal", "  Mochi  ").quickSummary,
    /what Mochi ate\.$/,
  );
});

test("quick-log dedupe window treats a rapid same-type second tap as the same intent", () => {
  const saved = {
    id: "temp_1",
    type: "meal",
    occurredAt: new Date(NOW).toISOString(),
    details: { mealCompletion: "served" },
  };

  // Same tick (0ms gap) and a fast bounce (120ms) both resolve to the entry
  // the first tap already saved.
  assert.equal(findRecentQuickLogDuplicate([saved], "meal", NOW), saved);
  assert.equal(findRecentQuickLogDuplicate([saved], "meal", NOW + 120), saved);
  // Anywhere inside the shared window still dedupes.
  assert.equal(
    findRecentQuickLogDuplicate([saved], "meal", NOW + QUICK_LOG_DEDUPE_WINDOW_MS),
    saved,
  );
});

test("quick-log dedupe never blocks a deliberate second log after the window", () => {
  const saved = { id: "temp_1", type: "meal", occurredAt: new Date(NOW).toISOString() };

  assert.equal(
    findRecentQuickLogDuplicate([saved], "meal", NOW + QUICK_LOG_DEDUPE_WINDOW_MS + 1),
    null,
  );
  assert.equal(findRecentQuickLogDuplicate([saved], "meal", NOW + 60_000), null);
});

test("quick-log dedupe only matches the same normalized care type", () => {
  const meal = { id: "temp_meal", type: "meal", occurredAt: new Date(NOW).toISOString() };
  const potty = { id: "temp_potty", type: "potty", occurredAt: new Date(NOW).toISOString() };

  assert.equal(findRecentQuickLogDuplicate([meal, potty], "water", NOW + 100), null);
  assert.equal(findRecentQuickLogDuplicate([meal, potty], "potty", NOW + 100), potty);
  // Legacy alias types normalize before matching ("pee" is a potty log).
  assert.equal(findRecentQuickLogDuplicate([potty], "pee", NOW + 100), potty);
});

test("quick-log dedupe returns the newest in-window entry and ignores bad timestamps", () => {
  const older = { id: "a", type: "water", occurredAt: new Date(NOW - 900).toISOString() };
  const newer = { id: "b", type: "water", occurredAt: new Date(NOW - 100).toISOString() };
  const invalid = { id: "c", type: "water", occurredAt: "not-a-date" };
  const future = { id: "d", type: "water", occurredAt: new Date(NOW + 5000).toISOString() };

  assert.equal(findRecentQuickLogDuplicate([older, invalid, newer, future], "water", NOW), newer);
});
