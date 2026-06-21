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
    aiProviderConfigured: true,
    appStoreAccountsReady: true,
    authConfigured: true,
    databaseConfigured: true,
    paymentsEnabled: true,
    privacyLegalApproved: true,
    pushNotificationsConfigured: true,
    storageProviderConfigured: true,
    supportRunbookApproved: true,
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
  assert.equal(plusTile?.value, "Checkout gated");
});

test("does not call WoofWatcher store-ready until every local, provider, and approval gate is closed", () => {
  const plan = deriveLaunchReadiness(fullyApprovedInput);

  assert.equal(plan.status, "store-ready");
  assert.equal(plan.storeLaunchReady, true);
  assert.equal(plan.badgeLabel, "STORE READY");
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
  assert.ok(plan.blockers.some((blocker) => /EAS/i.test(blocker)));
  assert.ok(plan.blockers.some((blocker) => /PixelLab/i.test(blocker)));

  const syncTile = plan.tiles.find((tile) => tile.key === "care-sync");
  assert.equal(syncTile?.status, "review");
  assert.equal(syncTile?.value, "Needs review");
});

test("provides owner-readable badge labels for launch status", () => {
  assert.equal(launchReadinessBadgeLabel("internal-preview"), "INTERNAL PREVIEW");
  assert.equal(launchReadinessBadgeLabel("native-qa-required"), "NATIVE QA OPEN");
  assert.equal(launchReadinessBadgeLabel("provider-gated"), "PROVIDER GATED");
  assert.equal(launchReadinessBadgeLabel("approval-required"), "APPROVAL OPEN");
  assert.equal(launchReadinessBadgeLabel("store-ready"), "STORE READY");
});
