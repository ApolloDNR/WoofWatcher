import { test } from "node:test";
import assert from "node:assert/strict";

import { CARE_TWIN_SPRITE_MANIFEST, type CareTwinSpriteAction } from "./avatarLifeEngine.ts";
import {
  CARE_TWIN_DOGLESS_ROOM_ASSETS,
  CARE_TWIN_ROOM_VARIANT_ASSETS,
  CARE_TWIN_SPRITE_ASSETS,
  evaluateCareTwinRuntimeQaScenario,
  getCareTwinLayerReadiness,
  getCareTwinRoomLayer,
  getCareTwinRoomVariantKey,
  getCareTwinSpriteAsset,
  listCareTwinRuntimeQaScenarios,
  listCareTwinSpriteSlots,
} from "./careTwinAssets.ts";

test("enables layered sprite rendering when production sprite and dogless room assets exist", () => {
  const readiness = getCareTwinLayerReadiness("tail-wag", "happy");

  assert.equal(readiness.layeredReady, true);
  assert.equal(readiness.spriteReady, true);
  assert.equal(readiness.roomReady, true);
  assert.deepEqual(readiness.missing, []);
});

test("registers finished PixelLab sprite strips and a dogless room layer", () => {
  assert.deepEqual(Object.keys(CARE_TWIN_SPRITE_ASSETS).sort(), [
    "bark-loop",
    "celebrate-hop",
    "comfort-loop",
    "drink-loop",
    "ear-perk",
    "eat-loop",
    "health-watch",
    "idle-breathe",
    "sleep-loop",
    "tail-wag",
    "walk-loop",
  ]);
  assert.deepEqual(Object.keys(CARE_TWIN_DOGLESS_ROOM_ASSETS).sort(), [
    "anxious",
    "calm",
    "excited",
    "happy",
    "unwell",
  ]);
  assert.deepEqual(Object.keys(CARE_TWIN_ROOM_VARIANT_ASSETS).sort(), [
    "bedtime",
    "day",
    "healthWatch",
    "homeAlone",
    "night",
  ]);
  assert.equal(getCareTwinSpriteAsset("tail-wag")?.frameWidth, 256);
  assert.equal(getCareTwinSpriteAsset("idle-breathe")?.columns, 8);
  assert.equal(getCareTwinSpriteAsset("tail-wag")?.columns, 8);
  assert.equal(getCareTwinSpriteAsset("walk-loop")?.columns, 8);
  assert.equal(getCareTwinSpriteAsset("ear-perk")?.columns, 6);
  assert.equal(getCareTwinSpriteAsset("bark-loop")?.columns, 6);
  assert.match(CARE_TWIN_ROOM_VARIANT_ASSETS.day.description, /Option B Dogless/);
  assert.equal(getCareTwinRoomLayer("happy")?.description.includes("Dogless"), true);
});

test("uses the hard-pixel Option B Phoenix family for live runtime actions", () => {
  const optionBActions: CareTwinSpriteAction[] = [
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
    "bark-loop",
  ];

  for (const action of optionBActions) {
    assert.match(CARE_TWIN_SPRITE_MANIFEST[action].requiredAsset, /assets\/avatar\/phoenix\/candidates\/option-b-/);
  }
  assert.equal(CARE_TWIN_SPRITE_MANIFEST["walk-loop"].frameCount, 8);
  assert.match(CARE_TWIN_SPRITE_MANIFEST["bark-loop"].requiredAsset, /option-b-bark-reaction-strip\.png/);
  assert.notEqual(CARE_TWIN_SPRITE_MANIFEST["bark-loop"].requiredAsset, CARE_TWIN_SPRITE_MANIFEST["ear-perk"].requiredAsset);
});

test("routes care twin sprite states to the right dogless room mood variant", () => {
  assert.equal(getCareTwinRoomVariantKey("calm", "sleep-loop"), "bedtime");
  assert.equal(getCareTwinRoomVariantKey("happy", "comfort-loop"), "homeAlone");
  assert.equal(getCareTwinRoomVariantKey("happy", "health-watch"), "healthWatch");
  assert.equal(getCareTwinRoomVariantKey("anxious", "ear-perk"), "night");
  assert.equal(getCareTwinRoomVariantKey("happy", "tail-wag"), "day");
  assert.equal(getCareTwinRoomLayer("calm", "sleep-loop"), CARE_TWIN_ROOM_VARIANT_ASSETS.bedtime);
  assert.equal(getCareTwinRoomLayer("happy", "comfort-loop"), CARE_TWIN_ROOM_VARIANT_ASSETS.homeAlone);
  assert.equal(getCareTwinRoomLayer("happy", "health-watch"), CARE_TWIN_ROOM_VARIANT_ASSETS.healthWatch);
  assert.equal(getCareTwinRoomLayer("anxious", "ear-perk"), CARE_TWIN_ROOM_VARIANT_ASSETS.night);
  assert.equal(getCareTwinRoomLayer("happy", "tail-wag"), CARE_TWIN_ROOM_VARIANT_ASSETS.day);
});

test("keeps every production sprite track layer-ready with the shared dogless room", () => {
  const readiness = getCareTwinLayerReadiness("walk-loop", "happy");

  assert.equal(readiness.layeredReady, true);
  assert.equal(readiness.spriteReady, true);
  assert.equal(readiness.roomReady, true);
  assert.deepEqual(readiness.missing, []);

  for (const action of Object.keys(CARE_TWIN_SPRITE_MANIFEST) as CareTwinSpriteAction[]) {
    assert.equal(getCareTwinLayerReadiness(action, "happy").layeredReady, true, action);
  }
});

test("mirrors the sprite manifest into asset slots for Fable and artist handoff", () => {
  const slots = listCareTwinSpriteSlots();
  const required = Object.keys(CARE_TWIN_SPRITE_MANIFEST) as CareTwinSpriteAction[];

  assert.deepEqual(
    slots.map((slot) => slot.action).sort(),
    [...required].sort(),
  );

  for (const slot of slots) {
    const track = CARE_TWIN_SPRITE_MANIFEST[slot.action];
    assert.equal(slot.expectedPath, track.requiredAsset);
    assert.equal(slot.frameCount, track.frameCount);
    assert.equal(slot.fps, track.fps);
    assert.equal(slot.loop, track.loop);
    assert.equal(slot.anchor, "bottom-center");
    assert.equal(slot.slotSize, 256);
    assert.equal(slot.assetReady, Boolean(CARE_TWIN_SPRITE_ASSETS[slot.action]));
  }
});

test("defines a native QA matrix for every care twin state and room variant", () => {
  const scenarios = listCareTwinRuntimeQaScenarios();
  const scenarioStates = new Set(scenarios.map((scenario) => scenario.motion.state));
  const roomVariants = new Set(scenarios.map((scenario) => scenario.expectedRoomVariant));

  assert.equal(scenarios.length, 12);
  assert.deepEqual(
    [...scenarioStates].sort(),
    [
      "annoyed",
      "bored",
      "drinking",
      "eating",
      "excited",
      "happy",
      "sad",
      "sick",
      "sleeping",
      "tired",
      "treat",
      "walking",
    ],
  );
  assert.deepEqual([...roomVariants].sort(), ["bedtime", "day", "healthWatch", "homeAlone", "night"]);

  for (const scenario of scenarios) {
    const result = evaluateCareTwinRuntimeQaScenario(scenario);

    assert.equal(result.actualAction, scenario.expectedAction, scenario.id);
    assert.equal(result.actualRoomVariant, scenario.expectedRoomVariant, scenario.id);
    assert.equal(result.actualZone, scenario.expectedZone, scenario.id);
    assert.equal(result.actualScenePhase, scenario.expectedScenePhase, scenario.id);
    assert.equal(result.actualNeed, scenario.expectedNeed, scenario.id);
    assert.equal(result.readiness.layeredReady, true, scenario.id);
    assert.deepEqual(result.readiness.missing, [], scenario.id);
    assert.ok(scenario.nativeQaPrompt.length > 50, scenario.id);
    assert.doesNotMatch(scenario.nativeQaPrompt, /emergency|certainty|cure|treatment claim/i, scenario.id);
  }
});
