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
  assert.equal(command.primaryAction.route, "/log");
  assert.equal(command.primaryAction.icon, "bowl");
  assert.match(command.primaryAction.detail, /Breakfast/i);
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
  assert.equal(command.primaryAction.route, "/records");
  assert.equal(command.primaryAction.urgency, "watch");
  assert.equal(command.health.urgency, "watch");
  assert.match(command.health.detail, /vomit/i);
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
