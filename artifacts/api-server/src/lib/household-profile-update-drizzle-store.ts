import { and, eq, sql } from "drizzle-orm";

import type { ExactHouseholdSnapshot } from "./household-me-snapshot.ts";
import type { HouseholdProfileUpdateStore } from "./household-profile-update.ts";
import {
  confirmUserHouseholdTransactionsLocked,
  lockUserHouseholdTransactions,
} from "./household-transaction-serializer.ts";

export function createDrizzleHouseholdProfileUpdateStore(input: {
  database: any;
  tables: { usersTable: any; householdMembersTable: any };
  buildExactMeSnapshot(
    transaction: any,
    userId: string,
    householdId: string,
  ): Promise<ExactHouseholdSnapshot>;
}): HouseholdProfileUpdateStore {
  const { usersTable, householdMembersTable } = input.tables;
  return {
    transaction: (work) =>
      input.database.transaction(async (transaction: any) =>
        work({
          async lockUserHouseholds(userId) {
            return lockUserHouseholdTransactions({
              transaction,
              householdMembersTable,
              userId,
            });
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
          async confirmUserHouseholdsLocked(userId, lockedHouseholdIds) {
            return confirmUserHouseholdTransactionsLocked({
              transaction,
              householdMembersTable,
              userId,
              lockedHouseholdIds,
            });
          },
          async lockActiveMembership(userId, householdId) {
            const [membership] = await transaction
              .select({
                id: householdMembersTable.id,
                userId: householdMembersTable.userId,
                householdId: householdMembersTable.householdId,
                role: householdMembersTable.role,
                accessPassExpiresAt:
                  householdMembersTable.accessPassExpiresAt,
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
            return new Date(result.rows[0].now);
          },
          async updateUserDisplayName(userId, displayName) {
            const [updated] = await transaction
              .update(usersTable)
              .set({ displayName })
              .where(eq(usersTable.id, userId))
              .returning({ id: usersTable.id });
            return Boolean(updated);
          },
          async updateMembershipDisplayNames(
            userId,
            activeMembershipId,
            displayName,
          ) {
            const rows = await transaction
              .update(householdMembersTable)
              .set({ displayName })
              .where(eq(householdMembersTable.userId, userId))
              .returning({ id: householdMembersTable.id });
            return rows.some(
              (row: { id: string }) => row.id === activeMembershipId,
            );
          },
          async buildExactMeSnapshot(userId, householdId) {
            return input.buildExactMeSnapshot(
              transaction,
              userId,
              householdId,
            );
          },
        }),
      ),
  };
}
