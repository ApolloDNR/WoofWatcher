import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveDietProgress } from "../src/index.ts";

const NOW = new Date("2026-06-06T18:00:00.000Z").getTime();

test("derives daily meal progress from diet profile and numeric meal logs", () => {
  const progress = deriveDietProgress({
    now: NOW,
    dietProfile: {
      primaryFood: "salmon kibble",
      normalPortion: "1 cup twice daily",
      mealSchedule: "Breakfast and dinner",
    },
    entries: [
      {
        type: "meal",
        occurredAt: "2026-06-06T14:00:00.000Z",
        amount: "0.75",
        details: { servingUnit: "cup" },
      },
      {
        type: "meal",
        occurredAt: "2026-06-06T17:30:00.000Z",
        details: { servingAmount: 0.5, servingUnit: "cup" },
      },
      {
        type: "meal",
        occurredAt: "2026-06-05T17:30:00.000Z",
        amount: "1",
        details: { servingUnit: "cup" },
      },
    ],
  });

  assert.equal(progress.targetAmount, 2);
  assert.equal(progress.fedAmount, 1.25);
  assert.equal(progress.remainingAmount, 0.75);
  assert.equal(progress.percent, 63);
  assert.equal(progress.unit, "cup");
  assert.equal(progress.mealCount, 2);
  assert.equal(progress.targetMeals, 2);
  assert.equal(progress.summary, "1.25 of 2 cups today");
});

test("uses portion presets when a meal log does not include a numeric serving", () => {
  const progress = deriveDietProgress({
    now: NOW,
    dietProfile: {
      normalPortion: "1 cup twice daily",
      mealSchedule: "Two meals",
    },
    entries: [
      {
        type: "meal",
        occurredAt: "2026-06-06T14:00:00.000Z",
        details: { portion: "full" },
      },
      {
        type: "meal",
        occurredAt: "2026-06-06T17:30:00.000Z",
        details: { portion: "half" },
      },
    ],
  });

  assert.equal(progress.fedAmount, 1.5);
  assert.equal(progress.remainingAmount, 0.5);
  assert.equal(progress.percent, 75);
  assert.equal(progress.summary, "1.5 of 2 cups today");
});

test("falls back gracefully when the diet profile has no parseable portion", () => {
  const progress = deriveDietProgress({
    now: NOW,
    dietProfile: {
      normalPortion: "Ask vet after weigh-in",
      mealSchedule: "Flexible",
    },
    entries: [
      {
        type: "meal",
        occurredAt: "2026-06-06T14:00:00.000Z",
        details: { portion: "snack" },
      },
    ],
  });

  assert.equal(progress.targetAmount, null);
  assert.equal(progress.remainingAmount, null);
  assert.equal(progress.percent, 0);
  assert.equal(progress.summary, "1 meal logged today");
});
