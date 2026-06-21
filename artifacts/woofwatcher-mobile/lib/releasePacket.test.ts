import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveLaunchReadiness, type LaunchReadinessInput } from "./launchReadiness.ts";
import { buildReleasePacket, buildReleasePacketShareText } from "./releasePacket.ts";

const previewInput: LaunchReadinessInput = {
  nativeQa: null,
  local: {
    careWorkflowsReady: true,
    easProfilesReady: true,
    pixelAssetsReady: true,
    privacyExportReady: true,
  },
  provider: {
    authConfigured: false,
    databaseConfigured: false,
    storageProviderConfigured: false,
    storageQueue: {
      total: 4,
      localOnly: 4,
      uploadReady: 0,
      providerSaved: 0,
      labels: ["record document", "qa screenshot"],
      detail: "4 local files are waiting for approved storage rules.",
    },
    aiProviderConfigured: false,
    paymentsEnabled: false,
    accountDeletionEnabled: false,
    pushNotificationsConfigured: false,
    appStoreAccountsReady: false,
    privacyLegalApproved: false,
    supportRunbookApproved: false,
  },
  syncStatus: "ready",
};

const completeInput: LaunchReadinessInput = {
  nativeQa: {
    total: 6,
    passed: 6,
    needsReview: 0,
    unreviewed: 0,
    requiredScreenshots: 12,
    missingScreenshots: 0,
    missingIosScreenshots: 0,
    missingAndroidScreenshots: 0,
    missingAnyScreenshots: 0,
  },
  local: {
    careWorkflowsReady: true,
    easProfilesReady: true,
    pixelAssetsReady: true,
    privacyExportReady: true,
  },
  provider: {
    authConfigured: true,
    databaseConfigured: true,
    storageProviderConfigured: true,
    aiProviderConfigured: true,
    paymentsEnabled: true,
    accountDeletionEnabled: true,
    pushNotificationsConfigured: true,
    appStoreAccountsReady: true,
    privacyLegalApproved: true,
    supportRunbookApproved: true,
  },
  syncStatus: "ready",
};

test("builds a truthful release packet from the launch-readiness plan", () => {
  const plan = deriveLaunchReadiness(previewInput);
  const packet = buildReleasePacket(plan, {
    appName: "WoofWatcher",
    buildName: "premium revenue builder",
    generatedAtIso: "2026-06-21T19:00:00.000Z",
  });

  assert.equal(packet.title, "WoofWatcher Release Packet");
  assert.equal(packet.generatedAtLabel, "Jun 21, 2026");
  assert.equal(packet.storeLaunchReady, false);
  assert.equal(packet.verdictLabel, "Not ready for public launch");
  assert.match(packet.ownerSummary, /hardened for internal review/i);
  assert.ok(packet.readinessScore > 0 && packet.readinessScore < 100);
  assert.equal(packet.gateRows.length, 6);
  assert.ok(packet.gateRows.some((row) => row.label === "Records Storage" && row.statusLabel === "Blocked"));
  assert.ok(packet.ownerApprovalChecklist.some((item) => /Apple and Google/i.test(item)));
  assert.ok(packet.ownerApprovalChecklist.some((item) => /Privacy\/legal/i.test(item)));
  assert.ok(packet.handoffNotes.some((note) => /No App Store or Play Store submission/i.test(note)));
});

test("builds share text that is safe for Apollo, testers, and future builders", () => {
  const packet = buildReleasePacket(deriveLaunchReadiness(previewInput), {
    appName: "WoofWatcher",
    buildName: "premium revenue builder",
    generatedAtIso: "2026-06-21T19:00:00.000Z",
  });
  const text = buildReleasePacketShareText(packet);

  assert.match(text, /WoofWatcher Release Packet/);
  assert.match(text, /Verdict: Not ready for public launch/);
  assert.match(text, /Readiness score: \d+%/);
  assert.match(text, /Native iOS\/Android QA evidence is not attached/);
  assert.match(text, /No App Store or Play Store submission is approved by this packet/);
  assert.doesNotMatch(text, /STORE READY/i);
});

test("marks the packet launch-ready only when every launch gate is closed", () => {
  const packet = buildReleasePacket(deriveLaunchReadiness(completeInput), {
    appName: "WoofWatcher",
    buildName: "release candidate",
    generatedAtIso: "2026-06-21T19:00:00.000Z",
  });

  assert.equal(packet.storeLaunchReady, true);
  assert.equal(packet.verdictLabel, "Ready for release submission");
  assert.equal(packet.readinessScore, 100);
  assert.deepEqual(packet.blockers, []);
  assert.ok(packet.ownerApprovalChecklist.every((item) => /Ready|Confirmed|Approved|Enabled|Complete/.test(item)));
});
