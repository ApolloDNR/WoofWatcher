import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAloneTimeStartEntry,
  buildAloneTimeReturnPatch,
  findOpenAloneTimeSession,
  getAloneTimeReturnOptions,
} from "./aloneTimeSession.ts";

process.env.TZ = "America/Los_Angeles";

const START = new Date("2026-06-19T12:30:00-07:00").getTime();
const RETURN = new Date("2026-06-19T14:08:00-07:00").getTime();

test("starts an open home-alone session with household-visible lifecycle details", () => {
  const entry = buildAloneTimeStartEntry({ caregiver: "Apollo", now: START });

  assert.equal(entry.type, "alone");
  assert.equal(entry.title, "Alone Time - home alone");
  assert.equal(entry.caregiver, "Apollo");
  assert.equal(entry.occurredAt, "2026-06-19T19:30:00.000Z");
  assert.equal(entry.mood, "home_alone");
  assert.deepEqual(entry.details, {
    aloneLifecycle: "active",
    aloneStartedAt: "2026-06-19T19:30:00.000Z",
    leftBy: "Apollo",
    presenceState: "home-alone",
    supervisedBy: null,
    householdVisible: true,
    logInteraction: "quick-tap",
    trustState: "confirmed",
    confirmationRequired: false,
  });
});

test("finds the newest active alone-time session and ignores completed or private sessions", () => {
  const open = buildAloneTimeStartEntry({ caregiver: "Emma", now: START + 60000 });
  const completed = buildAloneTimeReturnPatch(open, { caregiver: "Apollo", outcome: "calm", now: RETURN });

  const newestOpen = buildAloneTimeStartEntry({ caregiver: "Apollo", now: START + 120000 });

  const found = findOpenAloneTimeSession([
    { ...open, id: "completed", ...completed },
    { ...buildAloneTimeStartEntry({ caregiver: "Maya", now: START + 180000 }), id: "private", details: { aloneLifecycle: "active", householdVisible: false } },
    { ...newestOpen, id: "active" },
  ]);

  assert.equal(found?.id, "active");
});

test("closing an alone-time session records duration, return outcome, mood, severity, and audit detail", () => {
  const start = { ...buildAloneTimeStartEntry({ caregiver: "Emma", now: START }), id: "alone_1" };

  const patch = buildAloneTimeReturnPatch(start, {
    caregiver: "Apollo",
    outcome: "barking-whining",
    now: RETURN,
    recoveryMinutes: 12,
    note: "Settled after puzzle toy and a calm greeting.",
  });

  assert.equal(patch.title, "Alone Time - Barking/whining return");
  assert.equal(patch.durationMinutes, 98);
  assert.equal(patch.mood, "anxious");
  assert.equal(patch.severity, "watch");
  assert.equal(patch.note, "Settled after puzzle toy and a calm greeting.");
  assert.equal(patch.details?.aloneLifecycle, "completed");
  assert.equal(patch.details?.aloneOutcome, "barking-whining");
  assert.equal(patch.details?.aloneStartedAt, "2026-06-19T19:30:00.000Z");
  assert.equal(patch.details?.aloneEndedAt, "2026-06-19T21:08:00.000Z");
  assert.equal(patch.details?.returnedBy, "Apollo");
  assert.equal(patch.details?.outcomeBy, "Apollo");
  assert.equal(patch.details?.recoveryMinutes, 12);
  assert.equal(patch.details?.presenceState, "with-human");
  assert.equal(Array.isArray(patch.details?.auditTrail), true);
});

test("exposes the approved return outcomes for the mobile check-in", () => {
  assert.deepEqual(
    getAloneTimeReturnOptions().map((option) => option.id),
    ["calm", "excited", "anxious", "barking-whining", "accident", "vomit", "destructive", "unknown"],
  );
});
