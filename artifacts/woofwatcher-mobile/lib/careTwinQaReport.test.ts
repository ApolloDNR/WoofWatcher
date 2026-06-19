import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCareTwinQaShareText,
  careTwinQaStatusLabel,
  summarizeCareTwinQaReviews,
  type CareTwinQaReview,
} from "./careTwinQaReport.ts";
import type { CareTwinRuntimeQaResult } from "./careTwinAssets.ts";

function qaResult(
  id: string,
  label: string,
  layeredReady: boolean,
): CareTwinRuntimeQaResult {
  return {
    scenario: {
      id,
      label,
      expectedAction: "tail-wag",
      expectedRoomVariant: "day",
      expectedZone: "rug",
      expectedScenePhase: "idle",
      expectedNeed: "bond",
      nativeQaPrompt: "Check the room and sprite.",
      motion: {
        state: "happy",
        avatarMood: "happy",
        cue: "tail-wag",
        intensity: "medium",
        label,
        speech: label,
        line: label,
        route: "/log",
      },
    },
    plan: {} as CareTwinRuntimeQaResult["plan"],
    actualAction: "tail-wag",
    actualRoomVariant: "day",
    actualZone: "rug",
    actualScenePhase: "idle",
    actualNeed: "bond",
    readiness: {
      layeredReady,
      spriteReady: layeredReady,
      roomReady: true,
      missing: layeredReady ? [] : ["sprite"],
    },
  };
}

test("summarizes care twin QA review status for device evidence", () => {
  const results = [
    qaResult("happy", "Steady happy idle", true),
    qaResult("health", "Health Watch signal", true),
    qaResult("sleep", "Quiet-hours sleep", false),
  ];
  const reviews: CareTwinQaReview[] = [
    { scenarioId: "happy", status: "pass" },
    { scenarioId: "health", status: "needs-review", note: "Sprite sits too low on iPhone SE." },
  ];

  assert.deepEqual(summarizeCareTwinQaReviews(results, reviews), {
    total: 3,
    passed: 1,
    needsReview: 1,
    unreviewed: 1,
    readyLayered: 2,
  });
});

test("builds a shareable care twin QA report without claiming native QA is complete", () => {
  const results = [
    qaResult("happy", "Steady happy idle", true),
    qaResult("health", "Health Watch signal", true),
  ];
  const reviews: CareTwinQaReview[] = [
    { scenarioId: "happy", status: "pass" },
    { scenarioId: "health", status: "needs-review", note: "Health room crop needs 8px more bottom padding." },
  ];

  const text = buildCareTwinQaShareText(results, reviews, "2026-06-19T12:00:00.000Z");

  assert.match(text, /WoofWatcher Care Twin QA/);
  assert.match(text, /Summary: 1\/2 passed, 1 needs tune, 0 unreviewed/);
  assert.match(text, /Steady happy idle: Pass/);
  assert.match(text, /Health Watch signal: Needs tune/);
  assert.match(text, /Health room crop needs 8px more bottom padding/);
  assert.match(text, /Native screenshot evidence still required before launch/);
});

test("uses owner-readable review labels", () => {
  assert.equal(careTwinQaStatusLabel("pass"), "Pass");
  assert.equal(careTwinQaStatusLabel("needs-review"), "Needs tune");
  assert.equal(careTwinQaStatusLabel("unreviewed"), "Unreviewed");
});
