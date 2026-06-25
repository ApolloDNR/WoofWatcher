import assert from "node:assert/strict";
import { test } from "node:test";

import * as householdSharingCleanup from "../src/lib/household-sharing-cleanup.ts";

const {
  buildHouseholdSharingCleanupCandidates,
  normalizeHouseholdSharingCleanupQuery,
} = householdSharingCleanup;

test("household sharing cleanup review finds stale invitations and expired helper memberships without mutating", () => {
  assert.equal(
    typeof buildHouseholdSharingCleanupCandidates,
    "function",
    "owner-facing sharing cleanup needs a shared derivation before any destructive cleanup job is approved",
  );

  const now = new Date("2026-06-24T12:00:00.000Z");
  const candidates = buildHouseholdSharingCleanupCandidates(
    {
      invitations: [
        {
          id: "invite_old",
          householdId: "household_1",
          inviteCode: "OLD123",
          role: "sitter",
          lifecycleState: "approved",
          createdByUserId: "owner_1",
          expiresAt: "2026-06-24T11:00:00.000Z",
          createdAt: "2026-06-23T10:00:00.000Z",
        },
        {
          id: "invite_current",
          householdId: "household_1",
          inviteCode: "NEW123",
          role: "adult",
          lifecycleState: "approved",
          createdByUserId: "owner_1",
          expiresAt: "2026-06-24T13:00:00.000Z",
          createdAt: "2026-06-24T10:00:00.000Z",
        },
      ],
      members: [
        {
          id: "member_helper",
          householdId: "household_1",
          userId: "helper_1",
          role: "walker",
          displayName: "Weekend Walker",
          accessPassExpiresAt: "2026-06-24T10:30:00.000Z",
          createdAt: "2026-06-20T10:00:00.000Z",
        },
        {
          id: "member_owner",
          householdId: "household_1",
          userId: "owner_1",
          role: "owner",
          displayName: "Owner",
          accessPassExpiresAt: "2026-06-24T09:00:00.000Z",
          createdAt: "2026-06-20T10:00:00.000Z",
        },
      ],
      now,
    },
    { limit: 10 },
  );

  assert.deepEqual(
    candidates.map((candidate) => ({
      id: candidate.id,
      kind: candidate.kind,
      targetId: candidate.targetId,
      recommendedAction: candidate.recommendedAction,
      expiresAt: candidate.expiresAt,
      title: candidate.title,
      storage: candidate.storage,
    })),
    [
      {
        id: "sharing_cleanup_expired-invitation_invite_old",
        kind: "expired-invitation",
        targetId: "invite_old",
        recommendedAction: "mark-invitation-expired",
        expiresAt: "2026-06-24T11:00:00.000Z",
        title: "Expired sitter invitation",
        storage: "review-only",
      },
      {
        id: "sharing_cleanup_expired-access-pass_member_helper",
        kind: "expired-access-pass",
        targetId: "member_helper",
        recommendedAction: "review-helper-access",
        expiresAt: "2026-06-24T10:30:00.000Z",
        title: "Expired walker Access Pass",
        storage: "review-only",
      },
    ],
  );
});

test("household sharing cleanup query clamps limits and preserves safe kind filters", () => {
  assert.equal(
    typeof normalizeHouseholdSharingCleanupQuery,
    "function",
    "cleanup review routes need a shared query normalizer",
  );

  assert.deepEqual(
    normalizeHouseholdSharingCleanupQuery({
      limit: "500",
      kind: "expired-access-pass",
    }),
    {
      limit: 100,
      kind: "expired-access-pass",
    },
  );

  assert.deepEqual(
    normalizeHouseholdSharingCleanupQuery({
      limit: "-4",
      kind: "unknown",
    }),
    {
      limit: 1,
    },
  );

  assert.deepEqual(normalizeHouseholdSharingCleanupQuery({}), {
    limit: 50,
  });
});
