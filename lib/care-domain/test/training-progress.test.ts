import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveTrainingProgress } from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-08T12:00:00-07:00").getTime();

test("derives training progress from visible recent training logs", () => {
  const progress = deriveTrainingProgress({
    now: NOW,
    lookbackDays: 30,
    entries: [
      {
        id: "leash-win",
        type: "training",
        title: "Leash manners",
        caregiver: "Emma",
        occurredAt: "2026-06-08T09:00:00-07:00",
        durationMinutes: 12,
        details: {
          skill: "Leash manners",
          cue: "Heel",
          trainingOutcome: "win",
          trigger: "Dog near fence",
          nextPractice: "Practice calm passes",
          householdVisible: true,
        },
      },
      {
        id: "recall-practice",
        type: "training",
        title: "Recall practice",
        caregiver: "Apollo",
        occurredAt: "2026-06-07T16:00:00-07:00",
        durationMinutes: 8,
        details: {
          skill: "Recall",
          trainingOutcome: "practice",
          nextPractice: "Use longer leash in the yard",
          householdVisible: true,
        },
      },
      {
        id: "greeting-struggle",
        type: "training",
        title: "Calm greeting",
        caregiver: "Emma",
        occurredAt: "2026-06-06T18:30:00-07:00",
        durationMinutes: 10,
        dogInteractions: 1,
        note: "Barked once near gate, recovered with treats.",
        details: {
          skill: "Calm greeting",
          trainingOutcome: "struggle",
          trigger: "Fast dog at gate",
          householdVisible: true,
        },
      },
      {
        id: "private-training",
        type: "training",
        title: "Private note",
        caregiver: "Emma",
        occurredAt: "2026-06-08T10:00:00-07:00",
        durationMinutes: 99,
        details: { skill: "Private", trainingOutcome: "win", householdVisible: false },
      },
      {
        id: "stale-training",
        type: "training",
        title: "Old training",
        caregiver: "Apollo",
        occurredAt: "2026-04-20T10:00:00-07:00",
        durationMinutes: 20,
        details: { skill: "Old skill", trainingOutcome: "win", householdVisible: true },
      },
      {
        id: "play",
        type: "play",
        title: "Fetch",
        caregiver: "Apollo",
        occurredAt: "2026-06-08T11:00:00-07:00",
        durationMinutes: 15,
      },
    ],
  });

  assert.equal(progress.totalSessions, 3);
  assert.equal(progress.totalMinutes, 30);
  assert.equal(progress.skillCount, 3);
  assert.equal(progress.winCount, 1);
  assert.equal(progress.practiceCount, 1);
  assert.equal(progress.struggleCount, 1);
  assert.equal(progress.dogInteractions, 1);
  assert.deepEqual(progress.caregivers, ["Emma", "Apollo"]);
  assert.deepEqual(progress.focusSkills, ["Leash manners", "Recall", "Calm greeting"]);
  assert.equal(progress.status, "needs-practice");
  assert.equal(progress.latest?.id, "leash-win");
  assert.match(progress.summary, /3 training sessions in the last 30 days/);
  assert.match(progress.summary, /30 practice minutes/);
  assert.match(progress.nextStep, /Review the struggle notes/);
  assert.match(progress.items[0].nextPractice, /Practice calm passes/);
});

test("uses a steady training message when only wins and practice are logged", () => {
  const progress = deriveTrainingProgress({
    now: NOW,
    entries: [
      {
        id: "place-win",
        type: "training",
        title: "Place cue",
        caregiver: "Emma",
        occurredAt: "2026-06-08T08:00:00-07:00",
        durationMinutes: 6,
        details: { skill: "Place", outcome: "win", householdVisible: true },
      },
      {
        id: "leave-it",
        type: "training",
        title: "Leave it",
        caregiver: "Apollo",
        occurredAt: "2026-06-07T08:00:00-07:00",
        durationMinutes: 7,
        details: { skill: "Leave it", outcome: "practice", householdVisible: true },
      },
    ],
  });

  assert.equal(progress.status, "steady");
  assert.equal(progress.winCount, 1);
  assert.equal(progress.practiceCount, 1);
  assert.equal(progress.struggleCount, 0);
  assert.match(progress.nextStep, /Keep sessions short/);
});

test("prompts training baseline when there are no shared training logs", () => {
  const progress = deriveTrainingProgress({
    now: NOW,
    entries: [
      {
        id: "private",
        type: "training",
        title: "Private session",
        caregiver: "Emma",
        occurredAt: "2026-06-08T08:00:00-07:00",
        durationMinutes: 15,
        details: { skill: "Leash", trainingOutcome: "win", householdVisible: false },
      },
    ],
  });

  assert.equal(progress.totalSessions, 0);
  assert.equal(progress.totalMinutes, 0);
  assert.equal(progress.status, "needs-log");
  assert.equal(progress.summary, "No shared training sessions logged in the last 30 days");
  assert.match(progress.nextStep, /Log the next short training session/);
});
