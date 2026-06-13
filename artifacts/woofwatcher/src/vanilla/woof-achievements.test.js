import test from "node:test";
import assert from "node:assert/strict";

import {
  createEntry,
  getAchievementReview,
  getDefaultState
} from "./woof-core.js";

function daysAgo(now, days, hour = 12) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

test("derives meaningful care achievements from household evidence", () => {
  const now = "2026-06-13T18:00:00.000Z";
  const state = {
    ...getDefaultState(now),
    records: [
      { id: "r1", type: "vaccine", title: "Rabies", due: "2027-06-01", note: "Current" },
      { id: "r2", type: "vet", title: "Annual visit", due: "2026-06-20", note: "Baseline exam" },
      { id: "r3", type: "microchip", title: "Microchip", due: "985112000000000", note: "Registered" }
    ],
    entries: [
      ...Array.from({ length: 7 }, (_, index) => createEntry({
        type: "walk",
        title: "Morning walk",
        caregiver: index % 2 ? "Apollo" : "Girlfriend",
        durationMinutes: 24,
        occurredAt: daysAgo(now, index)
      })),
      ...Array.from({ length: 3 }, (_, index) => createEntry({
        type: "training",
        title: "Place work",
        caregiver: "Apollo",
        durationMinutes: 12,
        note: "Calm win and settled faster.",
        occurredAt: daysAgo(now, index + 1, 16)
      })),
      createEntry({
        type: "meal",
        title: "Dinner",
        caregiver: "Girlfriend",
        portionOffered: "1 cup",
        portionEaten: "Ate all",
        outcome: "Ate all",
        occurredAt: daysAgo(now, 0, 17)
      }),
      createEntry({
        type: "alone",
        title: "Alone time",
        caregiver: "Apollo",
        aloneOutcome: "Calm",
        note: "Waited calmly and greeted softly.",
        occurredAt: daysAgo(now, 2, 14)
      })
    ]
  };

  const review = getAchievementReview(state, now);

  assert.equal(review.completedCount, 5);
  assert.equal(review.totalCount, 6);
  assert.equal(review.featured.id, "routine_streak");
  assert.deepEqual(
    review.achievements.filter((achievement) => achievement.status === "earned").map((achievement) => achievement.id),
    ["routine_streak", "training_consistency", "happy_tummy_week", "calm_alone_time", "records_complete"]
  );
  assert.equal(review.achievements.find((achievement) => achievement.id === "bedtime_snack_proof").status, "progress");
});
