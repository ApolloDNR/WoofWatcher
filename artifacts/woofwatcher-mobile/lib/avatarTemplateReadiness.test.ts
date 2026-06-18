import assert from "node:assert/strict";
import test from "node:test";

import {
  getAvatarTemplateReadiness,
  isAvatarTemplateAccessoryLive,
  isAvatarTemplateEmoteLive,
} from "./avatarTemplateReadiness.ts";

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

test("keeps unfinished templates explicit about pending production art", () => {
  const readiness = getAvatarTemplateReadiness("retriever");

  assert.equal(readiness.hasBaseArt, true);
  assert.equal(readiness.packStage, "base");
  assert.equal(readiness.liveAccessoryCount, 0);
  assert.equal(readiness.totalAccessoryCount, 10);
  assert.equal(readiness.liveEmoteCount, 0);
  assert.equal(readiness.totalEmoteCount, 10);
  assert.equal(readiness.hasAnimatedPreview, false);
  assert.equal(readiness.previewLabel, "Starter still preview");
  assert.equal(readiness.stageLabel, "Base art live");
  assert.equal(readiness.stageDetail, "Base pose is live; overlays, moods, and sprite strips are still pending.");
  assert.equal(readiness.accessoryStatus, "Production overlays pending");
  assert.equal(readiness.emoteStatus, "Production moods pending");
});

test("distinguishes live accessory and emote slots from pending ones", () => {
  assert.equal(isAvatarTemplateAccessoryLive("shepherd", "forest-bandana"), true);
  assert.equal(isAvatarTemplateAccessoryLive("shepherd", "trail-bandana"), false);
  assert.equal(isAvatarTemplateAccessoryLive("retriever", "forest-bandana"), false);
  assert.equal(isAvatarTemplateEmoteLive("shepherd", "happy"), true);
  assert.equal(isAvatarTemplateEmoteLive("retriever", "happy"), false);
});
