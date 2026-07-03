import { test } from "node:test";
import assert from "node:assert/strict";

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
        /secret storage location/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.AUTH_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Redirect and deep-link URLs" &&
        /Expo scheme/.test(item.requiredEvidence) &&
        /iOS and Android/.test(item.requiredEvidence),
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
        /active household/.test(item.requiredEvidence) &&
        /invite acceptance/.test(item.requiredEvidence),
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
  assert.equal(manifest.rows[2]?.value, "Screenshots pending");
  assert.match(manifest.rows[2]?.detail ?? "", /iOS and Android Auth gateway/);
  assert.match(manifest.rows[3]?.detail ?? "", /Setup local-preview path/);
  assert.equal(manifest.rows[5]?.value, "Native proof blocked");
  assert.ok(manifest.blockers.some((blocker) => /Clerk production app/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /redirect and deep links/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /iOS and Android Auth gateway/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /Setup local-preview path/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /household creation/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /Apollo approval/i.test(blocker)));
});
