import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveLaunchReadiness,
  launchReadinessBadgeLabel,
  type LaunchReadinessInput,
  type LaunchReadinessNativeQaSummary,
} from "./launchReadiness.ts";

const openNativeQa: LaunchReadinessNativeQaSummary = {
  total: 6,
  passed: 2,
  needsReview: 1,
  unreviewed: 3,
  requiredScreenshots: 12,
  missingScreenshots: 8,
  missingIosScreenshots: 4,
  missingAndroidScreenshots: 3,
  missingAnyScreenshots: 1,
};

const completeNativeQa: LaunchReadinessNativeQaSummary = {
  total: 6,
  passed: 6,
  needsReview: 0,
  unreviewed: 0,
  requiredScreenshots: 12,
  missingScreenshots: 0,
  missingIosScreenshots: 0,
  missingAndroidScreenshots: 0,
  missingAnyScreenshots: 0,
};

const fullyApprovedInput: LaunchReadinessInput = {
  nativeQa: completeNativeQa,
  local: {
    careWorkflowsReady: true,
    easProfilesReady: true,
    pixelAssetsReady: true,
    privacyExportReady: true,
  },
  provider: {
    accountDeletionEnabled: true,
    accountDeletionProofReady: true,
    aiProviderConfigured: true,
    aiProviderProofReady: true,
    appStoreAccountsReady: true,
    authConfigured: true,
    authProviderProofReady: true,
    databaseConfigured: true,
    databaseProviderProofReady: true,
    paymentsEnabled: true,
    paymentsProviderProofReady: true,
    privacyLegalApproved: true,
    privacyLegalProofReady: true,
    pushNotificationsConfigured: true,
    pushNotificationsProofReady: true,
    storeAccountsProofReady: true,
    storageProviderConfigured: true,
    storageProviderProofReady: true,
    supportRunbookApproved: true,
    supportRunbookProofReady: true,
  },
  syncStatus: "ready",
};

test("keeps launch readiness truthful when native QA and providers are still open", () => {
  const plan = deriveLaunchReadiness({
    nativeQa: openNativeQa,
    local: {
      careWorkflowsReady: true,
      easProfilesReady: true,
      pixelAssetsReady: true,
      privacyExportReady: true,
    },
    provider: {
      authConfigured: true,
      databaseConfigured: true,
      storageProviderConfigured: false,
      storageQueue: {
        total: 5,
        localOnly: 5,
        uploadReady: 0,
        providerSaved: 0,
        labels: ["care-log proof", "record document", "adventure memory"],
        detail:
          "5 local files across care-log proof, record document, adventure memory. Keep them local until storage rules are approved.",
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
  });

  assert.equal(plan.status, "native-qa-required");
  assert.equal(plan.storeLaunchReady, false);
  assert.equal(plan.badgeLabel, "NATIVE QA OPEN");
  assert.equal(plan.nextGate.kind, "native-qa");
  assert.equal(plan.nextGate.action, "share-native-qa-fix-brief");
  assert.match(plan.nextGate.label, /Needs tune/i);
  assert.match(plan.nextGate.detail, /1 route/i);
  assert.equal(plan.nextGate.ctaLabel, "Share Fix Brief");
  assert.match(plan.summary, /internal review/i);
  assert.ok(plan.blockers.some((blocker) => /Native iOS\/Android QA/i.test(blocker)));
  assert.ok(plan.blockers.some((blocker) => /storage/i.test(blocker)));
  assert.ok(plan.blockers.some((blocker) => /payments/i.test(blocker)));

  const nativeTile = plan.tiles.find((tile) => tile.key === "native-qa");
  const storageTile = plan.tiles.find((tile) => tile.key === "storage");
  const plusTile = plan.tiles.find((tile) => tile.key === "plus-payments");

  assert.equal(nativeTile?.status, "blocked");
  assert.match(nativeTile?.value ?? "", /8 screenshot/);
  assert.equal(storageTile?.status, "blocked");
  assert.equal(storageTile?.value, "5 local files gated");
  assert.match(storageTile?.detail ?? "", /care-log proof, record document, adventure memory/i);
  assert.equal(plusTile?.value, "Checkout gated");
});

test("does not call WoofWatcher store-ready until every local, provider, and approval gate is closed", () => {
  const plan = deriveLaunchReadiness(fullyApprovedInput);

  assert.equal(plan.status, "store-ready");
  assert.equal(plan.storeLaunchReady, true);
  assert.equal(plan.badgeLabel, "STORE READY");
  assert.equal(plan.nextGate.kind, "store-submission");
  assert.equal(plan.nextGate.action, "share-store-packet");
  assert.equal(plan.nextGate.ctaLabel, "Share Store Packet");
  assert.equal(plan.blockers.length, 0);
  assert.ok(plan.tiles.every((tile) => tile.status === "ready"));
  assert.match(plan.summary, /ready for release submission/i);
});

test("surfaces sync and local foundation gaps before provider approval", () => {
  const plan = deriveLaunchReadiness({
    ...fullyApprovedInput,
    local: {
      careWorkflowsReady: true,
      easProfilesReady: false,
      pixelAssetsReady: false,
      privacyExportReady: true,
    },
    syncStatus: "attention",
  });

  assert.equal(plan.status, "provider-gated");
  assert.equal(plan.storeLaunchReady, false);
  assert.equal(plan.nextGate.kind, "local-foundation");
  assert.equal(plan.nextGate.action, "share-beta-handoff");
  assert.match(plan.nextGate.label, /Expo\/EAS/i);
  assert.ok(plan.blockers.some((blocker) => /EAS/i.test(blocker)));
  assert.ok(plan.blockers.some((blocker) => /PixelLab/i.test(blocker)));

  const syncTile = plan.tiles.find((tile) => tile.key === "care-sync");
  assert.equal(syncTile?.status, "review");
  assert.equal(syncTile?.value, "Needs review");
});

test("names the current primary shell and release-proof secondary routes", () => {
  const plan = deriveLaunchReadiness({
    ...fullyApprovedInput,
    local: {
      ...fullyApprovedInput.local,
      careWorkflowsReady: false,
    },
  });

  assert.equal(plan.nextGate.kind, "local-foundation");
  assert.match(
    plan.nextGate.detail,
    /Today, Plan, Quick Log, Health, and More/,
  );
  assert.match(plan.nextGate.detail, /Log History, Records, and Privacy/);
});

test("keeps records storage blocked when provider setup lacks structured storage proof", () => {
  const plan = deriveLaunchReadiness({
    ...fullyApprovedInput,
    provider: {
      ...fullyApprovedInput.provider,
      storageProviderConfigured: true,
      storageProviderProofReady: false,
      storageQueue: {
        total: 3,
        localOnly: 3,
        uploadReady: 0,
        providerSaved: 0,
        labels: ["record document", "qa screenshot"],
        detail: "3 local files need structured storage proof before provider upload.",
      },
    },
  });

  assert.equal(plan.status, "provider-gated");
  assert.equal(plan.storeLaunchReady, false);
  assert.ok(plan.blockers.some((blocker) => /structured storage proof/i.test(blocker)));

  const storageTile = plan.tiles.find((tile) => tile.key === "storage");
  assert.equal(storageTile?.status, "blocked");
  assert.equal(storageTile?.value, "3 local files gated");
  assert.match(storageTile?.detail ?? "", /structured storage proof/i);
});

test("keeps provider-approved launch gates blocked without aggregate structured proof flags", () => {
  const plan = deriveLaunchReadiness({
    nativeQa: completeNativeQa,
    local: {
      careWorkflowsReady: true,
      easProfilesReady: true,
      pixelAssetsReady: true,
      privacyExportReady: true,
    },
    provider: {
      accountDeletionEnabled: true,
      aiProviderConfigured: true,
      appStoreAccountsReady: true,
      authConfigured: true,
      databaseConfigured: true,
      paymentsEnabled: true,
      privacyLegalApproved: true,
      pushNotificationsConfigured: true,
      storageProviderConfigured: true,
      storageProviderProofReady: true,
      supportRunbookApproved: true,
    },
    syncStatus: "ready",
  });

  assert.equal(plan.storeLaunchReady, false);
  assert.equal(plan.status, "provider-gated");
  assert.ok(plan.blockers.some((blocker) => /structured auth provider proof/i.test(blocker)));
  assert.ok(plan.blockers.some((blocker) => /structured care-entry provider sync proof/i.test(blocker)));
  assert.ok(plan.blockers.some((blocker) => /structured AI provider proof/i.test(blocker)));
  assert.ok(plan.blockers.some((blocker) => /structured payments proof/i.test(blocker)));

  const syncTile = plan.tiles.find((tile) => tile.key === "care-sync");
  const aiTile = plan.tiles.find((tile) => tile.key === "woofguide-ai");
  const plusTile = plan.tiles.find((tile) => tile.key === "plus-payments");
  const approvalTile = plan.tiles.find((tile) => tile.key === "store-approval");

  assert.equal(syncTile?.status, "local");
  assert.equal(aiTile?.status, "review");
  assert.equal(plusTile?.status, "blocked");
  assert.equal(approvalTile?.status, "review");
});

test("distinguishes owner-staged support packets from final legal and store approval", () => {
  const plan = deriveLaunchReadiness({
    ...fullyApprovedInput,
    provider: {
      ...fullyApprovedInput.provider,
      accountDeletionEnabled: false,
      appStoreAccountsReady: false,
      privacyLegalApproved: false,
      privacyLegalOwnerReviewed: true,
      pushNotificationsConfigured: false,
      supportRunbookApproved: false,
      supportRunbookOwnerReviewed: true,
    },
  });

  assert.equal(plan.status, "approval-required");
  assert.equal(plan.storeLaunchReady, false);
  assert.equal(plan.nextGate.kind, "owner-approval");
  assert.equal(plan.nextGate.action, "share-launch-packet");
  assert.match(plan.nextGate.label, /owner/i);

  const approvalTile = plan.tiles.find((tile) => tile.key === "store-approval");
  assert.equal(approvalTile?.status, "review");
  assert.equal(approvalTile?.value, "Owner packet staged");
  assert.match(approvalTile?.detail ?? "", /final legal/i);
  assert.ok(plan.blockers.some((blocker) => /Privacy\/legal owner packet/i.test(blocker)));
  assert.ok(plan.blockers.some((blocker) => /Support runbook owner packet/i.test(blocker)));
});

test("keeps Plus checkout in review until payment approval obligations are closed", () => {
  const plan = deriveLaunchReadiness({
    ...fullyApprovedInput,
    provider: {
      ...fullyApprovedInput.provider,
      paymentsEnabled: true,
      appStoreAccountsReady: false,
      privacyLegalApproved: false,
      supportRunbookApproved: false,
    },
  });

  assert.equal(plan.status, "approval-required");
  assert.equal(plan.storeLaunchReady, false);

  const plusTile = plan.tiles.find((tile) => tile.key === "plus-payments");
  assert.equal(plusTile?.status, "review");
  assert.equal(plusTile?.value, "Checkout approval open");
  assert.match(plusTile?.detail ?? "", /refund/i);
  assert.match(plusTile?.detail ?? "", /support/i);
  assert.match(plusTile?.detail ?? "", /store/i);
  assert.doesNotMatch(plusTile?.value ?? "", /ready/i);
  assert.ok(plan.blockers.some((blocker) => /Apple and Google/i.test(blocker)));
  assert.ok(plan.blockers.some((blocker) => /Privacy\/legal/i.test(blocker)));
  assert.ok(plan.blockers.some((blocker) => /Support/i.test(blocker)));
});

test("points launch readiness at native QA when no device proof exists yet", () => {
  const plan = deriveLaunchReadiness({
    ...fullyApprovedInput,
    nativeQa: null,
  });

  assert.equal(plan.status, "internal-preview");
  assert.equal(plan.nextGate.kind, "native-qa");
  assert.equal(plan.nextGate.action, "open-native-qa");
  assert.equal(plan.nextGate.ctaLabel, "Open QA Cockpit");
  assert.match(plan.nextGate.label, /iOS \+ Android proof/i);
  assert.match(plan.nextGate.detail, /real device screenshots/i);
});

test("provides owner-readable badge labels for launch status", () => {
  assert.equal(launchReadinessBadgeLabel("internal-preview"), "INTERNAL PREVIEW");
  assert.equal(launchReadinessBadgeLabel("native-qa-required"), "NATIVE QA OPEN");
  assert.equal(launchReadinessBadgeLabel("provider-gated"), "PROVIDER GATED");
  assert.equal(launchReadinessBadgeLabel("approval-required"), "APPROVAL OPEN");
  assert.equal(launchReadinessBadgeLabel("store-ready"), "STORE READY");
});
