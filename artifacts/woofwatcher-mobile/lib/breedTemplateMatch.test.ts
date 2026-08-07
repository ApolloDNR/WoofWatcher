import { test } from "node:test";
import assert from "node:assert/strict";

import { createDefaultAvatarConfig, getAvatarTemplate } from "./avatarStudio.ts";
import {
  applyBreedTemplateToAvatarConfig,
  deriveSetupTwinPlan,
  matchBreedToTemplate,
} from "./breedTemplateMatch.ts";

test("maps the audit's keyword examples to the expected templates", () => {
  const cases: [string, string][] = [
    ["Golden", "retriever"],
    ["Lab", "retriever"],
    ["Labrador Retriever", "retriever"],
    ["Chihuahua", "toy"],
    ["Poodle", "doodle"],
    ["Goldendoodle", "doodle"],
    ["Labradoodle", "doodle"],
    ["Greyhound", "slender"],
    ["Whippet", "slender"],
    ["Beagle", "hound"],
    ["Pit bull", "bully"],
    ["Bulldog", "bully"],
    ["Staffy", "bully"],
    ["Yorkie", "terrier"],
    ["Miniature Schnauzer", "terrier"],
    ["Rat Terrier", "terrier"],
    ["Wiener dog", "dachshund"],
    ["Doxie", "dachshund"],
    ["Dachshund", "dachshund"],
    ["Husky", "husky"],
    ["Alaskan Malamute", "husky"],
    ["Japanese Spitz", "husky"],
    ["German Shepherd", "shepherd"],
    ["GSD", "shepherd"],
    ["Alsatian", "shepherd"],
    ["Cocker Spaniel", "spaniel"],
  ];

  for (const [input, expected] of cases) {
    const match = matchBreedToTemplate(input);
    assert.equal(match.templateId, expected, `${input} should map to ${expected}`);
    assert.equal(match.source, "keyword", `${input} should be a keyword match`);
    assert.equal(match.templateLabel, getAvatarTemplate(match.templateId).label);
  }
});

test("keeps keyword matching case- and punctuation-insensitive", () => {
  assert.equal(matchBreedToTemplate("  dAcHsHuNd!! ").templateId, "dachshund");
  assert.equal(matchBreedToTemplate("German-Shepherd").templateId, "shepherd");
  assert.equal(matchBreedToTemplate("Shih-Tzu").templateId, "toy");
});

test("orders rules so compound breed names beat their parent keywords", () => {
  // doodle before retriever/shepherd
  assert.equal(matchBreedToTemplate("Labradoodle mix").templateId, "doodle");
  assert.equal(matchBreedToTemplate("Sheepadoodle").templateId, "doodle");
  // sighthounds before the generic hound keyword
  assert.equal(matchBreedToTemplate("Italian Greyhound").templateId, "slender");
  assert.equal(matchBreedToTemplate("Irish Wolfhound").templateId, "slender");
  assert.equal(matchBreedToTemplate("Bloodhound").templateId, "hound");
  // bully-type terriers before the generic terrier keyword
  assert.equal(matchBreedToTemplate("Staffordshire Terrier").templateId, "bully");
  assert.equal(matchBreedToTemplate("Bull Terrier").templateId, "bully");
  assert.equal(matchBreedToTemplate("Boston Terrier").templateId, "bully");
  // "pit" needs a word boundary so spitz breeds stay husky
  assert.equal(matchBreedToTemplate("Finnish Spitz").templateId, "husky");
  // breed keyword wins over the trailing "mix" keyword
  assert.equal(matchBreedToTemplate("German Shepherd mix").templateId, "shepherd");
  assert.equal(matchBreedToTemplate("Dachshund mix").templateId, "dachshund");
});

test("falls back to the mixed template for unknown or mixed breeds", () => {
  const mutt = matchBreedToTemplate("Heinz 57 mutt");
  assert.equal(mutt.templateId, "mixed");
  assert.equal(mutt.source, "keyword");

  const unknown = matchBreedToTemplate("Bergamasco");
  assert.equal(unknown.templateId, "mixed");
  assert.equal(unknown.source, "fallback");
  assert.equal(unknown.matchedKeyword, null);

  const blank = matchBreedToTemplate("   ");
  assert.equal(blank.templateId, "mixed");
  assert.equal(blank.source, "fallback");
});

test("plans a template swap for a default shepherd with the toggle on", () => {
  const plan = deriveSetupTwinPlan({
    breed: "Dachshund",
    dogName: "Noodle",
    currentTemplateId: "shepherd",
    hasConfiguredAvatar: false,
    matchTwinToBreed: true,
  });

  assert.equal(plan.swapAvailable, true);
  assert.equal(plan.willSwapTemplate, true);
  assert.equal(plan.resultTemplateId, "dachshund");
  assert.equal(plan.resultTemplateLabel, "Dachshund");
  assert.equal(plan.previewLine, "Twin: Dachshund - change anytime in Avatar Studio.");
  assert.equal(plan.successLine, "Noodle's twin is ready - a Dachshund.");
});

test("never overrides an avatar the owner customized in Avatar Studio", () => {
  const plan = deriveSetupTwinPlan({
    breed: "Dachshund",
    dogName: "Noodle",
    currentTemplateId: "husky",
    hasConfiguredAvatar: true,
    matchTwinToBreed: true,
  });

  assert.equal(plan.swapAvailable, false);
  assert.equal(plan.willSwapTemplate, false);
  assert.equal(plan.resultTemplateId, "husky");
  assert.equal(plan.previewLine, "Twin: Husky / Spitz - your Avatar Studio pick stays.");
  assert.equal(plan.successLine, "Noodle's twin is ready - a Husky / Spitz.");
});

test("respects the confirm toggle when the owner turns breed matching off", () => {
  const plan = deriveSetupTwinPlan({
    breed: "Beagle",
    dogName: "Scout",
    currentTemplateId: "shepherd",
    hasConfiguredAvatar: false,
    matchTwinToBreed: false,
  });

  assert.equal(plan.swapAvailable, true);
  assert.equal(plan.willSwapTemplate, false);
  assert.equal(plan.resultTemplateId, "shepherd");
  assert.equal(plan.previewLine, "Twin: Shepherd - change in Avatar Studio.");
  assert.equal(plan.successLine, "Scout's twin is ready - a Shepherd.");
});

test("does not swap on a blank breed or when the match equals the current template", () => {
  const blank = deriveSetupTwinPlan({
    breed: "  ",
    dogName: "Phoenix",
    currentTemplateId: "shepherd",
    hasConfiguredAvatar: false,
    matchTwinToBreed: true,
  });
  assert.equal(blank.match, null);
  assert.equal(blank.swapAvailable, false);
  assert.equal(blank.willSwapTemplate, false);
  assert.equal(blank.resultTemplateId, "shepherd");

  const same = deriveSetupTwinPlan({
    breed: "German Shepherd mix",
    dogName: "Phoenix",
    currentTemplateId: "shepherd",
    hasConfiguredAvatar: false,
    matchTwinToBreed: true,
  });
  assert.equal(same.match?.templateId, "shepherd");
  assert.equal(same.swapAvailable, false);
  assert.equal(same.willSwapTemplate, false);
  assert.equal(same.successLine, "Phoenix's twin is ready - a Shepherd.");
});

test("applies the matched template with Avatar Studio's template-picker patch", () => {
  const base = createDefaultAvatarConfig("Phoenix", "2026-07-10T00:00:00.000Z");
  const next = applyBreedTemplateToAvatarConfig(base, "dachshund", "Noodle");
  const template = getAvatarTemplate("dachshund");

  assert.equal(next.templateId, "dachshund");
  assert.equal(next.petName, "Noodle");
  assert.equal(next.earTypeId, template.defaultEarTypeId);
  assert.equal(next.muzzleTypeId, template.defaultMuzzleTypeId);
  assert.equal(next.emotePackId, template.recommendedEmotePackId);
  // Owner-visible styling stays untouched, exactly like tapping a template
  // in Avatar Studio.
  assert.equal(next.coatPrimary, base.coatPrimary);
  assert.equal(next.coatSecondary, base.coatSecondary);
  assert.equal(next.collarId, base.collarId);
  assert.equal(next.faceMarkingId, base.faceMarkingId);
  assert.deepEqual(next.accessorySlots, base.accessorySlots);
  // The original config object is not mutated.
  assert.equal(base.templateId, "shepherd");
});

test("keeps Setup breed matching aligned with Dog Profile display identity", () => {
  const base = createDefaultAvatarConfig("Phoenix", "2026-08-07T00:00:00.000Z");
  const placeholderPlan = deriveSetupTwinPlan({
    breed: "Dachshund",
    dogName: "My Dog",
    currentTemplateId: "shepherd",
    hasConfiguredAvatar: false,
    matchTwinToBreed: true,
  });
  const placeholderConfig = applyBreedTemplateToAvatarConfig(
    base,
    "dachshund",
    "My Dog",
  );
  const renamedPlan = deriveSetupTwinPlan({
    breed: "Dachshund",
    dogName: "  Luna  ",
    currentTemplateId: "shepherd",
    hasConfiguredAvatar: false,
    matchTwinToBreed: true,
  });

  assert.equal(placeholderPlan.successLine, "Phoenix's twin is ready - a Dachshund.");
  assert.equal(placeholderConfig.petName, "Phoenix");
  assert.equal(renamedPlan.successLine, "Luna's twin is ready - a Dachshund.");
});
