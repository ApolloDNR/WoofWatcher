import { and, eq, sql } from "drizzle-orm";

import {
  type HouseholdInvitationCreateAuditEvent,
  type HouseholdInvitationCreateStore,
  type HouseholdInvitationCreateTransaction,
} from "./household-invitation-create.ts";
import { HOUSEHOLD_INVITATION_BOUNDARY } from "./household-invitations.ts";
import { lockHouseholdTransactions } from "./household-transaction-serializer.ts";

export interface HouseholdInvitationCreateDrizzleTables {
  usersTable: any;
  householdsTable: any;
  householdMembersTable: any;
  householdInvitationsTable: any;
  householdAuditEventsTable: any;
}

/**
 * Adapts the shipping Drizzle transaction to the deliberately small atomic
 * invitation contract. All authority reads, collision checks, writes, and the
 * audit insert therefore share one PostgreSQL transaction.
 */
export function createDrizzleHouseholdInvitationCreateStore<
  TAuditEvent extends HouseholdInvitationCreateAuditEvent,
>(input: {
  database: any;
  tables: HouseholdInvitationCreateDrizzleTables;
  nextInviteCodeCandidate(): string | Promise<string>;
  buildAuditInsert(event: TAuditEvent): unknown;
}): HouseholdInvitationCreateStore<TAuditEvent> {
  const {
    usersTable,
    householdsTable,
    householdMembersTable,
    householdInvitationsTable,
    householdAuditEventsTable,
  } = input.tables;

  return {
    transaction: (work) =>
      input.database.transaction(async (transaction: any) => {
        const adapter: HouseholdInvitationCreateTransaction<TAuditEvent> = {
          async lockHouseholds(householdIds) {
            await lockHouseholdTransactions(transaction, householdIds);
          },
          async lockUser(userId) {
            const [user] = await transaction
              .select({
                id: usersTable.id,
                activeHouseholdId: usersTable.activeHouseholdId,
              })
              .from(usersTable)
              .where(eq(usersTable.id, userId))
              .for("update");
            return user ?? null;
          },
          async lockActorMembership(userId, householdId) {
            const [membership] = await transaction
              .select({
                id: householdMembersTable.id,
                userId: householdMembersTable.userId,
                householdId: householdMembersTable.householdId,
                role: householdMembersTable.role,
              })
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
          async getCurrentTime() {
            const result = await transaction.execute(
              sql<{ now: Date }>`select clock_timestamp() as "now"`,
            );
            const row = result.rows[0];
            return new Date(row.now);
          },
          async nextInviteCodeCandidate() {
            return input.nextInviteCodeCandidate();
          },
          async tryInsertInvitation(invitation) {
            const [legacyCollision] = await transaction
              .select({ id: householdsTable.id })
              .from(householdsTable)
              .where(eq(householdsTable.inviteCode, invitation.inviteCode))
              .limit(1)
              .for("share");
            if (legacyCollision) return { status: "collision" };

            const [created] = await transaction
              .insert(householdInvitationsTable)
              .values({
                householdId: invitation.householdId,
                inviteCode: invitation.inviteCode,
                invitedEmail: invitation.invitedEmail,
                role: invitation.role,
                lifecycleState: invitation.lifecycleState,
                createdByUserId: invitation.actorUserId,
                approvedByUserId: invitation.approvedByUserId,
                note: invitation.note,
                expiresAt: invitation.expiresAt,
                createdAt: invitation.createdAt,
                updatedAt: invitation.createdAt,
                metadata: {
                  boundary: HOUSEHOLD_INVITATION_BOUNDARY,
                  storage: "provider-durable",
                },
              })
              .onConflictDoNothing({
                target: householdInvitationsTable.inviteCode,
              })
              .returning();

            return created
              ? { status: "created", invitation: created }
              : { status: "collision" };
          },
          async recordAudit(event) {
            await transaction
              .insert(householdAuditEventsTable)
              .values(input.buildAuditInsert(event));
          },
        };

        return work(adapter);
      }),
  };
}
