import { test } from "node:test";
import assert from "node:assert/strict";

test("defines the self-serve account deletion proof packet before destructive deletion can be enabled", async () => {
  const mod = await import("./accountDeletionProof.ts").catch(() => null);
  assert.ok(mod, "accountDeletionProof module should exist");

  assert.match(mod.ACCOUNT_DELETION_PROOF_SUMMARY, /Self-serve account deletion proof packet/);
  assert.match(mod.ACCOUNT_DELETION_PROOF_SUMMARY, /structured proof files/);
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
  assert.match(manifest.summary, /structured proof files/);
  assert.match(manifest.summary, /legal\/store approval/);
  assert.ok(manifest.items.every((item) => item.status === "blocked"));
  assert.ok(manifest.blockers.some((blocker) => /reauthentication/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /export-before-delete warning/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /data\/object deletion receipt/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /audit trail/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /recovery-window policy/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /legal\/store approval/i.test(blocker)));
});

test("keeps destructive deletion blocked when approvals lack structured proof files", async () => {
  const mod = await import("./accountDeletionProof.ts");
  const manifest = mod.buildAccountDeletionProofManifest({
    deletionRouteAuth: "Deletion route approved",
    exportBeforeDeleteHandoff: "Export handoff approved",
    dataObjectDeletionReceipt: "Provider deletion receipt approved",
    auditSupportReceipt: "Audit and support receipt approved",
    recoveryCancellationPolicy: "Recovery policy approved",
    legalStoreApproval: "Legal and store approved",
  });

  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.statusLabel, "Deletion blocked");
  assert.equal(manifest.destructiveDeletionAllowed, false);
  assert.equal(manifest.readyCount, 0);
  assert.equal(manifest.openCount, mod.ACCOUNT_DELETION_PROOF_ITEMS.length);
  assert.ok(manifest.items.every((item) => item.status === "blocked"));
  assert.ok(manifest.items.every((item) => item.evidenceAttached.length === 0));
  assert.match(manifest.blockers.join("\n"), /deletion-route\/auth proof file/);
  assert.match(manifest.blockers.join("\n"), /export-before-delete proof file/);
  assert.match(manifest.blockers.join("\n"), /data\/object deletion receipt proof file/);
  assert.match(manifest.blockers.join("\n"), /legal\/store approval proof file/);
});

test("allows deletion review only with complete structured proof evidence", async () => {
  const mod = await import("./accountDeletionProof.ts");
  const manifest = mod.buildAccountDeletionProofManifest({
    accountDeletionEvidence: [
      {
        kind: "deletion-route-auth",
        fileName: "account-deletion-route-auth-proof.json",
        uri: "file:///deletion-proof/account-deletion-route-auth-proof.json",
        mimeType: "application/json",
        byteSize: 4096,
        deletionRoute: "/settings/privacy/delete-account",
        reauthenticationMethod: "Clerk password or OAuth reauthentication",
        activeHouseholdScope: "Only active household membership is deleted after owner confirmation.",
        destructiveConfirmationCopy: "Type DELETE and confirm export before deletion.",
        localPreviewBoundaryAcknowledged: true,
      },
      {
        kind: "export-before-delete",
        fileName: "account-export-before-delete-proof.pdf",
        uri: "file:///deletion-proof/account-export-before-delete-proof.pdf",
        mimeType: "application/pdf",
        byteSize: 8192,
        exportWarningCopy: "Download your care records before deletion starts.",
        ownerDataExportLink: "https://app.woofwatcher.test/export/account-123",
        retainedRecordsExplanation: "Support receipts and legally retained billing records are named before deletion.",
        exitBeforeDeleteConfirmed: true,
      },
      {
        kind: "data-object-deletion-receipt",
        fileName: "account-data-object-deletion-receipt.json",
        uri: "file:///deletion-proof/account-data-object-deletion-receipt.json",
        mimeType: "application/json",
        byteSize: 6144,
        deletionReceiptId: "del_receipt_123",
        accountRowsDeleted: true,
        householdMembershipDeleted: true,
        careEntriesDeleted: true,
        reportsDeleted: true,
        credentialsDeleted: true,
        storageObjectsDeleted: true,
        providerTombstonesCreated: true,
      },
      {
        kind: "audit-support-receipt",
        fileName: "account-audit-support-receipt.md",
        uri: "file:///deletion-proof/account-audit-support-receipt.md",
        mimeType: "text/markdown",
        byteSize: 3072,
        auditTrailId: "audit_123",
        supportReceiptId: "support_123",
        requestId: "delete_request_123",
        deletionTimestamp: "2026-07-04T06:30:00.000Z",
        actingAccount: "owner@example.test",
        supportEscalationPath: "support@woofwatcher.test deletion queue",
        providerDelayEscalationReady: true,
      },
      {
        kind: "recovery-cancellation-policy",
        fileName: "account-recovery-cancellation-policy.pdf",
        uri: "file:///deletion-proof/account-recovery-cancellation-policy.pdf",
        mimeType: "application/pdf",
        byteSize: 5120,
        recoveryWindowPolicy: "Seven-day recovery window before irreversible deletion.",
        cancellationBehavior: "Owner can cancel from the deletion receipt before the irreversible timestamp.",
        irreversibleDeletionTimestamp: "2026-07-11T06:30:00.000Z",
        accountLockoutRules: "Account remains locked from new provider writes during the pending deletion window.",
        postWindowSupportLimits: "Support can share receipts only after the window closes.",
        cancelDeletionTested: true,
      },
      {
        kind: "legal-store-approval",
        fileName: "account-legal-store-approval-proof.pdf",
        uri: "file:///deletion-proof/account-legal-store-approval-proof.pdf",
        mimeType: "application/pdf",
        byteSize: 7168,
        privacyPolicySection: "Privacy policy section 8: account deletion and retention.",
        appStoreReviewReference: "App Store Guideline 5.1.1 deletion proof attached.",
        playStoreReviewReference: "Google Play Data Safety account deletion proof attached.",
        supportTermsReference: "Support terms deletion escalation section attached.",
        approvalOwner: "Apollo Duran",
        legalApproved: true,
        storeComplianceApproved: true,
        apolloApproved: true,
      },
    ],
  });

  assert.equal(manifest.status, "ready-for-review");
  assert.equal(manifest.statusLabel, "Ready for deletion review");
  assert.equal(manifest.destructiveDeletionAllowed, true);
  assert.equal(manifest.readyCount, mod.ACCOUNT_DELETION_PROOF_ITEMS.length);
  assert.equal(manifest.openCount, 0);
  assert.deepEqual(manifest.blockers, []);
  assert.deepEqual(
    manifest.items.map((item) => item.evidenceAttached[0]),
    [
      "Deletion route and reauthentication proof ready",
      "Export-before-delete handoff proof ready",
      "Data and object deletion receipt proof ready",
      "Audit trail and support receipt proof ready",
      "Recovery window and cancellation policy proof ready",
      "Legal, store, and Apollo approval proof ready",
    ],
  );
});
