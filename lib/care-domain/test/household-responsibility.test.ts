import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveHouseholdResponsibility } from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-11T09:15:00-07:00").getTime();

test("summarizes household routine ownership, open care, and today log activity", () => {
  const responsibility = deriveHouseholdResponsibility({
    now: NOW,
    caregivers: [
      { name: "Apollo", role: "Owner" },
      { name: "Emma", role: "Primary caregiver" },
      { name: "Jordan", role: "Walker" },
    ],
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Emma" },
      { id: "walk", label: "Morning walk", type: "walk", time: "8:30 AM", owner: "Apollo" },
      { id: "water", label: "Fresh water", type: "water", time: "9:00 AM", owner: "" },
      { id: "training", label: "Practice recall", type: "training", time: "6:00 PM", owner: "Jordan" },
    ],
    entries: [
      {
        id: "meal_1",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-11T07:38:00-07:00",
        details: { routineId: "breakfast", mealCompletion: "partial", householdVisible: true },
      },
      {
        id: "walk_private",
        type: "walk",
        title: "Private walk note",
        caregiver: "Apollo",
        occurredAt: "2026-06-11T08:35:00-07:00",
        details: { routineId: "walk", householdVisible: false },
      },
      {
        id: "water_1",
        type: "water",
        title: "Fresh water",
        caregiver: "Apollo",
        occurredAt: "2026-06-11T09:05:00-07:00",
        details: { routineId: "water", householdVisible: true },
      },
    ],
  });

  assert.equal(responsibility.status, "needs-care");
  assert.equal(responsibility.totalRoutines, 4);
  assert.equal(responsibility.doneRoutines, 2);
  assert.equal(responsibility.openRoutines, 2);
  assert.equal(responsibility.overdueRoutines, 1);
  assert.equal(responsibility.unassignedRoutines, 1);
  assert.match(responsibility.summary, /2\/4 routines handled/i);
  assert.match(responsibility.nextStep, /Morning walk/i);
  assert.equal(responsibility.nextAction?.routineId, "walk");
  assert.equal(responsibility.nextAction?.owner, "Apollo");
  assert.equal(responsibility.members.find((member) => member.name === "Emma")?.done, 1);
  assert.equal(responsibility.members.find((member) => member.name === "Apollo")?.todayLogs, 1);
  assert.equal(responsibility.members.find((member) => member.name === "Apollo")?.overdue, 1);
});

test("prioritizes unassigned routines before balanced load copy", () => {
  const responsibility = deriveHouseholdResponsibility({
    now: NOW,
    caregivers: [{ name: "Apollo", role: "Owner" }],
    routines: [
      { id: "dinner", label: "Dinner", type: "meal", time: "6:00 PM", owner: "" },
      { id: "sniff", label: "Sniff walk", type: "walk", time: "7:00 PM", owner: "Apollo" },
    ],
    entries: [],
  });

  assert.equal(responsibility.status, "needs-assignment");
  assert.equal(responsibility.nextAction?.kind, "assign-routine");
  assert.equal(responsibility.nextAction?.routineId, "dinner");
  assert.match(responsibility.nextStep, /Assign Dinner/i);
});

test("prompts setup when there is no care team or routine board", () => {
  const responsibility = deriveHouseholdResponsibility({
    now: NOW,
    caregivers: [],
    routines: [],
    entries: [],
  });

  assert.equal(responsibility.status, "needs-setup");
  assert.equal(responsibility.members.length, 0);
  assert.match(responsibility.nextStep, /Add the first caregiver/i);
});
