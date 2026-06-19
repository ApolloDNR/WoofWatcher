import { test } from "node:test";
import assert from "node:assert/strict";

import { CARE_TWIN_SPRITE_MANIFEST, type CareTwinSpriteAction } from "./avatarLifeEngine.ts";
import {
  CARE_TWIN_DOGLESS_ROOM_ASSETS,
  CARE_TWIN_ROOM_VARIANT_ASSETS,
  CARE_TWIN_SPRITE_ASSETS,
  getCareTwinLayerReadiness,
  getCareTwinRoomLayer,
  getCareTwinSpriteAsset,
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
  assert.equal(getCareTwinSpriteAsset("tail-wag")?.columns, 8);
  assert.equal(getCareTwinSpriteAsset("walk-loop")?.columns, 8);
  assert.equal(getCareTwinSpriteAsset("ear-perk")?.columns, 6);
  assert.equal(getCareTwinRoomLayer("happy")?.description.includes("Dogless"), true);
});

test("routes care twin sprite states to the right dogless room mood variant", () => {
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
