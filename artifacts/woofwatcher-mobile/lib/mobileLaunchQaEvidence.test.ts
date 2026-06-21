import { test } from "node:test";
import assert from "node:assert/strict";

import {
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
