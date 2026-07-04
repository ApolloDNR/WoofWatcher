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

test("builds a blocked account deletion proof manifest before destructive deletion can be enabled", async () => {
  const mod = await import("./accountDeletionProof.ts");
  const manifest = mod.buildAccountDeletionProofManifest({});

  assert.equal(manifest.title, "Account deletion proof manifest");
  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.statusLabel, "Deletion blocked");
  assert.equal(manifest.destructiveDeletionAllowed, false);
  assert.equal(manifest.readyCount, 0);
  assert.equal(manifest.openCount, mod.ACCOUNT_DELETION_PROOF_ITEMS.length);
  assert.match(manifest.summary, /Destructive account deletion must stay blocked/);
  assert.match(manifest.summary, /legal\/store approval/);
  assert.ok(manifest.items.every((item) => item.status === "blocked"));
  assert.ok(manifest.blockers.some((blocker) => /reauthentication/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /export-before-delete warning/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /data\/object deletion receipt/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /audit trail/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /recovery-window policy/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /legal\/store approval/i.test(blocker)));
});
