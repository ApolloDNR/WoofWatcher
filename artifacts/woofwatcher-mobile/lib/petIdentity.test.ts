import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPetPossessiveName,
  buildCareTwinRoomAccessibilityLabel,
  buildPetSetupCopy,
  buildPetSummaryLine,
  resolveConsumerPetName,
} from "./petIdentity.ts";

test("uses a neutral dog name until the household enters a real name", () => {
  assert.equal(resolveConsumerPetName(undefined), "your dog");
  assert.equal(resolveConsumerPetName(""), "your dog");
  assert.equal(resolveConsumerPetName("My Dog"), "your dog");
  assert.equal(resolveConsumerPetName("  Luna  "), "Luna");
});

test("builds natural first-run setup copy for unnamed and named dogs", () => {
  assert.deepEqual(buildPetSetupCopy("My Dog"), {
    displayName: "your dog",
    title: "Let's set up your dog",
    actionLabel: "Set up your dog",
  });
  assert.deepEqual(buildPetSetupCopy(" Luna "), {
    displayName: "Luna",
    title: "Let's set up Luna",
    actionLabel: "Set up Luna",
  });
});

test("progress-report identity omits empty breed parentheses", () => {
  assert.equal(buildPetSummaryLine("My Dog", ""), "your dog");
  assert.equal(buildPetSummaryLine(" Luna ", "  "), "Luna");
  assert.equal(buildPetSummaryLine("Luna", "Retriever"), "Luna (Retriever)");
});

test("builds one current-name care-twin label without a Phoenix or Shepherd fallback", () => {
  assert.equal(
    buildCareTwinRoomAccessibilityLabel({
      name: "Luna",
      templateLabel: "Retriever",
      motionLabel: "Resting",
      interactionLabel: "Tap to say hello",
      speech: "Ready for a walk",
    }),
    "Luna's room. Retriever care twin. Resting. Tap to say hello. Ready for a walk.",
  );
  assert.equal(
    buildCareTwinRoomAccessibilityLabel({
      name: "My Dog",
      motionLabel: "Resting",
    }),
    "Your dog's room. Care twin. Resting.",
  );
  assert.equal(
    buildCareTwinRoomAccessibilityLabel({
      name: "Gus",
      templateLabel: "Terrier",
      motionLabel: "Playing",
    }),
    "Gus' room. Terrier care twin. Playing.",
  );
});

test("builds grammatical possessive names for current and fresh identities", () => {
  assert.equal(buildPetPossessiveName("My Dog"), "your dog's");
  assert.equal(buildPetPossessiveName("Luna"), "Luna's");
  assert.equal(buildPetPossessiveName("Gus"), "Gus'");
});
