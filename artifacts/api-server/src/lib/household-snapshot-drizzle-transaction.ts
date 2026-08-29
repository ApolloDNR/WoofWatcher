import { and, eq, sql } from "drizzle-orm";

import {
  buildExactHouseholdSnapshot,
  type ExactHouseholdSnapshot,
} from "./household-me-snapshot.ts";
import { lockHouseholdTransactions } from "./household-transaction-serializer.ts";

export interface HouseholdSnapshotDrizzleTables {
  usersTable: any;
  householdsTable: any;
  householdMembersTable: any;
}

function createHouseholdSnapshotTransaction(input: {
  transaction: any;
  tables: HouseholdSnapshotDrizzleTables;
}) {
  const { transaction, tables } = input;
  const { usersTable, householdsTable, householdMembersTable } = tables;
  return {
    async lockHouseholds(householdIds: readonly string[]) {
      await lockHouseholdTransactions(transaction, householdIds);
    },
    async getCurrentTime() {
      const result = await transaction.execute(
        sql<{ now: Date }>`select clock_timestamp() as "now"`,
      );
      return new Date(result.rows[0].now);
    },
    async lockUser(expectedUserId: string) {
      const [user] = await transaction
        .select({
          id: usersTable.id,
          email: usersTable.email,
          displayName: usersTable.displayName,
          activeHouseholdId: usersTable.activeHouseholdId,
        })
        .from(usersTable)
        .where(eq(usersTable.id, expectedUserId))
        .for("update");
      return user ?? null;
    },
    async lockHousehold(expectedHouseholdId: string) {
      const [household] = await transaction
        .select({
          id: householdsTable.id,
          name: householdsTable.name,
        })
        .from(householdsTable)
        .where(eq(householdsTable.id, expectedHouseholdId))
        .for("share");
      return household ?? null;
    },
    async lockMembers(expectedHouseholdId: string) {
      const rows = await transaction
        .select({
          id: householdMembersTable.id,
          userId: householdMembersTable.userId,
          householdId: householdMembersTable.householdId,
          role: householdMembersTable.role,
          memberName: householdMembersTable.displayName,
          userName: usersTable.displayName,
          email: usersTable.email,
          accessPassExpiresAt: householdMembersTable.accessPassExpiresAt,
          createdAt: householdMembersTable.createdAt,
        })
        .from(householdMembersTable)
        .innerJoin(usersTable, eq(usersTable.id, householdMembersTable.userId))
        .where(eq(householdMembersTable.householdId, expectedHouseholdId))
        .orderBy(householdMembersTable.createdAt)
        .for("share");
      return rows.map((row: any) => ({
        ...row,
        displayName: row.memberName ?? row.userName ?? null,
      }));
    },
    async confirmActiveHousehold(
      expectedUserId: string,
      expectedHouseholdId: string,
    ) {
      const [user] = await transaction
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.id, expectedUserId),
            eq(usersTable.activeHouseholdId, expectedHouseholdId),
          ),
        );
      return Boolean(user);
    },
  };
}

/** Builds Exact Me without opening a nested transaction. */
export async function buildExactHouseholdSnapshotInDrizzleTransaction(input: {
  transaction: any;
  tables: HouseholdSnapshotDrizzleTables;
  userId: string;
  householdId: string;
}): Promise<ExactHouseholdSnapshot> {
  return buildExactHouseholdSnapshot({
    userId: input.userId,
    expectedHouseholdId: input.householdId,
    store: {
      async transaction(work) {
        return work(
          createHouseholdSnapshotTransaction({
            transaction: input.transaction,
            tables: input.tables,
          }),
        );
      },
    },
  });
}
