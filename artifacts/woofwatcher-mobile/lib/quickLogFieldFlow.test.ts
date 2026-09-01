import assert from "node:assert/strict";
import test from "node:test";

import { getTrainingQuickLogFieldFlow } from "./quickLogFieldFlow.ts";

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
