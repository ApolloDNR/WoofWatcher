import { and, eq, sql } from "drizzle-orm";

import type {
  HouseholdScopedOperationStore,
  HouseholdScopedOperationTransaction,
} from "./household-scoped-operation.ts";
import { lockHouseholdTransactions } from "./household-transaction-serializer.ts";

export interface HouseholdScopedOperationDrizzleTables {
  usersTable: any;
  householdMembersTable: any;
}

/**
 * Locks the authenticated user's household pointer and exact membership for
 * the lifetime of one Care operation. The shared locks conflict with the
 * activation/revocation writers' update locks without unnecessarily
 * serializing independent readers.
 */
export function createDrizzleHouseholdScopedOperationStore(input: {
  database: any;
  tables: HouseholdScopedOperationDrizzleTables;
}): HouseholdScopedOperationStore {
  const { usersTable, householdMembersTable } = input.tables;

  return {
    transaction: (work) =>
      input.database.transaction(async (transaction: any) => {
        const adapter: HouseholdScopedOperationTransaction = {
          database: transaction,
          async lockHouseholdMutation(householdId) {
            await lockHouseholdTransactions(transaction, [householdId]);
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
                activeHouseholdId: usersTable.activeHouseholdId,
                displayName: usersTable.displayName,
              })
              .from(usersTable)
              .where(eq(usersTable.id, userId))
              .for("share");
            return user ?? null;
          },
          async lockMembership(userId, householdId) {
            const [membership] = await transaction
              .select({
                id: householdMembersTable.id,
                userId: householdMembersTable.userId,
                householdId: householdMembersTable.householdId,
                role: householdMembersTable.role,
                displayName: householdMembersTable.displayName,
                accessPassExpiresAt: householdMembersTable.accessPassExpiresAt,
              })
              .from(householdMembersTable)
              .where(
                and(
                  eq(householdMembersTable.userId, userId),
                  eq(householdMembersTable.householdId, householdId),
                ),
              )
              .for("share");
            return membership ?? null;
          },
        };

        return work(adapter);
      }),
  };
}
