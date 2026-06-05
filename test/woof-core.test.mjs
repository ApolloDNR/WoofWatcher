import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCareRoomTransfer,
  buildReportText,
  createEntry,
  getAssistantContext,
  getBileWatch,
  getCareCalendar,
  getCaregiverHandoff,
  getDefaultState,
  getGoalReview,
  getAvatarState,
  getHealthWatch,
  getHouseholdPulse,
  getMonthlySummary,
  getNotificationCenter,
  getReminderCenter,
  getTrainingProgress,
  getTodayPlan,
  normalizeGoalInput,
  normalizeRecordInput,
  normalizeState,
  normalizeEntryInput,
  normalizeRoutineInput,
  removeCaregiverProfile,
  removeGoal,
  removeRecord,
  removeRoutine,
  upsertCaregiverProfile,
  upsertGoal,
  upsertRecord,
  upsertRoutine
} from "../src/woof-core.js";

function localIso(year, month, day, hour = 0, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

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

test("normalizes diet profile and preserves Phoenix appetite quirks", () => {
  const state = normalizeState(
    {
      dietProfile: {
        primaryFood: "Sensitive stomach kibble",
        normalPortion: "1.5 cups",
        mealSchedule: "Breakfast and dinner with bedtime snack",
        toppers: "Warm water if anxious",
        supplements: "Vet-approved probiotic",
        bedtimeSnack: "Small biscuit before sleep",
        treatsAllowed: "Training treats, dental chew",
        avoid: "Rich table scraps",
        sensitivities: "Sudden food changes",
        appetiteQuirks: "Eats best when the house is calm",
        vetNotes: "Track long food gaps for bile watch"
      }
    },
    "2026-06-05T12:00:00.000Z"
  );

  assert.equal(state.dietProfile.primaryFood, "Sensitive stomach kibble");
  assert.equal(state.dietProfile.normalPortion, "1.5 cups");
  assert.equal(state.dietProfile.bedtimeSnack, "Small biscuit before sleep");
  assert.match(state.dietProfile.appetiteQuirks, /house is calm/);
  assert.match(state.dietProfile.vetNotes, /bile watch/);
});

test("normalizes treat, training win, and alone time logs with optional details", () => {
  const treat = createEntry({
    type: "treat",
    title: "Training treat",
    treatType: "High-value",
    reason: "Recall practice",
    reaction: "Focused"
  });
  const win = createEntry({
    type: "training",
    title: "Loose leash win",
    skill: "Loose leash",
    outcome: "win",
    moodBefore: "excited",
    moodAfter: "proud"
  });
  const alone = createEntry({
    type: "alone",
    title: "Home alone",
    durationMinutes: 82,
    aloneOutcome: "calm",
    endedAt: "2026-06-05T20:10:00.000Z"
  });

  assert.equal(treat.treatType, "High-value");
  assert.equal(treat.reason, "Recall practice");
  assert.equal(treat.reaction, "Focused");
  assert.equal(win.skill, "Loose leash");
  assert.equal(win.outcome, "win");
  assert.equal(win.moodAfter, "proud");
  assert.equal(alone.type, "alone");
  assert.equal(alone.aloneOutcome, "calm");
  assert.equal(alone.endedAt, "2026-06-05T20:10:00.000Z");
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

test("builds a monthly care calendar with day-level vomit, walk, training, and social signals", () => {
  const state = getDefaultState("2026-06-03T12:00:00.000Z");
  const entries = [
    createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: "2026-06-03T14:00:00.000Z" }),
    createEntry({ type: "walk", title: "Morning walk", durationMinutes: 24, caregiver: "Apollo", occurredAt: "2026-06-03T15:00:00.000Z" }),
    createEntry({ type: "vomit", title: "Yellow bile", caregiver: "Apollo", severity: "watch", occurredAt: "2026-06-03T16:00:00.000Z" }),
    createEntry({ type: "park", title: "Dog park", dogInteractions: 3, caregiver: "Both", occurredAt: "2026-06-04T20:00:00.000Z" }),
    createEntry({ type: "training", title: "Place work", durationMinutes: 12, caregiver: "Girlfriend", occurredAt: "2026-06-04T21:00:00.000Z" }),
    createEntry({ type: "weight", title: "Weight check", amount: "57.4 lb", caregiver: "Apollo", occurredAt: "2026-05-31T18:00:00.000Z" })
  ];

  const calendar = getCareCalendar({ ...state, entries }, "2026-06-15T12:00:00.000Z");
  const juneThird = calendar.days.find((day) => day.dateKey === "2026-06-03");
  const juneFourth = calendar.days.find((day) => day.dateKey === "2026-06-04");

  assert.equal(calendar.monthLabel, "June 2026");
  assert.equal(calendar.firstWeekday, 1);
  assert.equal(calendar.days.length, 30);
  assert.equal(calendar.reviewDays, 1);
  assert.equal(calendar.vomitDays, 1);
  assert.equal(calendar.monthTotals.totalEntries, 5);
  assert.equal(juneThird.counts.meals, 1);
  assert.equal(juneThird.counts.walks, 1);
  assert.equal(juneThird.counts.vomit, 1);
  assert.equal(juneThird.status, "review");
  assert.match(juneThird.summary, /1 vomit/);
  assert.equal(juneFourth.counts.parkVisits, 1);
  assert.equal(juneFourth.counts.training, 1);
  assert.equal(juneFourth.counts.dogInteractions, 3);
  assert.equal(juneFourth.status, "active");
  assert.equal(calendar.days.some((day) => day.counts.weight > 0), false);
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

test("builds Household Pulse with daily status and careful language", () => {
  const state = {
    ...getDefaultState("2026-06-05T12:00:00.000Z"),
    entries: [
      createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: "2026-06-05T14:00:00.000Z" }),
      createEntry({ type: "walk", title: "Morning walk", caregiver: "Girlfriend", occurredAt: "2026-06-05T15:00:00.000Z" }),
      createEntry({ type: "vomit", title: "Yellow bile", caregiver: "Apollo", occurredAt: "2026-06-05T16:00:00.000Z" })
    ]
  };

  const pulse = getHouseholdPulse(state, "2026-06-05T18:00:00.000Z");

  assert.equal(pulse.label, "Household Pulse");
  assert.match(pulse.summary, /Phoenix/);
  assert.equal(pulse.timeline.length, 3);
  assert.equal(pulse.nextAction.label, "Midday check");
  assert.match(pulse.healthBoundary, /not veterinary advice/);
});

test("chooses Phoenix avatar state from evidence without diagnosing", () => {
  const state = {
    ...getDefaultState("2026-06-05T12:00:00.000Z"),
    entries: [createEntry({ type: "vomit", title: "Yellow bile", occurredAt: "2026-06-05T16:00:00.000Z" })]
  };

  const avatar = getAvatarState(state, "2026-06-05T18:00:00.000Z");

  assert.equal(avatar.mood, "tummy-watch");
  assert.equal(avatar.urgency, "watch");
  assert.match(avatar.speech, /tummy/);
  assert.match(avatar.evidence.join(" "), /vomit/i);
  assert.doesNotMatch(avatar.speech, /diagnosed|treat/i);
});

test("builds a reminder center from today's routine proof", () => {
  const state = getDefaultState("2026-06-03T12:00:00.000Z");
  const withEntries = {
    ...state,
    entries: [
      createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: localIso(2026, 6, 3, 7) }),
      createEntry({ type: "walk", title: "Morning walk", caregiver: "Apollo", occurredAt: localIso(2026, 6, 3, 8) })
    ]
  };

  const reminders = getReminderCenter(withEntries, localIso(2026, 6, 3, 18, 45));
  const breakfast = reminders.items.find((item) => item.label === "Breakfast");
  const dinner = reminders.items.find((item) => item.label === "Dinner");
  const eveningWalk = reminders.items.find((item) => item.label === "Evening walk");

  assert.equal(reminders.completedCount, 2);
  assert.equal(reminders.dueCount, 1);
  assert.equal(reminders.overdueCount, 1);
  assert.equal(breakfast.status, "completed");
  assert.equal(dinner.status, "due");
  assert.equal(eveningWalk.status, "upcoming");
  assert.equal(reminders.nextReminder.label, "Dinner");
  assert.match(reminders.message, /Dinner at 6:30 PM/);
});

test("flags overdue and unscheduled reminders without inventing completed care", () => {
  const state = {
    ...getDefaultState("2026-06-03T12:00:00.000Z"),
    routines: [
      normalizeRoutineInput({
        id: "routine_morning_walk",
        label: "Morning walk",
        type: "walk",
        time: "8:15 AM",
        owner: "Apollo",
        note: "Decompress walk."
      }),
      normalizeRoutineInput({
        id: "routine_weight_check",
        label: "Weight check",
        type: "weight",
        time: "Unscheduled",
        owner: "Either caregiver",
        note: "When Phoenix is calm."
      })
    ],
    entries: []
  };

  const reminders = getReminderCenter(state, localIso(2026, 6, 3, 16));
  const morningWalk = reminders.items.find((item) => item.label === "Morning walk");
  const weightCheck = reminders.items.find((item) => item.label === "Weight check");

  assert.equal(reminders.completedCount, 0);
  assert.equal(reminders.overdueCount, 1);
  assert.equal(reminders.unscheduledCount, 1);
  assert.equal(morningWalk.status, "overdue");
  assert.equal(morningWalk.minutesUntil, -465);
  assert.equal(weightCheck.status, "unscheduled");
  assert.equal(weightCheck.requiresAction, false);
  assert.equal(reminders.nextReminder.label, "Morning walk");
  assert.match(reminders.message, /1 overdue/);
});

test("builds notification readiness without claiming closed-app push", () => {
  const state = getDefaultState("2026-06-03T12:00:00.000Z");
  const withEntries = {
    ...state,
    entries: [
      createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: localIso(2026, 6, 3, 7) }),
      createEntry({ type: "walk", title: "Morning walk", caregiver: "Apollo", occurredAt: localIso(2026, 6, 3, 8) })
    ]
  };

  const notification = getNotificationCenter(withEntries, localIso(2026, 6, 3, 18, 45), {
    supported: true,
    permission: "default"
  });

  assert.equal(notification.status, "ready_to_enable");
  assert.equal(notification.canRequestPermission, true);
  assert.equal(notification.shouldNotifyNow, false);
  assert.equal(notification.dueReminderCount, 2);
  assert.equal(notification.nextNotification.title, "Phoenix care due");
  assert.match(notification.nextNotification.body, /Dinner at 6:30 PM/);
  assert.match(notification.deliveryBoundary, /while WoofWatcher is open/);
  assert.match(notification.message, /Enable alerts/);
});

test("flags due notifications when permission is granted and blocks unsupported browsers", () => {
  const state = {
    ...getDefaultState("2026-06-03T12:00:00.000Z"),
    routines: [
      normalizeRoutineInput({
        id: "routine_dinner",
        label: "Dinner",
        type: "meal",
        time: "6:30 PM",
        owner: "Either caregiver",
        note: "Keep her stomach settled."
      })
    ],
    entries: []
  };

  const enabled = getNotificationCenter(state, localIso(2026, 6, 3, 18, 45), {
    supported: true,
    permission: "granted"
  });
  const unsupported = getNotificationCenter(state, localIso(2026, 6, 3, 18, 45), {
    supported: false,
    permission: "default"
  });

  assert.equal(enabled.status, "enabled");
  assert.equal(enabled.shouldNotifyNow, true);
  assert.match(enabled.notificationKey, /routine_dinner/);
  assert.equal(enabled.canSendTest, true);
  assert.equal(unsupported.status, "unsupported");
  assert.equal(unsupported.canRequestPermission, false);
  assert.equal(unsupported.shouldNotifyNow, false);
  assert.match(unsupported.message, /does not support/);
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

test("renames a caregiver profile and keeps logs, routine ownership, handoff, and reports aligned", () => {
  const state = {
    ...getDefaultState("2026-06-03T12:00:00.000Z"),
    routines: upsertRoutine(getDefaultState("2026-06-03T12:00:00.000Z").routines, {
      id: "routine_evening_walk",
      label: "Evening walk",
      type: "walk",
      time: "8:15 PM",
      owner: "Girlfriend",
      note: "Short settling walk before bedtime."
    }),
    entries: [
      createEntry({ type: "meal", title: "Dinner", caregiver: "Girlfriend", occurredAt: localIso(2026, 6, 3, 18, 30) }),
      createEntry({ type: "walk", title: "Evening walk", caregiver: "Girlfriend", occurredAt: localIso(2026, 6, 3, 20) })
    ]
  };

  const updated = upsertCaregiverProfile(
    state,
    "Girlfriend",
    { name: "Maya", role: "Evening caregiver" },
    localIso(2026, 6, 3, 21)
  );
  const handoff = getCaregiverHandoff(updated, localIso(2026, 6, 3, 21));
  const report = buildReportText(updated, localIso(2026, 6, 3, 21));

  assert.equal(updated.caregivers.some((caregiver) => caregiver.name === "Girlfriend"), false);
  assert.equal(updated.caregivers.find((caregiver) => caregiver.name === "Maya").role, "Evening caregiver");
  assert.equal(updated.entries.every((entry) => entry.caregiver === "Maya"), true);
  assert.equal(updated.routines.find((routine) => routine.id === "routine_evening_walk").owner, "Maya");
  assert.equal(handoff.caregiverLoad.find((caregiver) => caregiver.name === "Maya").todayLogs, 2);
  assert.match(handoff.message, /Last meal: Dinner by Maya/);
  assert.match(report, /Dinner \| Maya/);
});

test("removes a caregiver profile without deleting historical logs and clears owned routines", () => {
  const state = {
    ...getDefaultState("2026-06-03T12:00:00.000Z"),
    routines: upsertRoutine(getDefaultState("2026-06-03T12:00:00.000Z").routines, {
      id: "routine_dinner",
      label: "Dinner",
      type: "meal",
      time: "6:30 PM",
      owner: "Girlfriend",
      note: "Document amount and whether she needed company to eat."
    }),
    entries: [
      createEntry({ type: "meal", title: "Dinner", caregiver: "Girlfriend", occurredAt: "2026-06-03T23:00:00.000Z" })
    ]
  };

  const updated = removeCaregiverProfile(state, "Girlfriend", "2026-06-04T04:00:00.000Z");
  const report = buildReportText(updated, "2026-06-04T04:00:00.000Z");

  assert.equal(updated.caregivers.some((caregiver) => caregiver.name === "Girlfriend"), false);
  assert.equal(updated.entries[0].caregiver, "Girlfriend");
  assert.equal(updated.routines.find((routine) => routine.id === "routine_dinner").owner, "Either caregiver");
  assert.match(report, /Dinner \| Girlfriend/);
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

test("flags empty-stomach bile risk without diagnosing Phoenix", () => {
  const state = {
    ...getDefaultState("2026-06-03T12:00:00.000Z"),
    entries: [
      createEntry({ type: "meal", title: "Dinner", caregiver: "Girlfriend", occurredAt: "2026-06-04T01:00:00.000Z" }),
      createEntry({ type: "vomit", title: "Yellow bile", caregiver: "Apollo", severity: "watch", note: "Before breakfast.", occurredAt: "2026-06-04T13:30:00.000Z" })
    ]
  };

  const bileWatch = getBileWatch(state, "2026-06-04T14:00:00.000Z");

  assert.equal(bileWatch.status, "review");
  assert.equal(bileWatch.label, "Review");
  assert.equal(bileWatch.hoursSinceLastFood, 13);
  assert.equal(bileWatch.bedtimeSnackLogged, false);
  assert.equal(bileWatch.recentYellowBileCount, 1);
  assert.equal(bileWatch.emptyStomachWindow, true);
  assert.match(bileWatch.signals.join(" "), /13 hours since Phoenix last logged food/);
  assert.match(bileWatch.actions.join(" "), /bedtime snack/i);
  assert.match(bileWatch.vetBoundary, /veterinarian/);
});

test("keeps bile watch steady when bedtime snack coverage exists", () => {
  const state = {
    ...getDefaultState("2026-06-03T12:00:00.000Z"),
    entries: [
      createEntry({ type: "meal", title: "Dinner", caregiver: "Apollo", occurredAt: localIso(2026, 6, 3, 18, 30) }),
      createEntry({ type: "treat", title: "Bedtime snack", caregiver: "Girlfriend", note: "Small snack before sleep.", occurredAt: localIso(2026, 6, 3, 22, 30) })
    ]
  };

  const bileWatch = getBileWatch(state, localIso(2026, 6, 4, 7));

  assert.equal(bileWatch.status, "steady");
  assert.equal(bileWatch.bedtimeSnackLogged, true);
  assert.equal(bileWatch.emptyStomachWindow, false);
  assert.equal(bileWatch.recentYellowBileCount, 0);
  assert.match(bileWatch.signals.join(" "), /Bedtime snack coverage logged/);
});

test("includes bile watch in report and local assistant context", () => {
  const state = {
    ...getDefaultState("2026-06-03T12:00:00.000Z"),
    entries: [
      createEntry({ type: "meal", title: "Dinner", caregiver: "Girlfriend", occurredAt: "2026-06-04T01:00:00.000Z" }),
      createEntry({ type: "vomit", title: "Yellow bile", caregiver: "Apollo", occurredAt: "2026-06-04T13:30:00.000Z" })
    ]
  };

  const context = getAssistantContext(state, "Phoenix threw up yellow again", "2026-06-04T14:00:00.000Z");
  const report = buildReportText(state, "2026-06-04T14:00:00.000Z");

  assert.equal(context.bileWatch.status, "review");
  assert.match(context.localAnswer, /Bile watch:/);
  assert.match(report, /Bile Watch/);
  assert.match(report, /13 hours since Phoenix last logged food/);
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

test("normalizes a Phoenix goal without trusting malformed milestone input", () => {
  const goal = normalizeGoalInput({
    id: "",
    category: "unknown",
    title: "",
    target: "",
    status: "weird",
    due: "",
    note: "  keep meals calm  "
  });

  assert.match(goal.id, /^goal_custom_/);
  assert.equal(goal.category, "custom");
  assert.equal(goal.title, "Care goal");
  assert.equal(goal.target, "Define target");
  assert.equal(goal.status, "active");
  assert.equal(goal.due, "No date set");
  assert.equal(goal.note, "keep meals calm");
});

test("adds, updates, removes, and reviews weight and training goals from logs", () => {
  const state = getDefaultState("2026-06-03T12:00:00.000Z");
  const goals = [
    normalizeGoalInput({
      id: "goal_weight_gain",
      category: "weight",
      title: "Steady weight gain",
      target: "Reach 58 lb",
      due: "2026-07-01",
      note: "Vet-guided."
    }),
    normalizeGoalInput({
      id: "goal_place_work",
      category: "training",
      title: "Place work",
      target: "Three short sessions per week",
      due: "2026-06-30",
      note: "Track calm reps."
    })
  ];
  const updated = upsertGoal(goals, {
    id: "goal_place_work",
    category: "training",
    title: "Place work",
    target: "Four calm sessions per week",
    due: "2026-06-30",
    note: "Track duration and anxiety."
  });
  const withSocial = upsertGoal(updated, {
    category: "social",
    title: "Calm dog greetings",
    target: "Two neutral interactions",
    due: "2026-06-20",
    note: "Avoid overwhelming her."
  });
  const withoutWeight = removeGoal(withSocial, "goal_weight_gain");
  const review = getGoalReview(
    {
      ...state,
      goals: withSocial,
      entries: [
        createEntry({ type: "weight", title: "Weight check", amount: "57.4 lb", caregiver: "Apollo", occurredAt: "2026-06-03T18:00:00.000Z" }),
        createEntry({ type: "training", title: "Place work", durationMinutes: 12, caregiver: "Girlfriend", occurredAt: "2026-06-03T19:00:00.000Z" }),
        createEntry({ type: "social", title: "Sidewalk dog pass", dogInteractions: 1, caregiver: "Apollo", occurredAt: "2026-06-03T20:00:00.000Z" })
      ]
    },
    "2026-06-04T12:00:00.000Z"
  );

  assert.equal(updated.length, 2);
  assert.equal(updated.find((goal) => goal.id === "goal_place_work").target, "Four calm sessions per week");
  assert.equal(withSocial.length, 3);
  assert.match(withSocial.find((goal) => goal.category === "social").id, /^goal_social_/);
  assert.equal(withoutWeight.some((goal) => goal.id === "goal_weight_gain"), false);
  assert.equal(review.totalGoals, 3);
  assert.equal(review.activeGoals, 3);
  assert.equal(review.weight.current, 57.4);
  assert.equal(review.training.sessions, 1);
  assert.equal(review.training.minutes, 12);
  assert.equal(review.social.interactions, 1);
  assert.match(review.highlights[0], /57.4 lb/);
});

test("reviews Phoenix training progress with calm wins, struggle signals, and focus areas", () => {
  const state = getDefaultState("2026-06-03T12:00:00.000Z");
  const entries = [
    createEntry({
      type: "training",
      title: "Place work",
      durationMinutes: 12,
      caregiver: "Girlfriend",
      mood: "calm",
      note: "Held place while food was prepared.",
      occurredAt: "2026-06-03T19:00:00.000Z"
    }),
    createEntry({
      type: "training",
      title: "Door manners",
      durationMinutes: 8,
      caregiver: "Apollo",
      mood: "anxious",
      note: "Barked when the hallway got loud.",
      occurredAt: "2026-06-04T19:00:00.000Z"
    }),
    createEntry({
      type: "park",
      title: "Dog park",
      dogInteractions: 3,
      caregiver: "Both",
      mood: "neutral",
      note: "Short calm greetings.",
      occurredAt: "2026-06-05T20:00:00.000Z"
    }),
    createEntry({
      type: "social",
      title: "Sidewalk dog pass",
      dogInteractions: 1,
      caregiver: "Apollo",
      mood: "tense",
      note: "Pulled toward the dog before redirecting.",
      occurredAt: "2026-06-06T20:00:00.000Z"
    }),
    createEntry({
      type: "training",
      title: "Old place work",
      durationMinutes: 20,
      caregiver: "Apollo",
      mood: "calm",
      note: "Previous month should not count.",
      occurredAt: "2026-05-30T20:00:00.000Z"
    })
  ];

  const progress = getTrainingProgress({ ...state, entries }, "2026-06-15T12:00:00.000Z");

  assert.equal(progress.monthLabel, "June 2026");
  assert.equal(progress.status, "Building");
  assert.equal(progress.training.sessions, 2);
  assert.equal(progress.training.minutes, 20);
  assert.equal(progress.social.sessions, 2);
  assert.equal(progress.social.dogInteractions, 4);
  assert.equal(progress.calmSignals, 2);
  assert.equal(progress.struggleSignals, 2);
  assert.match(progress.wins[0], /Place work/);
  assert.match(progress.focusAreas[0], /Door manners/);
  assert.equal(progress.recentEntries.length, 4);
});

test("normalizes Phoenix records without trusting malformed medical vault input", () => {
  const record = normalizeRecordInput({
    id: "",
    type: "unknown",
    title: "",
    due: "",
    note: "  ask vet about yellow bile pattern  "
  });

  assert.match(record.id, /^record_instruction_/);
  assert.equal(record.type, "instruction");
  assert.equal(record.title, "Care record");
  assert.equal(record.due, "No date set");
  assert.equal(record.note, "ask vet about yellow bile pattern");
});

test("adds, updates, and removes vaccine, vet, and instruction records", () => {
  const state = getDefaultState("2026-06-03T12:00:00.000Z");
  const withRabies = upsertRecord(state.records, {
    type: "vaccine",
    title: "Rabies vaccine",
    due: "2026-07-01",
    note: "Upload certificate after the clinic visit."
  });
  const rabies = withRabies.find((record) => record.title === "Rabies vaccine");
  const updated = upsertRecord(withRabies, {
    id: rabies.id,
    type: "vaccine",
    title: "Rabies vaccine",
    due: "2026-08-01",
    note: "Booster date moved by clinic."
  });
  const withoutRabies = removeRecord(updated, rabies.id);

  assert.equal(withRabies.length, state.records.length + 1);
  assert.match(rabies.id, /^record_vaccine_/);
  assert.equal(updated.find((record) => record.id === rabies.id).due, "2026-08-01");
  assert.equal(updated.find((record) => record.id === rabies.id).note, "Booster date moved by clinic.");
  assert.equal(withoutRabies.some((record) => record.id === rabies.id), false);
});

test("preserves explicitly empty routines and goals across backup restore", () => {
  const imported = normalizeState(
    {
      routines: [],
      goals: [],
      records: [],
      entries: []
    },
    "2026-06-03T18:00:00.000Z"
  );

  assert.deepEqual(imported.routines, []);
  assert.deepEqual(imported.goals, []);
  assert.deepEqual(getGoalReview(imported).highlights.at(-1), "No active goals are set.");
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
  assert.match(report, /Goal Review/);
  assert.match(report, /Training Progress/);
  assert.match(report, /not a veterinary diagnosis/);
});

test("builds an importable care room transfer package with handoff and report context", () => {
  const state = {
    ...getDefaultState("2026-06-03T12:00:00.000Z"),
    entries: [
      createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: "2026-06-03T14:00:00.000Z" }),
      createEntry({ type: "walk", title: "Morning walk", caregiver: "Girlfriend", occurredAt: "2026-06-03T15:00:00.000Z" }),
      createEntry({ type: "vomit", title: "Yellow bile", caregiver: "Apollo", severity: "watch", occurredAt: "2026-06-03T16:00:00.000Z" })
    ]
  };

  const transfer = buildCareRoomTransfer(state, "2026-06-03T18:00:00.000Z");

  assert.equal(transfer.packageType, "woofwatcher.care-room-transfer");
  assert.equal(transfer.version, 1);
  assert.equal(transfer.petName, "Phoenix");
  assert.equal(transfer.state.profile.name, "Phoenix");
  assert.equal(transfer.handoff.nextRoutine.label, "Midday check");
  assert.match(transfer.handoff.message, /Last meal: Breakfast by Apollo/);
  assert.match(transfer.monthlyReport, /WoofWatcher Monthly Report/);
  assert.match(transfer.importNote, /Import this file/);
});

test("normalizes care room transfer imports from nested state and ignores tampered summaries", () => {
  const state = getDefaultState("2026-06-03T12:00:00.000Z");
  const transfer = buildCareRoomTransfer(
    {
      ...state,
      entries: [createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: "2026-06-03T14:00:00.000Z" })]
    },
    "2026-06-03T18:00:00.000Z"
  );

  const imported = normalizeState(
    {
      ...transfer,
      handoff: { message: "tampered" },
      monthlyReport: "tampered",
      state: {
        ...transfer.state,
        entries: [
          ...transfer.state.entries,
          createEntry({ type: "walk", title: "Evening walk", caregiver: "Girlfriend", occurredAt: "2026-06-03T20:00:00.000Z" })
        ]
      }
    },
    "2026-06-03T21:00:00.000Z"
  );

  assert.equal(imported.profile.name, "Phoenix");
  assert.equal(imported.entries.length, 2);
  assert.equal(imported.entries.some((entry) => entry.title === "Evening walk"), true);
  assert.equal(imported.handoff, undefined);
  assert.equal(imported.monthlyReport, undefined);
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
  assert.equal(imported.goals.length >= 1, true);
  assert.equal(imported.entries[0].id, "imported_entry");
  assert.equal(imported.entries[0].requiresFollowUp, true);
  assert.equal(imported.entries[1].type, "note");
  assert.equal(imported.entries[1].title, "Care note");
});
