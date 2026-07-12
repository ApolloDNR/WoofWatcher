import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveCareTwinChoreography, motionRecipeForSpriteAction } from "./careTwinChoreography.ts";
import { deriveCareTwinScene } from "./avatarLifeEngine.ts";
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

test("builds a layered idle choreography without repeating the primary loop", () => {
  const plan = deriveCareTwinScene(motion({ state: "happy", avatarMood: "happy", cue: "tail-wag" }));
  const choreography = deriveCareTwinChoreography(plan);

  assert.equal(choreography.primary.action, "tail-wag");
  assert.deepEqual(
    choreography.ambient.map((step) => step.action),
    ["idle-breathe", "ear-perk"],
  );
  assert.equal(choreography.tapReaction.action, "bark-loop");
  assert.match(choreography.qaSummary, /Primary tail wag/i);
  assert.match(choreography.qaSummary, /ambient idle breathe/i);
});

test("keeps rest states calm instead of forcing an awake tap bark", () => {
  const plan = deriveCareTwinScene(motion({ state: "sleeping", avatarMood: "calm", cue: "slow-breath" }));
  const choreography = deriveCareTwinChoreography(plan);

  assert.equal(choreography.primary.action, "sleep-loop");
  assert.deepEqual(choreography.ambient, []);
  assert.equal(choreography.tapReaction.action, "ear-perk");
  assert.notEqual(choreography.tapReaction.action, "bark-loop");
  assert.match(choreography.tapReaction.label, /soft check/i);
  assert.match(choreography.qaSummary, /rest suppresses awake ambient swaps/i);
});

test("keeps Health Watch reactions calm and non-diagnostic", () => {
  const plan = deriveCareTwinScene(
    motion({ state: "sick", avatarMood: "unwell", cue: "health-watch", intensity: "urgent" }),
  );
  const choreography = deriveCareTwinChoreography(plan);

  assert.equal(choreography.primary.action, "health-watch");
  assert.equal(choreography.tapReaction.action, "comfort-loop");
  assert.match(choreography.tapReaction.label, /comfort/i);
  assert.match(choreography.qaSummary, /Health Watch/i);
  assert.doesNotMatch(choreography.qaSummary, /diagnos/i);
});

test("gives each sprite action a single-dog motion recipe", () => {
  const walk = motionRecipeForSpriteAction("walk-loop");
  const sleep = motionRecipeForSpriteAction("sleep-loop");
  const celebrate = motionRecipeForSpriteAction("celebrate-hop");
  const bark = motionRecipeForSpriteAction("bark-loop");

  assert.ok(walk.bodySwayPx > sleep.bodySwayPx, "walk should visibly travel more than sleep");
  assert.ok(celebrate.bodyBobPx > walk.bodyBobPx, "care-win hops should have the strongest bob");
  assert.ok(sleep.scalePulse < walk.scalePulse, "sleep should have a calmer breathing pulse");
  assert.match(bark.qaHint, /same Phoenix sprite|another avatar/i);
  assert.doesNotMatch(bark.qaHint, /second dog/i);
});
