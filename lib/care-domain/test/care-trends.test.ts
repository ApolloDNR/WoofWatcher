import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveCareTrends } from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-08T12:00:00-07:00").getTime();

test("derives weekly care trends from visible household logs", () => {
  const trends = deriveCareTrends({
    now: NOW,
    windowDays: 7,
    entries: [
      {
        id: "private-walk",
        type: "walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-08T06:30:00-07:00",
        durationMinutes: 90,
        details: { routeName: "Private field", householdVisible: false },
      },
      {
        id: "breakfast",
        type: "meal",
        caregiver: "Emma",
        occurredAt: "2026-06-08T07:10:00-07:00",
        details: { mealCompletion: "complete", householdVisible: true },
      },
      {
        id: "partial-dinner",
        type: "meal",
        caregiver: "Apollo",
        occurredAt: "2026-06-07T18:20:00-07:00",
        details: { mealCompletion: "partial", eatenAmount: 0.5, householdVisible: true },
      },
      {
        id: "morning-loop",
        type: "walk",
        caregiver: "Emma",
        occurredAt: "2026-06-08T08:30:00-07:00",
        durationMinutes: 30,
        dogInteractions: 1,
        details: { routeName: "Neighborhood Loop", distanceMiles: 1.2, socialOutcome: "Calm passing" },
      },
      {
        id: "evening-loop",
        type: "walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-07T18:45:00-07:00",
        durationMinutes: 20,
        details: { routeName: "Neighborhood Loop", distanceMiles: 0.8, dogInteractions: 0 },
      },
      {
        id: "water-refill",
        type: "water",
        caregiver: "Emma",
        occurredAt: "2026-06-08T09:00:00-07:00",
        details: { waterAmount: "refill", householdVisible: true },
      },
      {
        id: "water-sip",
        type: "water",
        caregiver: "Apollo",
        occurredAt: "2026-06-07T14:00:00-07:00",
        details: { amount: "sip", householdVisible: true },
      },
      {
        id: "soft-potty",
        type: "potty",
        caregiver: "Emma",
        occurredAt: "2026-06-08T10:20:00-07:00",
        details: { kind: "both", condition: "soft", stoolColor: "yellow", householdVisible: true },
      },
      {
        id: "med-skipped",
        type: "medication",
        caregiver: "Apollo",
        occurredAt: "2026-06-07T20:00:00-07:00",
        details: { medicationOutcome: "skipped", householdVisible: true },
      },
      {
        id: "vomit",
        type: "vomit",
        caregiver: "Emma",
        occurredAt: "2026-06-06T06:30:00-07:00",
        severity: "watch",
        details: { kind: "yellow bile", householdVisible: true },
      },
      {
        id: "previous-walk",
        type: "walk",
        caregiver: "Emma",
        occurredAt: "2026-05-31T08:30:00-07:00",
        durationMinutes: 15,
        details: { routeName: "Short block", distanceMiles: 0.5 },
      },
      {
        id: "previous-meal",
        type: "meal",
        caregiver: "Emma",
        occurredAt: "2026-05-30T07:00:00-07:00",
        details: { mealCompletion: "complete" },
      },
    ],
  });

  assert.equal(trends.windowDays, 7);
  assert.equal(trends.current.totalLogs, 9);
  assert.equal(trends.current.loggedDays, 3);
  assert.equal(trends.current.caregiverCount, 2);
  assert.deepEqual(trends.current.caregivers, ["Emma", "Apollo"]);
  assert.equal(trends.current.meals.total, 2);
  assert.equal(trends.current.meals.complete, 1);
  assert.equal(trends.current.meals.partial, 1);
  assert.equal(trends.current.meals.completionPercent, 50);
  assert.equal(trends.current.walks.totalMinutes, 50);
  assert.equal(trends.current.walks.distanceMiles, 2);
  assert.equal(trends.current.walks.dogInteractions, 1);
  assert.equal(trends.current.water.refillEquivalent, 1.25);
  assert.equal(trends.current.potty.watchCount, 1);
  assert.equal(trends.current.medication.skipped, 1);
  assert.equal(trends.current.health.watchCount, 1);
  assert.equal(trends.previous.walks.totalMinutes, 15);
  assert.equal(trends.deltas.walkMinutes, 35);
  assert.match(trends.summary, /9 visible care logs over 3 days/);
  assert.ok(trends.highlights.some((line) => /50 walk minutes/.test(line)));
  assert.ok(trends.signals.some((signal) => signal.kind === "potty-watch" && /1 potty log/.test(signal.detail)));
  assert.ok(trends.signals.some((signal) => signal.kind === "medication-watch" && /1 skipped/.test(signal.detail)));
});

test("ignores private logs when deriving care trends", () => {
  const trends = deriveCareTrends({
    now: NOW,
    entries: [
      {
        id: "private-meal",
        type: "meal",
        caregiver: "Apollo",
        occurredAt: "2026-06-08T07:00:00-07:00",
        details: { mealCompletion: "skipped", householdVisible: false },
      },
      {
        id: "private-potty",
        type: "potty",
        caregiver: "Apollo",
        occurredAt: "2026-06-08T09:00:00-07:00",
        details: { condition: "soft", householdVisible: false },
      },
    ],
  });

  assert.equal(trends.current.totalLogs, 0);
  assert.equal(trends.current.meals.total, 0);
  assert.equal(trends.current.potty.watchCount, 0);
  assert.equal(trends.summary, "No shared care logs in the last 7 days");
  assert.match(trends.nextStep, /Start with meals, water, walks, potty, and medication/i);
});

test("keeps pending meal outcomes separate in weekly trend summaries", () => {
  const trends = deriveCareTrends({
    now: NOW,
    entries: [
      {
        id: "breakfast-complete",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-08T07:00:00-07:00",
        details: { mealCompletion: "complete", householdVisible: true },
      },
      {
        id: "dinner-served",
        type: "meal",
        title: "Dinner",
        caregiver: "Apollo",
        occurredAt: "2026-06-07T18:00:00-07:00",
        details: {
          mealCompletion: "served",
          mealLifecycle: "outcome-pending",
          servedAmount: 1,
          servedUnit: "cup",
          householdVisible: true,
        },
      },
      {
        id: "snack-grazing",
        type: "meal",
        title: "Bedtime snack",
        caregiver: "Emma",
        occurredAt: "2026-06-07T21:00:00-07:00",
        details: {
          mealCompletion: "grazing",
          mealLifecycle: "outcome-pending",
          servedAmount: 0.25,
          servedUnit: "cup",
          householdVisible: true,
        },
      },
    ],
  });

  assert.equal(trends.current.meals.total, 3);
  assert.equal(trends.current.meals.complete, 1);
  assert.equal(trends.current.meals.partial, 0);
  assert.equal(trends.current.meals.skipped, 0);
  assert.equal(trends.current.meals.pending, 2);
  assert.equal(trends.current.meals.completionPercent, 33);
  assert.match(trends.summary, /33% meal completion, 2 outcomes pending/);
  assert.ok(
    trends.highlights.some((line) =>
      /Meals: 1 complete, 0 partial, 0 skipped, 2 pending outcomes/.test(line),
    ),
  );
  assert.ok(
    trends.signals.some(
      (signal) =>
        signal.kind === "meal-watch" &&
        /2 outcomes pending/.test(signal.detail) &&
        /update served meal outcomes/i.test(signal.action),
    ),
  );
});
