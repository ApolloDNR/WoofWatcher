import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AVATAR_ACCESSORIES,
  AVATAR_EMOTE_STATES,
  AVATAR_TEMPLATES,
  createDefaultAvatarConfig,
  deriveAvatarAccessoryFit,
  describeAvatarConfig,
  hasManualAvatarConfiguration,
  normalizeAvatarConfig,
  summarizeAvatarAccessoryFits,
} from "./avatarStudio.ts";

test("defines the launch template library for manual dog avatars", () => {
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

test("drops legacy scan metadata while preserving every real manual v1 field", () => {
  const legacyJson = JSON.stringify({
    version: 1,
    petName: "Scout",
    templateId: "retriever",
    style: "pixel",
    coatPrimary: "#5B412F",
    coatSecondary: "#F1E2C7",
    faceMarkingId: "blaze",
    earTypeId: "floppy",
    muzzleTypeId: "long",
    eyeColor: "#4F6B5E",
    collarId: "navy-collar",
    tagId: "bone",
    bandanaId: "sage-bandana",
    accessorySlots: {
      head: "birthday-hat",
      neck: "navy-collar",
      room: "cozy-bed",
      fx: "heart-sparkles",
    },
    emotePackId: "retriever-starter",
    scanAssisted: true,
    updatedAt: "2026-08-01T12:00:00.000Z",
  });

  const clean = normalizeAvatarConfig(JSON.parse(legacyJson), "Phoenix");
  assert.equal("scanAssisted" in clean, false);
  assert.deepEqual(
    {
      version: clean.version,
      petName: clean.petName,
      templateId: clean.templateId,
      coatPrimary: clean.coatPrimary,
      coatSecondary: clean.coatSecondary,
      faceMarkingId: clean.faceMarkingId,
      earTypeId: clean.earTypeId,
      muzzleTypeId: clean.muzzleTypeId,
      eyeColor: clean.eyeColor,
      collarId: clean.collarId,
      tagId: clean.tagId,
      bandanaId: clean.bandanaId,
      accessorySlots: clean.accessorySlots,
      emotePackId: clean.emotePackId,
      updatedAt: clean.updatedAt,
    },
    {
      version: 1,
      petName: "Scout",
      templateId: "retriever",
      coatPrimary: "#5B412F",
      coatSecondary: "#F1E2C7",
      faceMarkingId: "blaze",
      earTypeId: "floppy",
      muzzleTypeId: "long",
      eyeColor: "#4F6B5E",
      collarId: "navy-collar",
      tagId: "bone",
      bandanaId: "sage-bandana",
      accessorySlots: {
        neck: "navy-collar",
        room: "cozy-bed",
        fx: "heart-sparkles",
        head: "birthday-hat",
      },
      emotePackId: "retriever-starter",
      updatedAt: "2026-08-01T12:00:00.000Z",
    },
  );

  const nextSaveJson = JSON.stringify({ ...clean, updatedAt: "2026-08-02T12:00:00.000Z" });
  const resetJson = JSON.stringify(createDefaultAvatarConfig("Scout", "2026-08-02T12:00:00.000Z"));
  assert.equal(nextSaveJson.includes('"scanAssisted"'), false);
  assert.equal(resetJson.includes('"scanAssisted"'), false);
});

test("derives configured state only from manual avatar choices", () => {
  const base = createDefaultAvatarConfig("Phoenix", "2026-08-01T00:00:00.000Z");
  assert.equal(hasManualAvatarConfiguration(base), false);
  assert.equal(hasManualAvatarConfiguration({ ...base, petName: "Renamed dog", updatedAt: "2026-08-02T00:00:00.000Z" }), false);

  const fieldChanges = [
    { templateId: "retriever" as const }, { coatPrimary: "#FFFFFF" }, { coatSecondary: "#FFFFFF" },
    { faceMarkingId: "blaze" as const }, { earTypeId: "floppy" as const }, { muzzleTypeId: "light" as const },
    { eyeColor: "#4F6B5E" }, { collarId: "navy-collar" as const }, { tagId: "bone" as const },
    { bandanaId: "sage-bandana" as const }, { emotePackId: "starter-care-twin" as const },
  ];
  for (const patch of fieldChanges) assert.equal(hasManualAvatarConfiguration({ ...base, ...patch }), true);
  for (const slot of ["head", "face", "neck", "body", "room", "fx"] as const) {
    assert.equal(hasManualAvatarConfiguration({ ...base, accessorySlots: { ...base.accessorySlots, [slot]: `manual-${slot}` } }), true);
  }

  const legacyDefault = normalizeAvatarConfig({ ...base, scanAssisted: true }, "Phoenix");
  const legacyManual = normalizeAvatarConfig({ ...base, templateId: "retriever", scanAssisted: true }, "Phoenix");
  assert.equal(hasManualAvatarConfiguration(legacyDefault), false);
  assert.equal(hasManualAvatarConfiguration(legacyManual), true);
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
  assert.match(spriteAssets, /key: "shepherd:storybook-idle-tail-wag"/);
  assert.match(spriteAssets, /key: "shepherd:storybook-walk-loop"/);
  assert.match(spriteAssets, /assets\/avatar\/phoenix\/storybook\/storybook-idle-tail-wag-strip\.png/);
  assert.match(
    spriteAssets,
    /assets\/avatar\/phoenix\/storybook\/storybook-walk-loop-v3-hard-pixel-strip\.png/,
  );
  assert.match(spriteAssets, /Storybook board-matched shepherd/);
});
