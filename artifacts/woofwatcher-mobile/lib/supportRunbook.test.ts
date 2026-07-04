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
  assert.ok(manifest.blockers.some((blocker) => /veterinary boundary/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /deletion escalation/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /incident response owner/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /Apollo approval/i.test(blocker)));
});
