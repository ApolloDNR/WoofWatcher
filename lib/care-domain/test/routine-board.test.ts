import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveRoutineBoard } from "../src/index.ts";

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
