import assert from "node:assert/strict";
import { test } from "node:test";

import { migrateCareDoc } from "./careDocMigration.ts";
import { deriveHomeRoutinePlan } from "./homeRoutinePlan.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-11T12:00:00-07:00").getTime();

test("Home keeps unsafe routines as correction evidence outside schedulable Next Up metrics", () => {
  const rawTimes: unknown[] = [
    null,
    ["1:00 PM"],
    1300,
    { hour: 13 },
    " 1:00 PM",
    "1:00 PM ",
    "1:00  PM",
  ];
  const migrated = migrateCareDoc({
    routines: [
      { id: "valid", label: "Valid walk", type: "walk", time: "1:00 PM", owner: "Apollo" },
      ...rawTimes.map((time, index) => ({
        id: `invalid-${index}`,
        label: `Unsafe ${index}`,
        type: "walk",
        time,
        owner: "Apollo",
      })),
    ],
  } as unknown as Record<string, unknown>);

  const plan = deriveHomeRoutinePlan({
    routines: migrated.routines!,
    entries: [],
    snoozedUntil: {},
    now: NOW,
  });

  assert.deepEqual(plan.scheduledItems.map((item) => item.id), ["valid"]);
  assert.equal(plan.scheduledCount, 1);
  assert.equal(plan.correctionCount, rawTimes.length);
  assert.equal(plan.correctionItems.every((item) => item.minutesFromNow === null), true);
  assert.equal(plan.correctionSummary, "7 routines need correction in Plans.");
});

test("Home does not replace a correction-only plan with startable suggestions", () => {
  const migrated = migrateCareDoc({
    routines: [{ id: "invalid", label: "Unsafe walk", type: "walk", time: ["1:00 PM"], owner: "Apollo" }],
  } as unknown as Record<string, unknown>);
  const plan = deriveHomeRoutinePlan({
    routines: migrated.routines!,
    entries: [],
    snoozedUntil: {},
    now: NOW,
  });

  assert.equal(plan.hasSavedRoutines, true);
  assert.equal(plan.scheduledItems.length, 0);
  assert.equal(plan.correctionCount, 1);
  assert.equal(plan.correctionSummary, "1 routine needs correction in Plans.");
});
