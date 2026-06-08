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
