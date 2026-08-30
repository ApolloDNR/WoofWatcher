import assert from "node:assert/strict";
import test from "node:test";

import { AVATAR_TEMPLATES, createDefaultAvatarConfig } from "./avatarStudio.ts";
import {
  getAvatarStudioMotionPreviewState,
  listAvatarStudioMotionPreviewStates,
  deriveAvatarPreviewAccessories,
  deriveAvatarPreviewMood,
  deriveAvatarPreviewMotion,
} from "./avatarPreviewModel.ts";

test("derives layered preview accessories from configured slots", () => {
  const config = createDefaultAvatarConfig("Phoenix");

  const layers = deriveAvatarPreviewAccessories(config);

  assert.deepEqual(
    layers.map((layer) => [layer.id, layer.kind, layer.slot, layer.fitStatus]),
    [
      ["forest-bandana", "bandana", "neck", "template-fitted"],
      ["cozy-bed", "bed", "room", "template-fitted"],
      ["heart-sparkles", "sparkles", "fx", "template-fitted"],
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
    layers.map((layer) => [layer.id, layer.kind, layer.fitLabel]),
    [
      ["navy-collar", "collar", "Tailored fit"],
      ["birthday-hat", "hat", "Tailored fit"],
      ["sleepy-mask", "mask", "Tailored fit"],
      ["training-vest", "vest", "Tailored fit"],
    ],
  );
});

test("marks accessories without a template overlay as inventory-ready for non-shepherd templates", () => {
  const config = {
    ...createDefaultAvatarConfig("Scout"),
    templateId: "retriever" as const,
    accessorySlots: {
      neck: "forest-bandana",
      head: "birthday-hat",
    },
  };

  const layers = deriveAvatarPreviewAccessories(config);

  assert.deepEqual(
    layers.map((layer) => [layer.id, layer.fitStatus, layer.fitLabel]),
    [
      ["forest-bandana", "inventory-ready", "Standard preview"],
      ["birthday-hat", "inventory-ready", "Standard preview"],
    ],
  );
  assert.match(layers[0]?.fitDetail ?? "", /standard Retriever preview/);
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

test("uses the live Phoenix sprite pack for shepherd mood previews", () => {
  const motion = deriveAvatarPreviewMotion("shepherd", "excited");

  assert.equal(motion.mode, "sprite");
  assert.equal(motion.label, "Animated Phoenix pack");
  assert.equal(motion.spriteAction, "celebrate-hop");
});

test("uses live template sprite packs for completed launch breed previews", () => {
  const motion = deriveAvatarPreviewMotion("retriever", "calm");

  assert.equal(motion.mode, "sprite");
  assert.equal(motion.label, "Live template sprite pack");
  assert.equal(motion.spriteAction, null);
});

test("uses live template sprite packs for every non-Phoenix launch template", () => {
  const liveTemplateIds = AVATAR_TEMPLATES.map((template) => template.id).filter(
    (templateId) => templateId !== "shepherd",
  );

  assert.deepEqual(liveTemplateIds, [
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
  ]);

  for (const templateId of liveTemplateIds) {
    const motion = deriveAvatarPreviewMotion(templateId, "calm");

    assert.equal(motion.mode, "sprite");
    assert.equal(motion.label, "Live template sprite pack");
    assert.equal(motion.spriteAction, null);
  }
});

test("defines Avatar Studio motion preview states for the living care twin", () => {
  const states = listAvatarStudioMotionPreviewStates();

  assert.deepEqual(
    states.map((state) => [state.id, state.spriteAction, state.templateSpriteAction]),
    [
      ["idle", "idle-breathe", "idle-tail-wag"],
      ["walk", "walk-loop", "walk-loop"],
      ["meal", "eat-loop", "idle-tail-wag"],
      ["water", "drink-loop", "idle-tail-wag"],
      ["rest", "sleep-loop", "idle-tail-wag"],
      ["comfort", "comfort-loop", "idle-tail-wag"],
      ["health", "health-watch", "idle-tail-wag"],
      ["celebrate", "celebrate-hop", "walk-loop"],
    ],
  );

  assert.equal(getAvatarStudioMotionPreviewState("walk").emote, "excited");
  assert.equal(getAvatarStudioMotionPreviewState("meal").statusLabel, "Bowl loop");
  assert.match(
    getAvatarStudioMotionPreviewState("health").accessibilityLabel,
    /health watch animation/i,
  );
});
