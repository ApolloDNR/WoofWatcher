import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCareHelperInput,
  buildCareHelperInstructions,
  ensureVeterinaryBoundary,
} from "../src/openai-care-helper.js";

test("keeps a renamed Dog Profile identity throughout the provider-bound WoofGuide prompt", () => {
  const context = {
    profile: { name: "  Mochi  ", breed: "Shiba Inu" },
    latest: [],
  };

  const instructions = buildCareHelperInstructions(context);
  const input = buildCareHelperInput({ question: "", context });
  const fallback = ensureVeterinaryBoundary("", context);

  assert.match(instructions, /Care Helper for Mochi/);
  assert.match(instructions, /only the Mochi context/);
  assert.doesNotMatch(instructions, /Phoenix/);
  assert.match(input, /What should we review for Mochi today\?/);
  assert.match(input, /^Mochi context:/m);
  assert.doesNotMatch(input, /Phoenix|  Mochi  /);
  assert.match(fallback, /Mochi's logged care context/);
  assert.doesNotMatch(fallback, /Phoenix/);
});

test("keeps the intentional Phoenix starter identity for provider-bound WoofGuide copy", () => {
  const context = { profile: { name: "  my dog  " } };

  assert.match(buildCareHelperInstructions(context), /Care Helper for Phoenix/);
  assert.match(buildCareHelperInput({ question: "", context }), /Phoenix context:/);
  assert.match(ensureVeterinaryBoundary("", context), /Phoenix's logged care context/);
});
