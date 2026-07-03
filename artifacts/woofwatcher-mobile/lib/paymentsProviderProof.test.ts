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

test("builds a Premium payments proof manifest before checkout can be enabled", async () => {
  const mod = await import("./paymentsProviderProof.ts").catch(() => null);
  assert.equal(typeof mod?.buildPaymentsProviderProofManifest, "function");

  const manifest = mod.buildPaymentsProviderProofManifest({
    productCatalogApproved: false,
    billingPathApproved: false,
    sandboxReceiptsApproved: false,
    entitlementMappingApproved: false,
    refundSupportApproved: false,
    checkoutGateApproved: false,
  });

  assert.equal(manifest.status, "blocked");
  assert.deepEqual(
    manifest.rows.map((row) => row.label),
    [
      "Product catalog",
      "Billing path decision",
      "Sandbox receipts",
      "Entitlements and restore",
      "Refund and support policy",
      "Checkout gate",
    ],
  );
  assert.equal(manifest.rows[2]?.value, "Receipts pending");
  assert.match(manifest.rows[2]?.detail ?? "", /purchase, renewal, cancel, refund, and expired receipt/);
  assert.match(manifest.rows[3]?.detail ?? "", /restore purchases/);
  assert.equal(manifest.rows[5]?.value, "Checkout disabled");
  assert.ok(manifest.blockers.some((blocker) => /Plus and Family product ids/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /billing path decision/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /sandbox receipts/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /restore purchases/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /refund and support/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /Apollo approval/i.test(blocker)));
});
