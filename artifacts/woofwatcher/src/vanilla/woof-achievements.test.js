import test from "node:test";
import assert from "node:assert/strict";

import {
  createEntry,
  getAchievementReview,
  getDefaultState,
  getTrainingProgress
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

test("keeps achievement and training recovery copy behind the Dog Profile identity boundary", () => {
  const now = "2026-06-13T18:00:00.000Z";
  const renamedState = {
    ...getDefaultState(now),
    profile: { name: "  Mochi  " },
    entries: [
      ...Array.from({ length: 7 }, (_, index) => createEntry({
        type: "walk",
        title: "Morning walk",
        occurredAt: daysAgo(now, index)
      })),
      createEntry({
        type: "training",
        title: "Leash reset",
        note: "Mochi seemed anxious and pulled toward home.",
        occurredAt: daysAgo(now, 0, 15)
      })
    ]
  };

  const achievements = getAchievementReview(renamedState, now);
  const training = getTrainingProgress(renamedState, now);

  assert.equal(
    achievements.achievements.find((achievement) => achievement.id === "routine_streak").summary,
    "Mochi has care proof on every day of the last week.",
  );
  assert.match(training.focusAreas.join(" "), /what helped Mochi recover/);
  assert.doesNotMatch(JSON.stringify({ achievements, training }), /Phoenix|My Dog/);
});

test("derives shared achievements only from household-visible logs", () => {
  const now = "2026-06-13T18:00:00.000Z";
  const state = {
    ...getDefaultState(now),
    entries: [
      ...Array.from({ length: 7 }, (_, index) => ({
        ...createEntry({
          type: "walk",
          title: "Legacy private walk",
          occurredAt: daysAgo(now, index)
        }),
        householdVisible: false
      })),
      ...Array.from({ length: 3 }, (_, index) => createEntry({
        type: "training",
        title: "Private training note",
        occurredAt: daysAgo(now, index, 16),
        visibility: "Private"
      }))
    ]
  };

  const review = getAchievementReview(state, now);
  const streak = review.achievements.find((achievement) => achievement.id === "routine_streak");
  const training = review.achievements.find((achievement) => achievement.id === "training_consistency");

  assert.equal(streak.progress, 0);
  assert.equal(streak.status, "needs_log");
  assert.equal(training.progress, 0);
  assert.equal(training.status, "needs_log");
  assert.equal(review.evidence.weekLogs, 0);
});
