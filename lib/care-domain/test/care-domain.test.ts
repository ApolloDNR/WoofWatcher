import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveCareDayStatus,
  deriveMoodTrend,
  deriveMoodTrendPeriods,
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

  assert.deepEqual(status.counts.meals, { done: 1, target: 2 });
  assert.deepEqual(status.counts.walks, { done: 1, target: 1 });
  assert.deepEqual(status.counts.potty, { done: 1, target: 3 });
  assert.equal(status.counts.training, 0);
  assert.equal(status.counts.medication, 1);
  assert.equal(status.counts.vomit, 1);
  assert.equal(status.counts.anxiety, 1);
  assert.equal(status.counts.walkMinutes, 30);
  assert.equal(status.healthAlert, true);
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

test("derives mood trend period summaries from the same shared evidence boundary", () => {
  const periods = deriveMoodTrendPeriods({
    now: NOW,
    selectedLookbackDays: 30,
    periods: [
      { label: "Week", lookbackDays: 7 },
      { label: "Month", lookbackDays: 30 },
      { label: "Quarter", lookbackDays: 90 },
    ],
    entries: [
      {
        id: "week_low",
        type: "mood",
        occurredAt: "2026-06-06T12:00:00.000Z",
        caregiver: "Emma",
        mood: "anxious",
        details: {
          energyLevel: "low",
          moodContext: "Visitors",
          householdVisible: true,
        },
      },
      {
        id: "month_calm",
        type: "mood",
        occurredAt: "2026-05-20T12:00:00.000Z",
        caregiver: "Apollo",
        mood: "calm",
        details: {
          energyLevel: "steady",
          householdVisible: true,
        },
      },
      {
        id: "quarter_happy",
        type: "mood",
        occurredAt: "2026-04-15T12:00:00.000Z",
        caregiver: "Maya",
        mood: "happy",
        details: {
          energyLevel: "high",
          householdVisible: true,
        },
      },
      {
        id: "private_week",
        type: "mood",
        occurredAt: "2026-06-06T13:00:00.000Z",
        mood: "happy",
        details: {
          householdVisible: false,
        },
      },
    ],
  });

  assert.deepEqual(
    periods.map((period) => ({
      label: period.label,
      lookbackDays: period.lookbackDays,
      total: period.trend.total,
      selected: period.isSelected,
    })),
    [
      { label: "Week", lookbackDays: 7, total: 1, selected: false },
      { label: "Month", lookbackDays: 30, total: 2, selected: true },
      { label: "Quarter", lookbackDays: 90, total: 3, selected: false },
    ],
  );
  assert.equal(periods[0].trend.energy.low, 1);
  assert.equal(periods[1].trend.energy.steady, 1);
  assert.equal(periods[2].trend.energy.high, 1);
});

test("filters mood trend by caregiver and care context without widening shared evidence", () => {
  const trend = deriveMoodTrend({
    now: NOW,
    caregiver: "Emma",
    context: "Visitors",
    entries: [
      {
        id: "emma_visitors_low",
        type: "mood",
        occurredAt: "2026-06-06T12:00:00.000Z",
        caregiver: "Emma",
        mood: "anxious",
        details: {
          energyLevel: "low",
          moodContext: "Visitors",
          householdVisible: true,
        },
      },
      {
        id: "emma_walk_high",
        type: "mood",
        occurredAt: "2026-06-06T11:00:00.000Z",
        caregiver: "Emma",
        mood: "happy",
        details: {
          energyLevel: "high",
          moodContext: "After walk",
          householdVisible: true,
        },
      },
      {
        id: "apollo_visitors_steady",
        type: "mood",
        occurredAt: "2026-06-06T10:00:00.000Z",
        caregiver: "Apollo",
        mood: "calm",
        details: {
          energyLevel: "steady",
          moodContext: "Visitors",
          householdVisible: true,
        },
      },
      {
        id: "private_match",
        type: "mood",
        occurredAt: "2026-06-06T09:00:00.000Z",
        caregiver: "Emma",
        mood: "happy",
        details: {
          energyLevel: "high",
          moodContext: "Visitors",
          householdVisible: false,
        },
      },
      {
        id: "old_match",
        type: "mood",
        occurredAt: "2026-04-01T12:00:00.000Z",
        caregiver: "Emma",
        mood: "unwell",
        details: {
          energyLevel: "low",
          moodContext: "Visitors",
          householdVisible: true,
        },
      },
    ],
  });

  assert.equal(trend.total, 1);
  assert.deepEqual(trend.items.map((item) => item.id), ["emma_visitors_low"]);
  assert.deepEqual(trend.caregivers, ["Emma"]);
  assert.deepEqual(trend.contexts, ["Visitors"]);
  assert.equal(trend.energy.low, 1);
  assert.equal(trend.energy.steady, 0);
  assert.equal(trend.energy.high, 0);
  assert.match(trend.summary, /1 shared mood check-ins/);
  assert.match(trend.nextStep, /Visitors/);
});
