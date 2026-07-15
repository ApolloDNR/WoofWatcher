// Regression coverage for two diet-progress correctness bugs found in the
// pre-launch QA sweep:
//   1. "today" was compared in UTC, so evening meals in the Americas dropped
//      out of the day's diet progress.
//   2. A portion-size digit ("1 cup") was misread as a meal frequency, forcing
//      two-meal schedules down to one meal and producing false over-feeding.
// This file sets a western timezone (like the other care-domain suites) and
// runs in its own process, so the local-vs-UTC day boundary is actually
// exercised.
process.env.TZ = "America/Los_Angeles";

import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveDietProgress } from "../src/diet-progress.ts";

test("counts an evening meal by local calendar day, not UTC", () => {
  // 8 PM PDT on Jul 15 is 03:00Z on Jul 16, so the UTC date has already rolled
  // over. A 9 AM PDT meal the same local day must still count as "today".
  const now = new Date("2026-07-15T20:00:00-07:00").getTime();
  const progress = deriveDietProgress({
    dietProfile: { normalPortion: "1 cup", mealSchedule: "Breakfast and dinner" },
    entries: [
      {
        type: "meal",
        occurredAt: "2026-07-15T09:00:00-07:00",
        details: { mealCompletion: "complete", eatenAmount: "1 cup" },
      },
    ],
    now,
  });

  assert.equal(progress.mealCount, 1);
  assert.equal(progress.fedAmount, 1);
});

test("still excludes a meal logged on a different local day", () => {
  const now = new Date("2026-07-15T20:00:00-07:00").getTime();
  const progress = deriveDietProgress({
    dietProfile: { normalPortion: "1 cup", mealSchedule: "Breakfast and dinner" },
    entries: [
      {
        type: "meal",
        occurredAt: "2026-07-14T09:00:00-07:00",
        details: { mealCompletion: "complete", eatenAmount: "1 cup" },
      },
    ],
    now,
  });

  assert.equal(progress.mealCount, 0);
  assert.equal(progress.fedAmount, 0);
});

test("derives meal target from the schedule when the portion has a leading digit", () => {
  // "1 cup" served at breakfast and dinner is two meals a day, not one. The old
  // regex matched the "1" in the portion and reported a 1-cup daily target,
  // turning two full cups into a 200% over-feeding readout.
  const progress = deriveDietProgress({
    dietProfile: { normalPortion: "1 cup", mealSchedule: "Breakfast and dinner" },
    entries: [
      { type: "meal", occurredAt: "2026-07-15T07:00:00-07:00", details: { eatenAmount: "1 cup" } },
      { type: "meal", occurredAt: "2026-07-15T18:00:00-07:00", details: { eatenAmount: "1 cup" } },
    ],
    now: new Date("2026-07-15T20:00:00-07:00").getTime(),
  });

  assert.equal(progress.targetMeals, 2);
  assert.equal(progress.targetAmount, 2);
  assert.equal(progress.fedAmount, 2);
  assert.equal(progress.percent, 100);
});

test("a decimal portion size is not misread as a single meal", () => {
  const progress = deriveDietProgress({
    dietProfile: { normalPortion: "1.5 cups", mealSchedule: "7 AM and 6 PM" },
    entries: [],
    now: new Date("2026-07-15T12:00:00-07:00").getTime(),
  });

  assert.equal(progress.targetMeals, 2);
  assert.equal(progress.targetAmount, 3);
});

test("explicit frequency words still drive the meal count", () => {
  const cases: Array<{ portion: string; schedule: string; meals: number }> = [
    { portion: "1 cup twice daily", schedule: "Breakfast and dinner", meals: 2 },
    { portion: "1 cup", schedule: "Two meals", meals: 2 },
    { portion: "1 cup once daily", schedule: "Morning", meals: 1 },
    { portion: "0.5 cup", schedule: "Breakfast, lunch, and dinner", meals: 3 },
    { portion: "2 cups", schedule: "3x daily", meals: 3 },
  ];

  for (const { portion, schedule, meals } of cases) {
    const progress = deriveDietProgress({
      dietProfile: { normalPortion: portion, mealSchedule: schedule },
      entries: [],
      now: new Date("2026-07-15T12:00:00-07:00").getTime(),
    });
    assert.equal(progress.targetMeals, meals, `${portion} / ${schedule}`);
  }
});
