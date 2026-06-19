import assert from "node:assert/strict";
import test from "node:test";

import {
  getAvatarTemplateReadiness,
  isAvatarTemplateAccessoryLive,
  isAvatarTemplateEmoteLive,
} from "./avatarTemplateReadiness.ts";
import { getAvatarTemplatePack } from "./avatarTemplatePackManifest.ts";

test("reports the full live shepherd production pack", () => {
  const readiness = getAvatarTemplateReadiness("shepherd");

  assert.equal(readiness.hasBaseArt, true);
  assert.equal(readiness.packStage, "animated");
  assert.equal(readiness.liveAccessoryCount, 7);
  assert.equal(readiness.totalAccessoryCount, 10);
  assert.equal(readiness.liveEmoteCount, 10);
  assert.equal(readiness.totalEmoteCount, 10);
  assert.equal(readiness.hasAnimatedPreview, true);
  assert.equal(readiness.previewLabel, "Animated care twin pack");
  assert.equal(readiness.stageLabel, "Animated pack ready");
  assert.equal(readiness.stageDetail, "Overlays, moods, and sprite preview are live.");
  assert.equal(readiness.accessoryStatus, "7/10 live overlays");
  assert.equal(readiness.emoteStatus, "10/10 live moods");
});

test("marks retriever as a full animated launch pack", () => {
  const readiness = getAvatarTemplateReadiness("retriever");
  const pack = getAvatarTemplatePack("retriever");

  assert.equal(readiness.hasBaseArt, true);
  assert.equal(readiness.packStage, "animated");
  assert.equal(readiness.liveAccessoryCount, 10);
  assert.equal(readiness.totalAccessoryCount, 10);
  assert.equal(readiness.liveEmoteCount, 10);
  assert.equal(readiness.totalEmoteCount, 10);
  assert.equal(readiness.hasAnimatedPreview, true);
  assert.equal(readiness.previewLabel, "Animated care twin pack");
  assert.equal(readiness.stageLabel, "Animated pack ready");
  assert.equal(readiness.stageDetail, "Overlays, moods, and sprite preview are live.");
  assert.equal(readiness.accessoryStatus, "10/10 live overlays");
  assert.equal(readiness.emoteStatus, "10/10 live moods");
  assert.equal(pack.productionFocus, "live");
  assert.equal(pack.focusLabel, "Animated launch pack live");
});

test("applies the same animated launch-pack contract to every non-shepherd launch template", () => {
  for (const templateId of [
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
    const readiness = getAvatarTemplateReadiness(templateId);
    const pack = getAvatarTemplatePack(templateId);

    assert.equal(readiness.packStage, "animated");
    assert.equal(readiness.liveAccessoryCount, 10);
    assert.equal(readiness.liveEmoteCount, 10);
    assert.equal(readiness.hasAnimatedPreview, true);
    assert.equal(pack.productionFocus, "live");
    assert.equal(pack.focusLabel, "Animated launch pack live");
  }
});

test("derives explicit live production lists for the animated launch packs", () => {
  const readiness = getAvatarTemplateReadiness("retriever");

  assert.deepEqual(readiness.liveAccessoryIds, [
    "forest-bandana",
    "navy-collar",
    "copper-collar",
    "heart-tag",
    "trail-bandana",
    "birthday-hat",
    "sleepy-mask",
    "training-vest",
    "cozy-bed",
    "heart-sparkles",
  ]);
  assert.deepEqual(readiness.pendingAccessoryIds, []);
  assert.deepEqual(readiness.liveEmoteIds, [
    "happy",
    "calm",
    "excited",
    "bored",
    "hungry",
    "anxious",
    "sleepy",
    "proud",
    "home_alone",
    "not_feeling_well",
  ]);
  assert.deepEqual(readiness.pendingEmoteIds, []);
  assert.equal(readiness.packSummaryLabel, "Production now");
  assert.equal(readiness.nextPackLabel, "Next pack");
});

test("distinguishes live accessory and emote slots from pending ones", () => {
  assert.equal(isAvatarTemplateAccessoryLive("shepherd", "forest-bandana"), true);
  assert.equal(isAvatarTemplateAccessoryLive("shepherd", "trail-bandana"), false);
  assert.equal(isAvatarTemplateAccessoryLive("retriever", "forest-bandana"), true);
  assert.equal(isAvatarTemplateAccessoryLive("retriever", "sleepy-mask"), true);
  assert.equal(isAvatarTemplateAccessoryLive("bully", "trail-bandana"), true);
  assert.equal(isAvatarTemplateEmoteLive("shepherd", "happy"), true);
  assert.equal(isAvatarTemplateEmoteLive("retriever", "happy"), true);
  assert.equal(isAvatarTemplateEmoteLive("retriever", "anxious"), true);
  assert.equal(isAvatarTemplateEmoteLive("mixed", "home_alone"), true);
});
