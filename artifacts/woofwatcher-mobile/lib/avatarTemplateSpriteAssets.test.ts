import assert from "node:assert/strict";
import test from "node:test";

import {
  getAvatarTemplateSpriteAsset,
  listAvatarTemplateSpriteSlots,
} from "./avatarTemplateSpriteAssets.ts";

test("registers animated preview strips for every non-shepherd launch template", () => {
  for (const templateId of [
    "retriever",
    "husky",
    "bully",
    "doodle",
    "terrier",
    "hound",
    "dachshund",
    "spaniel",
    "toy",
    "slender",
    "mixed",
  ] as const) {
    const slots = listAvatarTemplateSpriteSlots(templateId);

    assert.equal(slots.length, 7);
    assert.deepEqual(
      slots.map((slot) => slot.action),
      ["tail-wag", "ear-perk", "eat-loop", "sleep-loop", "comfort-loop", "celebrate-hop", "health-watch"],
    );
    assert.ok(slots.every((slot) => slot.assetReady));
    assert.ok(slots.every((slot) => slot.expectedPath.includes(`assets/avatar/templates/${templateId}/sprites/`)));
  }
});

test("keeps shepherd preview on the Phoenix benchmark strip registry", () => {
  const asset = getAvatarTemplateSpriteAsset("shepherd", "tail-wag");

  assert.ok(asset);
  assert.equal(asset?.frameWidth, 256);
  assert.equal(asset?.frameHeight, 256);
  assert.equal(asset?.columns, 8);
});
