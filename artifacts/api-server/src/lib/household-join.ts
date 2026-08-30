import {
  careStateTable,
  db,
  householdAuditEventsTable,
  householdInvitationsTable,
  householdMembersTable,
  usersTable,
} from "@workspace/db";
import {
  HouseholdJoinCommitError,
  commitJoinedHouseholdActivation,
} from "./household-active-identity";
import { buildMeInTransaction } from "./household";
import {
  buildHouseholdAuditEvent,
  type HouseholdAuditEvent,
} from "./household-access-pass";
import { createDrizzleHouseholdJoinStore } from "./household-join-drizzle-store.ts";
import type { ExactHouseholdSnapshot } from "./household-me-snapshot.ts";
import type { FreshVerifiedHouseholdJoinIdentity } from "./household-verified-identity.ts";

export { HouseholdJoinCommitError };

function acceptanceAuditId(invitationId: string): string {
  return `household_invitation_accepted_${invitationId}`;
}

export async function commitHouseholdJoin(input: {
  userId: string;
  householdId: string;
  expectedSourceHouseholdId: string | null;
  invitationId: string | null;
  verifiedIdentity: FreshVerifiedHouseholdJoinIdentity;
}): Promise<{
  inThisHousehold: boolean;
  auditEvent: HouseholdAuditEvent;
  replayed: boolean;
  me: ExactHouseholdSnapshot;
}> {
  return commitJoinedHouseholdActivation<
    HouseholdAuditEvent,
    ExactHouseholdSnapshot
  >({
    ...input,
    store: createDrizzleHouseholdJoinStore({
      database: db,
      tables: {
        careStateTable,
        householdAuditEventsTable,
        householdInvitationsTable,
        householdMembersTable,
        usersTable,
      },
      buildExactMeSnapshot: buildMeInTransaction,
    }),
    buildAuditEvent({ inThisHousehold, invitationId, membership, acceptedAt }) {
      return {
        ...buildHouseholdAuditEvent(
          {
            action: "invitation-accepted",
            actorUserId: input.userId,
            householdId: input.householdId,
            targetMemberId: membership.id,
            targetUserId: input.userId,
            targetRole: inThisHousehold ? membership.role : null,
            nextRole: membership.role,
            reason: inThisHousehold
              ? "Existing household member opened an approved invitation."
              : "Approved invitation accepted and caregiver membership created.",
          },
          acceptedAt,
        ),
        id: acceptanceAuditId(invitationId),
      };
    },
  });
}
