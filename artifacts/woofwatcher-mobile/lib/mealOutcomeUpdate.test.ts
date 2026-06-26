import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMealOutcomeUpdatePatch,
  MEAL_OUTCOME_UPDATE_OPTIONS,
  type MealOutcomeUpdateEntryLike,
} from "./mealOutcomeUpdate.ts";

const NOW = "2026-06-26T22:14:00.000Z";

function entry(overrides: Partial<MealOutcomeUpdateEntryLike> = {}): MealOutcomeUpdateEntryLike {
  return {
    id: "meal-1",
    type: "meal",
    title: "Dinner - outcome pending",
    caregiver: "Emma",
    occurredAt: "2026-06-26T21:30:00.000Z",
    details: {
      householdVisible: true,
      routineId: "dinner",
      expectedPortion: "1.25 cups",
      servedAmount: 1.25,
      servedUnit: "cup",
      mealCompletion: "served",
      mealLifecycle: "outcome-pending",
      trustState: "confirmed",
      confirmationRequired: false,
    },
    ...overrides,
  };
}

test("exposes every launch meal outcome that can resolve or keep an open served meal", () => {
  assert.deepEqual(MEAL_OUTCOME_UPDATE_OPTIONS.map((option) => option.id), [
    "complete",
    "most",
    "partial",
    "skipped",
    "grazing",
  ]);
});

test("updates a pending served meal to ate most without losing routine or household context", () => {
  const patch = buildMealOutcomeUpdatePatch(entry(), {
    caregiver: "Apollo",
    now: NOW,
    outcome: "most",
  });

  assert.equal(patch.title, "Dinner - Ate most");
  assert.equal(patch.amount, "1");
  assert.equal(patch.severity, undefined);
  assert.deepEqual(
    {
      householdVisible: patch.details.householdVisible,
      routineId: patch.details.routineId,
      expectedPortion: patch.details.expectedPortion,
      servedAmount: patch.details.servedAmount,
      eatenAmount: patch.details.eatenAmount,
      eatenUnit: patch.details.eatenUnit,
      mealCompletion: patch.details.mealCompletion,
      mealLifecycle: patch.details.mealLifecycle,
      outcomeBy: patch.details.outcomeBy,
      outcomeAt: patch.details.outcomeAt,
      trustState: patch.details.trustState,
      confirmationRequired: patch.details.confirmationRequired,
    },
    {
      householdVisible: true,
      routineId: "dinner",
      expectedPortion: "1.25 cups",
      servedAmount: 1.25,
      eatenAmount: 1,
      eatenUnit: "cup",
      mealCompletion: "most",
      mealLifecycle: "outcome-recorded",
      outcomeBy: "Apollo",
      outcomeAt: NOW,
      trustState: "confirmed",
      confirmationRequired: false,
    },
  );
  assert.match(String(patch.details.auditTrail?.[0]?.summary), /Apollo updated meal outcome on "Dinner - outcome pending" to Ate most/);
  assert.deepEqual(patch.details.auditTrail?.[0]?.changes, ["mealCompletion", "mealLifecycle", "outcomeAt", "eatenAmount"]);
});

test("records ate some with a precise eaten amount when the household supplies one", () => {
  const patch = buildMealOutcomeUpdatePatch(entry(), {
    caregiver: "Emma",
    now: NOW,
    outcome: "partial",
    eatenAmount: 0.4,
  });

  assert.equal(patch.title, "Dinner - Ate some");
  assert.equal(patch.amount, "0.4");
  assert.equal(patch.details.mealCompletion, "partial");
  assert.equal(patch.details.mealLifecycle, "outcome-recorded");
  assert.equal(patch.details.eatenAmount, 0.4);
  assert.equal(patch.details.eatenUnit, "cup");
  assert.equal(patch.details.eatenAmountEstimated, undefined);
});

test("keeps still grazing meals open instead of satisfying the routine", () => {
  const patch = buildMealOutcomeUpdatePatch(entry(), {
    caregiver: "Emma",
    now: NOW,
    outcome: "grazing",
  });

  assert.equal(patch.title, "Dinner - Still grazing");
  assert.equal(patch.amount, undefined);
  assert.equal(patch.severity, "watch");
  assert.equal(patch.details.mealCompletion, "grazing");
  assert.equal(patch.details.mealLifecycle, "outcome-pending");
  assert.equal(patch.details.eatenAmount, undefined);
  assert.equal(patch.details.eatenUnit, undefined);
});

test("records refused meals as zero eaten watch items", () => {
  const patch = buildMealOutcomeUpdatePatch(entry(), {
    caregiver: "Apollo",
    now: NOW,
    outcome: "skipped",
  });

  assert.equal(patch.title, "Dinner - Refused");
  assert.equal(patch.amount, "0");
  assert.equal(patch.severity, "watch");
  assert.equal(patch.details.eatenAmount, 0);
  assert.equal(patch.details.eatenUnit, "cup");
  assert.equal(patch.details.mealCompletion, "skipped");
  assert.equal(patch.details.mealLifecycle, "outcome-recorded");
});
