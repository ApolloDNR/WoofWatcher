import { eq, sql } from "drizzle-orm";

function compareExactHouseholdIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalHouseholdLockIds(
  householdIds: readonly string[],
): string[] {
  return [...new Set(householdIds)].sort(compareExactHouseholdIds);
}

/**
 * Transaction-scoped household serializer. Every caller must invoke this
 * before acquiring user, membership, household, invitation, or snapshot row
 * locks. Multi-household operations use exact bytewise ordering.
 */
export async function lockHouseholdTransactions(
  transaction: any,
  householdIds: readonly string[],
): Promise<void> {
  for (const householdId of canonicalHouseholdLockIds(householdIds)) {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${householdId}, 0))`,
    );
  }
}

/**
 * Discovers a user's current membership households without row locks, then
 * takes their canonical advisory locks before the transaction locks the user.
 * A concurrent membership creator must itself lock the user after its target
 * household serializer, so a membership missing from this preflight cannot be
 * inserted while this transaction holds the user row.
 */
export async function lockUserHouseholdTransactions(input: {
  transaction: any;
  householdMembersTable: any;
  userId: string;
  includeHouseholdIds?: readonly string[];
}): Promise<string[]> {
  const rows = await input.transaction
    .select({ householdId: input.householdMembersTable.householdId })
    .from(input.householdMembersTable)
    .where(eq(input.householdMembersTable.userId, input.userId));
  const householdIds = canonicalHouseholdLockIds([
    ...(input.includeHouseholdIds ?? []),
    ...rows.map((row: { householdId: string }) => row.householdId),
  ]);
  await lockHouseholdTransactions(input.transaction, householdIds);
  return householdIds;
}

/**
 * Rechecks household discovery after the user row is locked. Membership
 * creators also lock that user row, so no new missing membership can commit
 * after this check. Memberships removed during the preflight gap are safe:
 * holding an extra advisory lock only reduces concurrency for this transaction.
 */
export async function confirmUserHouseholdTransactionsLocked(input: {
  transaction: any;
  householdMembersTable: any;
  userId: string;
  lockedHouseholdIds: readonly string[];
}): Promise<boolean> {
  const rows = await input.transaction
    .select({ householdId: input.householdMembersTable.householdId })
    .from(input.householdMembersTable)
    .where(eq(input.householdMembersTable.userId, input.userId));
  const locked = new Set(input.lockedHouseholdIds);
  return rows.every((row: { householdId: string }) =>
    locked.has(row.householdId),
  );
}
