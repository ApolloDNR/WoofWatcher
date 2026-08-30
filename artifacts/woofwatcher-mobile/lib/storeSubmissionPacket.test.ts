import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveLaunchReadiness, type LaunchReadinessInput } from "./launchReadiness.ts";
import { buildReleasePacket } from "./releasePacket.ts";
import { buildStoreSubmissionPacket, buildStoreSubmissionPacketShareText } from "./storeSubmissionPacket.ts";

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
    privacyLegalOwnerReviewed: true,
    supportRunbookApproved: false,
    supportRunbookOwnerReviewed: true,
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
    storageProviderProofReady: true,
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
  },
  syncStatus: "ready",
};

test("builds a blocked App Store and Play Store prep packet without claiming approval", () => {
  const releasePacket = buildReleasePacket(deriveLaunchReadiness(previewInput), {
    appName: "WoofWatcher",
    buildName: "premium mobile candidate",
    generatedAtIso: "2026-06-21T20:00:00.000Z",
  });
  const packet = buildStoreSubmissionPacket(releasePacket);

  assert.equal(packet.title, "WoofWatcher Store Submission Packet");
  assert.equal(packet.submissionReady, false);
  assert.equal(packet.verdictLabel, "Submission prep only");
  assert.equal(packet.metadata.shortDescription.length <= 80, true);
  assert.match(packet.metadata.fullDescription, /real-life dog care RPG/i);
  assert.match(packet.metadata.fullDescription, /not veterinary advice/i);
  assert.ok(packet.keywords.includes("dog care"));
  assert.ok(packet.screenshotChecklist.some((item) => item.screen === "Phoenix Home" && /iOS and Android/i.test(item.requirement)));
  assert.ok(
    packet.screenshotChecklist.some(
      (item) =>
        item.screen === "Health Watch" &&
        /Review packet/i.test(item.requirement) &&
        /Vet-share checklist/i.test(item.requirement) &&
        /Draft vet questions/i.test(item.requirement),
    ),
  );
  assert.ok(
    packet.screenshotChecklist.some(
      (item) =>
        item.screen === "Avatar Studio" &&
        /How accessories fit/i.test(item.requirement) &&
        /Tailored fit/i.test(item.requirement) &&
        /Standard preview/i.test(item.requirement),
    ),
  );
  assert.ok(packet.reviewNotes.some((note) => /not approved for App Store or Play Store submission/i.test(note)));
  assert.ok(packet.privacyDisclosures.some((item) => /care logs/i.test(item)));
  assert.ok(packet.blockedUntil.some((item) => /Native iOS\/Android/i.test(item)));
});

test("builds share text that is safe for store reviewers and future builders", () => {
  const releasePacket = buildReleasePacket(deriveLaunchReadiness(previewInput), {
    appName: "WoofWatcher",
    buildName: "premium mobile candidate",
    generatedAtIso: "2026-06-21T20:00:00.000Z",
  });
  const packet = buildStoreSubmissionPacket(releasePacket);
  const text = buildStoreSubmissionPacketShareText(packet);

  assert.match(text, /WoofWatcher Store Submission Packet/);
  assert.match(text, /Verdict: Submission prep only/);
  assert.match(text, /Not approved for App Store or Play Store submission/);
  assert.match(text, /Short description:/);
  assert.match(text, /Screenshot checklist:/);
  assert.match(text, /How accessories fit/);
  assert.match(text, /Privacy disclosures:/);
  assert.doesNotMatch(text, /Ready for public download/i);
});

test("marks the store packet ready only after the release packet has no blockers", () => {
  const releasePacket = buildReleasePacket(deriveLaunchReadiness(completeInput), {
    appName: "WoofWatcher",
    buildName: "release candidate",
    generatedAtIso: "2026-06-21T20:00:00.000Z",
  });
  const packet = buildStoreSubmissionPacket(releasePacket);

  assert.equal(packet.submissionReady, true);
  assert.equal(packet.verdictLabel, "Ready for store submission prep");
  assert.deepEqual(packet.blockedUntil, []);
  assert.ok(packet.reviewNotes.some((note) => /Final owner sign-off/i.test(note)));
});
