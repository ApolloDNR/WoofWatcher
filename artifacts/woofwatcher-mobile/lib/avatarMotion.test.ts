import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveAvatarMotion } from "./avatarMotion.ts";

function localTime(hour: number, minute = 0): number {
  return new Date(2026, 5, 8, hour, minute, 0, 0).getTime();
}

const NOW = localTime(8);

function iso(minutesOffset: number): string {
  return new Date(NOW + minutesOffset * 60_000).toISOString();
}

test("uses sick motion for recent health alerts before routine or activity cues", () => {
  const motion = deriveAvatarMotion({
    now: NOW,
    entries: [
      {
        id: "vomit-1",
        type: "vomit",
        title: "Yellow bile vomit",
        occurredAt: iso(-20),
        severity: "alert",
        note: "Yellow bile before breakfast.",
      },
      {
        id: "walk-1",
        type: "walk",
        title: "Morning walk",
        occurredAt: iso(-15),
      },
    ],
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Apollo" },
    ],
  });

  assert.equal(motion.state, "sick");
  assert.equal(motion.avatarMood, "unwell");
  assert.equal(motion.intensity, "urgent");
  assert.match(motion.line, /does not diagnose/i);
});

test("turns a recent visible meal log into eating motion", () => {
  const motion = deriveAvatarMotion({
    now: NOW,
    entries: [
      {
        id: "meal-1",
        type: "meal",
        title: "Breakfast",
        occurredAt: iso(-12),
        details: {
          mealCompletion: "complete",
          householdVisible: true,
          servedAmount: "1 cup",
          eatenAmount: "1 cup",
        },
      },
    ],
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Apollo" },
    ],
  });

  assert.equal(motion.state, "eating");
  assert.equal(motion.avatarMood, "happy");
  assert.equal(motion.cue, "chew");
  assert.equal(motion.route, "/log");
});

test("perks up when a walk routine is coming soon", () => {
  const motion = deriveAvatarMotion({
    now: localTime(8, 45),
    petName: "Luna",
    entries: [],
    routines: [
      { id: "walk", label: "Morning walk", type: "walk", time: "9:00 AM", owner: "Emma" },
    ],
  });

  assert.equal(motion.state, "excited");
  assert.equal(motion.avatarMood, "excited");
  assert.equal(motion.cue, "paw-bounce");
  assert.equal(motion.line, "Morning walk is coming up. Luna is watching the routine board.");
});

test("shows bored attention motion for overdue activity routines", () => {
  const motion = deriveAvatarMotion({
    now: localTime(10, 45),
    entries: [],
    routines: [
      { id: "walk", label: "Morning walk", type: "walk", time: "9:00 AM", owner: "Emma" },
    ],
  });

  assert.equal(motion.state, "bored");
  assert.equal(motion.avatarMood, "excited");
  assert.equal(motion.intensity, "medium");
  assert.equal(motion.route, "/calendar");
});

test("uses sleeping motion during quiet hours when no health signal is active", () => {
  const motion = deriveAvatarMotion({
    now: localTime(23, 30),
    entries: [],
    routines: [],
  });

  assert.equal(motion.state, "sleeping");
  assert.equal(motion.avatarMood, "calm");
  assert.equal(motion.cue, "slow-breath");
});

test("uses tired motion when energy is low without health alerts", () => {
  const motion = deriveAvatarMotion({
    now: NOW,
    energy: 42,
    entries: [],
    routines: [],
  });

  assert.equal(motion.state, "tired");
  assert.equal(motion.avatarMood, "calm");
  assert.equal(motion.intensity, "soft");
});

test("reactionsSince gates pre-session entries out of reaction states", () => {
  // A meal logged at 23:58 must not replay its eat reaction after an app
  // reload at 00:02: the pre-session entry falls through to the standing
  // quiet-hours scene instead.
  const midnight = new Date(2026, 5, 9, 0, 2, 0, 0).getTime();
  const motion = deriveAvatarMotion({
    now: midnight,
    reactionsSince: midnight - 60_000,
    entries: [
      {
        id: "meal-late",
        type: "meal",
        title: "Late dinner",
        occurredAt: new Date(midnight - 4 * 60_000).toISOString(),
      },
    ],
    routines: [],
  });

  assert.equal(motion.state, "sleeping");
  assert.equal(motion.speech, "Soft snooze.");
});

test("reactionsSince keeps reactions for entries logged in this session", () => {
  const motion = deriveAvatarMotion({
    now: NOW,
    reactionsSince: NOW - 30 * 60_000,
    entries: [
      {
        id: "meal-fresh",
        type: "meal",
        title: "Breakfast",
        occurredAt: iso(-4),
      },
    ],
    routines: [],
  });

  assert.equal(motion.state, "eating");
  assert.equal(motion.cue, "chew");
});

test("an open walk remains authoritative after reload even when its start log predates the session gate", () => {
  const motion = deriveAvatarMotion({
    now: NOW,
    activeWalk: true,
    reactionsSince: NOW - 60_000,
    entries: [
      {
        id: "walk-open-before-reload",
        type: "walk",
        title: "Morning walk",
        occurredAt: iso(-12),
        details: {
          walkLifecycle: "started",
          walkStartedAt: iso(-12),
          householdVisible: true,
        },
      },
    ],
    routines: [],
  });

  assert.equal(motion.state, "walking");
  assert.equal(motion.cue, "walk-cycle");
  assert.equal(motion.speech, "Out exploring.");
});
