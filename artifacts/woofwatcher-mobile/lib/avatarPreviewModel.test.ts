import assert from "node:assert/strict";
import test from "node:test";

import { AVATAR_TEMPLATES, createDefaultAvatarConfig } from "./avatarStudio.ts";
import {
  deriveAvatarStudioPreviewPlayback,
  getAvatarStudioMotionPreviewState,
  listAvatarStudioMotionPreviewStates,
  deriveAvatarPreviewAccessories,
  deriveAvatarPreviewMood,
  deriveAvatarPreviewMotion,
} from "./avatarPreviewModel.ts";
import { getAvatarTemplateSpritePreviewByAction } from "./avatarTemplateSpriteAssets.ts";

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
      ["navy-collar", "collar", "Template-fitted"],
      ["birthday-hat", "hat", "Template-fitted"],
      ["sleepy-mask", "mask", "Template-fitted"],
      ["training-vest", "vest", "Template-fitted"],
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
      ["forest-bandana", "inventory-ready", "Pack pending"],
      ["birthday-hat", "inventory-ready", "Pack pending"],
    ],
  );
  assert.match(layers[0]?.fitDetail ?? "", /shared inventory icon/);
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

test("uses live template strips only for non-Phoenix moods the pack actually depicts", () => {
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
    const calm = deriveAvatarPreviewMotion(templateId, "calm");
    const unwell = deriveAvatarPreviewMotion(templateId, "not_feeling_well");

    assert.equal(calm.mode, "sprite");
    assert.equal(calm.label, "Live template sprite pack");
    assert.equal(calm.spriteAction, null);
    assert.equal(unwell.mode, "still");
    assert.match(unwell.label, /still pose/i);
    assert.equal(unwell.spriteAction, null);
  }
});

test("resolves an explicitly requested registered walk strip without relabeling it as a mood", () => {
  const walk = getAvatarTemplateSpritePreviewByAction("retriever", "walk-loop");

  assert.equal(walk?.action, "walk-loop");
  assert.equal(walk?.track.key, "retriever:walk-loop");
  assert.equal(
    getAvatarTemplateSpritePreviewByAction("retriever", "idle-tail-wag")?.action,
    "idle-tail-wag",
  );
});

test("labels an explicit template strip as a manual playback preview instead of a saved mood", () => {
  const playback = deriveAvatarStudioPreviewPlayback(
    "retriever",
    "Scout",
    "not_feeling_well",
    "walk-loop",
  );

  assert.deepEqual(playback, {
    kind: "manual-sprite",
    label: "Retriever walk loop preview",
    detail: "Previewing the registered walk strip. This does not change Scout's care status or saved avatar.",
    accessibilityLabel:
      "Manual Retriever walk loop playback preview. Scout's care status and saved avatar are unchanged.",
    returnLabel: "Return to not feeling well mood",
    returnAccessibilityLabel:
      "Return to Scout's not feeling well mood preview without saving any changes.",
    returnAnnouncement:
      "Returned to Scout's not feeling well mood preview. No avatar changes were saved.",
  });
});

test("keeps the mood preview state free of an unnecessary return control", () => {
  const playback = deriveAvatarStudioPreviewPlayback("retriever", "Scout", "calm", null);

  assert.equal(playback.kind, "mood");
  assert.equal(playback.returnLabel, null);
  assert.equal(playback.returnAccessibilityLabel, null);
  assert.equal(playback.returnAnnouncement, null);
});

test("defines Avatar Studio motion preview states for the living care twin", () => {
  const states = listAvatarStudioMotionPreviewStates();

  assert.deepEqual(
    states.map((state) => [state.id, state.spriteAction, state.templateSpriteAction]),
    [
      ["idle", "idle-breathe", "idle-tail-wag"],
      ["walk", "walk-loop", "walk-loop"],
      ["meal", "eat-loop", null],
      ["water", "drink-loop", null],
      ["rest", "sleep-loop", null],
      ["comfort", "comfort-loop", null],
      ["health", "health-watch", null],
      ["celebrate", "celebrate-hop", null],
    ],
  );

  assert.equal(getAvatarStudioMotionPreviewState("walk").emote, "excited");
  assert.equal(getAvatarStudioMotionPreviewState("meal").statusLabel, "Bowl state");
  assert.match(
    getAvatarStudioMotionPreviewState("meal").accessibilityLabel,
    /meal state/i,
  );
  assert.match(
    getAvatarStudioMotionPreviewState("health").accessibilityLabel,
    /health watch state/i,
  );
});
