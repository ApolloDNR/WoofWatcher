import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultAvatarConfig } from "./avatarStudio.ts";
import { deriveAvatarPreviewAccessories, deriveAvatarPreviewMood } from "./avatarPreviewModel.ts";

test("derives layered preview accessories from configured slots", () => {
  const config = createDefaultAvatarConfig("Phoenix");

  const layers = deriveAvatarPreviewAccessories(config);

  assert.deepEqual(
    layers.map((layer) => [layer.id, layer.kind, layer.slot]),
    [
      ["forest-bandana", "bandana", "neck"],
      ["cozy-bed", "bed", "room"],
      ["heart-sparkles", "sparkles", "fx"],
    ],
  );
});

test("maps accessory ids to visual overlay kinds", () => {
  const config = {
    ...createDefaultAvatarConfig("Phoenix"),
    accessorySlots: {
      head: "birthday-hat",
      face: "sleepy-mask",
      body: "training-vest",
      neck: "navy-collar",
    },
  };

  const layers = deriveAvatarPreviewAccessories(config);

  assert.deepEqual(
    layers.map((layer) => [layer.id, layer.kind]),
    [
      ["navy-collar", "collar"],
      ["birthday-hat", "hat"],
      ["sleepy-mask", "mask"],
      ["training-vest", "vest"],
    ],
  );
});

test("derives preview mood copy and colors", () => {
  assert.deepEqual(deriveAvatarPreviewMood("sleepy"), {
    auraColor: "rgba(109,163,111,0.16)",
    chipColor: "#6DA36F",
    copy: "Ready for rest.",
  });
  assert.deepEqual(deriveAvatarPreviewMood("home_alone"), {
    auraColor: "rgba(168,203,232,0.2)",
    chipColor: "#7DA4C7",
    copy: "Waiting by the door.",
  });
});
