import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveWalkActivity, deriveWalkRouteTemplates } from "../src/index.ts";

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

test("derives saved walk route templates from visible route logs", () => {
  const templates = deriveWalkRouteTemplates({
    now: NOW,
    entries: [
      {
        id: "private-route",
        type: "walk",
        title: "Private decompression walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T11:00:00-07:00",
        durationMinutes: 20,
        details: {
          routeName: "Private field",
          householdVisible: false,
          socialOutcome: "Private owner note",
        },
      },
      {
        id: "stale-route",
        type: "walk",
        title: "Old trail",
        caregiver: "Emma",
        occurredAt: "2025-12-01T09:00:00-08:00",
        durationMinutes: 55,
        details: { routeName: "Old creek trail" },
      },
      {
        id: "loop-one",
        type: "walk",
        title: "Morning loop",
        caregiver: "Apollo",
        occurredAt: "2026-06-02T08:20:00-07:00",
        durationMinutes: 30,
        dogInteractions: 1,
        details: {
          routeName: "Neighborhood Loop",
          distanceMiles: 1.4,
          interactionOutcome: "Loose leash passing",
        },
      },
      {
        id: "park",
        type: "walk",
        title: "Dog park visit",
        caregiver: "Emma",
        occurredAt: "2026-06-04T17:10:00-07:00",
        durationMinutes: 45,
        details: {
          location: "Dog park",
          distanceMiles: 0.8,
          dogInteractions: 4,
          socialOutcome: "Too excited near the gate",
        },
      },
      {
        id: "loop-two",
        type: "walk",
        title: "Evening loop",
        caregiver: "Emma",
        occurredAt: "2026-06-06T18:00:00-07:00",
        durationMinutes: 25,
        details: {
          routeName: "Neighborhood Loop",
          distanceMiles: 1.2,
          dogInteractions: 0,
          socialOutcome: "No dogs seen",
          note: "Good decompression route.",
        },
      },
    ],
  });

  assert.equal(templates.length, 2);
  assert.equal(templates[0].name, "Neighborhood Loop");
  assert.equal(templates[0].visits, 2);
  assert.equal(templates[0].totalMinutes, 55);
  assert.equal(templates[0].averageMinutes, 28);
  assert.equal(templates[0].distanceMiles, 2.6);
  assert.equal(templates[0].dogInteractions, 1);
  assert.deepEqual(templates[0].caregivers, ["Emma", "Apollo"]);
  assert.deepEqual(templates[0].socialOutcomes, ["No dogs seen", "Loose leash passing"]);
  assert.equal(templates[0].suggestedUse, "Reliable routine route");
  assert.match(templates[0].handoff, /2 visits/);

  assert.equal(templates[1].name, "Dog park");
  assert.equal(templates[1].suggestedUse, "Social practice route");
  assert.deepEqual(templates.map((template) => template.name), ["Neighborhood Loop", "Dog park"]);
});

test("ignores private walk logs when building saved route templates", () => {
  const templates = deriveWalkRouteTemplates({
    now: NOW,
    entries: [
      {
        id: "private-route",
        type: "walk",
        title: "Private route",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T09:00:00-07:00",
        durationMinutes: 30,
        details: { routeName: "Private field", householdVisible: false },
      },
    ],
  });

  assert.deepEqual(templates, []);
});
