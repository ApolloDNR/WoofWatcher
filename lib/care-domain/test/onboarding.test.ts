import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveOnboardingStatus } from "../src/index.ts";

test("surfaces the dog profile as the first setup step for default state", () => {
  const status = deriveOnboardingStatus({
    profile: { name: "My Dog", breed: "", weight: { current: 0, unit: "lb" } },
    dietProfile: { primaryFood: "", normalPortion: "", mealSchedule: "" },
    routines: [],
    caregivers: [],
  });

  assert.equal(status.isComplete, false);
  assert.equal(status.completedCount, 0);
  assert.equal(status.totalCount, 4);
  assert.equal(status.percent, 0);
  assert.equal(status.nextStep?.id, "dog-profile");
  assert.match(status.nextStep?.title ?? "", /dog profile/i);
});

test("requires diet, routines, and household helpers after profile is set", () => {
  const status = deriveOnboardingStatus({
    profile: { name: "Phoenix", breed: "German Shepherd mix", weight: { current: 68, unit: "lb" } },
    dietProfile: { primaryFood: "Sensitive kibble", normalPortion: "", mealSchedule: "" },
    routines: [{ type: "meal", label: "Breakfast", time: "7:30 AM" }],
    caregivers: [],
  });

  assert.equal(status.completedCount, 2);
  assert.equal(status.percent, 50);
  assert.deepEqual(
    status.steps.filter((step) => !step.done).map((step) => step.id),
    ["diet-profile", "household-caregiver"],
  );
  assert.equal(status.nextStep?.id, "diet-profile");
});

test("marks onboarding complete when the core care foundation exists", () => {
  const status = deriveOnboardingStatus({
    profile: { name: "Phoenix", breed: "German Shepherd mix", weight: { current: 68, unit: "lb" } },
    dietProfile: { primaryFood: "Sensitive kibble", normalPortion: "1 cup", mealSchedule: "7 AM and 6 PM" },
    routines: [
      { type: "meal", label: "Breakfast", time: "7:30 AM" },
      { type: "walk", label: "Morning walk", time: "8:30 AM" },
    ],
    caregivers: [{ name: "Emma", role: "Primary" }],
  });

  assert.equal(status.isComplete, true);
  assert.equal(status.completedCount, 4);
  assert.equal(status.percent, 100);
  assert.equal(status.nextStep, null);
  assert.match(status.summary, /ready/i);
});
