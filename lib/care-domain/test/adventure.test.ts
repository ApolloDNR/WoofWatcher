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
  assert.equal(adventure.completedProof.length, 2);
  assert.equal(adventure.quests[0].id, "memory-photo");
  assert.match(adventure.quests[0].title, /Save today's memory/);
  assert.equal(adventure.quests.some((quest) => quest.id === "sniffari-walk" && quest.status === "complete"), true);
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
  assert.match(adventure.nextStep, /Start with a calm 10-20 minute walk/);
  assert.equal(adventure.privacyBoundary, "Adventure memories are private to the household unless an owner shares them.");
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
