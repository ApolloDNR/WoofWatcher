import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildQaScreenshotEvidence,
  qaScreenshotEvidenceIsExactDeviceProof,
  qaScreenshotEvidenceNames,
} from "./qaScreenshotEvidence.ts";

test("a Photos-library attachment remains manual self-attested evidence", () => {
  const evidence = buildQaScreenshotEvidence({
    uri: "file:///qa/ios-home.png",
    fileName: "ios-home.png",
    source: "library",
    targetPlatform: "ios",
    capturedAtIso: "2026-08-23T20:00:00.000Z",
    verification: "exact-binary-device",
    nativeBuildIdentifier: "com.example.woofwatcher:42",
    deviceIdentifier: "Apollo iPhone",
  });

  assert.ok(evidence);
  assert.equal(evidence.verification, "manual-self-attested");
  assert.equal(qaScreenshotEvidenceIsExactDeviceProof(evidence), false);
  assert.match(qaScreenshotEvidenceNames([evidence]), /manual self-attested/i);
});

test("exact-device proof requires a camera source and binary and device identifiers", () => {
  const evidence = buildQaScreenshotEvidence({
    uri: "file:///qa/ios-home.png",
    fileName: "ios-home.png",
    source: "camera",
    targetPlatform: "ios",
    capturedAtIso: "2026-08-23T20:00:00.000Z",
    verification: "exact-binary-device",
    nativeBuildIdentifier: "com.example.woofwatcher:42",
    deviceIdentifier: "Apollo iPhone",
  });

  assert.ok(evidence);
  assert.equal(qaScreenshotEvidenceIsExactDeviceProof(evidence), true);
});
