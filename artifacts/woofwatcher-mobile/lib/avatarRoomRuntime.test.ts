import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultAvatarConfig } from "./avatarStudio.ts";
import { deriveAvatarRoomRuntime } from "./avatarRoomRuntime.ts";

test("keeps Phoenix on the full action sprite pack while applying fitted overlays", () => {
  const runtime = deriveAvatarRoomRuntime(
    createDefaultAvatarConfig("Phoenix"),
    "eat-loop",
  );

  assert.equal(runtime.templateId, "shepherd");
  assert.equal(runtime.templateLabel, "Shepherd");
  assert.equal(runtime.spriteMode, "phoenix-action-pack");
  assert.equal(runtime.spriteTrack.key, "eat-loop");
  assert.equal(runtime.templateSpriteAction, null);
  assert.equal(
    runtime.underlayLayers.map((layer) => layer.id).join(","),
    "cozy-bed",
  );
  assert.deepEqual(
    runtime.overlayLayers.map((layer) => [
      layer.id,
      layer.slot,
      layer.fitStatus,
    ]),
    [
      ["forest-bandana", "neck", "template-fitted"],
      ["heart-sparkles", "fx", "template-fitted"],
    ],
  );
  assert.ok(runtime.overlayLayers.every((layer) => layer.source));
  assert.ok(runtime.underlayLayers.every((layer) => layer.source));
});

test("uses selected live template sprite packs in the main care room", () => {
  const config = {
    ...createDefaultAvatarConfig("Scout"),
    templateId: "retriever" as const,
    emotePackId: "retriever-starter" as const,
    accessorySlots: {
      neck: "forest-bandana",
      room: "cozy-bed",
    },
  };

  const walk = deriveAvatarRoomRuntime(config, "walk-loop");
  const meal = deriveAvatarRoomRuntime(config, "eat-loop");

  assert.equal(walk.templateId, "retriever");
  assert.equal(walk.templateLabel, "Retriever");
  assert.equal(walk.spriteMode, "template-idle-walk-pack");
  assert.equal(walk.templateSpriteAction, "walk-loop");
  assert.equal(walk.spriteTrack.key, "retriever:walk-loop");
  assert.match(walk.spriteLabel, /Retriever walk/i);

  assert.equal(meal.spriteMode, "template-idle-walk-pack");
  assert.equal(meal.templateSpriteAction, "idle-tail-wag");
  assert.equal(meal.spriteTrack.key, "retriever:idle-tail-wag");
  assert.equal(meal.overlayLayers.length, 0);
  assert.equal(meal.underlayLayers.length, 0);
});
