import { test } from "node:test";
import assert from "node:assert/strict";

test("defines the WoofWatcher Plus payments proof packet before checkout can be enabled", async () => {
  const mod = await import("./paymentsProviderProof.ts").catch(() => null);
  assert.ok(mod, "paymentsProviderProof module should exist");

  assert.match(mod.PAYMENTS_PROVIDER_PROOF_SUMMARY, /WoofWatcher Plus payments proof packet/);
  assert.match(mod.PAYMENTS_PROVIDER_PROOF_SUMMARY, /Plus and Family product ids/);
  assert.match(mod.PAYMENTS_PROVIDER_PROOF_SUMMARY, /billing path decision/);
  assert.match(mod.PAYMENTS_PROVIDER_PROOF_SUMMARY, /sandbox receipt test/);
  assert.match(mod.PAYMENTS_PROVIDER_PROOF_SUMMARY, /entitlement mapping/);
  assert.match(mod.PAYMENTS_PROVIDER_PROOF_SUMMARY, /refund and support policy/);

  assert.deepEqual(
    mod.PAYMENTS_PROVIDER_PROOF_ITEMS.map((item) => item.label),
    [
      "Product catalog",
      "Billing path decision",
      "Sandbox receipt test",
      "Entitlement mapping",
      "Refund and support policy",
      "Checkout gate and restore behavior",
    ],
  );
  assert.ok(
    mod.PAYMENTS_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Product catalog" &&
        /Plus/.test(item.requiredEvidence) &&
        /Family/.test(item.requiredEvidence) &&
        /price/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.PAYMENTS_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Billing path decision" &&
        /App Store/.test(item.requiredEvidence) &&
        /Google Play/.test(item.requiredEvidence) &&
        /Stripe/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.PAYMENTS_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Sandbox receipt test" &&
        /receipt/.test(item.requiredEvidence) &&
        /cancel/.test(item.requiredEvidence) &&
        /refund/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.PAYMENTS_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Entitlement mapping" &&
        /Plus/.test(item.requiredEvidence) &&
        /Family/.test(item.requiredEvidence) &&
        /restore purchases/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.PAYMENTS_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Refund and support policy" &&
        /refund/.test(item.requiredEvidence) &&
        /support/.test(item.requiredEvidence) &&
        /subscription terms/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.PAYMENTS_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Checkout gate and restore behavior" &&
        /checkout stays disabled/.test(item.requiredEvidence) &&
        /restore purchases/.test(item.requiredEvidence),
    ),
  );
});
