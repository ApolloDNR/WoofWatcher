import { test } from "node:test";
import assert from "node:assert/strict";

import { CARE_TWIN_SPRITE_MANIFEST, type CareTwinSpriteAction } from "./avatarLifeEngine.ts";
import {
  CARE_TWIN_DOGLESS_ROOM_ASSETS,
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
    "idle-breathe",
    "sleep-loop",
    "tail-wag",
  ]);
  assert.deepEqual(Object.keys(CARE_TWIN_DOGLESS_ROOM_ASSETS).sort(), [
    "anxious",
    "calm",
    "excited",
    "happy",
    "unwell",
  ]);
  assert.equal(getCareTwinSpriteAsset("tail-wag")?.frameWidth, 256);
  assert.equal(getCareTwinSpriteAsset("walk-loop"), null);
  assert.equal(getCareTwinRoomLayer("happy")?.description.includes("Dogless"), true);
});

test("reports unfinished sprite tracks without disabling the dogless room layer", () => {
  const readiness = getCareTwinLayerReadiness("walk-loop", "happy");

  assert.equal(readiness.layeredReady, false);
  assert.equal(readiness.spriteReady, false);
  assert.equal(readiness.roomReady, true);
  assert.deepEqual(readiness.missing, [CARE_TWIN_SPRITE_MANIFEST["walk-loop"].requiredAsset]);
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
