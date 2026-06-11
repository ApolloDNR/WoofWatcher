import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveGroomingCare } from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-11T12:00:00-07:00").getTime();

test("derives grooming care from visible recent grooming logs", () => {
  const grooming = deriveGroomingCare({
    now: NOW,
    lookbackDays: 60,
    entries: [
      {
        id: "brush",
        type: "grooming",
        title: "Grooming - Brush",
        caregiver: "Emma",
        occurredAt: "2026-06-11T08:00:00-07:00",
        durationMinutes: 15,
        details: {
          kind: "brush",
          groomingCondition: "Light shedding",
          groomingProducts: "Slicker brush",
          groomingNextDue: "2026-06-18",
          householdVisible: true,
        },
      },
      {
        id: "bath",
        type: "grooming",
        title: "Grooming - Bath",
        caregiver: "Apollo",
        occurredAt: "2026-06-02T10:00:00-07:00",
        durationMinutes: 30,
        details: {
          groomingType: "bath",
          groomingCondition: "Coat clean",
          groomingProducts: "Oatmeal shampoo",
          householdVisible: true,
        },
      },
      {
        id: "nails",
        type: "grooming",
        title: "Grooming - Nails",
        caregiver: "Emma",
        occurredAt: "2026-05-28T15:00:00-07:00",
        durationMinutes: 10,
        details: {
          kind: "nails",
          groomingCondition: "Paws handled well",
          householdVisible: true,
        },
      },
      {
        id: "private",
        type: "grooming",
        title: "Private grooming",
        caregiver: "Apollo",
        occurredAt: "2026-06-10T10:00:00-07:00",
        durationMinutes: 90,
        details: { kind: "bath", householdVisible: false },
      },
      {
        id: "stale",
        type: "grooming",
        title: "Old grooming",
        caregiver: "Apollo",
        occurredAt: "2026-02-10T10:00:00-07:00",
        durationMinutes: 20,
        details: { kind: "teeth", householdVisible: true },
      },
    ],
  });

  assert.equal(grooming.totalSessions, 3);
  assert.equal(grooming.totalMinutes, 55);
  assert.equal(grooming.brushCount, 1);
  assert.equal(grooming.bathCount, 1);
  assert.equal(grooming.nailCount, 1);
  assert.equal(grooming.teethCount, 0);
  assert.equal(grooming.status, "due-soon");
  assert.equal(grooming.latest?.id, "brush");
  assert.equal(grooming.nextDue, "2026-06-18");
  assert.deepEqual(grooming.caregivers, ["Emma", "Apollo"]);
  assert.deepEqual(grooming.products, ["Slicker brush", "Oatmeal shampoo"]);
  assert.match(grooming.summary, /3 grooming logs in the last 60 days/);
  assert.match(grooming.summary, /55 minutes/);
  assert.match(grooming.nextStep, /next grooming due/);
});

test("flags coat watch language without diagnosing skin issues", () => {
  const grooming = deriveGroomingCare({
    now: NOW,
    entries: [
      {
        id: "itch",
        type: "grooming",
        title: "Brush",
        caregiver: "Emma",
        occurredAt: "2026-06-11T08:00:00-07:00",
        details: {
          kind: "brush",
          groomingCondition: "Itchy red spot near collar",
          householdVisible: true,
        },
      },
    ],
  });

  assert.equal(grooming.status, "watch");
  assert.match(grooming.nextStep, /owner-reported coat and skin context/);
  assert.match(grooming.nextStep, /vet or groomer/);
  assert.doesNotMatch(grooming.nextStep, /diagnos/i);
});

test("prompts a grooming baseline when there are no shared grooming logs", () => {
  const grooming = deriveGroomingCare({
    now: NOW,
    entries: [
      {
        id: "private",
        type: "grooming",
        title: "Private bath",
        caregiver: "Emma",
        occurredAt: "2026-06-11T08:00:00-07:00",
        details: { kind: "bath", householdVisible: false },
      },
    ],
  });

  assert.equal(grooming.totalSessions, 0);
  assert.equal(grooming.totalMinutes, 0);
  assert.equal(grooming.status, "needs-log");
  assert.equal(grooming.summary, "No shared grooming logs in the last 45 days");
  assert.match(grooming.nextStep, /Log the next brush, bath, nail trim, or teeth care/);
});
