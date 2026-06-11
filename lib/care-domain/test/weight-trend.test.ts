import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveWeightTrend } from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-11T12:00:00-07:00").getTime();

test("derives weight trend from visible recent weigh-ins and weight goal", () => {
  const trend = deriveWeightTrend({
    now: NOW,
    lookbackDays: 120,
    profile: { weight: { current: 67, goal: "70 lb", unit: "lb" } },
    goals: [{ category: "weight", target: "70 lb", status: "active" }],
    entries: [
      {
        id: "weight-1",
        type: "weight",
        title: "Weight",
        caregiver: "Emma",
        occurredAt: "2026-05-01T09:00:00-07:00",
        amount: "66.2",
        details: { householdVisible: true },
      },
      {
        id: "weight-2",
        type: "weight",
        title: "Weight",
        caregiver: "Apollo",
        occurredAt: "2026-05-20T09:00:00-07:00",
        amount: "67.1",
        details: { householdVisible: true },
      },
      {
        id: "weight-3",
        type: "weight",
        title: "Weight",
        caregiver: "Emma",
        occurredAt: "2026-06-10T09:00:00-07:00",
        amount: "68",
        details: { householdVisible: true, note: "Ate breakfast first." },
      },
      {
        id: "private",
        type: "weight",
        title: "Private weight",
        caregiver: "Apollo",
        occurredAt: "2026-06-11T09:00:00-07:00",
        amount: "71",
        details: { householdVisible: false },
      },
    ],
  });

  assert.equal(trend.totalWeighIns, 3);
  assert.equal(trend.currentWeight, 68);
  assert.equal(trend.goalWeight, 70);
  assert.equal(trend.unit, "lb");
  assert.equal(trend.changeFromPrevious, 0.9);
  assert.equal(trend.remainingToGoal, 2);
  assert.equal(trend.direction, "gain");
  assert.equal(trend.status, "tracking");
  assert.deepEqual(trend.caregivers, ["Emma", "Apollo"]);
  assert.equal(trend.latest?.id, "weight-3");
  assert.match(trend.summary, /3 weigh-ins in the last 120 days/);
  assert.match(trend.summary, /current 68 lb/);
  assert.match(trend.nextStep, /Keep logging weight/);
});

test("uses profile weight as a baseline when visible weigh-ins are missing", () => {
  const trend = deriveWeightTrend({
    now: NOW,
    profile: { weight: { current: 68, goal: "", unit: "lb" } },
    entries: [
      {
        id: "old",
        type: "weight",
        occurredAt: "2025-12-01T09:00:00-07:00",
        amount: "66",
        details: { householdVisible: true },
      },
      {
        id: "private",
        type: "weight",
        occurredAt: "2026-06-10T09:00:00-07:00",
        amount: "69",
        details: { householdVisible: false },
      },
    ],
  });

  assert.equal(trend.totalWeighIns, 0);
  assert.equal(trend.currentWeight, 68);
  assert.equal(trend.goalWeight, 0);
  assert.equal(trend.status, "needs-log");
  assert.equal(trend.summary, "Current profile weight is 68 lb, but no shared weigh-ins are logged in the last 90 days.");
  assert.match(trend.nextStep, /Log the next weigh-in/);
});

test("prompts a weight baseline when neither profile nor logs have usable weight", () => {
  const trend = deriveWeightTrend({
    now: NOW,
    profile: { weight: { current: 0, unit: "lb" } },
    entries: [],
  });

  assert.equal(trend.status, "needs-baseline");
  assert.equal(trend.currentWeight, 0);
  assert.match(trend.summary, /No shared weight baseline/);
  assert.match(trend.nextStep, /Add Phoenix's current weight/);
});
