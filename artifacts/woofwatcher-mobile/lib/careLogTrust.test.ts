import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCareLogTrustReviewPatch,
  getCareLogTrustReview,
  type CareLogTrustEntryLike,
} from "./careLogTrust.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-19T16:45:00-07:00").getTime();

function entry(overrides: Partial<CareLogTrustEntryLike> = {}): CareLogTrustEntryLike {
  return {
    id: "meal_1",
    type: "meal",
    title: "Dinner",
    caregiver: "Maya",
    occurredAt: "2026-06-19T23:30:00.000Z",
    details: {
      householdVisible: true,
      trustState: "pending-confirmation",
      confirmationRequired: true,
      confirmationReason: "kid-log",
    },
    ...overrides,
  };
}

test("identifies pending kid logs as adult-reviewable care logs", () => {
  const review = getCareLogTrustReview(entry(), "Adult");

  assert.equal(review.visible, true);
  assert.equal(review.canReview, true);
  assert.equal(review.state, "pending-confirmation");
  assert.equal(review.statusLabel, "Needs adult confirmation");
  assert.equal(review.reasonLabel, "Kid log");
  assert.deepEqual(
    review.actions.map((action) => action.id),
    ["confirm", "reject", "request-photo", "mark-corrected"],
  );
});

test("confirms a pending log and records an audit trail", () => {
  const patch = buildCareLogTrustReviewPatch(entry(), {
    action: "confirm",
    reviewer: "Emma",
    reviewerRole: "Adult",
    now: NOW,
    note: "Dinner amount matches what Maya told me.",
  });

  assert.ok(patch);
  assert.equal(patch.details.trustState, "confirmed");
  assert.equal(patch.details.confirmationRequired, false);
  assert.equal(patch.details.confirmedBy, "Emma");
  assert.equal(patch.details.confirmedAt, "2026-06-19T23:45:00.000Z");
  assert.equal(patch.details.confirmationNote, "Dinner amount matches what Maya told me.");
  assert.equal(Array.isArray(patch.details.auditTrail), true);
  assert.match(String(patch.details.auditTrail?.[0]?.summary), /Emma confirmed "Dinner"/);
  assert.deepEqual(patch.details.auditTrail?.[0]?.changes, ["trustState", "confirmationRequired", "confirmedAt"]);
});

test("rejects a helper log with visible watch severity and rejection detail", () => {
  const patch = buildCareLogTrustReviewPatch(
    entry({
      id: "med_1",
      type: "medication",
      title: "Medication - Heartgard",
      caregiver: "Riley",
      details: {
        householdVisible: true,
        trustState: "pending-confirmation",
        confirmationRequired: true,
        confirmationReason: "helper-log",
        medicationOutcome: "taken",
      },
    }),
    {
      action: "reject",
      reviewer: "Apollo",
      reviewerRole: "Adult Admin",
      now: NOW,
      note: "Dose could not be verified.",
    },
  );

  assert.ok(patch);
  assert.equal(patch.severity, "watch");
  assert.equal(patch.details.trustState, "rejected");
  assert.equal(patch.details.confirmationRequired, false);
  assert.equal(patch.details.rejectedBy, "Apollo");
  assert.equal(patch.details.rejectionNote, "Dose could not be verified.");
  assert.match(String(patch.details.auditTrail?.[0]?.summary), /Apollo rejected "Medication - Heartgard"/);
});

test("requests photo proof without clearing the confirmation requirement", () => {
  const patch = buildCareLogTrustReviewPatch(entry(), {
    action: "request-photo",
    reviewer: "Emma",
    reviewerRole: "Primary caregiver",
    now: NOW,
  });

  assert.ok(patch);
  assert.equal(patch.details.trustState, "pending-confirmation");
  assert.equal(patch.details.confirmationRequired, true);
  assert.equal(patch.details.photoProofStatus, "requested");
  assert.equal(patch.details.photoProofRequestedBy, "Emma");
  assert.equal(patch.details.photoProofRequestedAt, "2026-06-19T23:45:00.000Z");
  assert.match(String(patch.details.auditTrail?.[0]?.summary), /Emma requested photo proof/);
});

test("marks a corrected log without deleting the original record", () => {
  const patch = buildCareLogTrustReviewPatch(entry(), {
    action: "mark-corrected",
    reviewer: "Apollo",
    reviewerRole: "Owner",
    now: NOW,
    note: "Changed from full dinner to ate most.",
  });

  assert.ok(patch);
  assert.equal(patch.details.trustState, "corrected");
  assert.equal(patch.details.confirmationRequired, false);
  assert.equal(patch.details.correctedBy, "Apollo");
  assert.equal(patch.details.correctionNote, "Changed from full dinner to ate most.");
  assert.match(String(patch.details.auditTrail?.[0]?.summary), /Apollo marked "Dinner" corrected/);
});

test("blocks kid, sitter, trainer, and vet viewer roles from reviewing logs", () => {
  for (const role of ["Kid", "Sitter", "Trainer", "Vet Viewer"]) {
    const review = getCareLogTrustReview(entry(), role);
    const patch = buildCareLogTrustReviewPatch(entry(), {
      action: "confirm",
      reviewer: "Helper",
      reviewerRole: role,
      now: NOW,
    });

    assert.equal(review.canReview, false, `${role} should not review trust state`);
    assert.equal(patch, null, `${role} should not produce a review patch`);
  }
});
