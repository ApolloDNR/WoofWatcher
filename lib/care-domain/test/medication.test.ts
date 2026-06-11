import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveMedicationAdherence } from "../src/index.ts";

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
