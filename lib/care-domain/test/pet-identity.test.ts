import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PET_DISPLAY_NAME,
  resolvePetName,
} from "../src/pet-identity.ts";

test("uses an honest unconfigured identity and preserves real saved names", () => {
  assert.equal(DEFAULT_PET_DISPLAY_NAME, "Your dog");
  assert.equal(resolvePetName(undefined), "Your dog");
  assert.equal(resolvePetName(""), "Your dog");
  assert.equal(resolvePetName("My Dog"), "Your dog");
  assert.equal(resolvePetName("Phoenix"), "Phoenix");
  assert.equal(resolvePetName("  Miso  "), "Miso");
});

test("allows an explicitly labelled preview to opt into a demo name", () => {
  assert.equal(resolvePetName("My Dog", "Phoenix"), "Phoenix");
});
