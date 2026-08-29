import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  careLevelSpanXp,
  careTitleForLevel,
  careXpForEntry,
  deriveCareCareerBadgeEarnDates,
  deriveCareCareer,
  deriveCareerWeek,
  deriveCareStreak,
} from "./careCareer.ts";
import {
  buildWalkSessionFinishPatch,
  buildWalkSessionStartEntry,
} from "./walkSession.ts";

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

test("in-progress walk sessions earn no XP until they finish", () => {
  // Real walk-session shape: started via the shared builder, so details
  // carry walkLifecycle exactly as the app stores it.
  const started = buildWalkSessionStartEntry({
    caregiver: "Apollo",
    now: "2026-07-06T09:00:00.000Z",
  });
  assert.equal(started.details?.walkLifecycle, "in-progress");
  assert.equal(careXpForEntry(started), 0);

  // The same entry finished flips to completed and earns duration-scaled XP
  // (30 real minutes -> 30 XP), matching the adventure quest track's
  // min(duration, 45) rule instead of a flat award.
  const patch = buildWalkSessionFinishPatch(started, {
    caregiver: "Apollo",
    now: "2026-07-06T09:30:00.000Z",
  });
  const finished = { ...started, ...patch };
  assert.equal(finished.details.walkLifecycle, "completed");
  assert.equal(finished.durationMinutes, 30);
  assert.equal(careXpForEntry(finished), 30);

  // Home's career card derives from this model: a walk that only just
  // started adds nothing today; finishing it lands the real minutes.
  const whileWalking = deriveCareCareer([started], NOW);
  assert.equal(whileWalking.totalXp, 0);
  assert.equal(whileWalking.todayXp, 0);
  assert.equal(deriveCareStreak([started], NOW), 0);
  assert.deepEqual(deriveCareerWeek([started], NOW), {
    logsThisWeek: 0,
    activeDays: 0,
  });
  assert.deepEqual(
    [...deriveCareCareerBadgeEarnDates(
      [started],
      [{ title: "New Paw", xpRequired: 0 }],
      NOW,
    )],
    [],
  );
  const afterWalk = deriveCareCareer([finished], NOW);
  assert.equal(afterWalk.totalXp, 30);
  assert.equal(afterWalk.todayXp, 30);
  assert.equal(deriveCareStreak([finished], NOW), 1);
});

test("completed-walk XP is honest: 0-minute farming earns nothing, real walks scale", () => {
  const started = buildWalkSessionStartEntry({
    caregiver: "Apollo",
    now: "2026-07-06T09:00:00.000Z",
  });

  // Instant start/finish (0 minutes walked) is not care evidence: 0 XP,
  // so tapping start+finish repeatedly can never farm the walk award.
  const instant = { ...started, ...buildWalkSessionFinishPatch(started, {
    caregiver: "Apollo",
    now: "2026-07-06T09:00:10.000Z",
  }) };
  assert.equal(instant.durationMinutes, 0);
  assert.equal(careXpForEntry(instant), 0);
  assert.equal(deriveCareCareer([instant], NOW).totalXp, 0);
  assert.equal(deriveCareStreak([instant], NOW), 0);
  assert.deepEqual(deriveCareerWeek([instant], NOW), {
    logsThisWeek: 0,
    activeDays: 0,
  });

  // A genuine 1-minute walk earns the small floor (5 XP).
  const oneMinute = { ...started, ...buildWalkSessionFinishPatch(started, {
    caregiver: "Apollo",
    now: "2026-07-06T09:01:00.000Z",
  }) };
  assert.equal(oneMinute.durationMinutes, 1);
  assert.equal(careXpForEntry(oneMinute), 5);

  // A 30-minute walk earns its real minutes.
  const thirtyMinutes = { ...started, ...buildWalkSessionFinishPatch(started, {
    caregiver: "Apollo",
    now: "2026-07-06T09:30:00.000Z",
  }) };
  assert.equal(careXpForEntry(thirtyMinutes), 30);

  // Long walks cap at 45, same ceiling as the adventure quest track.
  const marathon = { ...started, ...buildWalkSessionFinishPatch(started, {
    caregiver: "Apollo",
    now: "2026-07-06T11:00:00.000Z",
  }) };
  assert.equal(marathon.durationMinutes, 120);
  assert.equal(careXpForEntry(marathon), 45);

  // The Home finish toast computes its "+N care XP" from the finish patch
  // details, so the number a caregiver sees is this same honest value.
  const toastShape = { type: "walk", occurredAt: started.occurredAt, details: instant.details };
  assert.equal(careXpForEntry(toastShape), 0);

  // Plain walk logs without a session lifecycle keep the flat award.
  assert.equal(careXpForEntry(entry("walk", "2026-07-06T08:00:00.000Z")), 20);
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

test("private logs mint no XP or streak and are excluded before sensitive getters", () => {
  let timestampRead = false;
  let typeRead = false;
  const privateEntry = {
    details: { householdVisible: false },
    get occurredAt(): string {
      timestampRead = true;
      throw new Error("private timestamp must not be read");
    },
    get type(): string {
      typeRead = true;
      throw new Error("private care type must not be read");
    },
  };

  assert.equal(careXpForEntry(privateEntry, NOW), 0);
  assert.equal(deriveCareCareer([privateEntry], NOW).totalXp, 0);
  assert.equal(deriveCareStreak([privateEntry], NOW), 0);
  assert.deepEqual(deriveCareerWeek([privateEntry], NOW), {
    logsThisWeek: 0,
    activeDays: 0,
  });
  assert.equal(timestampRead, false);
  assert.equal(typeRead, false);
});

test("badge earn dates exclude private, malformed, and future logs before XP reads", () => {
  let privateTimestampRead = false;
  let rejectedTypeRead = false;
  const earnedAt = deriveCareCareerBadgeEarnDates(
    [
      {
        details: { householdVisible: false },
        get occurredAt(): string {
          privateTimestampRead = true;
          throw new Error("private badge timestamp must not be read");
        },
        get type(): string {
          rejectedTypeRead = true;
          throw new Error("private badge type must not be read");
        },
      },
      {
        occurredAt: "not-a-date",
        get type(): string {
          rejectedTypeRead = true;
          throw new Error("malformed badge type must not be read");
        },
      },
      {
        occurredAt: "2026-07-07T08:00:00.000Z",
        get type(): string {
          rejectedTypeRead = true;
          throw new Error("future badge type must not be read");
        },
      },
      entry("meal", "2026-07-06T08:00:00.000Z"),
    ],
    [
      { title: "New Paw", xpRequired: 0 },
      { title: "First Meal", xpRequired: 15 },
      { title: "Not Yet", xpRequired: 16 },
    ],
    NOW,
  );

  assert.deepEqual([...earnedAt], [
    ["New Paw", "2026-07-06T08:00:00.000Z"],
    ["First Meal", "2026-07-06T08:00:00.000Z"],
  ]);
  assert.equal(privateTimestampRead, false);
  assert.equal(rejectedTypeRead, false);
});

test("Story badge replay uses the canonical career evidence derivation", () => {
  const story = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "components",
      "more",
      "StoryProgressScreen.tsx",
    ),
    "utf8",
  );
  const badgeStart = story.indexOf("const badgeEarnDates = useMemo(");
  const earnedTitlesStart = story.indexOf("const earnedTitles = useMemo(", badgeStart);
  assert.notEqual(badgeStart, -1);
  assert.notEqual(earnedTitlesStart, -1);
  const badgeSource = story.slice(badgeStart, earnedTitlesStart);
  assert.match(
    badgeSource,
    /deriveCareCareerBadgeEarnDates\(storyEntries, badgeLadder, now\)/,
  );
  assert.doesNotMatch(badgeSource, /state\.entries\s*\.filter\(/);
  assert.doesNotMatch(badgeSource, /careXpForEntry\(/);
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
  // Bound the assertions to the two declarations that establish and consume
  // the career evidence. This proves the dataflow rather than accepting an
  // unrelated selector or timestamp check elsewhere in the large Home file.
  const homeEntriesStart = home.indexOf("const homeEntries = useMemo(");
  const todayEntriesStart = home.indexOf(
    "const todayHomeEntries = useMemo(",
    homeEntriesStart,
  );
  const careerStart = home.indexOf("const careCareer = useMemo(");
  const streakStart = home.indexOf("const careStreak = useMemo(", careerStart);

  assert.notEqual(homeEntriesStart, -1, "Home must establish its evidence boundary");
  assert.notEqual(todayEntriesStart, -1, "Home evidence boundary must be bounded");
  assert.notEqual(careerStart, -1, "Home must derive its career model");
  assert.notEqual(streakStart, -1, "Home career derivation must be bounded");

  const homeEntriesSource = home.slice(homeEntriesStart, todayEntriesStart);
  const careerSource = home.slice(careerStart, streakStart);
  assert.match(
    homeEntriesSource,
    /selectObservableHomeEntries\(state\.entries, now\)/,
  );
  assert.match(homeEntriesSource, /\[now, state\.entries\]/);
  assert.doesNotMatch(
    homeEntriesSource,
    /state\.entries\.filter\(/,
    "Home must not bypass its privacy-and-time evidence boundary",
  );
  assert.match(careerSource, /deriveCareCareer\(homeEntries, now\)/);
  assert.match(careerSource, /\[homeEntries, now\]/);
  assert.doesNotMatch(
    careerSource,
    /state\.entries/,
    "Career XP must never bypass the canonical Home evidence boundary",
  );
  assert.equal(
    [...home.matchAll(/\bderiveCareCareer\(/g)].length,
    1,
    "Home must have one canonical care-career derivation",
  );
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

test("career week counts only the trailing seven days of real logs", () => {
  const week = deriveCareerWeek(
    [
      entry("meal", "2026-07-06T08:00:00.000Z"),
      entry("walk", "2026-07-06T09:00:00.000Z"),
      entry("potty", "2026-07-03T09:00:00.000Z"),
      entry("meal", "2026-06-20T09:00:00.000Z"), // outside window
      entry("walk", "2026-07-08T09:00:00.000Z"), // future
    ],
    NOW,
  );
  assert.equal(week.logsThisWeek, 3);
  assert.equal(week.activeDays, 2);
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
