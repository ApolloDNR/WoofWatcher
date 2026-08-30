import { and, eq, sql } from "drizzle-orm";

import type {
  HouseholdMembershipActivationTransaction,
  HouseholdMembershipSwitchStore,
} from "./household-membership-activation.ts";
import type { ExactHouseholdSnapshot } from "./household-me-snapshot.ts";
import {
  confirmUserHouseholdTransactionsLocked,
  lockHouseholdTransactions,
  lockUserHouseholdTransactions,
} from "./household-transaction-serializer.ts";

export interface HouseholdMembershipDrizzleTables {
  usersTable: any;
  householdMembersTable: any;
  householdsTable: any;
  careStateTable: any;
}

export type HouseholdMembershipExactMeBuilder = (
  transaction: any,
  userId: string,
  householdId: string,
) => Promise<ExactHouseholdSnapshot>;

export function buildActiveHouseholdCasQuery(input: {
  transaction: any;
  tables: HouseholdMembershipDrizzleTables;
  activation: {
    userId: string;
    expectedSourceHouseholdId: string;
    targetHouseholdId: string;
    membershipId: string;
  };
}) {
  const { usersTable, householdMembersTable } = input.tables;
  const { activation } = input;
  const normalizedRole = sql<string>`lower(btrim(regexp_replace(${householdMembersTable.role}, '[[:space:]]+', ' ', 'g')))`;
  const exactValidTarget = sql<boolean>`exists (
    select 1
    from ${householdMembersTable}
    where ${householdMembersTable.id} = ${activation.membershipId}
      and ${householdMembersTable.userId} = ${activation.userId}
      and ${householdMembersTable.householdId} = ${activation.targetHouseholdId}
      and ${normalizedRole} in (
        'admin', 'adult admin', 'owner',
        'adult', 'member', 'primary caregiver',
        'teen',
        'kid', 'child', 'minor',
        'sitter', 'helper', 'temporary helper',
        'trainer', 'walker',
        'viewer', 'vet', 'vet viewer', 'veterinary viewer',
        'read-only', 'readonly'
      )
      and (
        ${normalizedRole} not in (
          'sitter', 'helper', 'temporary helper',
          'trainer', 'walker',
          'viewer', 'vet', 'vet viewer', 'veterinary viewer',
          'read-only', 'readonly'
        )
        or ${householdMembersTable.accessPassExpiresAt} is null
        or ${householdMembersTable.accessPassExpiresAt} > clock_timestamp()
      )
  )`;

  return input.transaction
    .update(usersTable)
    .set({ activeHouseholdId: activation.targetHouseholdId })
    .where(
      and(
        eq(usersTable.id, activation.userId),
        eq(usersTable.activeHouseholdId, activation.expectedSourceHouseholdId),
        exactValidTarget,
      ),
    )
    .returning({ id: usersTable.id });
}

/**
 * Builds the shipping transaction adapter while keeping the database handle
 * injectable for executable rollback and sequencing tests.
 */
export function createDrizzleHouseholdMembershipStore(input: {
  database: any;
  tables: HouseholdMembershipDrizzleTables;
  buildExactMeSnapshot?: HouseholdMembershipExactMeBuilder;
}): HouseholdMembershipSwitchStore {
  const { usersTable, householdMembersTable, householdsTable, careStateTable } =
    input.tables;
  const exactMeBuilder: HouseholdMembershipExactMeBuilder =
    input.buildExactMeSnapshot ??
    (async (transaction, userId, householdId) => {
      const { buildMeInTransaction } = await import("./household.ts");
      return buildMeInTransaction(transaction, userId, householdId);
    });

  return {
    transaction: (work) =>
      input.database.transaction(async (transaction: any) => {
        let lockedActiveHouseholdId: string | null | undefined;

        const adapter: HouseholdMembershipActivationTransaction = {
          async lockHouseholds(householdIds) {
            await lockHouseholdTransactions(transaction, householdIds);
          },
          async lockUserHouseholds(userId, includeHouseholdIds) {
            return lockUserHouseholdTransactions({
              transaction,
              householdMembersTable,
              userId,
              includeHouseholdIds,
            });
          },
          async getCurrentTime() {
            const result = await transaction.execute(
              sql<{ now: Date }>`select clock_timestamp() as "now"`,
            );
            const row = result.rows[0];
            return new Date(row.now);
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
            lockedActiveHouseholdId = user?.activeHouseholdId;
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
          async listMemberships(userId) {
            return transaction
              .select({
                id: householdMembersTable.id,
                userId: householdMembersTable.userId,
                householdId: householdMembersTable.householdId,
                householdName: householdsTable.name,
                role: householdMembersTable.role,
                accessPassExpiresAt: householdMembersTable.accessPassExpiresAt,
                createdAt: householdMembersTable.createdAt,
              })
              .from(householdMembersTable)
              .innerJoin(
                householdsTable,
                eq(householdsTable.id, householdMembersTable.householdId),
              )
              .where(eq(householdMembersTable.userId, userId))
              .for("share");
          },
          async lockTargetMembership(userId, householdId) {
            const [membership] = await transaction
              .select({
                id: householdMembersTable.id,
                userId: householdMembersTable.userId,
                householdId: householdMembersTable.householdId,
                householdName: householdsTable.name,
                role: householdMembersTable.role,
                accessPassExpiresAt: householdMembersTable.accessPassExpiresAt,
                createdAt: householdMembersTable.createdAt,
              })
              .from(householdMembersTable)
              .innerJoin(
                householdsTable,
                eq(householdsTable.id, householdMembersTable.householdId),
              )
              .where(
                and(
                  eq(householdMembersTable.userId, userId),
                  eq(householdMembersTable.householdId, householdId),
                ),
              )
              .for("update");
            return membership ?? null;
          },
          async compareAndSetActiveHousehold(activation) {
            if (
              lockedActiveHouseholdId !== activation.expectedSourceHouseholdId
            ) {
              return { updated: false, reason: "source-changed" };
            }

            const [updated] = await buildActiveHouseholdCasQuery({
              transaction,
              tables: input.tables,
              activation,
            });

            if (!updated) {
              return { updated: false, reason: "target-invalid" };
            }
            lockedActiveHouseholdId = activation.targetHouseholdId;
            return { updated: true };
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
          async buildExactMeSnapshot(userId, householdId) {
            return exactMeBuilder(transaction, userId, householdId);
          },
        };

        return work(adapter);
      }),
  };
}
