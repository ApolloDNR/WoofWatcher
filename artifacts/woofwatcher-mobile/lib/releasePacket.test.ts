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
    authProviderProofReady: true,
    databaseConfigured: true,
    databaseProviderProofReady: true,
    storageProviderConfigured: true,
    aiProviderConfigured: true,
    aiProviderProofReady: true,
    paymentsEnabled: true,
    paymentsProviderProofReady: true,
    accountDeletionEnabled: true,
    accountDeletionProofReady: true,
    pushNotificationsConfigured: true,
    pushNotificationsProofReady: true,
    appStoreAccountsReady: true,
    storeAccountsProofReady: true,
    privacyLegalApproved: true,
    privacyLegalProofReady: true,
    supportRunbookApproved: true,
    supportRunbookProofReady: true,
    storageProviderProofReady: true,
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
  assert.equal(packet.betaShipStatus, "qa-first");
  assert.equal(packet.betaVerdictLabel, "Beta candidate - capture device proof");
  assert.match(packet.betaSummary, /usable as a beta candidate/i);
  assert.ok(packet.betaNextActions.some((item) => /iOS and one Android/i.test(item)));
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
  assert.match(text, /48-hour beta target/);
  assert.match(text, /Beta candidate - capture device proof/);
  assert.match(text, /Beta next actions/);
  assert.match(text, /Readiness score: \d+%/);
  assert.match(text, /Native iOS\/Android QA evidence is not attached/);
  assert.match(text, /No App Store or Play Store submission is approved by this packet/);
  assert.doesNotMatch(text, /STORE READY/i);
});

test("separates internal beta readiness from public provider and store gates", () => {
  const packet = buildReleasePacket(
    deriveLaunchReadiness({
      ...previewInput,
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
    }),
    {
      appName: "WoofWatcher",
      buildName: "two day beta",
      generatedAtIso: "2026-06-21T19:00:00.000Z",
    },
  );

  assert.equal(packet.storeLaunchReady, false);
  assert.equal(packet.betaShipStatus, "ready");
  assert.equal(packet.betaVerdictLabel, "Ready for internal beta");
  assert.match(packet.betaSummary, /Expo\/PWA beta/i);
  assert.ok(packet.blockers.some((blocker) => /Production auth/i.test(blocker)));
  assert.ok(packet.betaNextActions.some((item) => /Share the Expo\/PWA beta/i.test(item)));
  assert.ok(
    packet.betaNextActions.some(
      (item) =>
        /Today, Plan, Quick Log, Health, and More/.test(item) &&
        /Log History, Records, and Privacy/.test(item),
    ),
  );
});

test("blocks internal beta when local release foundations are not verified", () => {
  const packet = buildReleasePacket(
    deriveLaunchReadiness({
      ...previewInput,
      local: {
        careWorkflowsReady: true,
        easProfilesReady: false,
        pixelAssetsReady: true,
        privacyExportReady: true,
      },
    }),
    {
      appName: "WoofWatcher",
      buildName: "two day beta",
      generatedAtIso: "2026-06-21T19:00:00.000Z",
    },
  );

  assert.equal(packet.betaShipStatus, "blocked");
  assert.equal(packet.betaVerdictLabel, "Beta blocked by local release gates");
  assert.ok(packet.betaNextActions.some((item) => /EAS build profiles/i.test(item)));
});

test("marks the packet launch-ready only when every launch gate is closed", () => {
  const packet = buildReleasePacket(deriveLaunchReadiness(completeInput), {
    appName: "WoofWatcher",
    buildName: "release candidate",
    generatedAtIso: "2026-06-21T19:00:00.000Z",
  });

  assert.equal(packet.storeLaunchReady, true);
  assert.equal(packet.betaShipStatus, "ready");
  assert.equal(packet.betaVerdictLabel, "Ready for release submission");
  assert.equal(packet.verdictLabel, "Ready for release submission");
  assert.equal(packet.readinessScore, 100);
  assert.deepEqual(packet.blockers, []);
  assert.ok(packet.ownerApprovalChecklist.every((item) => /Ready|Confirmed|Approved|Enabled|Complete/.test(item)));
});
