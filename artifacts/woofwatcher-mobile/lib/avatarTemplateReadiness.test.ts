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
  assert.equal(readiness.previewLabel, "Animated Phoenix pack");
  assert.equal(readiness.stageLabel, "Animated pack ready");
  assert.equal(readiness.stageDetail, "Overlays, moods, and sprite preview are live.");
  assert.equal(readiness.accessoryStatus, "7/10 live overlays");
  assert.equal(readiness.emoteStatus, "10/10 live moods");
});

test("marks the next family-dog wave as partial packs before animation", () => {
  const readiness = getAvatarTemplateReadiness("retriever");
  const pack = getAvatarTemplatePack("retriever");

  assert.equal(readiness.hasBaseArt, true);
  assert.equal(readiness.packStage, "art-partial");
  assert.equal(readiness.liveAccessoryCount, 8);
  assert.equal(readiness.totalAccessoryCount, 10);
  assert.equal(readiness.liveEmoteCount, 7);
  assert.equal(readiness.totalEmoteCount, 10);
  assert.equal(readiness.hasAnimatedPreview, false);
  assert.equal(readiness.previewLabel, "Starter still preview");
  assert.equal(readiness.stageLabel, "Art pack in progress");
  assert.equal(readiness.stageDetail, "Some overlays or moods are live; sprite strips are still finishing.");
  assert.equal(readiness.accessoryStatus, "8/10 live overlays");
  assert.equal(readiness.emoteStatus, "7/10 live moods");
  assert.equal(pack.productionFocus, "next");
  assert.equal(pack.focusLabel, "Partial pack live");
});

test("applies the same partial-pack contract to husky and doodle", () => {
  for (const templateId of ["husky", "doodle"] as const) {
    const readiness = getAvatarTemplateReadiness(templateId);
    const pack = getAvatarTemplatePack(templateId);

    assert.equal(readiness.packStage, "art-partial");
    assert.equal(readiness.liveAccessoryCount, 8);
    assert.equal(readiness.liveEmoteCount, 7);
    assert.equal(readiness.hasAnimatedPreview, false);
    assert.equal(pack.productionFocus, "next");
    assert.equal(pack.focusLabel, "Partial pack live");
  }
});

test("derives explicit live and pending production lists for partial packs", () => {
  const readiness = getAvatarTemplateReadiness("retriever");

  assert.deepEqual(readiness.liveAccessoryIds, [
    "forest-bandana",
    "navy-collar",
    "copper-collar",
    "heart-tag",
    "trail-bandana",
    "birthday-hat",
    "cozy-bed",
    "heart-sparkles",
  ]);
  assert.deepEqual(readiness.pendingAccessoryIds, ["sleepy-mask", "training-vest"]);
  assert.deepEqual(readiness.liveEmoteIds, [
    "happy",
    "calm",
    "excited",
    "sleepy",
    "proud",
    "home_alone",
    "not_feeling_well",
  ]);
  assert.deepEqual(readiness.pendingEmoteIds, ["bored", "hungry", "anxious"]);
  assert.equal(readiness.packSummaryLabel, "Production now");
  assert.equal(readiness.nextPackLabel, "Next pack");
});

test("distinguishes live accessory and emote slots from pending ones", () => {
  assert.equal(isAvatarTemplateAccessoryLive("shepherd", "forest-bandana"), true);
  assert.equal(isAvatarTemplateAccessoryLive("shepherd", "trail-bandana"), false);
  assert.equal(isAvatarTemplateAccessoryLive("retriever", "forest-bandana"), true);
  assert.equal(isAvatarTemplateAccessoryLive("retriever", "sleepy-mask"), false);
  assert.equal(isAvatarTemplateEmoteLive("shepherd", "happy"), true);
  assert.equal(isAvatarTemplateEmoteLive("retriever", "happy"), true);
  assert.equal(isAvatarTemplateEmoteLive("retriever", "anxious"), false);
});
