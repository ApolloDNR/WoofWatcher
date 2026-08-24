import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPetPossessiveName,
  DEFAULT_PET_DISPLAY_NAME,
  DEFAULT_PET_PLACEHOLDER,
  resolvePetName,
} from "../src/index.ts";

test("keeps the canonical fresh-install identity neutral", () => {
  assert.equal(DEFAULT_PET_PLACEHOLDER, "My Dog");
  assert.equal(DEFAULT_PET_DISPLAY_NAME, "your dog");
  assert.equal(resolvePetName(undefined), "your dog");
  assert.equal(resolvePetName(""), "your dog");
  assert.equal(resolvePetName("My Dog"), "your dog");
  assert.equal(resolvePetName("  Luna  "), "Luna");
});

test("preserves an explicit fallback for intentional sample identities", () => {
  assert.equal(resolvePetName("My Dog", "Phoenix"), "Phoenix");
});

test("builds grammatical possessive names for consumer copy", () => {
  assert.equal(buildPetPossessiveName("My Dog"), "your dog's");
  assert.equal(buildPetPossessiveName("Luna"), "Luna's");
  assert.equal(buildPetPossessiveName("Gus"), "Gus'");
});
