import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveCareIntelligence } from "../src/index.ts";

const NOW = new Date("2026-06-06T18:00:00.000Z").getTime();

test("blends routines, logs, evidence, and sync into care intelligence", () => {
  const intelligence = deriveCareIntelligence({
    now: NOW,
    caregivers: [
      { name: "Emma", role: "Owner" },
      { name: "Apollo", role: "Owner" },
    ],
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "8:00 AM", owner: "Emma" },
      { id: "walk-am", label: "Morning Walk", type: "walk", time: "9:00 AM", owner: "Apollo" },
      { id: "dinner", label: "Dinner", type: "meal", time: "7:00 PM", owner: "Emma" },
    ],
    entries: [
      {
        id: "meal-1",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-06T15:00:00.000Z",
        note: "Ate slowly but finished most.",
        details: {
          routineId: "breakfast",
          mealCompletion: "ate most",
          servedAmount: 1,
          servedUnit: "cup",
          eatenAmount: 0.8,
          eatenUnit: "cup",
          food: "salmon kibble",
        },
        syncStatus: "synced",
      },
      {
        id: "walk-1",
        type: "walk",
        title: "Morning Walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T16:00:00.000Z",
        durationMinutes: 45,
        note: "Good leash manners.",
        details: {
          routineId: "walk-am",
          walkRouteName: "Park loop",
          walkSocialOutcome: "calm",
          dogInteractions: 2,
        },
        syncStatus: "synced",
      },
      {
        id: "potty-1",
        type: "potty",
        title: "Potty",
        caregiver: "Emma",
        occurredAt: "2026-06-06T17:00:00.000Z",
        details: {
          pottyKind: "both",
          stoolCondition: "normal",
          stoolColor: "brown",
          pottyContext: "outside",
        },
        syncStatus: "synced",
      },
      {
        id: "dinner-1",
        type: "meal",
        title: "Dinner",
        caregiver: "Emma",
        occurredAt: "2026-06-06T17:55:00.000Z",
        details: {
          routineId: "dinner",
          mealCompletion: "served",
          mealLifecycle: "outcome-pending",
          servedAmount: 1,
          servedUnit: "cup",
          food: "salmon kibble",
        },
        syncStatus: "pending",
      },
    ],
  });

  assert.ok(intelligence.score >= 60);
  assert.ok(intelligence.confidenceScore >= 72);
  assert.equal(intelligence.pendingOutcomeCount, 1);
  assert.equal(intelligence.nextAction.kind, "update-meal-outcome");
  assert.equal(intelligence.nextAction.targetEntryId, "dinner-1");
  assert.ok(
    intelligence.openLoops.some((loop) => loop.kind === "pending-meal" && loop.targetEntryId === "dinner-1"),
  );
  assert.equal(intelligence.metrics[1].label, "Log confidence");
  assert.match(intelligence.subtitle, /care|confirm|outcome|record/i);
});

test("penalizes sparse, private, failed, and overdue care records", () => {
  const intelligence = deriveCareIntelligence({
    now: NOW,
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "8:00 AM", owner: "Emma" },
      { id: "walk-am", label: "Morning Walk", type: "walk", time: "9:00 AM", owner: "Apollo" },
    ],
    entries: [
      {
        id: "private-meal",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-06T15:00:00.000Z",
        details: { householdVisible: false, mealCompletion: "complete" },
        syncStatus: "synced",
      },
      {
        id: "failed-note",
        type: "note",
        title: "Saw something",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T17:30:00.000Z",
        syncStatus: "failed",
        syncError: "Network unavailable",
      },
    ],
  });

  assert.equal(intelligence.status, "needs-attention");
  assert.equal(intelligence.nextAction.kind, "retry-sync");
  assert.equal(intelligence.nextAction.targetEntryId, "failed-note");
  assert.ok(intelligence.score < 60);
  assert.ok(intelligence.openLoops.some((loop) => loop.kind === "failed-sync"));
  assert.ok(intelligence.openLoops.some((loop) => loop.kind === "overdue-routine"));
});
