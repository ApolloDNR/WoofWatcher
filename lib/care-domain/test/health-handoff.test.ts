import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveCareHandoff,
  deriveHealthWatch,
} from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-06T15:00:00-07:00").getTime();

test("detects a yellow bile vomit pattern without diagnosing", () => {
  const health = deriveHealthWatch({
    now: NOW,
    entries: [
      {
        id: "vomit_today",
        type: "vomit",
        title: "Yellow bile",
        note: "Early morning yellow foam",
        caregiver: "Emma",
        occurredAt: "2026-06-06T13:00:00.000Z",
        severity: "watch",
        details: { kind: "yellow bile" },
      },
      {
        id: "vomit_recent",
        type: "symptom",
        title: "Throw up",
        note: "Yellow liquid before breakfast",
        caregiver: "Apollo",
        occurredAt: "2026-06-03T13:00:00.000Z",
        details: { what: "vomit" },
      },
    ],
    routines: [{ type: "meal" }, { type: "meal" }],
  });

  assert.equal(health.status, "watch");
  assert.equal(health.counts.vomit7, 2);
  assert.equal(health.signals[0].kind, "vomit-pattern");
  assert.match(health.summary, /2 vomit/i);
  assert.match(health.vetBoundary, /not diagnose/i);
});

test("urgent health entries escalate to alert with red flags", () => {
  const health = deriveHealthWatch({
    now: NOW,
    entries: [
      {
        id: "urgent_1",
        type: "vomit",
        title: "Repeated vomiting",
        caregiver: "Emma",
        occurredAt: "2026-06-06T14:30:00.000Z",
        severity: "urgent",
      },
    ],
  });

  assert.equal(health.status, "alert");
  assert.equal(health.redFlags.length, 1);
  assert.equal(health.redFlags[0].label, "Repeated vomiting");
});

test("surfaces appetite and stool watch signals", () => {
  const health = deriveHealthWatch({
    now: NOW,
    entries: [
      {
        id: "meal_1",
        type: "meal",
        title: "Meal light portion",
        caregiver: "Emma",
        occurredAt: "2026-06-06T07:00:00.000Z",
        details: { portion: "light" },
      },
      {
        id: "meal_2",
        type: "meal",
        title: "Meal half portion",
        caregiver: "Apollo",
        occurredAt: "2026-06-05T18:00:00.000Z",
        details: { portion: "half" },
      },
      {
        id: "potty_1",
        type: "potty",
        title: "Potty soft stool",
        caregiver: "Emma",
        occurredAt: "2026-06-06T12:00:00.000Z",
        severity: "watch",
        details: { kind: "poop", condition: "soft" },
      },
    ],
  });

  const kinds = health.signals.map((signal) => signal.kind);
  assert.ok(kinds.includes("appetite-watch"));
  assert.ok(kinds.includes("stool-watch"));
  assert.equal(health.status, "watch");
});

test("builds non-diagnostic health pattern cards with owner next steps", () => {
  const health = deriveHealthWatch({
    now: NOW,
    entries: [
      {
        id: "vomit_1",
        type: "vomit",
        title: "Yellow bile",
        note: "Foam before breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-06T13:00:00.000Z",
        severity: "watch",
      },
      {
        id: "vomit_2",
        type: "symptom",
        title: "Throw up",
        caregiver: "Apollo",
        occurredAt: "2026-06-05T13:00:00.000Z",
        details: { what: "vomit" },
      },
      {
        id: "meal_1",
        type: "meal",
        title: "Breakfast partial",
        caregiver: "Emma",
        occurredAt: "2026-06-06T07:00:00.000Z",
        details: { mealCompletion: "partial" },
      },
      {
        id: "meal_2",
        type: "meal",
        title: "Dinner skipped",
        caregiver: "Apollo",
        occurredAt: "2026-06-05T18:00:00.000Z",
        details: { mealCompletion: "skipped" },
      },
    ],
  });

  assert.equal(health.patterns[0].kind, "vomit-pattern");
  assert.match(health.patterns[0].evidence, /2 vomit/i);
  assert.match(health.patterns[0].nextStep, /Track/i);
  assert.match(health.patterns[0].nextStep, /vet/i);
  assert.doesNotMatch(health.patterns[0].nextStep, /diagnos/i);

  const appetite = health.patterns.find((pattern) => pattern.kind === "appetite-watch");
  assert.ok(appetite);
  assert.match(appetite.nextStep, /meal/i);
});

test("adds a steady health pattern card when no signals are active", () => {
  const health = deriveHealthWatch({
    now: NOW,
    entries: [
      {
        id: "walk_1",
        type: "walk",
        title: "Walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T12:00:00.000Z",
      },
    ],
  });

  assert.equal(health.status, "good");
  assert.equal(health.patterns[0].kind, "steady");
  assert.match(health.patterns[0].nextStep, /Keep logging/i);
});

test("builds a caregiver handoff with done, watch, next, and load", () => {
  const handoff = deriveCareHandoff({
    now: NOW,
    caregivers: [
      { name: "Emma", role: "Primary" },
      { name: "Apollo", role: "Caregiver" },
    ],
    routines: [
      { id: "breakfast", type: "meal", label: "Breakfast", time: "7:00 AM", owner: "Emma" },
      { id: "walk", type: "walk", label: "Walk", time: "8:30 AM", owner: "Apollo" },
      { id: "dinner", type: "meal", label: "Dinner", time: "6:00 PM", owner: "Emma" },
    ],
    entries: [
      {
        id: "meal_1",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-06T14:00:00.000Z",
      },
      {
        id: "walk_1",
        type: "walk",
        title: "Morning walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T14:30:00.000Z",
        durationMinutes: 25,
      },
      {
        id: "vomit_1",
        type: "vomit",
        title: "Yellow bile",
        caregiver: "Emma",
        occurredAt: "2026-06-06T13:00:00.000Z",
        severity: "watch",
      },
    ],
  });

  assert.deepEqual(
    handoff.sections.done.map((item) => item.kind),
    ["meal", "walk"],
  );
  assert.equal(handoff.sections.watch[0].kind, "health");
  assert.equal(handoff.next?.label, "Dinner");
  assert.equal(handoff.caregiverLoad[0].name, "Emma");
  assert.equal(handoff.caregiverLoad[0].todayLogs, 2);
  assert.match(handoff.message, /Emma logged 2/i);
});

test("writes needs-attention sentences with real subject-verb agreement", () => {
  const handoff = deriveCareHandoff({
    now: NOW,
    caregivers: [{ name: "Emma", role: "Primary" }],
    routines: [
      { id: "breakfast", type: "meal", label: "Breakfast", time: "7:00 AM", owner: "Emma" },
      { id: "dinner", type: "meal", label: "Dinner", time: "6:00 PM", owner: "Emma" },
      { id: "walk", type: "walk", label: "Walk", time: "8:30 AM", owner: "Emma" },
    ],
    entries: [
      {
        id: "breakfast-served",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-06T14:00:00.000Z",
        details: {
          mealCompletion: "served",
          mealLifecycle: "outcome-pending",
          householdVisible: true,
        },
      },
    ],
  });

  const details = handoff.sections.needsAttention.map((item) => `${item.label}: ${item.detail}`);
  assert.ok(details.includes(
    "Meal outcome pending: 1 meal outcome needs confirmation - ate all, ate some, refused, or still grazing.",
  ));
  assert.ok(details.includes("Meal remaining: 1 more meal to log today."));
  assert.ok(details.includes("Walk remaining: 1 more walk to log today."));
  // Singular subjects never take plural verbs, and nothing claims "open".
  assert.ok(details.every((line) => !/1 meal outcome need /.test(line)));
  assert.ok(details.every((line) => !/still open/.test(line)));
});

test("only calls a walk open while its session is actually in progress", () => {
  const base = {
    now: NOW,
    caregivers: [{ name: "Apollo", role: "Owner" }],
    routines: [
      { id: "walk-am", type: "walk", label: "Morning walk", time: "8:30 AM", owner: "Apollo" },
      { id: "walk-pm", type: "walk", label: "Evening walk", time: "6:30 PM", owner: "Apollo" },
    ],
  };

  const inProgress = deriveCareHandoff({
    ...base,
    entries: [
      {
        id: "walk_open",
        type: "walk",
        title: "Morning walk - In progress",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T14:30:00.000Z",
        details: { walkLifecycle: "in-progress", householdVisible: true },
      },
    ],
  });
  assert.ok(
    inProgress.sections.needsAttention.some(
      (item) => item.label === "Walk in progress" && /still in progress/.test(item.detail),
    ),
  );

  const finished = deriveCareHandoff({
    ...base,
    entries: [
      {
        id: "walk_done",
        type: "walk",
        title: "Morning walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T14:30:00.000Z",
        durationMinutes: 25,
        details: { walkLifecycle: "completed", householdVisible: true },
      },
    ],
  });
  // The finished walk is never described as open/in progress; the second
  // routine walk is reported as a real remaining count.
  assert.ok(
    finished.sections.needsAttention.every((item) => item.label !== "Walk in progress"),
  );
  assert.ok(
    finished.sections.needsAttention.some(
      (item) => item.label === "Walk remaining" && item.detail === "1 more walk to log today.",
    ),
  );
});

test("credits the household when today's logs match no listed caregiver name", () => {
  const handoff = deriveCareHandoff({
    now: NOW,
    // The caregiver was renamed to Apollo, but today's entries still carry
    // the old name string - never report "Apollo logged 0 items today".
    caregivers: [{ name: "Apollo", role: "Owner" }],
    entries: [
      {
        id: "meal_1",
        type: "meal",
        title: "Breakfast",
        caregiver: "Old Name",
        occurredAt: "2026-06-06T14:00:00.000Z",
      },
      {
        id: "walk_1",
        type: "walk",
        title: "Morning walk",
        caregiver: "Old Name",
        occurredAt: "2026-06-06T14:30:00.000Z",
        durationMinutes: 25,
      },
    ],
  });

  assert.equal(handoff.message, "The household logged 2 items today.");
  assert.doesNotMatch(handoff.message, /logged 0/);
});

test("matches caregiver log attribution case-insensitively", () => {
  const handoff = deriveCareHandoff({
    now: NOW,
    caregivers: [{ name: "Emma", role: "Primary" }],
    entries: [
      {
        id: "meal_1",
        type: "meal",
        title: "Breakfast",
        caregiver: "emma ",
        occurredAt: "2026-06-06T14:00:00.000Z",
      },
    ],
  });

  assert.equal(handoff.caregiverLoad[0]?.todayLogs, 1);
  assert.match(handoff.message, /Emma logged 1 item today/);
});

test("keeps pending meal outcomes in caregiver handoff needs-attention", () => {
  const handoff = deriveCareHandoff({
    now: NOW,
    caregivers: [
      { name: "Emma", role: "Primary" },
      { name: "Apollo", role: "Caregiver" },
    ],
    routines: [
      { id: "breakfast", type: "meal", label: "Breakfast", time: "7:00 AM", owner: "Emma" },
      { id: "dinner", type: "meal", label: "Dinner", time: "6:00 PM", owner: "Apollo" },
    ],
    entries: [
      {
        id: "breakfast-served",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-06T14:00:00.000Z",
        details: {
          routineId: "breakfast",
          mealCompletion: "served",
          mealLifecycle: "outcome-pending",
          servedAmount: 1,
          servedUnit: "cup",
          householdVisible: true,
        },
      },
      {
        id: "dinner-finished",
        type: "meal",
        title: "Dinner",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T18:00:00.000Z",
        details: {
          routineId: "dinner",
          mealCompletion: "ate most",
          servedAmount: 1,
          eatenAmount: 0.8,
          householdVisible: true,
        },
      },
    ],
  });

  assert.match(handoff.sections.done.find((item) => item.kind === "meal")?.detail ?? "", /1\/2 meals resolved/i);
  assert.ok(
    handoff.sections.needsAttention.some(
      (item) =>
        item.kind === "meal" &&
        /outcome pending/i.test(item.label) &&
        /confirm/i.test(item.detail),
    ),
  );
});
