import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveWalkActivity } from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-06T20:00:00-07:00").getTime();

test("derives daily walk activity from visible walk logs", () => {
  const activity = deriveWalkActivity({
    now: NOW,
    entries: [
      {
        id: "old-walk",
        type: "walk",
        title: "Yesterday walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-05T09:00:00-07:00",
        durationMinutes: 20,
      },
      {
        id: "private-walk",
        type: "walk",
        title: "Private decompression walk",
        caregiver: "Emma",
        occurredAt: "2026-06-06T10:30:00-07:00",
        durationMinutes: 15,
        details: { householdVisible: false },
      },
      {
        id: "morning",
        type: "walk",
        title: "Morning walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T08:40:00-07:00",
        durationMinutes: 20,
        dogInteractions: 1,
        details: {
          routeName: "Neighborhood loop",
          interactionOutcome: "Calm greeting",
        },
      },
      {
        id: "park",
        type: "walk",
        title: "Dog park visit",
        caregiver: "Emma",
        occurredAt: "2026-06-06T17:20:00-07:00",
        details: {
          durationMinutes: 35,
          distanceMiles: 1.4,
          location: "Dog park",
          dogInteractions: 3,
          socialOutcome: "One bark, recovered quickly",
          note: "Left before it got crowded.",
        },
      },
    ],
  });

  assert.equal(activity.total, 2);
  assert.equal(activity.totalMinutes, 55);
  assert.equal(activity.distanceMiles, 1.4);
  assert.equal(activity.dogInteractions, 4);
  assert.equal(activity.status, "active");
  assert.equal(activity.summary, "2 walks today - 55 minutes, 4 dog interactions noted");
  assert.deepEqual(activity.caregivers, ["Emma", "Apollo"]);
  assert.deepEqual(activity.places, ["Dog park", "Neighborhood loop"]);
  assert.equal(activity.last?.id, "park");
  assert.equal(activity.last?.place, "Dog park");
  assert.equal(activity.last?.socialOutcome, "One bark, recovered quickly");
  assert.match(activity.nextStep, /social outcomes/i);
});

test("prompts a walk check when no visible walk is logged", () => {
  const activity = deriveWalkActivity({
    now: NOW,
    entries: [
      {
        id: "private-walk",
        type: "walk",
        title: "Private walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T09:00:00-07:00",
        durationMinutes: 30,
        details: { householdVisible: false },
      },
    ],
  });

  assert.equal(activity.total, 0);
  assert.equal(activity.status, "needs-walk");
  assert.equal(activity.summary, "No walks logged today");
  assert.match(activity.nextStep, /Log the walk/i);
});
