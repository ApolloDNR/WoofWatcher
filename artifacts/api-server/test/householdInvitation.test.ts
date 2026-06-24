import { strict as assert } from "node:assert";
import test from "node:test";
import * as householdInvitations from "../src/lib/household-invitations.ts";

const {
  assertHouseholdInvitationAcceptAllowed,
  deriveHouseholdInvitationRuntimeStatus,
  normalizeHouseholdInvitationListQuery,
} = householdInvitations;

test("household invitation lifecycle blocks unapproved or expired invites before membership creation", () => {
  assert.equal(
    typeof deriveHouseholdInvitationRuntimeStatus,
    "function",
    "household invitations need shared lifecycle logic before join routes create memberships",
  );
  assert.equal(
    typeof assertHouseholdInvitationAcceptAllowed,
    "function",
    "join-by-invite must have an explicit accept policy",
  );

  const now = new Date("2026-06-24T12:00:00.000Z");

  const approved = deriveHouseholdInvitationRuntimeStatus({
    lifecycleState: "approved",
    expiresAt: "2026-06-24T13:00:00.000Z",
    now,
  });
  assert.deepEqual(approved, {
    lifecycleState: "approved",
    runtimeLifecycleState: "approved",
    expiresAt: "2026-06-24T13:00:00.000Z",
    expired: false,
  });
  assert.deepEqual(assertHouseholdInvitationAcceptAllowed(approved), {
    allowed: true,
    lifecycleState: "approved",
  });

  const pending = deriveHouseholdInvitationRuntimeStatus({
    lifecycleState: "pending-approval",
    expiresAt: "2026-06-24T13:00:00.000Z",
    now,
  });
  assert.equal(assertHouseholdInvitationAcceptAllowed(pending).allowed, false);
  assert.match(
    assertHouseholdInvitationAcceptAllowed(pending).reason ?? "",
    /waiting for owner approval/i,
  );

  const expired = deriveHouseholdInvitationRuntimeStatus({
    lifecycleState: "approved",
    expiresAt: "2026-06-24T11:59:59.000Z",
    now,
  });
  assert.deepEqual(expired, {
    lifecycleState: "approved",
    runtimeLifecycleState: "expired",
    expiresAt: "2026-06-24T11:59:59.000Z",
    expired: true,
    reason: "Invitation expired before it was accepted.",
  });
  assert.equal(assertHouseholdInvitationAcceptAllowed(expired).lifecycleState, "expired");
});

test("household invitation list query keeps safe lifecycle filters", () => {
  assert.equal(
    typeof normalizeHouseholdInvitationListQuery,
    "function",
    "owner/admin invitation review needs a shared query normalizer",
  );

  assert.deepEqual(
    normalizeHouseholdInvitationListQuery({
      limit: "500",
      lifecycleState: "APPROVED",
    }),
    {
      limit: 100,
      lifecycleState: "approved",
    },
  );

  assert.deepEqual(
    normalizeHouseholdInvitationListQuery({
      limit: "-10",
      lifecycleState: "unknown",
    }),
    {
      limit: 1,
    },
  );
});
