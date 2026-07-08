import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AVATAR_ACCESSORIES,
  AVATAR_EMOTE_STATES,
  AVATAR_SCAN_WORKFLOW_STEPS,
  AVATAR_TEMPLATES,
  buildTemplateScanSuggestion,
  createDefaultAvatarConfig,
  deriveAvatarAccessoryFit,
  describeAvatarConfig,
  normalizeAvatarConfig,
  summarizeAvatarAccessoryFits,
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
  const accessoryAssets = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "avatarAccessoryAssets.ts"),
    "utf8",
  );

  assert.ok(slots.has("neck"));
  assert.ok(slots.has("head"));
  assert.ok(slots.has("face"));
  assert.ok(slots.has("body"));
  assert.ok(slots.has("room"));
  assert.ok(slots.has("fx"));
  assert.ok(AVATAR_ACCESSORIES.some((item) => item.launchTier === "plus-ready"));
  for (const item of AVATAR_ACCESSORIES) {
    assert.match(accessoryAssets, new RegExp(`"${item.id}":[\\s\\S]*slot: "${item.slot}"`));
  }
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
  assert.equal(AVATAR_TEMPLATES.find((template) => template.id === "retriever")?.recommendedEmotePackId, "retriever-starter");
  assert.equal(AVATAR_TEMPLATES.find((template) => template.id === "husky")?.recommendedEmotePackId, "husky-starter");
  assert.equal(AVATAR_TEMPLATES.find((template) => template.id === "bully")?.recommendedEmotePackId, "bully-starter");
  assert.equal(normalized.templateId, "shepherd");
  assert.equal(normalized.earTypeId, "tall");
  assert.equal(normalized.accessorySlots.head, "birthday-hat");
  assert.equal(normalized.accessorySlots.neck, "forest-bandana");
  assert.equal(normalizeAvatarConfig({ templateId: "retriever", emotePackId: "retriever-starter" }, "Scout").emotePackId, "retriever-starter");
  assert.equal(normalizeAvatarConfig({ templateId: "husky", emotePackId: "husky-starter" }, "Nova").emotePackId, "husky-starter");
  assert.equal(normalizeAvatarConfig({ templateId: "bully", emotePackId: "bully-starter" }, "Tank").emotePackId, "bully-starter");
});

test("keeps template-scan copy truthful and owner-approved", () => {
  const suggestion = buildTemplateScanSuggestion("Phoenix", "2026-06-17T12:00:00.000Z");

  assert.equal(suggestion.templateId, "shepherd");
  assert.equal(suggestion.confidence, "high");
  assert.equal(suggestion.suggestedConfig.scanAssisted, true);
  assert.match(suggestion.copy, /suggest/i);
  assert.match(suggestion.copy, /approve/i);
  assert.doesNotMatch(suggestion.copy, /perfect/i);
  assert.doesNotMatch(suggestion.copy, /instantly/i);
});

test("tracks which accessories are template-fitted versus inventory-ready", () => {
  const forestBandana = AVATAR_ACCESSORIES.find((item) => item.id === "forest-bandana");
  const copperCollar = AVATAR_ACCESSORIES.find((item) => item.id === "copper-collar");

  assert.ok(forestBandana);
  assert.ok(copperCollar);

  const fitted = deriveAvatarAccessoryFit("shepherd", forestBandana);
  const pending = deriveAvatarAccessoryFit("shepherd", copperCollar);

  assert.equal(fitted.status, "template-fitted");
  assert.equal(fitted.label, "Template-fitted");
  assert.match(fitted.detail, /PixelLab Shepherd overlay/);
  assert.match(fitted.placementHint, /neck/i);
  assert.equal(fitted.needsDeviceQa, true);

  assert.equal(pending.status, "inventory-ready");
  assert.equal(pending.label, "Pack pending");
  assert.match(pending.detail, /shared inventory icon/);
  assert.match(pending.detail, /template overlay pack ships/);

  assert.equal(
    summarizeAvatarAccessoryFits("shepherd"),
    "7/10 accessories template-fitted for Shepherd; 3 stay inventory-ready until their template overlay pack ships.",
  );
  assert.equal(
    summarizeAvatarAccessoryFits("retriever"),
    "0/10 accessories template-fitted for Retriever; 10 stay inventory-ready until their template overlay pack ships.",
  );
});

test("documents the scan-to-pixel workflow as owner-approved template matching", () => {
  assert.deepEqual(
    AVATAR_SCAN_WORKFLOW_STEPS.map((step) => step.id),
    ["photo-reference", "template-match", "pixel-twin", "owner-approval"],
  );
  assert.ok(AVATAR_SCAN_WORKFLOW_STEPS.every((step) => step.label && step.detail));
  assert.match(AVATAR_SCAN_WORKFLOW_STEPS.map((step) => step.detail).join(" "), /PixelLab/i);
  assert.match(AVATAR_SCAN_WORKFLOW_STEPS.map((step) => step.detail).join(" "), /owner approval/i);
  assert.doesNotMatch(AVATAR_SCAN_WORKFLOW_STEPS.map((step) => step.detail).join(" "), /live AI/i);
  assert.doesNotMatch(AVATAR_SCAN_WORKFLOW_STEPS.map((step) => step.detail).join(" "), /photo filter/i);
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

test("keeps Phoenix's shepherd template live in Avatar Studio", () => {
  const spriteAssets = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "avatarTemplateSpriteAssets.ts"),
    "utf8",
  );

  assert.match(spriteAssets, /shepherd: \{/);
  assert.match(spriteAssets, /key: "shepherd:option-b-idle-tail-wag"/);
  assert.match(spriteAssets, /key: "shepherd:option-b-walk-loop"/);
  assert.match(spriteAssets, /assets\/avatar\/phoenix\/storybook\/storybook-idle-tail-wag-strip\.png/);
  assert.match(spriteAssets, /assets\/avatar\/phoenix\/storybook\/storybook-walk-loop-strip\.png/);
  assert.match(spriteAssets, /Approved Option B Phoenix/);
});
