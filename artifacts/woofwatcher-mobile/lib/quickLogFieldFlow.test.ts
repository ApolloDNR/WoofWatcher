import assert from "node:assert/strict";
import test from "node:test";

import {
  getIncidentQuickLogFieldFlow,
  getTrainingQuickLogFieldFlow,
} from "./quickLogFieldFlow.ts";

test("incident quick log preserves the complete safety handoff through a final follow-up action", () => {
  assert.deepEqual(getIncidentQuickLogFieldFlow(), [
    {
      id: "trigger",
      accessibilityLabel: "Incident trigger or context",
      returnKeyType: "next",
    },
    {
      id: "exposure",
      accessibilityLabel: "Who or what was involved in the incident",
      returnKeyType: "next",
    },
    {
      id: "injury",
      accessibilityLabel: "Incident injury check",
      returnKeyType: "next",
    },
    {
      id: "action",
      accessibilityLabel: "Action taken after the incident",
      returnKeyType: "next",
    },
    {
      id: "followUp",
      accessibilityLabel: "Incident follow-up",
      returnKeyType: "done",
    },
  ]);
});

test("training quick log advances from the cue to a final next-practice action", () => {
  assert.deepEqual(getTrainingQuickLogFieldFlow(), [
    {
      id: "skill",
      accessibilityLabel: "Training skill or cue",
      returnKeyType: "next",
    },
    {
      id: "nextPractice",
      accessibilityLabel: "Training next practice",
      returnKeyType: "done",
    },
  ]);
});

test("training quick log field flow returns an isolated copy", () => {
  const first = getTrainingQuickLogFieldFlow();
  first[0].accessibilityLabel = "Changed";

  assert.equal(
    getTrainingQuickLogFieldFlow()[0].accessibilityLabel,
    "Training skill or cue",
  );
});
