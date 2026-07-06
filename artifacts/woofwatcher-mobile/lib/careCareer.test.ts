import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  careLevelSpanXp,
  careTitleForLevel,
  careXpForEntry,
  deriveCareCareer,
  deriveCareStreak,
} from "./careCareer.ts";

const NOW = Date.parse("2026-07-06T12:00:00.000Z");

function entry(type: string, occurredAt: string, details?: { [key: string]: unknown }) {
  return { type, occurredAt, details };
}

test("care XP comes only from real care evidence with per-type weights", () => {
  assert.equal(careXpForEntry(entry("meal", "2026-07-06T08:00:00.000Z")), 15);
  assert.equal(careXpForEntry(entry("walk", "2026-07-06T08:00:00.000Z")), 20);
  assert.equal(careXpForEntry(entry("medication", "2026-07-06T08:00:00.000Z")), 20);
  assert.equal(careXpForEntry(entry("treat", "2026-07-06T08:00:00.000Z")), 5);
  // Unknown types still count as small evidence, never zero and never huge.
  assert.equal(careXpForEntry(entry("mystery", "2026-07-06T08:00:00.000Z")), 4);
});

test("aliased event types normalize before XP weighting", () => {
  // "bite" style aliases normalize into the incident taxonomy.
  const aliased = careXpForEntry(entry("bite", "2026-07-06T08:00:00.000Z"));
  assert.equal(aliased, 10);
});

test("level spans grow linearly so later levels ask for more real care", () => {
  assert.equal(careLevelSpanXp(1), 100);
  assert.equal(careLevelSpanXp(2), 150);
  assert.equal(careLevelSpanXp(5), 300);
});

test("titles ladder from New Paw to Legendary Companion", () => {
  assert.equal(careTitleForLevel(1), "New Paw");
  assert.equal(careTitleForLevel(2), "Rookie Companion");
  assert.equal(careTitleForLevel(4), "Steady Sidekick");
  assert.equal(careTitleForLevel(8), "Explorer Pup");
  assert.equal(careTitleForLevel(12), "Adventure Ace");
  assert.equal(careTitleForLevel(25), "Legendary Companion");
});

test("empty history starts at level 1 with zero progress", () => {
  const model = deriveCareCareer([], NOW);
  assert.equal(model.level, 1);
  assert.equal(model.totalXp, 0);
  assert.equal(model.levelXp, 0);
  assert.equal(model.levelProgress, 0);
  assert.equal(model.xpToNextLevel, 100);
  assert.equal(model.title, "New Paw");
  assert.equal(model.levelLabel, "Lv 1 New Paw");
});

test("real logs accumulate XP, level up, and track today separately", () => {
  const entries = [
    entry("meal", "2026-07-05T08:00:00.000Z"), // 15, yesterday
    entry("walk", "2026-07-05T09:00:00.000Z"), // 20, yesterday
    entry("meal", "2026-07-06T08:00:00.000Z"), // 15, today
    entry("walk", "2026-07-06T09:00:00.000Z"), // 20, today
    entry("training", "2026-07-06T10:00:00.000Z"), // 18, today
    entry("water", "2026-07-06T10:30:00.000Z"), // 6, today
    entry("potty", "2026-07-06T11:00:00.000Z"), // 8, today
  ];
  const model = deriveCareCareer(entries, NOW);
  assert.equal(model.totalXp, 102);
  assert.equal(model.todayXp, 67);
  // 102 total: level 1 span is 100, so level 2 with 2 XP inside the level.
  assert.equal(model.level, 2);
  assert.equal(model.levelXp, 2);
  assert.equal(model.levelSpanXp, 150);
  assert.equal(model.xpToNextLevel, 148);
  assert.equal(model.title, "Rookie Companion");
});

test("future-dated and unparseable logs never mint XP", () => {
  const entries = [
    entry("meal", "2026-07-07T08:00:00.000Z"), // future
    entry("walk", "not-a-date"),
    entry("meal", "2026-07-06T08:00:00.000Z"), // valid, 15
  ];
  const model = deriveCareCareer(entries, NOW);
  assert.equal(model.totalXp, 15);
  assert.equal(model.todayXp, 15);
});

test("Home wires the care career level strip, XP toasts, and level-up celebration", () => {
  const home = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "app",
      "(tabs)",
      "index.tsx",
    ),
    "utf8",
  );
  assert.match(home, /deriveCareCareer\(state\.entries, now\)/);
  assert.match(home, /careXpForEntry\(entry\)/);
  assert.match(home, /care XP/);
  assert.match(home, /Level up!/);
  assert.match(home, /spriteAction: "celebrate-hop"/);
  assert.match(home, /Care level \$\{careCareer\.level\}/);
  assert.match(home, /every point from real care logs/);
});

test("care streak counts consecutive logged days from real evidence", () => {
  assert.equal(deriveCareStreak([], NOW), 0);
  // Today only.
  assert.equal(deriveCareStreak([entry("meal", "2026-07-06T08:00:00.000Z")], NOW), 1);
  // Today plus two prior days.
  assert.equal(
    deriveCareStreak(
      [
        entry("meal", "2026-07-06T08:00:00.000Z"),
        entry("walk", "2026-07-05T09:00:00.000Z"),
        entry("potty", "2026-07-04T09:00:00.000Z"),
      ],
      NOW,
    ),
    3,
  );
  // A quiet morning does not break yesterday's streak.
  assert.equal(
    deriveCareStreak(
      [
        entry("walk", "2026-07-05T09:00:00.000Z"),
        entry("meal", "2026-07-04T08:00:00.000Z"),
      ],
      NOW,
    ),
    2,
  );
  // A full missed day does break it.
  assert.equal(
    deriveCareStreak([entry("walk", "2026-07-03T09:00:00.000Z")], NOW),
    0,
  );
});

test("level progress stays clamped to the 0..1 range", () => {
  const entries = Array.from({ length: 40 }, (_, i) =>
    entry("walk", `2026-07-0${(i % 5) + 1}T0${i % 9}:00:00.000Z`),
  );
  const model = deriveCareCareer(entries, NOW);
  assert.ok(model.levelProgress >= 0 && model.levelProgress <= 1);
  assert.ok(model.level >= 2);
  assert.equal(
    model.totalXp,
    entries.length * 20,
  );
});
