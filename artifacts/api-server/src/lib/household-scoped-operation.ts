import {
  resolveHouseholdMembershipAuthority,
  type HouseholdAuthorizationRole,
  type HouseholdMemberRole,
} from "./household-role-authority.ts";

export const HOUSEHOLD_SCOPED_ACCESS_ERROR =
  "Authenticated household membership is unavailable.";

export const HOUSEHOLD_SCOPED_INTEGRITY_ERROR =
  "Household membership authority is internally inconsistent.";

export interface HouseholdScopedOperationUser {
  id: string;
  activeHouseholdId: string | null;
  displayName: string | null;
}

export interface HouseholdScopedOperationMembership {
  id: string;
  userId: string;
  householdId: string;
  role: string;
  displayName: string | null;
  accessPassExpiresAt: Date | string | null;
}

export interface HouseholdScopedOperationTransaction {
  /** The same transaction handle that owns the authority row locks. */
  database: any;
  /** Serializes household-management mutations before any actor row lock. */
  lockHouseholdMutation(householdId: string): Promise<void>;
  getCurrentTime(): Promise<Date>;
  lockUser(userId: string): Promise<HouseholdScopedOperationUser | null>;
  lockMembership(
    userId: string,
    householdId: string,
  ): Promise<HouseholdScopedOperationMembership | null>;
}

export interface HouseholdScopedOperationStore {
  transaction<T>(
    work: (transaction: HouseholdScopedOperationTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface HouseholdScopedOperationScope {
  database: any;
  userId: string;
  householdId: string;
  membershipId: string;
  role: HouseholdMemberRole;
  authorizationRole: HouseholdAuthorizationRole;
  caregiverName: string | null;
  now: Date;
}

export interface HouseholdScopedOperationInput<T> {
  userId: string;
  expectedHouseholdId: string;
  serializeHouseholdMutation?: boolean;
  operation: (scope: HouseholdScopedOperationScope) => Promise<T>;
}

export interface RunHouseholdScopedOperation {
  <T>(input: HouseholdScopedOperationInput<T>): Promise<T>;
}

export class HouseholdScopedOperationError extends Error {
  readonly status: 403 | 409 | 412;

  constructor(message: string, status: 403 | 409 | 412) {
    super(message);
    this.name = "HouseholdScopedOperationError";
    this.status = status;
  }
}

function assertExactUser(input: {
  user: HouseholdScopedOperationUser | null;
  userId: string;
  expectedHouseholdId: string;
}): HouseholdScopedOperationUser {
  if (!input.user) {
    throw new HouseholdScopedOperationError(HOUSEHOLD_SCOPED_ACCESS_ERROR, 403);
  }
  if (input.user.id !== input.userId) {
    throw new HouseholdScopedOperationError(
      HOUSEHOLD_SCOPED_INTEGRITY_ERROR,
      409,
    );
  }
  if (input.user.activeHouseholdId !== input.expectedHouseholdId) {
    throw new HouseholdScopedOperationError(
      "Active household changed. Refresh household identity before retrying.",
      412,
    );
  }
  return input.user;
}

function assertExactMembership(input: {
  membership: HouseholdScopedOperationMembership | null;
  userId: string;
  expectedHouseholdId: string;
}): HouseholdScopedOperationMembership {
  if (!input.membership) {
    throw new HouseholdScopedOperationError(HOUSEHOLD_SCOPED_ACCESS_ERROR, 403);
  }
  if (
    input.membership.userId !== input.userId ||
    input.membership.householdId !== input.expectedHouseholdId ||
    input.membership.id.trim().length === 0
  ) {
    throw new HouseholdScopedOperationError(
      HOUSEHOLD_SCOPED_INTEGRITY_ERROR,
      409,
    );
  }
  return input.membership;
}

export async function runHouseholdScopedOperation<T>(
  input: HouseholdScopedOperationInput<T> & {
    store: HouseholdScopedOperationStore;
  },
): Promise<T> {
  return input.store.transaction(async (transaction) => {
    if (input.serializeHouseholdMutation) {
      await transaction.lockHouseholdMutation(input.expectedHouseholdId);
    }
    const user = assertExactUser({
      user: await transaction.lockUser(input.userId),
      userId: input.userId,
      expectedHouseholdId: input.expectedHouseholdId,
    });
    const membership = assertExactMembership({
      membership: await transaction.lockMembership(
        input.userId,
        input.expectedHouseholdId,
      ),
      userId: input.userId,
      expectedHouseholdId: input.expectedHouseholdId,
    });
    const now = await transaction.getCurrentTime();
    const authority = resolveHouseholdMembershipAuthority({
      role: membership.role,
      accessPassExpiresAt: membership.accessPassExpiresAt,
      now,
    });
    if (!authority.householdAccessAllowed || !authority.role) {
      throw new HouseholdScopedOperationError(
        HOUSEHOLD_SCOPED_ACCESS_ERROR,
        403,
      );
    }

    return input.operation({
      database: transaction.database,
      userId: input.userId,
      householdId: input.expectedHouseholdId,
      membershipId: membership.id,
      role: authority.role,
      authorizationRole: authority.authorizationRole,
      caregiverName: membership.displayName ?? user.displayName,
      now,
    });
  });
}

export function createHouseholdScopedOperationRunner(
  store: HouseholdScopedOperationStore,
  options: { serializeHouseholdMutations?: boolean } = {},
): RunHouseholdScopedOperation {
  return (input) =>
    runHouseholdScopedOperation({
      store,
      ...input,
      serializeHouseholdMutation:
        input.serializeHouseholdMutation ??
        options.serializeHouseholdMutations ??
        false,
    });
}
