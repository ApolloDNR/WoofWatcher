import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveAloneTime } from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-11T12:00:00-07:00").getTime();

test("derives alone-time patterns from visible recent logs", () => {
  const aloneTime = deriveAloneTime({
    now: NOW,
    lookbackDays: 30,
    entries: [
      {
        id: "morning-calm",
        type: "alone",
        title: "Alone time - calm",
        caregiver: "Emma",
        occurredAt: "2026-06-11T09:00:00-07:00",
        durationMinutes: 35,
        details: {
          aloneOutcome: "calm",
          trigger: "Morning work call",
          calmingSupport: "Puzzle toy",
          recoveryMinutes: 0,
          householdVisible: true,
        },
      },
      {
        id: "dinner-anxious",
        type: "alone",
        title: "Alone time - anxious",
        caregiver: "Apollo",
        occurredAt: "2026-06-10T19:00:00-07:00",
        durationMinutes: 50,
        details: {
          aloneOutcome: "anxious",
          trigger: "Leaving after dinner",
          calmingSupport: "White noise",
          recoveryMinutes: 18,
          householdVisible: true,
        },
      },
      {
        id: "door-distress",
        type: "alone",
        title: "Alone time - distressed",
        caregiver: "Emma",
        occurredAt: "2026-06-09T16:30:00-07:00",
        durationMinutes: 20,
        severity: "watch",
        details: {
          outcome: "distressed",
          trigger: "Door slam",
          calmingSupport: "Mat settle",
          recoveryMinutes: 12,
          householdVisible: true,
        },
      },
      {
        id: "private",
        type: "alone",
        title: "Private alone log",
        caregiver: "Apollo",
        occurredAt: "2026-06-11T10:00:00-07:00",
        durationMinutes: 90,
        details: { aloneOutcome: "distressed", householdVisible: false },
      },
      {
        id: "stale",
        type: "alone",
        title: "Old alone log",
        caregiver: "Apollo",
        occurredAt: "2026-04-01T10:00:00-07:00",
        durationMinutes: 30,
        details: { aloneOutcome: "anxious", householdVisible: true },
      },
    ],
  });

  assert.equal(aloneTime.totalSessions, 3);
  assert.equal(aloneTime.totalMinutes, 105);
  assert.equal(aloneTime.calmCount, 1);
  assert.equal(aloneTime.anxiousCount, 1);
  assert.equal(aloneTime.distressedCount, 1);
  assert.equal(aloneTime.averageRecoveryMinutes, 10);
  assert.equal(aloneTime.status, "needs-support");
  assert.deepEqual(aloneTime.triggers, ["Morning work call", "Leaving after dinner", "Door slam"]);
  assert.deepEqual(aloneTime.supports, ["Puzzle toy", "White noise", "Mat settle"]);
  assert.deepEqual(aloneTime.caregivers, ["Emma", "Apollo"]);
  assert.equal(aloneTime.latest?.id, "morning-calm");
  assert.match(aloneTime.summary, /3 alone-time logs in the last 30 days/);
  assert.match(aloneTime.nextStep, /Review trigger and recovery notes/);
});

test("uses steady alone-time guidance when logs are calm", () => {
  const aloneTime = deriveAloneTime({
    now: NOW,
    entries: [
      {
        id: "settled",
        type: "alone",
        title: "Alone time - settled",
        caregiver: "Emma",
        occurredAt: "2026-06-11T08:00:00-07:00",
        durationMinutes: 25,
        details: { aloneOutcome: "settled", calmingSupport: "Kong", householdVisible: true },
      },
    ],
  });

  assert.equal(aloneTime.status, "steady");
  assert.equal(aloneTime.totalSessions, 1);
  assert.equal(aloneTime.nextStep, "Keep logging departures, returns, and calming supports so the household can keep the routine predictable.");
});

test("prompts an alone-time baseline when no shared logs exist", () => {
  const aloneTime = deriveAloneTime({
    now: NOW,
    entries: [
      {
        id: "private",
        type: "alone",
        title: "Private alone log",
        caregiver: "Emma",
        occurredAt: "2026-06-11T08:00:00-07:00",
        durationMinutes: 30,
        details: { aloneOutcome: "anxious", householdVisible: false },
      },
    ],
  });

  assert.equal(aloneTime.totalSessions, 0);
  assert.equal(aloneTime.totalMinutes, 0);
  assert.equal(aloneTime.status, "needs-log");
  assert.equal(aloneTime.summary, "No shared alone-time logs in the last 30 days");
  assert.match(aloneTime.nextStep, /Log the next departure/);
});
