import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AVATAR_ACCESSORIES,
  AVATAR_EMOTE_STATES,
  AVATAR_TEMPLATES,
  buildMockScanSuggestion,
  createDefaultAvatarConfig,
  describeAvatarConfig,
  normalizeAvatarConfig,
} from "./avatarStudio.ts";

test("defines the launch template library for scan-assisted dog avatars", () => {
  const ids = AVATAR_TEMPLATES.map((template) => template.id);

  assert.deepEqual(ids, [
    "shepherd",
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
  assert.ok(AVATAR_TEMPLATES.every((template) => template.anchorNotes.includes("anchor") || template.anchorNotes.includes("Bottom-center")));
});

test("keeps avatar customization as slots instead of loose stickers", () => {
  const slots = new Set(AVATAR_ACCESSORIES.map((item) => item.slot));

  assert.ok(slots.has("neck"));
  assert.ok(slots.has("head"));
  assert.ok(slots.has("face"));
  assert.ok(slots.has("body"));
  assert.ok(slots.has("room"));
  assert.ok(slots.has("fx"));
  assert.ok(AVATAR_ACCESSORIES.some((item) => item.launchTier === "plus-ready"));
});

test("creates and normalizes a Phoenix-first avatar config", () => {
  const config = createDefaultAvatarConfig("Phoenix", "2026-06-17T12:00:00.000Z");
  const normalized = normalizeAvatarConfig(
    {
      ...config,
      templateId: "not-real",
      earTypeId: "not-real",
      accessorySlots: { head: "birthday-hat" },
    },
    "Phoenix",
  );

  assert.equal(config.templateId, "shepherd");
  assert.equal(config.emotePackId, "phoenix-shepherd");
  assert.equal(normalized.templateId, "shepherd");
  assert.equal(normalized.earTypeId, "tall");
  assert.equal(normalized.accessorySlots.head, "birthday-hat");
  assert.equal(normalized.accessorySlots.neck, "forest-bandana");
});

test("keeps scan-assisted copy truthful and owner-approved", () => {
  const suggestion = buildMockScanSuggestion("Phoenix", "2026-06-17T12:00:00.000Z");

  assert.equal(suggestion.templateId, "shepherd");
  assert.equal(suggestion.confidence, "high");
  assert.equal(suggestion.suggestedConfig.scanAssisted, true);
  assert.match(suggestion.copy, /suggest/i);
  assert.match(suggestion.copy, /approve/i);
  assert.doesNotMatch(suggestion.copy, /perfect/i);
  assert.doesNotMatch(suggestion.copy, /instantly/i);
});

test("documents the first emote state set for the living care twin", () => {
  assert.deepEqual(AVATAR_EMOTE_STATES, [
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

  assert.match(describeAvatarConfig(createDefaultAvatarConfig("Phoenix")), /Shepherd/);
  assert.match(describeAvatarConfig(createDefaultAvatarConfig("Phoenix")), /template-built/);
});
