import { and, eq, gt, isNull, or, sql } from "drizzle-orm";

import type { HouseholdJoinTransactionStore } from "./household-active-identity.ts";
import {
  buildHouseholdAuditEventFromRecord,
  buildHouseholdAuditInsert,
  type HouseholdAuditEvent,
} from "./household-access-pass.ts";
import { lockHouseholdTransactions } from "./household-transaction-serializer.ts";

export interface HouseholdJoinDrizzleTables {
  careStateTable: any;
  householdAuditEventsTable: any;
  householdInvitationsTable: any;
  householdMembersTable: any;
  usersTable: any;
}

export type HouseholdJoinExactMeBuilder<TMeSnapshot> = (
  transaction: any,
  userId: string,
  householdId: string,
) => Promise<TMeSnapshot>;

function acceptanceAuditId(invitationId: string): string {
  return `household_invitation_accepted_${invitationId}`;
}

/**
 * Creates the shipping join store. The acceptance clock is read from the
 * database transaction, and the invitation update repeats the expiry check
 * against that exact timestamp so an expired row cannot pass the write CAS.
 */
export function createDrizzleHouseholdJoinStore<TMeSnapshot>(input: {
  database: any;
  tables: HouseholdJoinDrizzleTables;
  buildExactMeSnapshot: HouseholdJoinExactMeBuilder<TMeSnapshot>;
}): HouseholdJoinTransactionStore<HouseholdAuditEvent, TMeSnapshot> {
  const {
    careStateTable,
    householdAuditEventsTable,
    householdInvitationsTable,
    householdMembersTable,
    usersTable,
  } = input.tables;

  return {
    transaction: (work) =>
      input.database.transaction(async (transaction: any) => {
        let lockedUser:
          | {
              id: string;
              displayName: string | null;
              activeHouseholdId: string | null;
            }
          | undefined;

        return work({
          async lockHouseholds(householdIds) {
            await lockHouseholdTransactions(transaction, householdIds);
          },
          async getCurrentTime() {
            const result = await transaction.execute(
              sql<{ now: Date }>`select clock_timestamp() as "now"`,
            );
            return new Date(result.rows[0].now);
          },
          async lockUser(userId) {
            const [user] = await transaction
              .select({
                id: usersTable.id,
                displayName: usersTable.displayName,
                activeHouseholdId: usersTable.activeHouseholdId,
              })
              .from(usersTable)
              .where(eq(usersTable.id, userId))
              .for("update");
            lockedUser = user;
            return user ?? null;
          },
          async lockInvitation(invitationId) {
            const [invitation] = await transaction
              .select()
              .from(householdInvitationsTable)
              .where(eq(householdInvitationsTable.id, invitationId))
              .for("update");
            return invitation ?? null;
          },
          async findMembership(userId, householdId) {
            const [membership] = await transaction
              .select()
              .from(householdMembersTable)
              .where(
                and(
                  eq(householdMembersTable.userId, userId),
                  eq(householdMembersTable.householdId, householdId),
                ),
              )
              .for("update");
            return membership ?? null;
          },
          async findExistingAcceptanceAudit(auditInput) {
            const [auditEvent] = await transaction
              .select()
              .from(householdAuditEventsTable)
              .where(
                and(
                  eq(
                    householdAuditEventsTable.id,
                    acceptanceAuditId(auditInput.invitationId),
                  ),
                  eq(householdAuditEventsTable.action, "invitation-accepted"),
                  eq(
                    householdAuditEventsTable.actorUserId,
                    auditInput.userId,
                  ),
                  eq(
                    householdAuditEventsTable.householdId,
                    auditInput.householdId,
                  ),
                  eq(
                    householdAuditEventsTable.targetUserId,
                    auditInput.userId,
                  ),
                  eq(
                    householdAuditEventsTable.targetMemberId,
                    auditInput.membershipId,
                  ),
                ),
              )
              .limit(1)
              .for("update");
            return auditEvent
              ? buildHouseholdAuditEventFromRecord(auditEvent)
              : null;
          },
          async createMembership(membership) {
            const [created] = await transaction
              .insert(householdMembersTable)
              .values({
                householdId: membership.householdId,
                userId: membership.userId,
                role: membership.role,
                displayName: lockedUser?.displayName ?? membership.displayName,
              })
              .returning();
            return created;
          },
          async acceptInvitation(invitationInput) {
            const [accepted] = await transaction
              .update(householdInvitationsTable)
              .set({
                lifecycleState: "accepted",
                acceptedByUserId: invitationInput.userId,
                acceptedAt: invitationInput.acceptedAt,
                invitedUserId: invitationInput.userId,
                updatedAt: invitationInput.acceptedAt,
              })
              .where(
                and(
                  eq(
                    householdInvitationsTable.id,
                    invitationInput.invitationId,
                  ),
                  eq(
                    householdInvitationsTable.householdId,
                    invitationInput.householdId,
                  ),
                  eq(householdInvitationsTable.lifecycleState, "approved"),
                  or(
                    isNull(householdInvitationsTable.expiresAt),
                    gt(
                      householdInvitationsTable.expiresAt,
                      invitationInput.acceptedAt,
                    ),
                  ),
                ),
              )
              .returning({ id: householdInvitationsTable.id });

            return accepted
              ? { allowed: true as const }
              : {
                  allowed: false as const,
                  reason:
                    "Invitation expired or changed before acceptance could be committed.",
                };
          },
          async ensureCareState(householdId, userId) {
            await transaction
              .insert(careStateTable)
              .values({
                householdId,
                doc: {},
                version: 1,
                updatedBy: userId,
              })
              .onConflictDoNothing();
          },
          async recordAudit(event) {
            await transaction
              .insert(householdAuditEventsTable)
              .values(buildHouseholdAuditInsert(event));
          },
          async setActiveHousehold(activeInput) {
            const [membership] = await transaction
              .select({ id: householdMembersTable.id })
              .from(householdMembersTable)
              .where(
                and(
                  eq(householdMembersTable.id, activeInput.membershipId),
                  eq(householdMembersTable.userId, activeInput.userId),
                  eq(
                    householdMembersTable.householdId,
                    activeInput.householdId,
                  ),
                ),
              )
              .for("update");
            if (!membership) return false;

            const [updated] = await transaction
              .update(usersTable)
              .set({ activeHouseholdId: activeInput.householdId })
              .where(
                and(
                  eq(usersTable.id, activeInput.userId),
                  eq(
                    usersTable.activeHouseholdId,
                    activeInput.expectedSourceHouseholdId,
                  ),
                ),
              )
              .returning({ id: usersTable.id });
            return Boolean(updated);
          },
          async buildExactMeSnapshot(snapshotInput) {
            return input.buildExactMeSnapshot(
              transaction,
              snapshotInput.userId,
              snapshotInput.householdId,
            );
          },
        });
      }),
  };
}
