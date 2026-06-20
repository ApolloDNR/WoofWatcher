import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWalkSessionFinishPatch,
  buildWalkSessionStartEntry,
  findOpenWalkSession,
  type WalkSessionEntryLike,
} from "./walkSession.ts";

const START = "2026-06-19T22:00:00.000Z";
const END = "2026-06-19T22:42:00.000Z";

function walk(overrides: Partial<WalkSessionEntryLike> = {}): WalkSessionEntryLike {
  return {
    id: "walk-1",
    type: "walk",
    title: "Walk - In progress",
    caregiver: "Emma",
    occurredAt: START,
    details: {
      householdVisible: true,
      walkLifecycle: "in-progress",
      walkStartedAt: START,
      startedBy: "Emma",
    },
    ...overrides,
  };
}

test("starts a household-visible active walk session", () => {
  const entry = buildWalkSessionStartEntry({ caregiver: "Apollo", now: START, routineId: "walk-pm", routineLabel: "Evening walk" });

  assert.equal(entry.type, "walk");
  assert.equal(entry.title, "Evening walk - In progress");
  assert.equal(entry.caregiver, "Apollo");
  assert.deepEqual(entry.details, {
    householdVisible: true,
    walkLifecycle: "in-progress",
    walkStartedAt: START,
    startedBy: "Apollo",
    routineId: "walk-pm",
    routineLabel: "Evening walk",
    logInteraction: "walk-session-start",
  });
});

test("finds the newest active household-visible walk session", () => {
  const active = walk({ id: "active", occurredAt: "2026-06-19T22:10:00.000Z", details: { householdVisible: true, walkLifecycle: "in-progress", walkStartedAt: "2026-06-19T22:10:00.000Z" } });
  const older = walk({ id: "older", occurredAt: "2026-06-19T21:00:00.000Z", details: { householdVisible: true, walkLifecycle: "in-progress", walkStartedAt: "2026-06-19T21:00:00.000Z" } });
  const completed = walk({ id: "done", details: { householdVisible: true, walkLifecycle: "completed", walkStartedAt: START } });
  const privateOpen = walk({ id: "private", details: { householdVisible: false, walkLifecycle: "in-progress", walkStartedAt: "2026-06-19T23:00:00.000Z" } });

  assert.equal(findOpenWalkSession([completed, privateOpen, older, active])?.id, "active");
});

test("finishes an active walk session with route, duration, social context, and audit history", () => {
  const patch = buildWalkSessionFinishPatch(walk(), {
    caregiver: "Apollo",
    now: END,
    routeName: "River loop",
    distanceMiles: 1.8,
    dogInteractions: 2,
    socialOutcome: "Calm greetings",
    note: "Loose leash was much better near the park.",
  });

  assert.equal(patch.title, "Walk - Completed");
  assert.equal(patch.durationMinutes, 42);
  assert.equal(patch.dogInteractions, 2);
  assert.equal(patch.note, "Loose leash was much better near the park.");
  assert.deepEqual(
    {
      householdVisible: patch.details.householdVisible,
      walkLifecycle: patch.details.walkLifecycle,
      walkStartedAt: patch.details.walkStartedAt,
      walkEndedAt: patch.details.walkEndedAt,
      endedBy: patch.details.endedBy,
      durationMinutes: patch.details.durationMinutes,
      routeName: patch.details.routeName,
      distanceMiles: patch.details.distanceMiles,
      dogInteractions: patch.details.dogInteractions,
      socialOutcome: patch.details.socialOutcome,
    },
    {
      householdVisible: true,
      walkLifecycle: "completed",
      walkStartedAt: START,
      walkEndedAt: END,
      endedBy: "Apollo",
      durationMinutes: 42,
      routeName: "River loop",
      distanceMiles: 1.8,
      dogInteractions: 2,
      socialOutcome: "Calm greetings",
    },
  );
  assert.match(String(patch.details.auditTrail?.[0]?.summary), /Apollo finished "Walk - In progress" after 42 minutes/);
  assert.deepEqual(patch.details.auditTrail?.[0]?.changes, ["walkLifecycle", "walkEndedAt", "durationMinutes"]);
});

test("uses an explicit duration when the timer cannot be trusted", () => {
  const patch = buildWalkSessionFinishPatch(walk({ details: { householdVisible: true, walkLifecycle: "in-progress", walkStartedAt: "not-a-date" } }), {
    caregiver: "Emma",
    now: END,
    durationMinutes: 30,
  });

  assert.equal(patch.durationMinutes, 30);
  assert.equal(patch.details.durationMinutes, 30);
});
