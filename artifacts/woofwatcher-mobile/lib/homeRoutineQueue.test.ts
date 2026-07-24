import assert from "node:assert/strict";
import { test } from "node:test";

import { selectHomeRoutineQueue } from "./homeRoutineQueue.ts";

const NOW = Date.parse("2026-07-23T19:00:00-07:00");

test("selects future open routines by actual clock order", () => {
  const queue = selectHomeRoutineQueue(
    [
      {
        id: "breakfast",
        status: "overdue",
        minutesFromNow: -720,
      },
      {
        id: "bedtime",
        status: "upcoming",
        minutesFromNow: 180,
      },
      {
        id: "dinner",
        status: "upcoming",
        minutesFromNow: 30,
      },
    ],
    {},
    NOW,
  );

  assert.deepEqual(
    queue.map((item) => item.id),
    ["dinner", "bedtime"],
  );
});

test("excludes completed, pending-outcome, and snoozed routines", () => {
  const queue = selectHomeRoutineQueue(
    [
      { id: "done", status: "done", minutesFromNow: 10 },
      { id: "pending-meal", status: "pending", minutesFromNow: 15 },
      { id: "snoozed", status: "upcoming", minutesFromNow: 20 },
      { id: "available", status: "upcoming", minutesFromNow: 25 },
    ],
    { snoozed: NOW + 30 * 60_000 },
    NOW,
  );

  assert.deepEqual(
    queue.map((item) => item.id),
    ["available"],
  );
});

test("keeps an exact-time open routine and restores expired snoozes", () => {
  const queue = selectHomeRoutineQueue(
    [
      { id: "exact", status: "due", minutesFromNow: 0 },
      { id: "restored", status: "upcoming", minutesFromNow: 5 },
    ],
    { restored: NOW - 1 },
    NOW,
  );

  assert.deepEqual(
    queue.map((item) => item.id),
    ["exact", "restored"],
  );
});
