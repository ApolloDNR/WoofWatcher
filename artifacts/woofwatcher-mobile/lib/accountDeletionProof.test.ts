import { test } from "node:test";
import assert from "node:assert/strict";

test("defines the self-serve account deletion proof packet before destructive deletion can be enabled", async () => {
  const mod = await import("./accountDeletionProof.ts").catch(() => null);
  assert.ok(mod, "accountDeletionProof module should exist");

  assert.match(mod.ACCOUNT_DELETION_PROOF_SUMMARY, /Self-serve account deletion proof packet/);
  assert.match(mod.ACCOUNT_DELETION_PROOF_SUMMARY, /self-serve deletion route/);
  assert.match(mod.ACCOUNT_DELETION_PROOF_SUMMARY, /export-before-delete warning/);
  assert.match(mod.ACCOUNT_DELETION_PROOF_SUMMARY, /data\/object deletion receipt/);
  assert.match(mod.ACCOUNT_DELETION_PROOF_SUMMARY, /audit trail/);
  assert.match(mod.ACCOUNT_DELETION_PROOF_SUMMARY, /recovery-window policy/);
  assert.match(mod.ACCOUNT_DELETION_PROOF_SUMMARY, /legal\/store approval/);

  const items = mod.ACCOUNT_DELETION_PROOF_ITEMS;
  assert.ok(Array.isArray(items));
  assert.deepEqual(
    items.map((item) => item.label),
    [
      "Deletion route and authentication gate",
      "Export-before-delete handoff",
      "Data and object deletion receipt",
      "Audit trail and support receipt",
      "Recovery window and cancellation rules",
      "Legal and store approval",
    ],
  );

  assert.ok(
    items.some(
      (item) =>
        item.label === "Deletion route and authentication gate" &&
        /self-serve deletion route/i.test(item.requiredEvidence) &&
        /reauthentication/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Export-before-delete handoff" &&
        /export-before-delete warning/i.test(item.requiredEvidence) &&
        /owner data export/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Data and object deletion receipt" &&
        /data\/object deletion receipt/i.test(item.requiredEvidence) &&
        /storage objects/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Audit trail and support receipt" &&
        /audit trail/i.test(item.requiredEvidence) &&
        /support receipt/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Recovery window and cancellation rules" &&
        /recovery-window policy/i.test(item.requiredEvidence) &&
        /cancel deletion/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Legal and store approval" &&
        /legal\/store approval/i.test(item.requiredEvidence) &&
        /privacy policy/i.test(item.requiredEvidence),
    ),
  );
});
