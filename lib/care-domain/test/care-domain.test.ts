import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveCareDayStatus,
  deriveMoodTrend,
  getCareEventDefinition,
  normalizeCareEventType,
} from "../src/index.ts";

const NOW = new Date("2026-06-06T15:00:00.000Z").getTime();

test("normalizes medication aliases to the canonical event type", () => {
  assert.equal(normalizeCareEventType("meds"), "medication");
  assert.equal(normalizeCareEventType("medicine"), "medication");
});

test("normalizes symptom entries with vomit detail to vomit", () => {
  assert.equal(normalizeCareEventType("symptom", { what: "vomit" }), "vomit");
});

test("returns metadata for canonical event definitions", () => {
  const walk = getCareEventDefinition("walk");

  assert.equal(walk.type, "walk");
  assert.equal(walk.label, "Walk");
  assert.equal(walk.icon, "paw");
});

test("derives day status from normalized care entries", () => {
  const status = deriveCareDayStatus(
    [
      {
        type: "meal",
        occurredAt: "2026-06-06T07:00:00.000Z",
      },
      {
        type: "walk",
        occurredAt: "2026-06-06T08:00:00.000Z",
        durationMinutes: 30,
      },
      {
        type: "pee",
        occurredAt: "2026-06-06T09:00:00.000Z",
      },
      {
        type: "meds",
        occurredAt: "2026-06-06T10:00:00.000Z",
      },
      {
        type: "symptom",
        occurredAt: "2026-06-06T11:00:00.000Z",
        severity: "watch",
        details: { what: "vomit" },
      },
      {
        type: "mood",
        occurredAt: "2026-06-06T12:00:00.000Z",
        mood: "anxious",
      },
      {
        type: "training",
        occurredAt: "2026-06-05T12:00:00.000Z",
      },
    ],
    [
      { type: "meal" },
      { type: "meal" },
      { type: "walk" },
    ],
    NOW,
  );

  assert.deepEqual(status.counts.meals, { done: 1, target: 2, pending: 0 });
  assert.deepEqual(status.counts.walks, { done: 1, target: 1 });
  assert.deepEqual(status.counts.potty, { done: 1, target: 3 });
  assert.equal(status.counts.training, 0);
  assert.equal(status.counts.medication, 1);
  assert.equal(status.counts.vomit, 1);
  assert.equal(status.counts.anxiety, 1);
  assert.equal(status.counts.walkMinutes, 30);
  assert.equal(status.healthAlert, true);
});

test("keeps served meal outcomes open until the household records what was eaten", () => {
  const status = deriveCareDayStatus(
    [
      {
        type: "meal",
        occurredAt: "2026-06-06T07:00:00.000Z",
        details: {
          routineId: "breakfast",
          mealCompletion: "served",
          mealLifecycle: "outcome-pending",
          servedAmount: 1,
          servedUnit: "cup",
          householdVisible: true,
        },
      },
      {
        type: "meal",
        occurredAt: "2026-06-06T12:00:00.000Z",
        details: {
          routineId: "snack",
          mealCompletion: "grazing",
          servedAmount: 0.25,
          servedUnit: "cup",
          householdVisible: true,
        },
      },
      {
        type: "meal",
        occurredAt: "2026-06-06T14:00:00.000Z",
        details: {
          routineId: "lunch",
          mealCompletion: "ate most",
          servedAmount: 1,
          eatenAmount: 0.8,
          householdVisible: true,
        },
      },
      {
        type: "meal",
        occurredAt: "2026-06-06T18:00:00.000Z",
        details: {
          routineId: "dinner",
          mealCompletion: "skipped",
          servedAmount: 1,
          eatenAmount: 0,
          householdVisible: true,
        },
      },
    ],
    [
      { type: "meal" },
      { type: "meal" },
      { type: "meal" },
      { type: "meal" },
    ],
    NOW,
  );

  assert.deepEqual(status.counts.meals, { done: 2, target: 4, pending: 2 });
});

test("derives mood trend from shared mood and energy check-ins", () => {
  const trend = deriveMoodTrend({
    now: NOW,
    entries: [
      {
        id: "mood_1",
        type: "mood",
        title: "Mood - Visitors",
        occurredAt: "2026-06-06T12:00:00.000Z",
        caregiver: "Emma",
        mood: "anxious",
        details: {
          energyLevel: "low",
          moodContext: "Visitors came by",
          householdVisible: true,
        },
      },
      {
        id: "mood_2",
        type: "mood",
        occurredAt: "2026-06-05T12:00:00.000Z",
        caregiver: "Apollo",
        mood: "calm",
        details: {
          energyLevel: "steady",
          householdVisible: true,
        },
      },
      {
        id: "private_mood",
        type: "mood",
        occurredAt: "2026-06-05T13:00:00.000Z",
        mood: "happy",
        details: {
          energyLevel: "high",
          householdVisible: false,
        },
      },
      {
        id: "old_mood",
        type: "mood",
        occurredAt: "2026-04-01T12:00:00.000Z",
        mood: "unwell",
        details: {
          energyLevel: "low",
          householdVisible: true,
        },
      },
    ],
  });

  assert.equal(trend.total, 2);
  assert.equal(trend.averageScore, 3);
  assert.equal(trend.status, "watch");
  assert.equal(trend.watchCount, 1);
  assert.equal(trend.energy.low, 1);
  assert.equal(trend.energy.steady, 1);
  assert.equal(trend.energy.high, 0);
  assert.deepEqual(trend.caregivers, ["Emma", "Apollo"]);
  assert.equal(trend.latest?.context, "Visitors came by");
  assert.match(trend.summary, /2 shared mood check-ins/);
  assert.match(trend.nextStep, /Visitors came by/);
});
