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
