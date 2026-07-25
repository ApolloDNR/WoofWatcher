import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAdventureMemoryDraft,
  deriveAdventureMode,
} from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-11T17:15:00-07:00").getTime();

test("derives private adventure quests from real care evidence", () => {
  const adventure = deriveAdventureMode({
    now: NOW,
    petName: "Phoenix",
    entries: [
      {
        id: "walk_1",
        type: "walk",
        title: "Morning walk",
        caregiver: "Emma",
        occurredAt: "2026-06-11T08:00:00-07:00",
        durationMinutes: 32,
        details: { householdVisible: true, routeName: "Wildflower Loop" },
      },
      {
        id: "training_1",
        type: "training",
        title: "Recall practice",
        caregiver: "Apollo",
        occurredAt: "2026-06-11T10:00:00-07:00",
        durationMinutes: 12,
        details: { householdVisible: true, trainingOutcome: "win" },
      },
    ],
    memories: [],
  });

  assert.equal(adventure.petName, "Phoenix");
  assert.equal(adventure.status, "quest-ready");
  assert.equal(adventure.todayXp, 56);
  assert.equal(adventure.level, 2);
  // Vocabulary pin: Adventure's daily track speaks in "quest XP" so its
  // numbers can never be read as the canonical careCareer "care XP"/"Lv"
  // that Pack, More, Story, and Home's Today's Story render.
  assert.match(adventure.summary, /earned 56 quest XP/);
  assert.doesNotMatch(adventure.summary, /care XP/);
  assert.equal(adventure.completedProof.length, 2);
  assert.equal(adventure.quests[0].id, "memory-photo");
  assert.equal(adventure.quests[0].action, "save-memory");
  assert.equal(adventure.quests[0].actionLabel, "Save memory");
  assert.match(adventure.quests[0].title, /Save today's memory/);
  assert.equal(adventure.quests.some((quest) => quest.id === "sniffari-walk" && quest.status === "complete"), true);
  assert.equal(adventure.quests.some((quest) => quest.id === "training-win" && quest.action === "log-training"), true);
  assert.match(adventure.nextStep, /Save a private memory/);
});

test("keeps Adventure Mode private and calm when no outings are logged", () => {
  const adventure = deriveAdventureMode({
    now: NOW,
    petName: "Phoenix",
    entries: [],
    memories: [],
  });

  assert.equal(adventure.status, "needs-outing");
  assert.equal(adventure.todayXp, 0);
  assert.equal(adventure.quests[0].id, "sniffari-walk");
  assert.equal(adventure.quests[0].action, "start-walk");
  assert.equal(adventure.quests[0].actionLabel, "Start walk");
  assert.equal(adventure.quests[1].action, "log-training");
  assert.equal(adventure.quests[2].action, "log-play");
  assert.match(adventure.nextStep, /Start with a calm 10-20 minute walk/);
  assert.equal(adventure.privacyBoundary, "Adventure memories are private to the household unless an owner shares them.");
});

test("credits a completed under-threshold walk as near-miss progress and unlocks the memory quest", () => {
  const adventure = deriveAdventureMode({
    now: NOW,
    petName: "Phoenix",
    entries: [
      {
        id: "walk_short",
        type: "walk",
        title: "Walk - Completed",
        caregiver: "Apollo",
        occurredAt: "2026-06-11T09:00:00-07:00",
        durationMinutes: 9,
        details: { householdVisible: true, walkLifecycle: "completed" },
      },
    ],
    memories: [],
  });

  // XP semantics unchanged: 9 real minutes earn 9 XP, credited at completion.
  assert.equal(adventure.todayXp, 9);
  assert.equal(adventure.completedProof.length, 1);
  assert.equal(adventure.completedProof[0].xp, 9);
  assert.equal(adventure.status, "quest-ready");

  // The 10-minute bar does not move, but the finished walk is acknowledged.
  const walkQuest = adventure.quests.find((quest) => quest.id === "sniffari-walk");
  assert.equal(walkQuest?.status, "available");
  assert.match(walkQuest?.evidence ?? "", /9 of 10 min walked today - so close!/);
  assert.doesNotMatch(walkQuest?.evidence ?? "", /No walk adventure is logged yet/);

  // Any completed real outing (walk, training, or play) unlocks the memory quest.
  const memoryQuest = adventure.quests.find((quest) => quest.id === "memory-photo");
  assert.equal(memoryQuest?.status, "available");
  assert.match(memoryQuest?.evidence ?? "", /ready to save/);
  assert.equal(adventure.quests[0].id, "memory-photo");
  assert.match(adventure.nextStep, /Save a private memory/);
});

test("keeps near-miss walk copy honest for much shorter completed walks", () => {
  const adventure = deriveAdventureMode({
    now: NOW,
    petName: "Phoenix",
    entries: [
      {
        id: "walk_tiny",
        type: "walk",
        title: "Walk - Completed",
        occurredAt: "2026-06-11T09:00:00-07:00",
        durationMinutes: 4,
        details: { householdVisible: true, walkLifecycle: "completed" },
      },
    ],
    memories: [],
  });

  const walkQuest = adventure.quests.find((quest) => quest.id === "sniffari-walk");
  assert.equal(walkQuest?.status, "available");
  assert.match(walkQuest?.evidence ?? "", /4 of 10 min walked today\./);
  assert.doesNotMatch(walkQuest?.evidence ?? "", /so close/);
  const memoryQuest = adventure.quests.find((quest) => quest.id === "memory-photo");
  assert.equal(memoryQuest?.status, "available");
});

test("keeps XP and the memory quest gated on walk completion", () => {
  const adventure = deriveAdventureMode({
    now: NOW,
    petName: "Phoenix",
    entries: [
      {
        id: "walk_open",
        type: "walk",
        title: "Walk - In progress",
        occurredAt: "2026-06-11T16:50:00-07:00",
        durationMinutes: 0,
        details: { householdVisible: true, walkLifecycle: "in-progress" },
      },
    ],
    memories: [],
  });

  // Walk XP lands only at completion; an open session earns nothing yet.
  assert.equal(adventure.todayXp, 0);
  assert.equal(adventure.status, "needs-outing");
  const walkQuest = adventure.quests.find((quest) => quest.id === "sniffari-walk");
  assert.match(walkQuest?.evidence ?? "", /No walk adventure is logged yet/);
  const memoryQuest = adventure.quests.find((quest) => quest.id === "memory-photo");
  assert.equal(memoryQuest?.status, "locked");
  assert.match(memoryQuest?.evidence ?? "", /Complete a care outing first/);
  assert.match(adventure.nextStep, /Start with a calm 10-20 minute walk/);
});

test("does not point at the locked memory quest when XP came without an outing", () => {
  const adventure = deriveAdventureMode({
    now: NOW,
    petName: "Phoenix",
    entries: [
      {
        id: "alone_1",
        type: "alone",
        title: "Alone time",
        occurredAt: "2026-06-11T12:00:00-07:00",
        durationMinutes: 45,
        details: { householdVisible: true },
      },
    ],
    memories: [],
  });

  // Alone time earns real XP but is not a care outing.
  assert.equal(adventure.todayXp, 8);
  assert.equal(adventure.status, "quest-ready");
  const memoryQuest = adventure.quests.find((quest) => quest.id === "memory-photo");
  assert.equal(memoryQuest?.status, "locked");
  assert.match(adventure.nextStep, /Start with a calm 10-20 minute walk/);
});

test("builds a local Adventure memory draft without claiming cloud media storage", () => {
  const memory = buildAdventureMemoryDraft({
    petName: "Phoenix",
    questId: "sniffari-walk",
    title: "Wildflower Loop",
    note: "Phoenix sniffed every flower and came home calm.",
    humans: ["Emma", "Apollo"],
    nowIso: "2026-06-11T18:00:00.000Z",
  });

  assert.match(memory.id, /^memory_wildflower_loop_/);
  assert.equal(memory.petName, "Phoenix");
  assert.equal(memory.questId, "sniffari-walk");
  assert.equal(memory.storageStatus, "local-draft");
  assert.equal(memory.mediaStatus, "no-photo-yet");
  assert.equal(memory.xp, 18);
  assert.deepEqual(memory.humans, ["Emma", "Apollo"]);
});
