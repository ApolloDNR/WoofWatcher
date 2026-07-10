import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveTodayCommand, type TodayCommandState } from "./todayCommand.ts";

process.env.TZ = "America/Los_Angeles";

const MORNING = new Date("2026-06-06T09:00:00-07:00").getTime();
const AFTERNOON = new Date("2026-06-06T14:00:00-07:00").getTime();

function state(overrides: Partial<TodayCommandState> = {}): TodayCommandState {
  return {
    profile: { name: "Phoenix" },
    caregivers: [{ name: "Emma", role: "Primary caregiver" }],
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Emma" },
      { id: "walk", label: "Walk", type: "walk", time: "8:30 AM", owner: "Apollo" },
      { id: "training", label: "Training", type: "training", time: "3:00 PM", owner: "Emma" },
    ],
    entries: [],
    ...overrides,
  };
}

test("missed meal in the morning creates a log-meal primary action", () => {
  const command = deriveTodayCommand(state(), MORNING);

  assert.equal(command.primaryAction.kind, "log-meal");
  assert.equal(command.primaryAction.route, "/log?type=meal&detail=1&intent=today-command-meal");
  assert.equal(command.primaryAction.icon, "bowl");
  assert.match(command.primaryAction.detail, /Breakfast/i);
});

test("partial meal log satisfies the meal routine and moves command to the next open care item", () => {
  const command = deriveTodayCommand(
    state({
      entries: [
        {
          id: "meal_partial",
          type: "meal",
          title: "Breakfast - partial",
          caregiver: "Emma",
          occurredAt: "2026-06-06T07:38:00-07:00",
          details: {
            routineId: "breakfast",
            mealCompletion: "partial",
            expectedPortion: "1 cup",
            servedAmount: 1,
            servedUnit: "cup",
            eatenAmount: 0.5,
            eatenUnit: "cup",
            householdVisible: true,
          },
        },
      ],
    }),
    MORNING,
  );

  assert.equal(command.primaryAction.kind, "log-walk");
  assert.equal(command.primaryAction.route, "/log?type=walk&detail=1&intent=today-command-walk");
  assert.match(command.primaryAction.detail, /Walk/i);
});

test("served meal with pending outcome becomes the primary update action", () => {
  const command = deriveTodayCommand(
    state({
      entries: [
        {
          id: "meal_served",
          type: "meal",
          title: "Breakfast",
          caregiver: "Emma",
          occurredAt: "2026-06-06T07:38:00-07:00",
          details: {
            routineId: "breakfast",
            mealCompletion: "served",
            mealLifecycle: "outcome-pending",
            servedAmount: 1,
            servedUnit: "cup",
            householdVisible: true,
          },
        },
      ],
    }),
    MORNING,
  );

  assert.equal(command.primaryAction.kind, "update-meal-outcome");
  assert.equal(command.primaryAction.route, "/log?entry=meal_served");
  assert.equal(command.primaryAction.icon, "bowl");
  assert.match(command.primaryAction.label, /Update breakfast outcome/i);
  assert.match(command.primaryAction.detail, /served/i);
  // Copy stays short so Home's clamped lines never clip it mid-sentence.
  assert.match(command.primaryAction.detail, /Confirm how much Phoenix ate/i);
  assert.match(command.handoff.detail, /Emma served Breakfast/i);
  assert.match(command.handoff.detail, /outcome pending/i);
  assert.doesNotMatch(command.handoff.detail, /logged Breakfast/i);
});

test("vomit watch event creates health watch urgency", () => {
  const command = deriveTodayCommand(
    state({
      entries: [
        {
          id: "vomit_1",
          type: "vomit",
          title: "Yellow bile",
          caregiver: "Apollo",
          occurredAt: "2026-06-06T08:40:00-07:00",
          severity: "watch",
        },
      ],
    }),
    MORNING,
  );

  assert.equal(command.primaryAction.kind, "health");
  assert.equal(command.primaryAction.route, "/health?tab=bile");
  assert.equal(command.primaryAction.urgency, "watch");
  assert.equal(command.health.urgency, "watch");
  assert.match(command.health.detail, /vomit/i);
});

test("non-vomit health alerts route to Health Watch instead of Records", () => {
  const command = deriveTodayCommand(
    state({
      entries: [
        {
          id: "symptom_1",
          type: "symptom",
          title: "Low appetite",
          caregiver: "Apollo",
          occurredAt: "2026-06-06T08:40:00-07:00",
          severity: "watch",
        },
      ],
    }),
    MORNING,
  );

  assert.equal(command.primaryAction.kind, "health");
  assert.equal(command.primaryAction.route, "/health?tab=health");
  assert.equal(command.primaryAction.urgency, "watch");
  assert.match(command.primaryAction.detail, /health signal/i);
});

test("next routine produces a routine action when core care is caught up", () => {
  const command = deriveTodayCommand(
    state({
      entries: [
        { id: "meal_1", type: "meal", title: "Breakfast", caregiver: "Emma", occurredAt: "2026-06-06T07:35:00-07:00" },
        { id: "walk_1", type: "walk", title: "Morning walk", caregiver: "Apollo", occurredAt: "2026-06-06T08:45:00-07:00" },
        { id: "potty_1", type: "potty", title: "Potty", caregiver: "Emma", occurredAt: "2026-06-06T07:20:00-07:00" },
        { id: "potty_2", type: "potty", title: "Potty", caregiver: "Apollo", occurredAt: "2026-06-06T10:20:00-07:00" },
        { id: "potty_3", type: "potty", title: "Potty", caregiver: "Emma", occurredAt: "2026-06-06T12:20:00-07:00" },
      ],
      routines: [
        { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Emma" },
        { id: "walk", label: "Walk", type: "walk", time: "8:30 AM", owner: "Apollo" },
        { id: "training", label: "Training", type: "training", time: "3:00 PM", owner: "Emma" },
      ],
    }),
    AFTERNOON,
  );

  assert.equal(command.primaryAction.kind, "routine");
  assert.equal(command.primaryAction.route, "/calendar");
  assert.equal(command.primaryAction.icon, "star");
  assert.match(command.primaryAction.label, /Training/i);
});

test("overdue assigned routine becomes the primary command when core care is handled", () => {
  const command = deriveTodayCommand(
    state({
      entries: [
        { id: "meal_1", type: "meal", title: "Breakfast", caregiver: "Emma", occurredAt: "2026-06-06T07:35:00-07:00", details: { routineId: "breakfast" } },
        { id: "walk_1", type: "walk", title: "Morning walk", caregiver: "Apollo", occurredAt: "2026-06-06T08:45:00-07:00", details: { routineId: "walk" } },
        { id: "potty_1", type: "potty", title: "Potty", caregiver: "Emma", occurredAt: "2026-06-06T07:20:00-07:00" },
        { id: "potty_2", type: "potty", title: "Potty", caregiver: "Apollo", occurredAt: "2026-06-06T10:20:00-07:00" },
        { id: "potty_3", type: "potty", title: "Potty", caregiver: "Emma", occurredAt: "2026-06-06T12:20:00-07:00" },
      ],
      routines: [
        { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Emma" },
        { id: "walk", label: "Morning walk", type: "walk", time: "8:30 AM", owner: "Apollo" },
        { id: "meds", label: "Medication", type: "medication", time: "9:00 AM", owner: "Apollo" },
        { id: "training", label: "Training", type: "training", time: "3:00 PM", owner: "Emma" },
      ],
    }),
    AFTERNOON,
  );

  assert.equal(command.primaryAction.kind, "routine");
  assert.equal(command.primaryAction.route, "/calendar");
  assert.equal(command.primaryAction.urgency, "watch");
  assert.match(command.primaryAction.label, /Medication/i);
  assert.match(command.primaryAction.detail, /Apollo/i);
});

test("recent failed sync creates a sync action", () => {
  const command = deriveTodayCommand(
    state({
      entries: [
        {
          id: "temp_1",
          type: "meal",
          title: "Breakfast",
          caregiver: "Emma",
          occurredAt: "2026-06-06T07:35:00-07:00",
          syncStatus: "failed",
          syncError: "Saved locally. Refresh to retry sync.",
        },
      ],
    }),
    MORNING,
  );

  assert.equal(command.primaryAction.kind, "sync");
  assert.equal(command.primaryAction.route, "/log");
  assert.equal(command.primaryAction.urgency, "watch");
  assert.equal(command.sync.failed, 1);
});

test("handoff review opens the exact latest care log when the day is caught up", () => {
  const command = deriveTodayCommand(
    state({
      entries: [
        { id: "meal_1", type: "meal", title: "Breakfast", caregiver: "Emma", occurredAt: "2026-06-06T07:35:00-07:00", details: { routineId: "breakfast" } },
        { id: "walk_1", type: "walk", title: "Morning walk", caregiver: "Apollo", occurredAt: "2026-06-06T08:45:00-07:00", details: { routineId: "walk" } },
        { id: "training_1", type: "training", title: "Training", caregiver: "Emma", occurredAt: "2026-06-06T15:10:00-07:00", details: { routineId: "training" } },
        { id: "potty_1", type: "potty", title: "Potty", caregiver: "Emma", occurredAt: "2026-06-06T07:20:00-07:00" },
        { id: "potty_2", type: "potty", title: "Potty", caregiver: "Apollo", occurredAt: "2026-06-06T10:20:00-07:00" },
        { id: "potty_3", type: "potty", title: "Potty", caregiver: "Emma", occurredAt: "2026-06-06T12:20:00-07:00" },
      ],
    }),
    new Date("2026-06-06T16:00:00-07:00").getTime(),
  );

  assert.equal(command.primaryAction.kind, "handoff");
  assert.equal(command.primaryAction.route, "/log?entry=training_1");
  assert.match(command.primaryAction.label, /Review handoff/i);
});
