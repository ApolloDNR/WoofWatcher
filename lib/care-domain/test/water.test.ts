import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveWaterHydration } from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

test("derives daily hydration from visible water logs", () => {
  const hydration = deriveWaterHydration({
    now: new Date("2026-06-06T20:00:00-07:00").getTime(),
    targetRefills: 3,
    entries: [
      {
        id: "old-water",
        type: "water",
        title: "Water",
        caregiver: "Apollo",
        occurredAt: "2026-06-05T18:00:00-07:00",
        details: { waterAmount: "refill", householdVisible: true },
      },
      {
        id: "private-water",
        type: "water",
        title: "Water",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T09:00:00-07:00",
        details: { waterAmount: "refill", householdVisible: false },
      },
      {
        id: "sip",
        type: "water",
        title: "A sip",
        caregiver: "Emma",
        occurredAt: "2026-06-06T10:00:00-07:00",
        details: { amount: "sip", householdVisible: true },
      },
      {
        id: "refill",
        type: "water",
        title: "Fresh water refill",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T19:00:00-07:00",
        note: "Was thirsty after the park.",
        details: { waterAmount: "refill", householdVisible: true },
      },
    ],
  });

  assert.equal(hydration.total, 2);
  assert.equal(hydration.refillEquivalent, 1.25);
  assert.equal(hydration.percent, 42);
  assert.equal(hydration.status, "watch");
  assert.equal(hydration.summary, "2 water logs today - 1.25 bowl refills tracked");
  assert.equal(hydration.last?.id, "refill");
  assert.deepEqual(hydration.caregivers, ["Apollo", "Emma"]);
  assert.match(hydration.nextStep, /Keep logging/i);
});

test("uses a steady hydration message when enough fresh water is logged", () => {
  const hydration = deriveWaterHydration({
    now: new Date("2026-06-06T20:00:00-07:00").getTime(),
    targetRefills: 2,
    entries: [
      {
        id: "morning",
        type: "water",
        title: "Water refill",
        caregiver: "Emma",
        occurredAt: "2026-06-06T08:00:00-07:00",
        details: { waterAmount: "refill", householdVisible: true },
      },
      {
        id: "evening",
        type: "water",
        title: "Full bowl",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T18:00:00-07:00",
        details: { amount: "bowl", householdVisible: true },
      },
    ],
  });

  assert.equal(hydration.status, "logged");
  assert.equal(hydration.percent, 100);
  assert.match(hydration.nextStep, /Fresh water/i);
});
