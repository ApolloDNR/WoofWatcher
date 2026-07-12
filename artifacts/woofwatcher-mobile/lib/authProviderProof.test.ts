import { test } from "node:test";
import assert from "node:assert/strict";

function completeNativeEvidence() {
  return [
    {
      platform: "ios" as const,
      surface: "auth-gateway" as const,
      fileName: "ios-auth-gateway-provider-boundary.png",
      mimeType: "image/png",
      byteSize: 124000,
      capturesProviderBoundaryCopy: true,
    },
    {
      platform: "android" as const,
      surface: "auth-gateway" as const,
      fileName: "android-auth-gateway-provider-boundary.png",
      mimeType: "image/png",
      byteSize: 118000,
      capturesProviderBoundaryCopy: true,
    },
    {
      platform: "ios" as const,
      surface: "setup-local-preview" as const,
      fileName: "ios-setup-local-preview-save-controls.png",
      mimeType: "image/png",
      byteSize: 132000,
      capturesProviderBoundaryCopy: true,
      capturesReachableControls: true,
    },
    {
      platform: "android" as const,
      surface: "setup-local-preview" as const,
      fileName: "android-setup-local-preview-save-controls.png",
      mimeType: "image/png",
      byteSize: 129000,
      capturesProviderBoundaryCopy: true,
      capturesReachableControls: true,
    },
  ];
}

function completeProviderEvidence() {
  return [
    {
      kind: "clerk-production" as const,
      fileName: "clerk-production-auth-proof.json",
      mimeType: "application/json",
      byteSize: 18240,
      productionAppId: "clerk-prod-woofwatcher",
      publishableKeyEnvironment: "production mobile and web environment",
      secretStorageLocation: "provider vault, not committed env files",
      localPlaceholderKeysExcluded: true,
      secretStorageApproved: true,
    },
    {
      kind: "redirect-deep-links" as const,
      fileName: "auth-redirect-deep-link-proof.json",
      mimeType: "application/json",
      byteSize: 16400,
      redirectUrls: [
        "woofwatcher://auth/callback",
        "com.woofwatcher.app://auth/callback",
        "com.apollodnr.woofwatcher://auth/callback",
        "https://app.woofwatcher.com/auth/callback",
        "https://app.woofwatcher.com/setup",
      ],
      expoSchemeApproved: true,
      iosBundleApproved: true,
      androidBundleApproved: true,
      productionWebApproved: true,
      postAuthReturnApproved: true,
    },
    {
      kind: "household-membership" as const,
      fileName: "auth-household-membership-proof.json",
      mimeType: "application/json",
      byteSize: 21120,
      activeHouseholdPolicy: "active household id resolves from authenticated membership",
      inviteAcceptancePolicy: "invite acceptance requires valid household invitation",
      joinCreatePermissionPolicy: "create and join permissions are owner-controlled",
      roleEnforcementPolicy: "roles constrain household reads and writes",
      crossHouseholdAccessDenied: true,
      householdMembershipApproved: true,
    },
    {
      kind: "launch-approval" as const,
      fileName: "auth-apollo-launch-approval-proof.json",
      mimeType: "application/json",
      byteSize: 14920,
      apolloApprovalOwner: "Apollo Duran",
      noLaunchBoundary: "No provider-backed account sync until Apollo approves the release gate",
      nativeProofReference: "native-auth-setup-proof-2026-07-04",
      apolloApproved: true,
    },
  ];
}

test("defines the production auth provider proof packet before account sync can be claimed", async () => {
  const mod = await import("./authProviderProof.ts").catch(() => null);
  assert.ok(mod, "authProviderProof module should exist");

  assert.match(mod.AUTH_PROVIDER_PROOF_SUMMARY, /Production auth provider proof packet/);
  assert.match(mod.AUTH_PROVIDER_PROOF_SUMMARY, /Clerk production app id/);
  assert.match(mod.AUTH_PROVIDER_PROOF_SUMMARY, /redirect\/deep-link URL list/);
  assert.match(mod.AUTH_PROVIDER_PROOF_SUMMARY, /OAuth sign-in test/);
  assert.match(mod.AUTH_PROVIDER_PROOF_SUMMARY, /session policy/);
  assert.match(mod.AUTH_PROVIDER_PROOF_SUMMARY, /household membership policy/);

  assert.deepEqual(
    mod.AUTH_PROVIDER_PROOF_ITEMS.map((item) => item.label),
    [
      "Clerk production app",
      "Redirect and deep-link URLs",
      "OAuth sign-in test",
      "Session and token policy",
      "Household membership policy",
    ],
  );
  assert.ok(
    mod.AUTH_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Clerk production app" &&
        /publishable key environment/.test(item.requiredEvidence) &&
        /secret storage location/.test(item.requiredEvidence) &&
        /approval booleans/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.AUTH_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Redirect and deep-link URLs" &&
        /Expo scheme/.test(item.requiredEvidence) &&
        /iOS and Android/.test(item.requiredEvidence) &&
        /row-specific approvals/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.AUTH_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "OAuth sign-in test" &&
        /native screenshot/.test(item.requiredEvidence) &&
        /no local-preview fallback/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.AUTH_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Session and token policy" &&
        /token refresh/.test(item.requiredEvidence) &&
        /sign-out behavior/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.AUTH_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Household membership policy" &&
        /active-household/.test(item.requiredEvidence) &&
        /invite acceptance/.test(item.requiredEvidence) &&
        /denied cross-household access/.test(item.requiredEvidence),
    ),
  );
});

test("builds an Auth/Setup proof manifest before native proof can be claimed", async () => {
  const mod = await import("./authProviderProof.ts").catch(() => null);
  assert.equal(typeof mod?.buildAuthSetupProofManifest, "function");

  const manifest = mod.buildAuthSetupProofManifest({
    clerkProductionApproved: false,
    redirectDeepLinkApproved: false,
    nativeAuthScreensApproved: false,
    setupNativeScreensApproved: false,
    householdSyncApproved: false,
    launchGateApproved: false,
  });

  assert.equal(manifest.status, "blocked");
  assert.deepEqual(
    manifest.rows.map((row) => row.label),
    [
      "Clerk production app",
      "Redirect and deep links",
      "Native auth screenshots",
      "Setup local-preview proof",
      "Household sync boundary",
      "Launch gate",
    ],
  );
  assert.equal(manifest.rows[2]?.value, "0/2 Auth gateway screenshots ready");
  assert.match(manifest.rows[2]?.detail ?? "", /iOS and Android Auth gateway/);
  assert.match(manifest.rows[3]?.detail ?? "", /Setup local-preview path/);
  assert.equal(manifest.rows[5]?.value, "Native proof blocked");
  assert.ok(manifest.blockers.some((blocker) => /Clerk production app/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /redirect and deep links/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /iOS and Android Auth gateway/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /Setup local-preview path/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /household creation/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /Apollo.*approval/i.test(blocker)));
});

test("keeps Auth/Setup proof blocked when generic native approvals lack platform evidence", async () => {
  const mod = await import("./authProviderProof.ts").catch(() => null);
  assert.equal(typeof mod?.buildAuthSetupProofManifest, "function");

  const manifest = mod.buildAuthSetupProofManifest({
    clerkProductionApproved: true,
    redirectDeepLinkApproved: true,
    nativeAuthScreensApproved: true,
    setupNativeScreensApproved: true,
    householdSyncApproved: true,
    launchGateApproved: true,
  });

  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.rows[2]?.status, "blocked");
  assert.match(manifest.rows[2]?.value ?? "", /0\/2 Auth gateway screenshots ready/);
  assert.equal(manifest.rows[3]?.status, "blocked");
  assert.match(manifest.rows[3]?.value ?? "", /0\/2 Setup local-preview screenshots ready/);
  assert.equal(manifest.rows[5]?.status, "blocked");
  assert.match(manifest.blockers.join("\n"), /iOS Auth gateway screenshot/);
  assert.match(manifest.blockers.join("\n"), /Android Setup local-preview screenshot/);
});

test("keeps Auth/Setup proof blocked when provider approvals lack structured proof files", async () => {
  const mod = await import("./authProviderProof.ts").catch(() => null);
  assert.equal(typeof mod?.buildAuthSetupProofManifest, "function");

  const manifest = mod.buildAuthSetupProofManifest({
    clerkProductionApproved: true,
    redirectDeepLinkApproved: true,
    nativeAuthScreensApproved: true,
    setupNativeScreensApproved: true,
    householdSyncApproved: true,
    launchGateApproved: true,
    nativeEvidence: completeNativeEvidence(),
  });

  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.rows[0]?.value, "Clerk pending structured proof");
  assert.equal(manifest.rows[1]?.value, "Redirects pending structured proof");
  assert.equal(manifest.rows[2]?.value, "2/2 Auth gateway screenshots ready");
  assert.equal(manifest.rows[3]?.value, "2/2 Setup local-preview screenshots ready");
  assert.equal(manifest.rows[4]?.value, "Household sync pending structured proof");
  assert.equal(manifest.rows[5]?.value, "Native proof blocked");
  assert.match(manifest.blockers.join("\n"), /structured proof file/);
  assert.match(manifest.blockers.join("\n"), /structured Apollo launch approval/);
});

test("approves Auth/Setup native proof only with platform-specific screenshots and structured provider evidence", async () => {
  const mod = await import("./authProviderProof.ts").catch(() => null);
  assert.equal(typeof mod?.buildAuthSetupProofManifest, "function");

  const manifest = mod.buildAuthSetupProofManifest({
    clerkProductionApproved: true,
    redirectDeepLinkApproved: true,
    nativeAuthScreensApproved: true,
    setupNativeScreensApproved: true,
    householdSyncApproved: true,
    launchGateApproved: true,
    nativeEvidence: completeNativeEvidence(),
    providerEvidence: completeProviderEvidence(),
  });

  assert.equal(manifest.status, "ready");
  assert.equal(manifest.rows[0]?.value, "Clerk proof ready");
  assert.equal(manifest.rows[1]?.value, "Redirect proof ready");
  assert.equal(manifest.rows[2]?.value, "2/2 Auth gateway screenshots ready");
  assert.equal(manifest.rows[3]?.value, "2/2 Setup local-preview screenshots ready");
  assert.equal(manifest.rows[4]?.value, "Household sync proof ready");
  assert.equal(manifest.rows[5]?.value, "Native proof approved");
  assert.deepEqual(manifest.blockers, []);
});
