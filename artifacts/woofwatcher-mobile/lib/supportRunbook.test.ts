import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSupportLegalReadinessProofManifest,
  buildSupportRunbookShareText,
  deriveSupportRunbookPlan,
  SUPPORT_LEGAL_READINESS_PROOF_ITEMS,
} from "./supportRunbook.ts";

test("keeps support runbook unapproved when launch policies are missing", () => {
  const plan = deriveSupportRunbookPlan({
    supportEmail: "",
    privacyPolicyUrl: "",
    termsUrl: "",
    refundPolicyApproved: false,
    veterinaryBoundaryApproved: false,
    accountDeletionEscalationApproved: false,
    incidentResponseApproved: false,
  });

  assert.equal(plan.launchReady, false);
  assert.equal(plan.supportRunbookApproved, false);
  assert.equal(plan.privacyLegalApproved, false);
  assert.equal(plan.verdictLabel, "Not approved for public launch");
  assert.ok(plan.sections.some((section) => section.title === "Support inbox" && section.status === "manual_required"));
  assert.ok(plan.sections.some((section) => section.title === "Refund and subscription policy" && section.status === "blocked"));
  assert.ok(plan.sections.some((section) => section.title === "Vet and emergency boundary" && section.status === "blocked"));
  assert.ok(plan.sections.some((section) => section.title === "Privacy and terms links" && section.status === "blocked"));
  assert.ok(plan.sections.some((section) => section.title === "Deletion escalation" && section.status === "manual_required"));
  assert.ok(plan.launchBlockers.some((blocker) => /support inbox/i.test(blocker)));
  assert.ok(plan.launchBlockers.some((blocker) => /refund/i.test(blocker)));
  assert.ok(plan.launchBlockers.some((blocker) => /privacy/i.test(blocker)));
});

test("builds share text that preserves support, legal, and veterinary boundaries", () => {
  const plan = deriveSupportRunbookPlan({
    supportEmail: "help@woofwatcher.app",
    privacyPolicyUrl: "https://example.com/privacy",
    termsUrl: "https://example.com/terms",
    refundPolicyApproved: false,
    veterinaryBoundaryApproved: false,
    accountDeletionEscalationApproved: true,
    incidentResponseApproved: true,
  });

  const text = buildSupportRunbookShareText(plan, {
    appName: "WoofWatcher",
    generatedAtIso: "2026-06-21T20:00:00.000Z",
  });

  assert.match(text, /WoofWatcher Support Runbook/);
  assert.match(text, /Verdict: Not approved for public launch/);
  assert.match(text, /help@woofwatcher\.app/);
  assert.match(text, /not veterinary advice/i);
  assert.match(text, /Deletion escalation/);
  assert.match(text, /Open blockers:/);
});

test("marks support ready only when all policy gates are explicitly approved", () => {
  const plan = deriveSupportRunbookPlan({
    supportEmail: "help@woofwatcher.app",
    privacyPolicyUrl: "https://example.com/privacy",
    termsUrl: "https://example.com/terms",
    refundPolicyApproved: true,
    veterinaryBoundaryApproved: true,
    accountDeletionEscalationApproved: true,
    incidentResponseApproved: true,
  });

  assert.equal(plan.launchReady, true);
  assert.equal(plan.supportRunbookApproved, true);
  assert.equal(plan.privacyLegalApproved, true);
  assert.equal(plan.verdictLabel, "Support runbook ready for owner approval");
  assert.deepEqual(plan.launchBlockers, []);
  assert.ok(plan.sections.every((section) => section.status === "ready"));
});

test("builds a blocked support legal readiness proof manifest before public launch can be approved", () => {
  const manifest = buildSupportLegalReadinessProofManifest({});

  assert.equal(manifest.title, "Support legal readiness proof manifest");
  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.statusLabel, "Public launch blocked");
  assert.equal(manifest.publicLaunchAllowed, false);
  assert.equal(manifest.readyCount, 0);
  assert.equal(manifest.openCount, SUPPORT_LEGAL_READINESS_PROOF_ITEMS.length);
  assert.match(manifest.summary, /Public launch must stay blocked/);
  assert.match(manifest.summary, /Apollo approval/);
  assert.ok(manifest.items.every((item) => item.status === "blocked"));
  assert.ok(manifest.blockers.some((blocker) => /support inbox/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /privacy policy and terms links/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /refund\/subscription policy/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /veterinary.*boundary/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /deletion escalation/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /incident response owner/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /Apollo approval/i.test(blocker)));
});

test("keeps public launch blocked when support approvals lack structured proof files", () => {
  const manifest = buildSupportLegalReadinessProofManifest({
    supportInbox: "help@woofwatcher.app is monitored",
    privacyTermsLinks: "Privacy and terms are approved",
    refundSubscriptionPolicy: "Refund/subscription policy approved",
    veterinaryEmergencyBoundary: "Veterinary boundary approved",
    deletionEscalation: "Deletion escalation owner approved",
    incidentResponseOwner: "Incident response owner assigned",
    apolloApproval: "Apollo approved public launch",
  });

  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.publicLaunchAllowed, false);
  assert.equal(manifest.readyCount, 0);
  assert.equal(manifest.openCount, SUPPORT_LEGAL_READINESS_PROOF_ITEMS.length);
  assert.ok(manifest.items.every((item) => item.status === "blocked"));
  assert.ok(manifest.items.every((item) => item.evidenceAttached.length === 0));
  assert.match(manifest.blockers.join("\n"), /support inbox proof file/i);
  assert.match(manifest.blockers.join("\n"), /Apollo launch approval proof file/i);
});

test("opens support legal launch review when all structured proof files are attached", () => {
  const manifest = buildSupportLegalReadinessProofManifest({
    supportInbox: "Support inbox note retained for owner review",
    supportLegalEvidence: [
      {
        kind: "support-inbox",
        fileName: "support-inbox-proof.pdf",
        uri: "file:///support-legal/support-inbox-proof.pdf",
        mimeType: "application/pdf",
        byteSize: 48291,
        supportEmail: "help@woofwatcher.app",
        supportOwner: "Apollo Duran",
        coverageSchedule: "Weekday response and launch-week escalation",
        storeSupportUrl: "https://woofwatcher.app/support",
        escalationPath: "support to Apollo",
        supportInboxMonitored: true,
      },
      {
        kind: "privacy-terms-links",
        fileName: "privacy-terms-links-proof.json",
        uri: "file:///support-legal/privacy-terms-links-proof.json",
        mimeType: "application/json",
        byteSize: 32450,
        privacyPolicyUrl: "https://woofwatcher.app/privacy",
        termsUrl: "https://woofwatcher.app/terms",
        dataRetentionPolicy: "Retention, export, and deletion policy linked",
        exportDeletionPolicy: "Export and deletion paths documented",
        aiStoragePaymentsDisclosure: "AI, storage, and payments disclosures approved",
        storeListingUrlOwned: true,
      },
      {
        kind: "refund-subscription-policy",
        fileName: "refund-subscription-policy-proof.md",
        uri: "file:///support-legal/refund-subscription-policy-proof.md",
        mimeType: "text/markdown",
        byteSize: 18880,
        refundPolicyReference: "Refund policy v1",
        subscriptionCancellationLanguage: "Cancellation language approved",
        billingSupportWorkflow: "Billing support workflow documented",
        restorePurchaseSupport: "Restore purchase support documented",
        appStorePlaySubscriptionCompliance: true,
        premiumSurfaceCopyApproved: true,
      },
      {
        kind: "veterinary-emergency-boundary",
        fileName: "veterinary-emergency-boundary-proof.pdf",
        uri: "file:///support-legal/veterinary-emergency-boundary-proof.pdf",
        mimeType: "application/pdf",
        byteSize: 25210,
        veterinaryBoundaryCopy: "Not veterinary advice",
        emergencyEscalationCopy: "Emergency concerns go to a veterinarian",
        healthWatchBoundary: "Health Watch boundary approved",
        woofGuideBoundary: "WoofGuide boundary approved",
        supportBoundary: "Support boundary approved",
        storeCopyBoundary: "Store copy boundary approved",
        notVeterinaryAdviceApproved: true,
      },
      {
        kind: "deletion-escalation",
        fileName: "deletion-escalation-proof.json",
        uri: "file:///support-legal/deletion-escalation-proof.json",
        mimeType: "application/json",
        byteSize: 21930,
        deletionEscalationOwner: "Apollo Duran",
        exportFirstSupportFlow: "Export-first support flow documented",
        deletionRequestReceiptTemplate: "Deletion request receipt template approved",
        providerDelayFallback: "Provider delay fallback documented",
        selfServeDeletionProofReference: "account-deletion-proof packet",
        escalationOwnerApproved: true,
      },
      {
        kind: "incident-response-owner",
        fileName: "incident-response-owner-proof.pdf",
        uri: "file:///support-legal/incident-response-owner-proof.pdf",
        mimeType: "application/pdf",
        byteSize: 39110,
        incidentResponseOwner: "Apollo Duran",
        loginBillingTriagePath: "Login and billing triage path",
        privacyRequestsTriagePath: "Privacy request triage path",
        aiSafetyComplaintsTriagePath: "AI and safety complaints triage path",
        storeReviewFollowUpPath: "Store review follow-up path",
        incidentOwnerApproved: true,
      },
      {
        kind: "apollo-launch-approval",
        fileName: "apollo-launch-approval-proof.pdf",
        uri: "file:///support-legal/apollo-launch-approval-proof.pdf",
        mimeType: "application/pdf",
        byteSize: 41002,
        apolloApprovalOwner: "Apollo Duran",
        launchWindow: "Public launch window approved",
        noLaunchBoundary: "No launch before support/legal proof boundary acknowledged",
        publicLaunchDecision: "Ready for launch review only",
        supportLegalRefundVetApproved: true,
        apolloApproved: true,
        noLaunchBoundaryAcknowledged: true,
      },
    ],
  });

  assert.equal(manifest.status, "ready-for-review");
  assert.equal(manifest.statusLabel, "Ready for launch review");
  assert.equal(manifest.publicLaunchAllowed, true);
  assert.equal(manifest.readyCount, SUPPORT_LEGAL_READINESS_PROOF_ITEMS.length);
  assert.equal(manifest.openCount, 0);
  assert.deepEqual(manifest.blockers, []);
  assert.deepEqual(
    manifest.items.map((item) => item.evidenceAttached[0]),
    [
      "Support inbox proof ready",
      "Privacy policy and terms proof ready",
      "Refund and subscription policy proof ready",
      "Veterinary and emergency boundary proof ready",
      "Deletion escalation proof ready",
      "Incident response owner proof ready",
      "Apollo launch approval and no-launch boundary proof ready",
    ],
  );
});
