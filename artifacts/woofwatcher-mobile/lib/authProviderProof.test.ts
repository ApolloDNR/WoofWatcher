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
