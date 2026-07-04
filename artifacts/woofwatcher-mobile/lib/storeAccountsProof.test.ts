import { test } from "node:test";
import assert from "node:assert/strict";

test("defines the Apple and Google store accounts proof packet before submission can be claimed", async () => {
  const mod = await import("./storeAccountsProof.ts").catch(() => null);
  assert.ok(mod, "storeAccountsProof module should exist");

  assert.match(mod.STORE_ACCOUNTS_PROOF_SUMMARY, /Apple and Google store accounts proof packet/);
  assert.match(mod.STORE_ACCOUNTS_PROOF_SUMMARY, /Apple Developer team id/);
  assert.match(mod.STORE_ACCOUNTS_PROOF_SUMMARY, /App Store Connect app record/);
  assert.match(mod.STORE_ACCOUNTS_PROOF_SUMMARY, /Google Play package record/);
  assert.match(mod.STORE_ACCOUNTS_PROOF_SUMMARY, /bundle ids/);
  assert.match(mod.STORE_ACCOUNTS_PROOF_SUMMARY, /reviewer access notes/);
  assert.match(mod.STORE_ACCOUNTS_PROOF_SUMMARY, /release role approval/);

  const items = mod.STORE_ACCOUNTS_PROOF_ITEMS;
  assert.ok(Array.isArray(items));
  assert.deepEqual(
    items.map((item) => item.label),
    [
      "Apple Developer and App Store Connect access",
      "Google Play Console package record",
      "Bundle identifiers and signing ownership",
      "Reviewer access and test credentials",
      "Store screenshots and metadata ownership",
      "Release roles and submission approval",
    ],
  );

  assert.ok(
    items.some(
      (item) =>
        item.label === "Apple Developer and App Store Connect access" &&
        /Apple Developer team id/i.test(item.requiredEvidence) &&
        /App Store Connect app record/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Google Play Console package record" &&
        /Google Play package record/i.test(item.requiredEvidence) &&
        /package name/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Bundle identifiers and signing ownership" &&
        /bundle ids/i.test(item.requiredEvidence) &&
        /signing/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Reviewer access and test credentials" &&
        /reviewer access notes/i.test(item.requiredEvidence) &&
        /test credentials/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Store screenshots and metadata ownership" &&
        /store screenshots/i.test(item.requiredEvidence) &&
        /privacy labels/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Release roles and submission approval" &&
        /release role approval/i.test(item.requiredEvidence) &&
        /Apollo approval/i.test(item.requiredEvidence),
    ),
  );
});

test("builds a blocked store accounts proof manifest before submission can be claimed", async () => {
  const mod = await import("./storeAccountsProof.ts").catch(() => null);
  assert.ok(mod, "storeAccountsProof module should exist");

  const manifest = mod.buildStoreAccountsProofManifest({});

  assert.equal(manifest.title, "Store accounts proof manifest");
  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.statusLabel, "Store submission blocked");
  assert.equal(manifest.appSubmissionAllowed, false);
  assert.equal(manifest.readyCount, 0);
  assert.equal(manifest.openCount, 6);
  assert.match(manifest.summary, /Store submission must stay blocked/);
  assert.match(manifest.summary, /Apple\/Google/);
  assert.ok(manifest.items.every((item) => item.status === "blocked"));
  assert.ok(manifest.blockers.some((blocker) => /Apple Developer team id/.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /Google Play package record/.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /reviewer access notes/.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /privacy labels/.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /Apollo approval/.test(blocker)));
});

test("keeps store submission blocked when approvals lack structured Apple and Google proof files", async () => {
  const mod = await import("./storeAccountsProof.ts").catch(() => null);
  assert.equal(typeof mod?.buildStoreAccountsProofManifest, "function");

  const manifest = mod.buildStoreAccountsProofManifest({
    appleDeveloperAccess: "Apollo approved",
    googlePlayPackage: "Play Console approved",
    bundleSigningOwnership: "Signing owned",
    reviewerAccessCredentials: "Reviewer account ready",
    screenshotsMetadataOwnership: "Metadata approved",
    releaseRolesApproval: "Release approved",
  });

  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.statusLabel, "Store submission blocked");
  assert.equal(manifest.appSubmissionAllowed, false);
  assert.equal(manifest.readyCount, 0);
  assert.equal(manifest.openCount, 6);
  assert.ok(manifest.items.every((item) => item.status === "blocked"));
  assert.ok(manifest.items.every((item) => item.evidenceAttached.length === 0));
  assert.match(manifest.blockers.join("\n"), /iOS App Store Connect developer account proof/);
  assert.match(manifest.blockers.join("\n"), /Android Google Play package proof/);
  assert.match(manifest.blockers.join("\n"), /platform\/store-named proof file/);
  assert.match(manifest.blockers.join("\n"), /Apollo release approval/);
});

test("allows store review readiness only with platform and store named proof evidence", async () => {
  const mod = await import("./storeAccountsProof.ts").catch(() => null);
  assert.equal(typeof mod?.buildStoreAccountsProofManifest, "function");

  const manifest = mod.buildStoreAccountsProofManifest({
    storeAccountEvidence: [
      {
        kind: "apple-developer-access",
        platform: "ios",
        store: "app-store-connect",
        fileName: "ios-app-store-connect-apple-developer-access-proof.pdf",
        uri: "file:///store-proof/ios-app-store-connect-apple-developer-access-proof.pdf",
        mimeType: "application/pdf",
        byteSize: 8192,
        appleDeveloperTeamId: "TEAM12345",
        appStoreConnectAppId: "1234567890",
        accountRole: "Admin",
        bundleId: "com.woofwatcher.app",
        paidProgramActive: true,
      },
      {
        kind: "google-play-package",
        platform: "android",
        store: "google-play",
        fileName: "android-google-play-package-proof.png",
        uri: "file:///store-proof/android-google-play-package-proof.png",
        mimeType: "image/png",
        byteSize: 16384,
        googlePlayPackageName: "com.woofwatcher.app",
        googlePlayConsoleAppId: "play-app-123",
        accountRole: "Admin",
        testingTrackName: "internal",
        appSigningEnabled: true,
      },
      {
        kind: "bundle-signing-ownership",
        platform: "shared",
        store: "both",
        fileName: "ios-android-bundle-signing-ownership-proof.json",
        uri: "file:///store-proof/ios-android-bundle-signing-ownership-proof.json",
        mimeType: "application/json",
        byteSize: 4096,
        iosBundleId: "com.woofwatcher.app",
        androidPackageName: "com.woofwatcher.app",
        iosSigningOwner: "Pegasus Dreamscapes Corp",
        androidSigningOwner: "Pegasus Dreamscapes Corp",
        easCredentialsHandoff: true,
        associatedDomainsConfirmed: true,
        releaseKeystoreCustody: true,
      },
      {
        kind: "reviewer-access",
        platform: "shared",
        store: "both",
        fileName: "app-store-connect-google-play-reviewer-access-proof.pdf",
        uri: "file:///store-proof/app-store-connect-google-play-reviewer-access-proof.pdf",
        mimeType: "application/pdf",
        byteSize: 5120,
        reviewerUsername: "reviewer@woofwatcher.test",
        reviewerInstructions: "Use the demo household and stay in local preview.",
        demoHouseholdReady: true,
        authLimitationsNamed: true,
      },
      {
        kind: "metadata-privacy-ownership",
        platform: "shared",
        store: "both",
        fileName: "app-store-connect-google-play-metadata-privacy-proof.json",
        uri: "file:///store-proof/app-store-connect-google-play-metadata-privacy-proof.json",
        mimeType: "application/json",
        byteSize: 6144,
        screenshotsApproved: true,
        privacyLabelsApproved: true,
        supportUrlApproved: true,
        ageRatingApproved: true,
        metadataOwnerApproved: true,
      },
      {
        kind: "release-approval",
        platform: "shared",
        store: "both",
        fileName: "app-store-connect-google-play-release-approval-proof.pdf",
        uri: "file:///store-proof/app-store-connect-google-play-release-approval-proof.pdf",
        mimeType: "application/pdf",
        byteSize: 7168,
        releaseTrackName: "internal beta",
        submitterIdentity: "Apollo Duran",
        supportLegalApproved: true,
        apolloApproved: true,
        noSubmitBoundaryAcknowledged: true,
      },
    ],
  });

  assert.equal(manifest.status, "ready-for-review");
  assert.equal(manifest.statusLabel, "Ready for store review");
  assert.equal(manifest.appSubmissionAllowed, true);
  assert.equal(manifest.readyCount, 6);
  assert.equal(manifest.openCount, 0);
  assert.deepEqual(manifest.blockers, []);
  assert.deepEqual(
    manifest.items.map((item) => item.evidenceAttached[0]),
    [
      "iOS App Store Connect developer account proof ready",
      "Android Google Play package proof ready",
      "iOS/Android bundle and signing ownership proof ready",
      "App Review and Play review access proof ready",
      "Store screenshots, metadata, and privacy proof ready",
      "Apollo release approval and no-submit boundary proof ready",
    ],
  );
});
