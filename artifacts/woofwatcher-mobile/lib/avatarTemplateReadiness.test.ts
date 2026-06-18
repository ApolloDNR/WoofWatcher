import assert from "node:assert/strict";
import test from "node:test";

import { getAvatarTemplateReadiness } from "./avatarTemplateReadiness.ts";

test("reports the full live shepherd production pack", () => {
  const readiness = getAvatarTemplateReadiness("shepherd");

  assert.equal(readiness.hasBaseArt, true);
  assert.equal(readiness.liveAccessoryCount, 7);
  assert.equal(readiness.totalAccessoryCount, 10);
  assert.equal(readiness.liveEmoteCount, 10);
  assert.equal(readiness.totalEmoteCount, 10);
  assert.equal(readiness.hasAnimatedPreview, true);
  assert.equal(readiness.previewLabel, "Animated Phoenix pack");
  assert.equal(readiness.accessoryStatus, "7/10 live overlays");
  assert.equal(readiness.emoteStatus, "10/10 live moods");
});

test("keeps unfinished templates explicit about pending production art", () => {
  const readiness = getAvatarTemplateReadiness("retriever");

  assert.equal(readiness.hasBaseArt, true);
  assert.equal(readiness.liveAccessoryCount, 0);
  assert.equal(readiness.totalAccessoryCount, 10);
  assert.equal(readiness.liveEmoteCount, 0);
  assert.equal(readiness.totalEmoteCount, 10);
  assert.equal(readiness.hasAnimatedPreview, false);
  assert.equal(readiness.previewLabel, "Starter still preview");
  assert.equal(readiness.accessoryStatus, "Production overlays pending");
  assert.equal(readiness.emoteStatus, "Production moods pending");
});
