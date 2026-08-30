import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCareTwinQaShareText,
  careTwinQaMissingNativeProof,
  careTwinQaReviewStatusLabel,
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
    stageFraming: {
      zone: "rug",
      label: "Rug stage framing",
      cropRule: "Keep Phoenix centered with head, paws, speech bubble, and bottom dock visible.",
      hudClearanceRule: "HUD must not cover the face, paws, or bottom dock.",
      singleAvatarRule: "Use the dogless room plus one single live sprite.",
      mockupAccuracyRule: "Match Option B hard-pixel room staging.",
      phoneQaHint: "Use a phone screenshot to confirm the stage feels balanced.",
    },
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
    {
      scenarioId: "happy",
      status: "pass",
      screenshotEvidence: [
        {
          uri: "file:///qa/ios-happy-idle.png",
          fileName: "ios-happy-idle.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-20T12:02:00.000Z",
        },
      ],
    },
    { scenarioId: "health", status: "needs-review", note: "Sprite sits too low on iPhone SE." },
  ];

  assert.deepEqual(summarizeCareTwinQaReviews(results, reviews), {
    total: 3,
    passed: 1,
    passedWithNativeProof: 0,
    passPendingProof: 1,
    needsReview: 1,
    unreviewed: 1,
    readyLayered: 2,
    attachedScreenshots: 1,
    attachedIosScreenshots: 1,
    attachedAndroidScreenshots: 0,
    attachedUnknownScreenshots: 0,
  });
});

test("keeps passed care twin states pending until exact-device proof is attached", () => {
  const pendingPass: CareTwinQaReview = {
    scenarioId: "happy",
    status: "pass",
    screenshotEvidence: [
      {
        uri: "file:///qa/web-happy-idle.png",
        fileName: "web-happy-idle.png",
        source: "library",
        targetPlatform: "web",
        capturedAtIso: "2026-06-20T12:02:00.000Z",
      },
    ],
  };
  const manualNativeTagPass: CareTwinQaReview = {
    scenarioId: "health",
    status: "pass",
    screenshotEvidence: [
      {
        uri: "file:///qa/android-health-watch.png",
        fileName: "android-health-watch.png",
        source: "library",
        targetPlatform: "android",
        capturedAtIso: "2026-06-20T12:04:00.000Z",
      },
    ],
  };

  const exactDevicePass: CareTwinQaReview = {
    scenarioId: "health",
    status: "pass",
    screenshotEvidence: [
      {
        uri: "file:///qa/android-health-watch-exact.png",
        fileName: "android-health-watch-exact.png",
        source: "camera",
        targetPlatform: "android",
        capturedAtIso: "2026-06-20T12:04:00.000Z",
        verification: "exact-binary-device",
        nativeBuildIdentifier: "com.woofwatcher:42",
        deviceIdentifier: "Pixel 9",
      },
    ],
  };

  assert.equal(careTwinQaReviewStatusLabel(pendingPass), "Pass pending proof");
  assert.deepEqual(careTwinQaMissingNativeProof(pendingPass), [
    "Capture at least one exact-binary iOS or Android device screenshot for this care-twin state before treating Pass as native launch proof; Photos-library attachments are manual self-attested references only.",
  ]);
  assert.equal(careTwinQaReviewStatusLabel(manualNativeTagPass), "Pass pending proof");
  assert.notDeepEqual(careTwinQaMissingNativeProof(manualNativeTagPass), []);
  assert.equal(careTwinQaReviewStatusLabel(exactDevicePass), "Pass");
  assert.deepEqual(careTwinQaMissingNativeProof(exactDevicePass), []);

  assert.deepEqual(summarizeCareTwinQaReviews([
    qaResult("happy", "Steady happy idle", true),
    qaResult("health", "Health Watch signal", true),
  ], [pendingPass, exactDevicePass]), {
    total: 2,
    passed: 2,
    passedWithNativeProof: 1,
    passPendingProof: 1,
    needsReview: 0,
    unreviewed: 0,
    readyLayered: 2,
    attachedScreenshots: 2,
    attachedIosScreenshots: 0,
    attachedAndroidScreenshots: 1,
    attachedUnknownScreenshots: 1,
  });
});

test("builds a shareable care twin QA report without claiming native QA is complete", () => {
  const results = [
    qaResult("happy", "Steady happy idle", true),
    qaResult("health", "Health Watch signal", true),
  ];
  const reviews: CareTwinQaReview[] = [
    {
      scenarioId: "happy",
      status: "pass",
      screenshotEvidence: [
        {
          uri: "file:///qa/ios-happy-idle.png",
          fileName: "ios-happy-idle.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-20T12:02:00.000Z",
        },
      ],
    },
    { scenarioId: "health", status: "needs-review", note: "Health room crop needs 8px more bottom padding." },
  ];

  const text = buildCareTwinQaShareText(results, reviews, "2026-06-19T12:00:00.000Z");

  assert.match(text, /WoofWatcher Care Twin QA/);
  assert.match(text, /Summary: 1\/2 passed, 0 exact-device pass, 1 pass pending exact-device proof, 1 needs tune, 0 unreviewed/);
  assert.match(text, /Steady happy idle: Pass pending proof/);
  assert.match(text, /Health Watch signal: Needs tune/);
  assert.match(text, /Motion recipe: tail wag/);
  assert.match(text, /bob 1\.8px/);
  assert.match(text, /Happy idle uses a readable body sway/);
  assert.match(text, /Stage framing: Rug stage framing/);
  assert.match(text, /single live sprite/);
  assert.match(text, /phone screenshot/);
  assert.match(text, /Health room crop needs 8px more bottom padding/);
  assert.match(text, /Attached screenshots: 1 \(iOS 1, Android 0/);
  assert.match(text, /Screenshots: ios-happy-idle\.png \(iOS, manual self-attested\)/);
  assert.match(text, /Exact-binary native device evidence still required before launch/);
});

test("uses owner-readable review labels", () => {
  assert.equal(careTwinQaStatusLabel("pass"), "Pass");
  assert.equal(careTwinQaStatusLabel("needs-review"), "Needs tune");
  assert.equal(careTwinQaStatusLabel("unreviewed"), "Unreviewed");
  assert.equal(careTwinQaReviewStatusLabel({ scenarioId: "happy", status: "pass" }), "Pass pending proof");
});
