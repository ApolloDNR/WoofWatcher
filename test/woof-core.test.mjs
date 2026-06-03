import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReportText,
  createEntry,
  getAssistantContext,
  getCaregiverHandoff,
  getDefaultState,
  getHealthWatch,
  getMonthlySummary,
  getTodayPlan,
  normalizeState,
  normalizeEntryInput,
  normalizeRoutineInput,
  removeRoutine,
  upsertRoutine
} from "../src/woof-core.js";

test("normalizes a meal entry with caregiver context and Phoenix-specific appetite notes", () => {
  const entry = createEntry({
    type: "meal",
    title: "Breakfast",
    caregiver: "Apollo",
    amount: "1.25 cups",
    mood: "anxious",
    note: "Ate after both caregivers were home",
    occurredAt: "2026-06-03T15:15:00.000Z"
  });

  assert.equal(entry.type, "meal");
  assert.equal(entry.title, "Breakfast");
  assert.equal(entry.caregiver, "Apollo");
  assert.equal(entry.amount, "1.25 cups");
  assert.equal(entry.mood, "anxious");
  assert.equal(entry.requiresFollowUp, false);
  assert.match(entry.id, /^entry_/);
  assert.equal(entry.occurredAt, "2026-06-03T15:15:00.000Z");
});

test("marks vomit and urgent health entries for follow-up without making a diagnosis", () => {
  const vomit = createEntry({
    type: "vomit",
    title: "Yellow bile",
    caregiver: "Apollo",
    note: "Small yellow vomit before breakfast",
    occurredAt: "2026-06-03T13:20:00.000Z"
  });

  const urgent = createEntry({
    type: "health",
    title: "Repeated vomiting",
    caregiver: "Girlfriend",
    severity: "urgent",
    note: "Vomited twice in one morning",
    occurredAt: "2026-06-04T15:00:00.000Z"
  });

  assert.equal(vomit.requiresFollowUp, true);
  assert.equal(urgent.requiresFollowUp, true);
  assert.equal(vomit.vetDisclaimer.includes("veterinarian"), true);
});

test("summarizes the current month across meals, walks, social, training, and vomit logs", () => {
  const state = getDefaultState("2026-06-03T18:00:00.000Z");
  const entries = [
    createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: "2026-06-01T15:00:00.000Z" }),
    createEntry({ type: "meal", title: "Dinner", caregiver: "Girlfriend", occurredAt: "2026-06-01T23:00:00.000Z" }),
    createEntry({ type: "walk", title: "Neighborhood walk", durationMinutes: 24, caregiver: "Apollo", occurredAt: "2026-06-02T17:30:00.000Z" }),
    createEntry({ type: "social", title: "Dog park", dogInteractions: 3, caregiver: "Both", occurredAt: "2026-06-02T20:00:00.000Z" }),
    createEntry({ type: "training", title: "Place work", durationMinutes: 12, caregiver: "Apollo", occurredAt: "2026-06-03T18:00:00.000Z" }),
    createEntry({ type: "vomit", title: "Yellow bile", caregiver: "Apollo", occurredAt: "2026-06-03T13:00:00.000Z" }),
    createEntry({ type: "meal", title: "Last month", caregiver: "Apollo", occurredAt: "2026-05-31T16:00:00.000Z" })
  ];

  const summary = getMonthlySummary({ ...state, entries }, "2026-06-15T12:00:00.000Z");

  assert.equal(summary.meals, 2);
  assert.equal(summary.walks, 1);
  assert.equal(summary.walkMinutes, 24);
  assert.equal(summary.socialSessions, 1);
  assert.equal(summary.dogInteractions, 3);
  assert.equal(summary.trainingSessions, 1);
  assert.equal(summary.trainingMinutes, 12);
  assert.equal(summary.vomitIncidents, 1);
  assert.equal(summary.followUps, 1);
});

test("builds a handoff-aware today plan from routines and latest logs", () => {
  const state = getDefaultState("2026-06-03T12:00:00.000Z");
  const withEntries = {
    ...state,
    entries: [
      createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: "2026-06-03T14:00:00.000Z" }),
      createEntry({ type: "walk", title: "Morning walk", caregiver: "Apollo", occurredAt: "2026-06-03T15:00:00.000Z" })
    ]
  };

  const plan = getTodayPlan(withEntries, "2026-06-03T18:00:00.000Z");

  assert.equal(plan.completedLabels.includes("Breakfast"), true);
  assert.equal(plan.completedLabels.includes("Morning walk"), true);
  assert.equal(plan.nextItems.some((item) => item.label === "Dinner"), true);
  assert.equal(plan.handoffPrompt.includes("who fed, walked, trained, or noticed symptoms"), true);
});

test("builds a caregiver handoff digest with next action and latest care context", () => {
  const state = getDefaultState("2026-06-03T12:00:00.000Z");
  const withEntries = {
    ...state,
    entries: [
      createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: "2026-06-03T14:00:00.000Z" }),
      createEntry({ type: "walk", title: "Morning walk", caregiver: "Apollo", occurredAt: "2026-06-03T15:00:00.000Z" }),
      createEntry({ type: "vomit", title: "Yellow bile", caregiver: "Apollo", severity: "watch", occurredAt: "2026-06-03T16:00:00.000Z" })
    ]
  };

  const handoff = getCaregiverHandoff(withEntries, "2026-06-03T18:00:00.000Z");

  assert.equal(handoff.nextRoutine.label, "Midday check");
  assert.equal(handoff.lastMeal.title, "Breakfast");
  assert.equal(handoff.lastWalk.title, "Morning walk");
  assert.equal(handoff.followUps.length, 1);
  assert.equal(handoff.caregiverLoad.find((item) => item.name === "Apollo").todayLogs, 3);
  assert.equal(handoff.caregiverLoad.find((item) => item.name === "Girlfriend").todayLogs, 0);
  assert.match(handoff.message, /Next Phoenix care: Midday check/);
  assert.match(handoff.message, /Last meal: Breakfast by Apollo/);
  assert.match(handoff.message, /Follow-up: Yellow bile/);
});

test("builds an empty-day caregiver handoff without inventing completed care", () => {
  const state = { ...getDefaultState("2026-06-03T12:00:00.000Z"), entries: [] };

  const handoff = getCaregiverHandoff(state, "2026-06-03T13:00:00.000Z");

  assert.equal(handoff.nextRoutine.label, "Breakfast");
  assert.equal(handoff.lastMeal, null);
  assert.equal(handoff.lastWalk, null);
  assert.equal(handoff.followUps.length, 0);
  assert.match(handoff.message, /No meals logged today/);
  assert.match(handoff.message, /No walks logged today/);
});

test("includes caregiver handoff context in the local assistant review", () => {
  const state = {
    ...getDefaultState("2026-06-03T12:00:00.000Z"),
    entries: [
      createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: "2026-06-03T14:00:00.000Z" }),
      createEntry({ type: "walk", title: "Morning walk", caregiver: "Girlfriend", occurredAt: "2026-06-03T15:00:00.000Z" })
    ]
  };

  const context = getAssistantContext(state, "What should I tell the other caregiver?", "2026-06-03T18:00:00.000Z");

  assert.equal(context.handoff.nextRoutine.label, "Midday check");
  assert.match(context.handoff.message, /Last meal: Breakfast by Apollo/);
  assert.match(context.localAnswer, /Handoff:/);
});

test("normalizes an editable routine without trusting malformed schedule input", () => {
  const routine = normalizeRoutineInput({
    id: "",
    label: "",
    type: "unknown",
    time: "",
    owner: "",
    note: "  anxiety check after lunch  "
  });

  assert.match(routine.id, /^routine_note_/);
  assert.equal(routine.label, "Care note");
  assert.equal(routine.type, "note");
  assert.equal(routine.time, "Unscheduled");
  assert.equal(routine.owner, "Either caregiver");
  assert.equal(routine.note, "anxiety check after lunch");
});

test("adds, updates, orders, and removes caregiver routines for the daily plan", () => {
  const state = getDefaultState("2026-06-03T12:00:00.000Z");
  const withUpdatedDinner = upsertRoutine(state.routines, {
    id: "routine_dinner",
    label: "Dinner",
    type: "meal",
    time: "5:45 PM",
    owner: "Girlfriend",
    note: "Early dinner if Phoenix is anxious."
  });
  const withMedication = upsertRoutine(withUpdatedDinner, {
    label: "Medication",
    type: "medication",
    time: "9:00 PM",
    owner: "Apollo",
    note: "Only if prescribed."
  });
  const withoutMidday = removeRoutine(withMedication, "routine_midday_check");

  const dinner = withoutMidday.find((routine) => routine.id === "routine_dinner");
  const medication = withoutMidday.find((routine) => routine.label === "Medication");
  const plan = getTodayPlan({ ...state, routines: withoutMidday, entries: [] }, "2026-06-03T13:00:00.000Z");

  assert.equal(withUpdatedDinner.length, state.routines.length);
  assert.equal(dinner.owner, "Girlfriend");
  assert.equal(dinner.time, "5:45 PM");
  assert.match(medication.id, /^routine_medication_/);
  assert.equal(withoutMidday.some((routine) => routine.id === "routine_midday_check"), false);
  assert.deepEqual(
    withoutMidday.map((routine) => routine.label),
    ["Breakfast", "Morning walk", "Dinner", "Evening walk", "Medication", "Bedtime snack"]
  );
  assert.equal(plan.nextItems.some((routine) => routine.label === "Midday check"), false);
});

test("health watch elevates repeated vomit incidents and missing appetite pattern", () => {
  const state = getDefaultState("2026-06-03T12:00:00.000Z");
  const entries = [
    createEntry({ type: "vomit", title: "Yellow bile", caregiver: "Apollo", occurredAt: "2026-06-02T13:00:00.000Z" }),
    createEntry({ type: "vomit", title: "Yellow bile", caregiver: "Apollo", occurredAt: "2026-06-03T13:00:00.000Z" }),
    createEntry({ type: "meal", title: "Dinner", caregiver: "Girlfriend", mood: "refused", occurredAt: "2026-06-03T23:00:00.000Z" })
  ];

  const watch = getHealthWatch({ ...state, entries }, "2026-06-03T23:30:00.000Z");

  assert.equal(watch.status, "review");
  assert.equal(watch.signals.some((signal) => signal.includes("2 vomit incidents")), true);
  assert.equal(watch.redFlags.some((flag) => flag.includes("repeated vomiting")), true);
});

test("report text is export-ready and keeps veterinary boundaries visible", () => {
  const state = {
    ...getDefaultState("2026-06-03T12:00:00.000Z"),
    entries: [
      createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: "2026-06-03T14:00:00.000Z" }),
      createEntry({ type: "vomit", title: "Yellow bile", caregiver: "Apollo", note: "Before breakfast", occurredAt: "2026-06-03T13:00:00.000Z" })
    ]
  };

  const report = buildReportText(state, "2026-06-15T12:00:00.000Z");

  assert.match(report, /WoofWatcher Monthly Report/);
  assert.match(report, /Phoenix/);
  assert.match(report, /Vomit incidents: 1/);
  assert.match(report, /not a veterinary diagnosis/);
});

test("normalizes unsafe or missing entry input into a safe log draft", () => {
  const draft = normalizeEntryInput({
    type: "unknown",
    title: "   ",
    caregiver: "",
    durationMinutes: "-20",
    dogInteractions: "bad",
    occurredAt: "not-a-date"
  });

  assert.equal(draft.type, "note");
  assert.equal(draft.title, "Care note");
  assert.equal(draft.caregiver, "Unassigned");
  assert.equal(draft.durationMinutes, 0);
  assert.equal(draft.dogInteractions, 0);
  assert.match(draft.occurredAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("normalizes imported backup state without trusting malformed records", () => {
  const imported = normalizeState(
    {
      profile: {
        name: "Phoenix",
        weight: { current: 58 }
      },
      caregivers: [{ name: "Apollo" }, { name: "" }],
      routines: [{ label: "Bedtime snack", type: "treat" }],
      records: [{ title: "Rabies vaccine" }],
      entries: [
        {
          id: "imported_entry",
          type: "vomit",
          title: "Yellow bile",
          caregiver: "Apollo",
          occurredAt: "bad date"
        },
        {
          type: "unknown",
          title: "",
          caregiver: ""
        }
      ]
    },
    "2026-06-03T18:00:00.000Z"
  );

  assert.equal(imported.profile.name, "Phoenix");
  assert.equal(imported.profile.weight.current, 58);
  assert.equal(imported.caregivers[1].name, "Unassigned");
  assert.equal(imported.routines[0].time, "Unscheduled");
  assert.equal(imported.records[0].type, "instruction");
  assert.equal(imported.entries[0].id, "imported_entry");
  assert.equal(imported.entries[0].requiresFollowUp, true);
  assert.equal(imported.entries[1].type, "note");
  assert.equal(imported.entries[1].title, "Care note");
});
