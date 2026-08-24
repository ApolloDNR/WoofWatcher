import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CARE_TWIN_SPRITE_MANIFEST,
  deriveAvatarLifePlan,
  deriveCareTwinScene,
  type CareTwinSpriteAction,
} from "./avatarLifeEngine.ts";
import type { AvatarMotionModel } from "./avatarMotion.ts";

function motion(overrides: Partial<AvatarMotionModel>): AvatarMotionModel {
  return {
    state: "happy",
    avatarMood: "happy",
    cue: "tail-wag",
    intensity: "soft",
    label: "Steady",
    speech: "All steady.",
    line: "Care is steady.",
    route: "/log",
    ...overrides,
  };
}

test("routes eating and drinking avatar states to the bowl", () => {
  const eating = deriveCareTwinScene(motion({ state: "eating", cue: "chew" }));
  const drinking = deriveCareTwinScene(motion({ state: "drinking", cue: "lap" }));

  assert.equal(eating.zone, "bowl");
  assert.equal(drinking.zone, "bowl");
  assert.equal(eating.animation, "eat");
  assert.equal(drinking.animation, "drink");
  assert.equal(eating.spriteAction, "eat-loop");
  assert.equal(drinking.spriteAction, "drink-loop");
  assert.equal(eating.priorityNeed, "hunger");
  assert.equal(drinking.priorityNeed, "hydration");
});

test("routes activity states to the door with walk animation", () => {
  const plan = deriveCareTwinScene(motion({ state: "walking", cue: "walk-cycle", intensity: "high" }));

  assert.equal(plan.zone, "door");
  assert.equal(plan.animation, "walk");
  assert.equal(plan.activityLabel, "Walking");
  assert.equal(plan.spriteAction, "walk-loop");
  assert.equal(plan.scenePhase, "care-action");
});

test("routes health and tired states to calmer bed behavior", () => {
  const health = deriveCareTwinScene(
    motion({ state: "sick", avatarMood: "unwell", cue: "health-watch", intensity: "urgent" }),
  );
  const tired = deriveCareTwinScene(motion({ state: "sleeping", avatarMood: "calm", cue: "slow-breath" }));

  assert.equal(health.zone, "bed");
  assert.equal(health.showCareAura, true);
  assert.equal(health.spriteAction, "health-watch");
  assert.equal(health.scenePhase, "watch");
  assert.equal(health.priorityNeed, "health");
  assert.equal(tired.zone, "bed");
  assert.equal(tired.showSleep, true);
  assert.equal(tired.spriteAction, "sleep-loop");
});

test("keeps steady care playful without forcing health aura", () => {
  const plan = deriveCareTwinScene(motion({ state: "happy", avatarMood: "happy", cue: "tail-wag" }));

  assert.equal(plan.zone, "rug");
  assert.equal(plan.animation, "idle");
  assert.equal(plan.showHearts, true);
  assert.equal(plan.showCareAura, false);
  assert.equal(plan.spriteAction, "tail-wag");
  assert.equal(plan.spriteTrack, CARE_TWIN_SPRITE_MANIFEST["tail-wag"]);
  assert.ok(plan.idleBehaviors.some((behavior) => behavior.action === "idle-breathe"));
});

test("keeps consumer tap actions neutral instead of assuming the sample dog's name", () => {
  const happy = deriveCareTwinScene(motion({ state: "happy" }));
  const tired = deriveCareTwinScene(motion({ state: "tired" }));

  assert.doesNotMatch(`${happy.tapVerb} ${tired.tapVerb}`, /Phoenix|My Dog/);
});

test("keeps legacy life-plan export compatible with the care twin scene engine", () => {
  const input = motion({ state: "treat", avatarMood: "happy", cue: "treat-hop" });

  assert.deepEqual(deriveAvatarLifePlan(input), deriveCareTwinScene(input));
});

test("defines production sprite tracks with a stable transparent-strip contract", () => {
  const required: CareTwinSpriteAction[] = [
    "idle-breathe",
    "tail-wag",
    "ear-perk",
    "walk-loop",
    "eat-loop",
    "drink-loop",
    "sleep-loop",
    "comfort-loop",
    "celebrate-hop",
    "health-watch",
  ];

  for (const action of required) {
    const track = CARE_TWIN_SPRITE_MANIFEST[action];
    assert.equal(track.key, action);
    assert.ok(track.frameCount >= 6, `${action} should have enough frames for a readable loop`);
    assert.ok(track.fps >= 5, `${action} should define playback speed`);
    assert.equal(track.anchor, "bottom-center");
    assert.equal(track.slotSize, 256);
    assert.match(track.requiredAsset, /^assets\/avatar\/phoenix\/.+-strip\.png$/);
    assert.match(track.notes, /transparent|prop|stable|scenery|background|seed|careful/i);
  }
});
