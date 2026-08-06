import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAccessPassDraft,
  deriveAccessPassPlan,
  deriveMyCareToday,
} from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-11T09:15:00-07:00").getTime();

test("derives active and upcoming Access Passes with explicit permissions and boundaries", () => {
  const plan = deriveAccessPassPlan({
    now: NOW,
    petName: "Phoenix",
    passes: [
      {
        id: "pass_sitter",
        holderName: "Maya",
        role: "Sitter",
        kind: "sitter",
        startsAt: "2026-06-11T08:00:00-07:00",
        endsAt: "2026-06-11T18:00:00-07:00",
        responsibilities: ["Lunch potty", "Dinner"],
      },
      {
        id: "pass_trainer",
        holderName: "Jordan",
        role: "Trainer",
        kind: "trainer",
        startsAt: "2026-06-12T08:00:00-07:00",
        endsAt: "2026-06-12T10:00:00-07:00",
        responsibilities: ["Recall practice"],
      },
    ],
  });

  assert.equal(plan.status, "active");
  assert.equal(plan.activeCount, 1);
  assert.equal(plan.upcomingCount, 1);
  assert.match(plan.summary, /Maya has active sitter access/);
  assert.match(plan.nextStep, /Review Maya/);
  assert.deepEqual(plan.passes[0].permissions.slice(0, 4), [
    "View routine",
    "Log meals",
    "Log walks",
    "Log potty",
  ]);
  assert.deepEqual(plan.passes[0].blockedPermissions.slice(0, 3), [
    "Edit records",
    "Invite people",
    "Change diet",
  ]);
  assert.equal(plan.passes[0].status, "active");
  assert.equal(plan.passes[1].status, "upcoming");
  assert.equal(plan.permissionBoundary, "Access Pass is permission to help; Care Pass is the shareable report.");
});

test("builds a local Access Pass draft without pretending cloud sharing is live", () => {
  const draft = buildAccessPassDraft({
    holderName: "Aunt Lina",
    kind: "emergency",
    petName: "Phoenix",
    nowIso: "2026-06-11T09:15:00.000Z",
  });

  assert.match(draft.id, /^access_aunt_lina_/);
  assert.equal(draft.holderName, "Aunt Lina");
  assert.equal(draft.role, "Emergency helper");
  assert.equal(draft.kind, "emergency");
  assert.equal(draft.status, "draft");
  assert.equal(draft.storageStatus, "local-draft");
  assert.equal(draft.providerShareEnabled, false);
  assert.match(draft.notes, /Local draft/);
});

test("derives My Care Today from assigned routines and visible logs", () => {
  const today = deriveMyCareToday({
    now: NOW,
    personName: "Apollo",
    petName: "Phoenix",
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Emma" },
      { id: "walk", label: "Morning walk", type: "walk", time: "8:30 AM", owner: "Apollo" },
      { id: "dinner", label: "Dinner", type: "meal", time: "6:00 PM", owner: "Apollo" },
      { id: "water", label: "Fresh water", type: "water", time: "9:00 AM", owner: "" },
    ],
    entries: [
      {
        id: "walk_private",
        type: "walk",
        title: "Private walk",
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

  assert.equal(today.personName, "Apollo");
  assert.equal(today.petName, "Phoenix");
  assert.equal(today.assignedCount, 2);
  assert.equal(today.doneCount, 0);
  assert.equal(today.openCount, 2);
  assert.equal(today.overdueCount, 1);
  assert.equal(today.status, "needs-care");
  assert.match(today.title, /Apollo's care today/);
  assert.match(today.nextStep, /Morning walk/);
  assert.deepEqual(
    today.items.map((item) => [item.id, item.label, item.status]),
    [
      ["walk", "Morning walk", "overdue"],
      ["dinner", "Dinner", "upcoming"],
    ],
  );
});

test("keeps an assigned invalid-time routine visible as a correction item", () => {
  const today = deriveMyCareToday({
    now: NOW,
    personName: "Apollo",
    petName: "Phoenix",
    routines: [
      { id: "legacy", label: "Legacy care", type: "walk", time: "9x:30 AM", owner: "Apollo" },
    ],
    entries: [],
  });

  assert.equal(today.assignedCount, 0);
  assert.equal(today.correctionCount, 1);
  assert.equal(today.doneCount, 0);
  assert.equal(today.openCount, 0);
  assert.equal(today.status, "needs-correction");
  assert.equal(today.items[0].status, "needs-correction");
  assert.equal(today.items[0].minutesFromNow, null);
  assert.equal(today.summary, "0 schedulable routines assigned to Apollo. 1 routine needs correction.");
  assert.equal(today.nextStep, "Correct Legacy care's saved time before it can be scheduled for Apollo.");
});
