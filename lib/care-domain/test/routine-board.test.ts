import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveRoutineBoard } from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-06T14:00:00-07:00").getTime();

test("matches care logs to specific routines without completing every routine of the same type", () => {
  const board = deriveRoutineBoard({
    now: NOW,
    caregivers: [{ name: "Emma" }, { name: "Apollo" }],
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Emma" },
      { id: "walk", label: "Morning walk", type: "walk", time: "8:30 AM", owner: "Apollo" },
      { id: "dinner", label: "Dinner", type: "meal", time: "6:00 PM", owner: "Emma" },
    ],
    entries: [
      {
        id: "meal_1",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-06T07:40:00-07:00",
        details: { routineId: "breakfast" },
      },
      {
        id: "walk_1",
        type: "walk",
        title: "Morning walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T08:45:00-07:00",
      },
    ],
  });

  assert.equal(board.doneCount, 2);
  assert.equal(board.openCount, 1);
  assert.equal(board.items.find((item) => item.id === "breakfast")?.status, "done");
  assert.equal(board.items.find((item) => item.id === "walk")?.status, "done");
  assert.equal(board.items.find((item) => item.id === "dinner")?.status, "upcoming");
  assert.equal(board.ownerLoads.find((load) => load.owner === "Emma")?.assigned, 2);
  assert.equal(board.ownerLoads.find((load) => load.owner === "Emma")?.done, 1);
});

test("marks overdue, due, upcoming, and unassigned routine states", () => {
  const board = deriveRoutineBoard({
    now: NOW,
    caregivers: [{ name: "Emma" }, { name: "Apollo" }],
    routines: [
      { id: "walk", label: "Morning walk", type: "walk", time: "8:30 AM", owner: "Apollo" },
      { id: "snack", label: "Bedtime snack", type: "meal", time: "2:15 PM", owner: "" },
      { id: "training", label: "Training", type: "training", time: "5:00 PM", owner: "Emma" },
    ],
    entries: [],
  });

  assert.equal(board.items.find((item) => item.id === "walk")?.status, "overdue");
  assert.equal(board.items.find((item) => item.id === "snack")?.status, "due");
  assert.equal(board.items.find((item) => item.id === "training")?.status, "upcoming");
  assert.equal(board.unassignedCount, 1);
  assert.equal(board.next?.id, "snack");
});

test("fuzzy matching consumes each same-type entry once", () => {
  const board = deriveRoutineBoard({
    now: NOW,
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Emma" },
      { id: "dinner", label: "Dinner", type: "meal", time: "6:00 PM", owner: "Emma" },
    ],
    entries: [
      {
        id: "meal_1",
        type: "meal",
        title: "Meal",
        caregiver: "Emma",
        occurredAt: "2026-06-06T07:45:00-07:00",
      },
    ],
  });

  assert.equal(board.doneCount, 1);
  assert.equal(board.items.find((item) => item.id === "breakfast")?.status, "done");
  assert.equal(board.items.find((item) => item.id === "dinner")?.status, "upcoming");
});

test("id-less routine logs still match exactly and only count once", () => {
  const board = deriveRoutineBoard({
    now: NOW,
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Emma" },
      { id: "snack", label: "Snack", type: "meal", time: "7:45 AM", owner: "Apollo" },
    ],
    entries: [
      {
        type: "meal",
        title: "Snack",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T07:42:00-07:00",
        details: { routineId: "snack" },
      },
    ],
  });

  assert.equal(board.doneCount, 1);
  assert.equal(board.items.find((item) => item.id === "breakfast")?.status, "overdue");
  assert.equal(board.items.find((item) => item.id === "snack")?.status, "done");
});

test("meal logs record partial and skipped completion while satisfying the matching routine", () => {
  const board = deriveRoutineBoard({
    now: NOW,
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Emma" },
      { id: "dinner", label: "Dinner", type: "meal", time: "6:00 PM", owner: "Apollo" },
    ],
    entries: [
      {
        id: "meal_partial",
        type: "meal",
        title: "Breakfast - partial",
        caregiver: "Emma",
        occurredAt: "2026-06-06T07:38:00-07:00",
        details: {
          routineId: "breakfast",
          mealCompletion: "partial",
          expectedPortion: "1 cup",
          servedAmount: 1,
          servedUnit: "cup",
          eatenAmount: 0.5,
          eatenUnit: "cup",
          householdVisible: true,
        },
      },
      {
        id: "meal_skipped",
        type: "meal",
        title: "Dinner - skipped",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T17:55:00-07:00",
        details: {
          routineId: "dinner",
          mealCompletion: "skipped",
          expectedPortion: "1 cup",
          servedAmount: 0,
          servedUnit: "cup",
          eatenAmount: 0,
          eatenUnit: "cup",
          householdVisible: true,
        },
      },
    ],
  });

  const breakfast = board.items.find((item) => item.id === "breakfast");
  const dinner = board.items.find((item) => item.id === "dinner");

  assert.equal(board.doneCount, 2);
  assert.equal(board.openCount, 0);
  assert.equal(breakfast?.status, "done");
  assert.equal(breakfast?.completion, "partial");
  assert.equal(breakfast?.completionLabel, "Partial");
  assert.equal(dinner?.status, "done");
  assert.equal(dinner?.completion, "skipped");
  assert.equal(dinner?.completionLabel, "Skipped");
});

test("served meal keeps the matching routine open until the outcome is updated", () => {
  const board = deriveRoutineBoard({
    now: NOW,
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Emma" },
      { id: "walk", label: "Morning walk", type: "walk", time: "8:30 AM", owner: "Apollo" },
    ],
    entries: [
      {
        id: "meal_served",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-06T07:38:00-07:00",
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
        id: "walk_done",
        type: "walk",
        title: "Morning walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T08:45:00-07:00",
        details: { routineId: "walk", householdVisible: true },
      },
    ],
  });

  const breakfast = board.items.find((item) => item.id === "breakfast");

  assert.equal(board.doneCount, 1);
  assert.equal(board.openCount, 1);
  assert.equal(board.next?.id, "breakfast");
  assert.equal(breakfast?.status, "pending");
  assert.equal(breakfast?.completion, "pending");
  assert.equal(breakfast?.completionLabel, "Outcome pending");
  assert.equal(breakfast?.completedBy, "Emma");
});

test("private logs do not satisfy household routines", () => {
  const board = deriveRoutineBoard({
    now: NOW,
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Emma" },
    ],
    entries: [
      {
        id: "meal_private",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-06T07:38:00-07:00",
        details: {
          routineId: "breakfast",
          mealCompletion: "complete",
          householdVisible: false,
        },
      },
    ],
  });

  assert.equal(board.doneCount, 0);
  assert.equal(board.openCount, 1);
  assert.equal(board.items.find((item) => item.id === "breakfast")?.status, "overdue");
});
