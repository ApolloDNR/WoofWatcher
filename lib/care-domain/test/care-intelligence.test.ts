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

test("keeps a pre-midnight pending meal outcome open just after the rollover", () => {
  // Dinner served 23:58 local, checked 00:02: the open loop survives the
  // local-day rollover with copy that owns it ("Last night's ...") - in
  // lockstep with lib/todayCommand's PENDING_MEAL_OUTCOME_WINDOW_MS.
  // Local Date constructors keep this timezone-agnostic on any runner.
  const servedLateNight = new Date(2026, 5, 6, 23, 58);
  const justPastMidnight = new Date(2026, 5, 7, 0, 2).getTime();
  const intelligence = deriveCareIntelligence({
    now: justPastMidnight,
    entries: [
      {
        id: "dinner-late",
        type: "meal",
        title: "Dinner",
        caregiver: "Emma",
        occurredAt: servedLateNight.toISOString(),
        details: {
          mealCompletion: "served",
          mealLifecycle: "outcome-pending",
          servedAmount: 1,
          servedUnit: "cup",
        },
        syncStatus: "synced",
      },
    ],
  });

  assert.equal(intelligence.pendingOutcomeCount, 1);
  assert.equal(intelligence.nextAction.kind, "update-meal-outcome");
  assert.equal(intelligence.nextAction.targetEntryId, "dinner-late");
  const loop = intelligence.openLoops.find((item) => item.kind === "pending-meal");
  assert.ok(loop);
  assert.match(loop.detail, /Last night's Dinner - how did it go\?/);
});

test("expires a previous-day pending meal outcome after 12 hours", () => {
  // Served 10:00 local yesterday, checked 00:02: 14h old is past the 12h
  // carryover window, so the stale loop no longer surfaces.
  const servedMidMorning = new Date(2026, 5, 6, 10, 0);
  const justPastMidnight = new Date(2026, 5, 7, 0, 2).getTime();
  const intelligence = deriveCareIntelligence({
    now: justPastMidnight,
    entries: [
      {
        id: "stale-meal",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: servedMidMorning.toISOString(),
        details: {
          mealCompletion: "served",
          mealLifecycle: "outcome-pending",
        },
        syncStatus: "synced",
      },
    ],
  });

  assert.equal(intelligence.pendingOutcomeCount, 0);
  assert.notEqual(intelligence.nextAction.kind, "update-meal-outcome");
  assert.equal(
    intelligence.openLoops.some((loop) => loop.kind === "pending-meal"),
    false,
  );
});

test("keeps a zero-log day at an honest 0 Care IQ instead of sync filler", () => {
  // Fresh profile / empty day: nothing has been logged, so the score must
  // read 0 - not the ~9% the perfect-sync term would fabricate. The record
  // starts with the first real log (in lockstep with Home's "--" zero state).
  const intelligence = deriveCareIntelligence({ now: NOW, entries: [] });

  assert.equal(intelligence.score, 0);
  assert.equal(intelligence.visibleLogCount, 0);
  assert.equal(intelligence.status, "building");
  assert.ok(intelligence.openLoops.some((loop) => loop.kind === "missing-care"));

  // A single private (household-hidden) log is still an empty household
  // record - the honest zero holds.
  const privateOnly = deriveCareIntelligence({
    now: NOW,
    entries: [
      {
        id: "hidden",
        type: "note",
        title: "Private note",
        caregiver: "Emma",
        occurredAt: "2026-06-06T15:00:00.000Z",
        details: { householdVisible: false },
        syncStatus: "synced",
      },
    ],
  });
  assert.equal(privateOnly.score, 0);
});

test("penalizes sparse, private, failed, and overdue care records", () => {
  const intelligence = deriveCareIntelligence({
    now: NOW,
    providerSyncEnabled: true,
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

test("treats local and stale failed statuses as complete saves without a provider", () => {
  const intelligence = deriveCareIntelligence({
    now: NOW,
    providerSyncEnabled: false,
    entries: [
      {
        id: "local-meal",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-06T17:30:00.000Z",
        syncStatus: "local",
        details: {
          mealCompletion: "complete",
          servingAmount: "1 cup",
          householdVisible: true,
        },
      },
      {
        id: "stale-failed-note",
        type: "note",
        title: "Care note",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T17:35:00.000Z",
        syncStatus: "failed",
        syncError: "Network unavailable",
        details: { householdVisible: true },
      },
    ],
  });

  assert.equal(intelligence.syncScore, 100);
  assert.notEqual(intelligence.nextAction.kind, "retry-sync");
  assert.equal(
    intelligence.openLoops.some((loop) => loop.kind === "failed-sync"),
    false,
  );
});
