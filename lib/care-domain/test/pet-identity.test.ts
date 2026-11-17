import assert from "node:assert/strict";
import test from "node:test";

import { resolvePetName } from "../src/pet-identity.ts";

test("resolves padded and mixed-case starter placeholders to Phoenix", () => {
  assert.equal(resolvePetName("  my dog  "), "Phoenix");
  assert.equal(resolvePetName("MY DOG"), "Phoenix");
});

test("preserves a trimmed owner-selected dog name", () => {
  assert.equal(resolvePetName("  Luna  "), "Luna");
});
