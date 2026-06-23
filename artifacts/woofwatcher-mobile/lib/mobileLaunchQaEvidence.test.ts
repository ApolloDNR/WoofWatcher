import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMobileLaunchQaCaptureShareText,
  buildMobileLaunchQaCapturePlan,
  deriveNativeQaSummaryFromMobileQaSession,
  listMobileLaunchQaSurfaces,
} from "./mobileLaunchQaEvidence.ts";
import type { MobileQaSessionState } from "./mobileQaSession.ts";
import type { MobileReleaseQaSurface } from "./mobileReleaseQa.ts";

const focusedSurfaces: readonly MobileReleaseQaSurface[] = [
  {
    id: "home",
    title: "Home",
    route: "/",
    priority: "launch-critical",
    goal: "Verify the main screen.",
    devicePrompt: "Capture the screen.",
    requiredEvidence: ["iOS screenshot of Home.", "Android screenshot of Home."],
    launchRisk: "Home is the first impression.",
  },
  {
    id: "care-pass",
    title: "Care Pass",
    route: "/records",
    priority: "release-polish",
    goal: "Verify Care Pass.",
    devicePrompt: "Capture the handoff.",
    requiredEvidence: ["Screenshot of Care Pass share preview."],
    launchRisk: "Care Pass needs proof.",
  },
];

test("derives a launch native QA summary from saved mobile QA session proof", () => {
  const session: MobileQaSessionState = {
    careTwinStatusById: {},
    careTwinNotes: {},
    careTwinEvidenceById: {},
    surfaceStatusById: {
      home: "pass",
      "care-pass": "needs-review",
    },
    surfaceNotes: {},
    surfaceEvidenceById: {
      home: [
        {
          uri: "file:///qa/ios-home.png",
          fileName: "ios-home.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-21T09:00:00.000Z",
        },
      ],
      "care-pass": [
        {
          uri: "file:///qa/care-pass.png",
          fileName: "care-pass.png",
          source: "library",
          targetPlatform: "unknown",
          capturedAtIso: "2026-06-21T09:02:00.000Z",
        },
      ],
    },
  };

  const summary = deriveNativeQaSummaryFromMobileQaSession(session, focusedSurfaces);

  assert.deepEqual(summary, {
    total: 2,
    passed: 1,
    needsReview: 1,
    unreviewed: 0,
    requiredScreenshots: 3,
    missingScreenshots: 1,
    missingIosScreenshots: 0,
    missingAndroidScreenshots: 1,
    missingAnyScreenshots: 0,
  });
});

test("keeps launch native QA empty until the saved session contains real review data", () => {
  const emptySession: MobileQaSessionState = {
    careTwinStatusById: {},
    careTwinNotes: {},
    careTwinEvidenceById: {},
    surfaceStatusById: {},
    surfaceNotes: {},
    surfaceEvidenceById: {},
  };

  assert.equal(deriveNativeQaSummaryFromMobileQaSession(null, focusedSurfaces), null);
  assert.equal(deriveNativeQaSummaryFromMobileQaSession(emptySession, focusedSurfaces), null);
});

test("lists the combined native release and store screenshot QA surfaces", () => {
  const surfaces = listMobileLaunchQaSurfaces();
  const ids = surfaces.map((surface) => surface.id);

  assert.ok(ids.includes("phoenix-home"));
  assert.ok(ids.includes("avatar-studio"));
  assert.ok(ids.includes("store-phoenix-home"));
  assert.ok(ids.includes("store-privacy-launch-gates"));
  assert.ok(surfaces.every((surface) => surface.requiredEvidence.some((item) => /screenshot/i.test(item))));
});

test("builds a prioritized capture plan from missing native QA evidence", () => {
  const session: MobileQaSessionState = {
    careTwinStatusById: {},
    careTwinNotes: {},
    careTwinEvidenceById: {},
    surfaceStatusById: {
      home: "pass",
      "care-pass": "pass",
    },
    surfaceNotes: {},
    surfaceEvidenceById: {
      home: [
        {
          uri: "file:///qa/ios-home.png",
          fileName: "ios-home.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-21T09:00:00.000Z",
        },
        {
          uri: "file:///qa/android-home.png",
          fileName: "android-home.png",
          source: "library",
          targetPlatform: "android",
          capturedAtIso: "2026-06-21T09:02:00.000Z",
        },
      ],
    },
  };

  const plan = buildMobileLaunchQaCapturePlan(session, focusedSurfaces);

  assert.equal(plan.totalSurfaces, 2);
  assert.equal(plan.openSurfaces, 1);
  assert.equal(plan.completeSurfaces, 1);
  assert.deepEqual(plan.nextTargets, [
    {
      surfaceId: "care-pass",
      title: "Care Pass",
      route: "/records",
      priority: "release-polish",
      status: "pass",
      missingEvidence: ["Attach 1 screenshot for Care Pass."],
      evidenceAttached: 0,
      note: undefined,
    },
  ]);
});

test("prioritizes launch-critical unreviewed targets before release-polish targets", () => {
  const emptySession: MobileQaSessionState = {
    careTwinStatusById: {},
    careTwinNotes: {},
    careTwinEvidenceById: {},
    surfaceStatusById: {},
    surfaceNotes: {},
    surfaceEvidenceById: {},
  };

  const plan = buildMobileLaunchQaCapturePlan(emptySession, focusedSurfaces);

  assert.equal(plan.openSurfaces, 2);
  assert.equal(plan.nextTargets[0]?.surfaceId, "home");
  assert.deepEqual(plan.nextTargets[0]?.missingEvidence, [
    "Attach 1 iOS screenshot for Home.",
    "Attach 1 Android screenshot for Home.",
  ]);
  assert.equal(plan.nextTargets[1]?.surfaceId, "care-pass");
});

test("preserves release surface order inside each priority group", () => {
  const surfaces: readonly MobileReleaseQaSurface[] = [
    {
      id: "phoenix-home",
      title: "Phoenix Home",
      route: "/",
      priority: "launch-critical",
      goal: "Verify the first screen.",
      devicePrompt: "Capture Home first.",
      requiredEvidence: ["iOS screenshot of Phoenix Home."],
      launchRisk: "Home is the first impression.",
    },
    {
      id: "home-mission-deck",
      title: "Home Mission Deck",
      route: "/",
      priority: "launch-critical",
      goal: "Verify the mission deck.",
      devicePrompt: "Capture mission deck second.",
      requiredEvidence: ["iOS screenshot of Home Mission Deck."],
      launchRisk: "Mission rows must not hide behind the nav.",
    },
    {
      id: "avatar-studio",
      title: "Avatar Studio",
      route: "/portrait",
      priority: "launch-critical",
      goal: "Verify Avatar Studio.",
      devicePrompt: "Capture Avatar Studio after Home.",
      requiredEvidence: ["iOS screenshot of Avatar Studio."],
      launchRisk: "Avatar Studio is the product hook.",
    },
    {
      id: "care-pass",
      title: "Care Pass",
      route: "/records",
      priority: "release-polish",
      goal: "Verify Care Pass.",
      devicePrompt: "Capture Care Pass.",
      requiredEvidence: ["Screenshot of Care Pass."],
      launchRisk: "Care Pass needs proof.",
    },
  ];

  const plan = buildMobileLaunchQaCapturePlan(null, surfaces);

  assert.deepEqual(
    plan.nextTargets.map((target) => target.surfaceId),
    ["phoenix-home", "home-mission-deck", "avatar-studio", "care-pass"],
  );
});

test("builds a shareable native QA capture script for Apollo and device testers", () => {
  const plan = buildMobileLaunchQaCapturePlan(null, focusedSurfaces);
  const text = buildMobileLaunchQaCaptureShareText(plan, "2026-06-21T09:30:00.000Z");

  assert.match(text, /WoofWatcher Native QA Capture Plan/);
  assert.match(text, /Generated: 2026-06-21T09:30:00.000Z/);
  assert.match(text, /Progress: 0\/2 complete, 2 open/);
  assert.match(text, /1\. Home \(\/\)/);
  assert.match(text, /Priority: launch-critical/);
  assert.match(text, /Missing: Attach 1 iOS screenshot for Home\. Attach 1 Android screenshot for Home\./);
  assert.match(text, /2\. Care Pass \(\/records\)/);
  assert.match(text, /Done condition: capture iOS and Android proof in \/care-twin-qa/);
});
