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

test("keeps layered sprite rendering disabled until sprite and dogless room assets both exist", () => {
  const readiness = getCareTwinLayerReadiness("tail-wag", "happy");

  assert.equal(readiness.layeredReady, false);
  assert.equal(readiness.spriteReady, false);
  assert.equal(readiness.roomReady, false);
  assert.deepEqual(readiness.missing, [
    "dogless-room-layer",
    CARE_TWIN_SPRITE_MANIFEST["tail-wag"].requiredAsset,
  ]);
});

test("keeps optional asset registries empty until production-safe art is supplied", () => {
  assert.deepEqual(Object.keys(CARE_TWIN_SPRITE_ASSETS), []);
  assert.deepEqual(Object.keys(CARE_TWIN_DOGLESS_ROOM_ASSETS), []);
  assert.equal(getCareTwinSpriteAsset("walk-loop"), null);
  assert.equal(getCareTwinRoomLayer("happy"), null);
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
    assert.equal(slot.assetReady, false);
  }
});
