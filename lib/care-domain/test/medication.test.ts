import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveMedicationAdherence, deriveMedicationFollowUps, deriveMedicationHistory } from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-06T14:00:00-07:00").getTime();

test("derives medication adherence from routines and visible logs", () => {
  const adherence = deriveMedicationAdherence({
    now: NOW,
    routines: [
      { id: "am-meds", label: "Apoquel", type: "medication", time: "8:00 AM", owner: "Apollo", note: "1 tablet with breakfast" },
      { id: "midday-meds", label: "Joint supplement", type: "meds", time: "2:00 PM", owner: "Emma", note: "1 chew" },
      { id: "pm-meds", label: "Probiotic", type: "medicine", time: "9:00 PM", owner: "Apollo", note: "1 capsule" },
    ],
    entries: [
      {
        id: "am-log",
        type: "medication",
        title: "Apoquel",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T08:05:00-07:00",
        details: { routineId: "am-meds", dose: "1 tablet", householdVisible: true },
      },
    ],
  });

  assert.equal(adherence.total, 3);
  assert.equal(adherence.takenCount, 1);
  assert.equal(adherence.dueCount, 1);
  assert.equal(adherence.upcomingCount, 1);
  assert.equal(adherence.missedCount, 0);
  assert.equal(adherence.adherencePercent, 33);
  assert.equal(adherence.next?.id, "midday-meds");
  assert.equal(adherence.items.find((item) => item.id === "am-meds")?.status, "taken");
  assert.equal(adherence.items.find((item) => item.id === "midday-meds")?.status, "due");
  assert.equal(adherence.items.find((item) => item.id === "pm-meds")?.status, "upcoming");
  assert.equal(adherence.items.find((item) => item.id === "am-meds")?.takenBy, "Apollo");
  assert.equal(adherence.items.find((item) => item.id === "am-meds")?.dose, "1 tablet");
});

test("marks overdue medication as missed and ignores private logs", () => {
  const adherence = deriveMedicationAdherence({
    now: new Date("2026-06-06T11:00:00-07:00").getTime(),
    routines: [
      { id: "am-meds", label: "Apoquel", type: "medication", time: "8:00 AM", owner: "Apollo", note: "1 tablet" },
    ],
    entries: [
      {
        id: "private-log",
        type: "medication",
        title: "Apoquel",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T08:05:00-07:00",
        details: { routineId: "am-meds", householdVisible: false },
      },
    ],
  });

  assert.equal(adherence.total, 1);
  assert.equal(adherence.missedCount, 1);
  assert.equal(adherence.takenCount, 0);
  assert.equal(adherence.adherencePercent, 0);
  assert.equal(adherence.next?.status, "missed");
  assert.equal(adherence.summary, "0/1 medication doses logged today");
});

test("does not count skipped medication logs as taken", () => {
  const adherence = deriveMedicationAdherence({
    now: new Date("2026-06-06T11:00:00-07:00").getTime(),
    routines: [
      { id: "am-meds", label: "Apoquel", type: "medication", time: "8:00 AM", owner: "Apollo", note: "1 tablet" },
    ],
    entries: [
      {
        id: "skipped-log",
        type: "medication",
        title: "Apoquel skipped",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T08:05:00-07:00",
        details: { routineId: "am-meds", dose: "1 tablet", medicationOutcome: "skipped", householdVisible: true },
      },
    ],
  });

  assert.equal(adherence.total, 1);
  assert.equal(adherence.takenCount, 0);
  assert.equal(adherence.missedCount, 1);
  assert.equal(adherence.items[0].entryId, "skipped-log");
  assert.equal(adherence.items[0].status, "missed");
  assert.equal(adherence.items[0].dose, "1 tablet");
});

test("derives medication follow-ups for missed doses and refill records", () => {
  const followUps = deriveMedicationFollowUps({
    now: new Date("2026-06-06T11:00:00-07:00").getTime(),
    routines: [
      { id: "am-meds", label: "Apoquel", type: "medication", time: "8:00 AM", owner: "Apollo", note: "1 tablet" },
      { id: "pm-meds", label: "Probiotic", type: "medication", time: "11:00 AM", owner: "Emma", note: "1 capsule" },
    ],
    entries: [],
    records: [
      { id: "apoquel-refill", type: "medication", title: "Apoquel refill", due: "Jun 10, 2026", note: "14 tablets left" },
    ],
  });

  assert.deepEqual(
    followUps.map((item) => item.kind),
    ["missed", "due", "refill"],
  );
  assert.equal(followUps[0].label, "Apoquel missed");
  assert.equal(followUps[0].urgency, "alert");
  assert.match(followUps[0].notificationRule, /missed dose/i);
  assert.equal(followUps[1].label, "Probiotic due now");
  assert.equal(followUps[1].urgency, "watch");
  assert.equal(followUps[2].label, "Apoquel refill due soon");
  assert.equal(followUps[2].recordId, "apoquel-refill");
  assert.equal(followUps[2].daysUntil, 4);
  assert.match(followUps[2].action, /refill/i);
});

test("derives visible medication history with dose, outcome, caregiver, and notes", () => {
  const history = deriveMedicationHistory({
    now: new Date("2026-06-06T20:00:00-07:00").getTime(),
    entries: [
      {
        id: "old-log",
        type: "medication",
        title: "Apoquel",
        caregiver: "Apollo",
        occurredAt: "2026-04-20T08:05:00-07:00",
        details: { routineId: "am-meds", dose: "1 tablet", medicationOutcome: "taken", householdVisible: true },
      },
      {
        id: "private-log",
        type: "medication",
        title: "Apoquel",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T08:05:00-07:00",
        details: { routineId: "am-meds", dose: "1 tablet", medicationOutcome: "taken", householdVisible: false },
      },
      {
        id: "am-log",
        type: "meds",
        title: "Apoquel",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T08:05:00-07:00",
        details: { routineId: "am-meds", dose: "1 tablet", medicationOutcome: "taken", householdVisible: true },
      },
      {
        id: "pm-log",
        type: "medicine",
        title: "Probiotic",
        caregiver: "Emma",
        occurredAt: "2026-06-06T19:55:00-07:00",
        note: "Held after soft stool.",
        details: { routineId: "pm-meds", dose: "1 capsule", medicationOutcome: "skipped", householdVisible: true },
      },
    ],
  });

  assert.equal(history.total, 2);
  assert.equal(history.takenCount, 1);
  assert.equal(history.skippedCount, 1);
  assert.equal(history.summary, "2 visible medication logs in 30 days");
  assert.deepEqual(history.items.map((item) => item.id), ["pm-log", "am-log"]);
  assert.equal(history.items[0].label, "Probiotic");
  assert.equal(history.items[0].outcome, "skipped");
  assert.equal(history.items[0].statusLabel, "Skipped");
  assert.equal(history.items[0].dose, "1 capsule");
  assert.equal(history.items[0].caregiver, "Emma");
  assert.equal(history.items[0].routineId, "pm-meds");
  assert.equal(history.items[0].note, "Held after soft stool.");
});
