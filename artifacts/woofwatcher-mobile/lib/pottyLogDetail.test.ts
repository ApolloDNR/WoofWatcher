import assert from "node:assert/strict";
import test from "node:test";

import { deriveHealthWatch } from "../../../lib/care-domain/src/index.ts";

import {
  buildPottyLogDetailPatch,
  POTTY_DETAIL_OUTCOMES,
  POTTY_LOCATION_OPTIONS,
  POTTY_PEE_DETAIL_OPTIONS,
  POTTY_STOOL_CONDITION_OPTIONS,
  type PottyLogDetailEntryLike,
} from "./pottyLogDetail.ts";

const NOW = "2026-06-19T23:58:00.000Z";

function entry(
  overrides: Partial<PottyLogDetailEntryLike> = {},
): PottyLogDetailEntryLike {
  return {
    id: "potty-1",
    type: "potty",
    title: "Potty break",
    caregiver: "Emma",
    occurredAt: "2026-06-19T23:40:00.000Z",
    details: {
      householdVisible: true,
      pottyOutcome: "attempt",
      routineId: "potty-evening",
    },
    ...overrides,
  };
}

test("exposes the launch potty detail option set for the log detail sheet", () => {
  assert.deepEqual(
    POTTY_DETAIL_OUTCOMES.map((option) => option.id),
    ["pee", "poop", "both", "tried-nothing", "accident"],
  );
  assert.deepEqual(
    POTTY_LOCATION_OPTIONS.map((option) => option.id),
    ["outside", "inside"],
  );
  assert.ok(
    POTTY_PEE_DETAIL_OPTIONS.some((option) => option.id === "straining"),
  );
  assert.ok(
    POTTY_STOOL_CONDITION_OPTIONS.some((option) => option.id === "diarrhea"),
  );
});

test("updates a parent potty attempt with pee and stool detail without losing household context", () => {
  const patch = buildPottyLogDetailPatch(entry(), {
    caregiver: "Apollo",
    now: NOW,
    outcome: "both",
    location: "outside",
    peeDetail: "normal",
    stoolCondition: "soft",
    stoolColor: "brown",
    context: "routine",
  });

  assert.equal(patch.title, "Potty break - Pee & poop");
  assert.equal(patch.severity, "watch");
  assert.deepEqual(
    {
      householdVisible: patch.details.householdVisible,
      routineId: patch.details.routineId,
      pottyOutcome: patch.details.pottyOutcome,
      pottyWhere: patch.details.pottyWhere,
      peeDetail: patch.details.peeDetail,
      condition: patch.details.condition,
      stoolColor: patch.details.stoolColor,
      pottyContext: patch.details.pottyContext,
      outcomeBy: patch.details.outcomeBy,
      outcomeAt: patch.details.outcomeAt,
    },
    {
      householdVisible: true,
      routineId: "potty-evening",
      pottyOutcome: "both",
      pottyWhere: "outside",
      peeDetail: "normal",
      condition: "soft",
      stoolColor: "brown",
      pottyContext: "routine",
      outcomeBy: "Apollo",
      outcomeAt: NOW,
    },
  );
  assert.match(
    String(patch.details.auditTrail?.[0]?.summary),
    /Apollo updated potty detail on "Potty break" to Pee & poop/,
  );
  assert.deepEqual(patch.details.auditTrail?.[0]?.changes, [
    "pottyOutcome",
    "pottyWhere",
    "condition",
    "peeDetail",
    "outcomeAt",
  ]);
});

test("clears stale pee and stool fields when a potty log is corrected to tried nothing", () => {
  const patch = buildPottyLogDetailPatch(
    entry({
      title: "Potty break - Poop",
      severity: "watch",
      details: {
        householdVisible: true,
        pottyOutcome: "poop",
        pottyWhere: "outside",
        condition: "diarrhea",
        stoolColor: "yellow",
        peeDetail: "dark",
        pottyContext: "urgent",
      },
    }),
    {
      caregiver: "Emma",
      now: NOW,
      outcome: "tried-nothing",
      location: "outside",
    },
  );

  assert.equal(patch.title, "Potty break - Tried, nothing");
  assert.equal(patch.severity, undefined);
  assert.equal(patch.details.pottyOutcome, "tried-nothing");
  assert.equal(patch.details.pottyWhere, "outside");
  assert.equal(patch.details.condition, undefined);
  assert.equal(patch.details.stoolColor, undefined);
  assert.equal(patch.details.peeDetail, undefined);
  assert.equal(patch.details.pottyContext, undefined);
});

test("marks inside accidents as watch items while keeping the record non-diagnostic", () => {
  const patch = buildPottyLogDetailPatch(entry(), {
    caregiver: "Jordan",
    now: NOW,
    outcome: "accident",
    location: "inside",
    context: "accident",
  });

  assert.equal(patch.title, "Potty break - Accident");
  assert.equal(patch.severity, "watch");
  assert.equal(patch.details.pottyOutcome, "accident");
  assert.equal(patch.details.pottyWhere, "inside");
  assert.equal(patch.details.pottyContext, "accident");
  assert.match(
    String(patch.details.auditTrail?.[0]?.summary),
    /updated potty detail/,
  );
});

test("marks an owner-selected urgent potty context as a Health Watch alert", () => {
  const patch = buildPottyLogDetailPatch(entry(), {
    caregiver: "Jordan",
    now: NOW,
    outcome: "poop",
    location: "outside",
    stoolCondition: "normal",
    stoolColor: "brown",
    context: "urgent",
  });

  assert.equal(patch.severity, "alert");

  const health = deriveHealthWatch({
    petName: "Luna",
    now: Date.parse(NOW),
    entries: [
      {
        id: "potty-1",
        type: "potty",
        title: patch.title,
        caregiver: "Jordan",
        occurredAt: NOW,
        severity: patch.severity,
        details: patch.details,
      },
    ],
  });

  assert.equal(health.status, "alert");
  assert.deepEqual(
    health.redFlags.map((flag) => flag.entryId),
    ["potty-1"],
  );
});
