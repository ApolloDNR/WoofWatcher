import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveIncidentWatch, normalizeCareEventType } from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-20T12:00:00-07:00").getTime();

test("normalizes altercation and behavior aliases into incident logs", () => {
  assert.equal(normalizeCareEventType("altercation"), "incident");
  assert.equal(normalizeCareEventType("dog fight"), "incident");
  assert.equal(normalizeCareEventType("bite"), "incident");
  assert.equal(normalizeCareEventType("reactive"), "incident");
});

test("derives Incident Watch from recent household-visible incident logs", () => {
  const watch = deriveIncidentWatch({
    now: NOW,
    lookbackDays: 90,
    entries: [
      {
        id: "dog-gate",
        type: "incident",
        title: "Incident - dog conflict",
        caregiver: "Emma",
        occurredAt: "2026-06-20T08:30:00-07:00",
        severity: "watch",
        details: {
          incidentType: "dog-conflict",
          incidentTrigger: "Fast dog at gate",
          incidentExposure: "Leashed dog by fence",
          incidentInjury: "None",
          incidentAction: "Moved across street",
          incidentFollowUp: "Practice calm passes",
          householdVisible: true,
        },
      },
      {
        id: "bite-review",
        type: "altercation",
        title: "Incident - snap or bite",
        caregiver: "Apollo",
        occurredAt: "2026-06-19T19:00:00-07:00",
        note: "Small scratch on paw after rough play.",
        details: {
          incidentType: "snap-or-bite",
          incidentTrigger: "Toy guarding",
          incidentExposure: "Family dog",
          incidentInjury: "Scratch",
          incidentAction: "Separated dogs",
          incidentFollowUp: "Share with trainer",
          householdVisible: true,
        },
      },
      {
        id: "private",
        type: "incident",
        title: "Private incident",
        caregiver: "Emma",
        occurredAt: "2026-06-20T10:00:00-07:00",
        details: { incidentType: "other", householdVisible: false },
      },
      {
        id: "old",
        type: "incident",
        title: "Old incident",
        caregiver: "Emma",
        occurredAt: "2026-01-01T10:00:00-08:00",
        details: { incidentType: "other", householdVisible: true },
      },
    ],
  });

  assert.equal(watch.totalIncidents, 2);
  assert.equal(watch.watchCount, 1);
  assert.equal(watch.alertCount, 1);
  assert.equal(watch.followUpCount, 2);
  assert.equal(watch.dogExposureCount, 2);
  assert.equal(watch.injuryCount, 1);
  assert.equal(watch.status, "review");
  assert.deepEqual(watch.triggers, ["Fast dog at gate", "Toy guarding"]);
  assert.deepEqual(watch.exposures, ["Leashed dog by fence", "Family dog"]);
  assert.equal(watch.latest?.id, "dog-gate");
  assert.equal(watch.trend.direction, "rising");
  assert.equal(watch.trend.windows[0]?.count, 2);
  assert.equal(watch.trend.windows[2]?.count, 2);
  assert.equal(watch.followUpTasks[0]?.id, "household-safety-review");
  assert.ok(watch.followUpTasks.some((task) => task.id === "close-open-follow-up"));
  assert.ok(watch.trainerGoals.some((goal) => goal.id === "calm-dog-passes"));
  assert.ok(watch.trainerGoals.some((goal) => goal.id === "threshold-calm"));
  assert.match(watch.summary, /2 incidents in the last 90 days/);
  assert.match(watch.nextStep, /Review the latest incident/);
});

test("derives improving trend when recent incidents quiet down", () => {
  const watch = deriveIncidentWatch({
    now: NOW,
    lookbackDays: 90,
    entries: [
      {
        id: "older-dog",
        type: "incident",
        title: "Incident - dog conflict",
        caregiver: "Emma",
        occurredAt: "2026-06-09T08:30:00-07:00",
        details: {
          incidentTrigger: "Fence line dog",
          incidentExposure: "Neighbor dog",
          incidentInjury: "None",
          incidentAction: "Crossed street",
          incidentFollowUp: "Practice calm pass",
          householdVisible: true,
        },
      },
    ],
  });

  assert.equal(watch.trend.direction, "improving");
  assert.equal(watch.trend.windows[0]?.count, 0);
  assert.equal(watch.trend.windows[2]?.count, 1);
  assert.match(watch.trend.detail, /lower than the prior window/);
  // Default copy keeps the app-wide Phoenix fallback.
  assert.match(watch.trend.detail, /helped Phoenix recover calmly/);
});

test("incident copy uses the renamed dog's name, never Phoenix", () => {
  const watch = deriveIncidentWatch({
    now: NOW,
    lookbackDays: 90,
    petName: "Biscuit",
    entries: [
      {
        id: "older-dog",
        type: "incident",
        title: "Incident - dog conflict",
        caregiver: "Emma",
        occurredAt: "2026-06-09T08:30:00-07:00",
        details: {
          incidentTrigger: "Fence line dog",
          incidentExposure: "Neighbor dog",
          incidentInjury: "None",
          incidentAction: "Crossed street",
          incidentFollowUp: "Practice calm pass",
          householdVisible: true,
        },
      },
    ],
  });

  assert.match(watch.trend.detail, /helped Biscuit recover calmly/);
  assert.doesNotMatch(watch.trend.detail, /Phoenix/);
  assert.doesNotMatch(watch.nextStep, /Phoenix/);
  for (const goal of watch.trainerGoals) {
    assert.doesNotMatch(goal.detail, /Phoenix/);
  }
});

test("returns a clear baseline when no incidents are visible", () => {
  const watch = deriveIncidentWatch({
    now: NOW,
    entries: [
      {
        id: "private",
        type: "incident",
        title: "Private incident",
        caregiver: "Emma",
        occurredAt: "2026-06-20T10:00:00-07:00",
        details: { householdVisible: false },
      },
    ],
  });

  assert.equal(watch.totalIncidents, 0);
  assert.equal(watch.status, "clear");
  assert.equal(watch.trend.direction, "clear");
  assert.equal(watch.followUpTasks[0]?.id, "keep-context-ready");
  assert.deepEqual(watch.trainerGoals, []);
  assert.match(watch.summary, /No household-visible incidents/);
  assert.match(watch.nextStep, /altercation, bite, escape/);
});
