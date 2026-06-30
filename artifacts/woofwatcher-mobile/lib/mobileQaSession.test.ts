import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMobileQaSessionProofManifest,
  buildMobileQaSessionProofManifestShareText,
  buildMobileQaSessionSnapshot,
  MOBILE_QA_SESSION_STORAGE_KEY,
  parseMobileQaSessionSnapshot,
} from "./mobileQaSession.ts";

test("builds a compact local mobile QA snapshot", () => {
  const snapshot = buildMobileQaSessionSnapshot(
    {
      careTwinStatusById: {
        happy: "pass",
        sleep: "unreviewed",
      },
      careTwinNotes: {
        sleep: "Needs iPhone SE crop check.",
        blank: "   ",
      },
      careTwinEvidenceById: {
        happy: [
          {
            uri: "file:///qa/ios-happy-idle.png",
            fileName: "ios-happy-idle.png",
            source: "library",
            targetPlatform: "ios",
            capturedAtIso: "2026-06-20T13:00:05.000Z",
          },
        ],
      },
      surfaceStatusById: {
        "phoenix-home": "pass",
      },
      surfaceNotes: {
        "records-incident-watch": "Follow-up row needs touch review.",
      },
      surfaceEvidenceById: {
        "phoenix-home": [
          {
            uri: "file:///qa/ios-home.png",
            fileName: "ios-home.png",
            source: "library",
            targetPlatform: "ios",
            capturedAtIso: "2026-06-20T13:00:10.000Z",
          },
        ],
      },
    },
    "2026-06-20T13:00:00.000Z",
  );

  assert.equal(MOBILE_QA_SESSION_STORAGE_KEY, "woofwatcher.mobileReleaseQaSession.v1");
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.savedAtIso, "2026-06-20T13:00:00.000Z");
  assert.deepEqual(snapshot.careTwinReviews, [
    {
      scenarioId: "happy",
      status: "pass",
      note: undefined,
      screenshotEvidence: [
        {
          uri: "file:///qa/ios-happy-idle.png",
          fileName: "ios-happy-idle.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-20T13:00:05.000Z",
        },
      ],
    },
    { scenarioId: "sleep", status: "unreviewed", note: "Needs iPhone SE crop check." },
  ]);
  assert.deepEqual(snapshot.releaseReviews, [
    {
      surfaceId: "phoenix-home",
      status: "pass",
      note: undefined,
      screenshotEvidence: [
        {
          uri: "file:///qa/ios-home.png",
          fileName: "ios-home.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-20T13:00:10.000Z",
        },
      ],
    },
    {
      surfaceId: "records-incident-watch",
      status: "unreviewed",
      note: "Follow-up row needs touch review.",
    },
  ]);
});

test("parses a saved mobile QA snapshot into screen state maps", () => {
  const snapshot = buildMobileQaSessionSnapshot(
    {
      careTwinStatusById: { happy: "pass" },
      careTwinNotes: { happy: "Looks good on iPhone." },
      careTwinEvidenceById: {
        happy: [
          {
            uri: "file:///qa/ios-happy-idle.png",
            fileName: "ios-happy-idle.png",
            source: "library",
            targetPlatform: "ios",
            capturedAtIso: "2026-06-20T13:05:05.000Z",
          },
        ],
      },
      surfaceStatusById: { "avatar-studio": "needs-review" },
      surfaceNotes: { "avatar-studio": "Bully walk loop feels stiff." },
      surfaceEvidenceById: {
        "avatar-studio": [
          {
            uri: "file:///qa/android-avatar-studio.png",
            fileName: "android-avatar-studio.png",
            source: "library",
            targetPlatform: "android",
            capturedAtIso: "2026-06-20T13:05:10.000Z",
          },
        ],
      },
    },
    "2026-06-20T13:05:00.000Z",
  );

  const parsed = parseMobileQaSessionSnapshot(JSON.stringify(snapshot));

  assert.deepEqual(parsed?.careTwinStatusById, { happy: "pass" });
  assert.deepEqual(parsed?.careTwinNotes, { happy: "Looks good on iPhone." });
  assert.equal(parsed?.careTwinEvidenceById.happy?.[0]?.fileName, "ios-happy-idle.png");
  assert.equal(parsed?.careTwinEvidenceById.happy?.[0]?.targetPlatform, "ios");
  assert.deepEqual(parsed?.surfaceStatusById, { "avatar-studio": "needs-review" });
  assert.deepEqual(parsed?.surfaceNotes, { "avatar-studio": "Bully walk loop feels stiff." });
  assert.equal(parsed?.surfaceEvidenceById["avatar-studio"]?.[0]?.fileName, "android-avatar-studio.png");
  assert.equal(parsed?.surfaceEvidenceById["avatar-studio"]?.[0]?.targetPlatform, "android");
  assert.equal(parsed?.savedAtIso, "2026-06-20T13:05:00.000Z");
});

test("ignores corrupt and invalid mobile QA session data", () => {
  assert.equal(parseMobileQaSessionSnapshot("not-json"), null);
  assert.equal(parseMobileQaSessionSnapshot(null), null);

  const parsed = parseMobileQaSessionSnapshot(
    JSON.stringify({
      savedAtIso: "2026-06-20T13:10:00.000Z",
      careTwinReviews: [
        { scenarioId: "happy", status: "ship-it", note: "bad status" },
        {
          scenarioId: "health",
          status: "needs-review",
          note: "  Crop low. ",
          screenshotEvidence: [
            { uri: "", fileName: "bad.png", source: "library", capturedAtIso: "2026-06-20T13:10:10.000Z" },
            { uri: "file:///qa/health.png", fileName: "  health.png  ", source: "camera", targetPlatform: "sideways", capturedAtIso: "bad-date" },
          ],
        },
      ],
      releaseReviews: [
        { surfaceId: "", status: "pass" },
        { surfaceId: "phoenix-home", status: "pass", note: 42 },
      ],
    }),
  );

  assert.deepEqual(parsed?.careTwinStatusById, { health: "needs-review" });
  assert.deepEqual(parsed?.careTwinNotes, { health: "Crop low." });
  assert.equal(parsed?.careTwinEvidenceById.health?.length, 1);
  assert.equal(parsed?.careTwinEvidenceById.health?.[0]?.fileName, "health.png");
  assert.equal(parsed?.careTwinEvidenceById.health?.[0]?.targetPlatform, "unknown");
  assert.deepEqual(parsed?.surfaceStatusById, { "phoenix-home": "pass" });
  assert.deepEqual(parsed?.surfaceNotes, {});
});

test("builds a deterministic handoff proof manifest for saved device QA", () => {
  const snapshot = buildMobileQaSessionSnapshot(
    {
      careTwinStatusById: {
        happy: "pass",
        health: "needs-review",
      },
      careTwinNotes: {
        health: "Health-watch crop needs Android retest.",
      },
      careTwinEvidenceById: {
        happy: [
          {
            uri: "file:///qa/ios-happy-idle.png",
            fileName: "ios-happy-idle.png",
            source: "library",
            targetPlatform: "ios",
            capturedAtIso: "2026-06-20T13:00:05.000Z",
          },
        ],
      },
      surfaceStatusById: {
        "owner-preview-core-loop": "pass",
        "store-home": "pass",
      },
      surfaceNotes: {
        "owner-preview-core-loop": "Home, Log, Plans, Health, More, Adventure, Records, Avatar Studio, and Care Pass reached.",
      },
      surfaceEvidenceById: {
        "owner-preview-core-loop": [
          {
            uri: "file:///qa/android-launch-readiness.png",
            fileName: "android-launch-readiness.png",
            source: "library",
            targetPlatform: "android",
            capturedAtIso: "2026-06-20T13:00:10.000Z",
          },
        ],
        "store-home": [
          {
            uri: "file:///qa/store-home-web.png",
            fileName: "store-home-web.png",
            source: "library",
            targetPlatform: "web",
            capturedAtIso: "2026-06-20T13:00:15.000Z",
          },
        ],
      },
    },
    "2026-06-20T13:00:00.000Z",
  );

  const manifest = buildMobileQaSessionProofManifest(snapshot, "2026-06-20T13:05:00.000Z");
  const sameManifest = buildMobileQaSessionProofManifest(snapshot, "2026-06-20T13:10:00.000Z");
  const text = buildMobileQaSessionProofManifestShareText(manifest);

  assert.match(manifest.proofId, /^wwqa-[a-z0-9]+$/);
  assert.equal(manifest.proofId, sameManifest.proofId);
  assert.equal(manifest.savedAtIso, "2026-06-20T13:00:00.000Z");
  assert.equal(manifest.generatedAtIso, "2026-06-20T13:05:00.000Z");
  assert.deepEqual(manifest.careTwin, {
    totalReviews: 2,
    passed: 1,
    needsTune: 1,
    unreviewed: 0,
    notes: 1,
    evidenceFiles: 1,
    iosEvidence: 1,
    androidEvidence: 0,
    webEvidence: 0,
    unknownEvidence: 0,
  });
  assert.deepEqual(manifest.release, {
    totalReviews: 2,
    passed: 2,
    needsTune: 0,
    unreviewed: 0,
    notes: 1,
    evidenceFiles: 2,
    iosEvidence: 0,
    androidEvidence: 1,
    webEvidence: 1,
    unknownEvidence: 0,
  });
  assert.equal(manifest.totalEvidenceFiles, 3);
  assert.equal(manifest.platformEvidenceLabel, "iOS 1, Android 1, Web 1, Unknown 0");
  assert.match(text, /WoofWatcher QA Proof Manifest/);
  assert.match(text, /Proof ID: wwqa-/);
  assert.match(text, /Care twin: 1 pass, 1 needs tune, 1 evidence file/);
  assert.match(text, /Release: 2 pass, 0 needs tune, 2 evidence files/);
  assert.match(text, /does not prove App Store or Play Store approval/);
});
