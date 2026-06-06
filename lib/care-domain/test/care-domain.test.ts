import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveCareDayStatus,
  getCareEventDefinition,
  normalizeCareEventType,
} from "../src/index.ts";

const NOW = new Date("2026-06-06T15:00:00.000Z").getTime();

test("normalizes medication aliases to the canonical event type", () => {
  assert.equal(normalizeCareEventType("meds"), "medication");
  assert.equal(normalizeCareEventType("medicine"), "medication");
});

test("normalizes symptom entries with vomit detail to vomit", () => {
  assert.equal(normalizeCareEventType("symptom", { what: "vomit" }), "vomit");
});

test("returns metadata for canonical event definitions", () => {
  const walk = getCareEventDefinition("walk");

  assert.equal(walk.type, "walk");
  assert.equal(walk.label, "Walk");
  assert.equal(walk.icon, "paw");
});

test("derives day status from normalized care entries", () => {
  const status = deriveCareDayStatus(
    [
      {
        type: "meal",
        occurredAt: "2026-06-06T07:00:00.000Z",
      },
      {
        type: "walk",
        occurredAt: "2026-06-06T08:00:00.000Z",
        durationMinutes: 30,
      },
      {
        type: "pee",
        occurredAt: "2026-06-06T09:00:00.000Z",
      },
      {
        type: "meds",
        occurredAt: "2026-06-06T10:00:00.000Z",
      },
      {
        type: "symptom",
        occurredAt: "2026-06-06T11:00:00.000Z",
        severity: "watch",
        details: { what: "vomit" },
      },
      {
        type: "mood",
        occurredAt: "2026-06-06T12:00:00.000Z",
        mood: "anxious",
      },
      {
        type: "training",
        occurredAt: "2026-06-05T12:00:00.000Z",
      },
    ],
    [
      { type: "meal" },
      { type: "meal" },
      { type: "walk" },
    ],
    NOW,
  );

  assert.deepEqual(status.counts.meals, { done: 1, target: 2 });
  assert.deepEqual(status.counts.walks, { done: 1, target: 1 });
  assert.deepEqual(status.counts.potty, { done: 1, target: 3 });
  assert.equal(status.counts.training, 0);
  assert.equal(status.counts.medication, 1);
  assert.equal(status.counts.vomit, 1);
  assert.equal(status.counts.anxiety, 1);
  assert.equal(status.counts.walkMinutes, 30);
  assert.equal(status.healthAlert, true);
});
