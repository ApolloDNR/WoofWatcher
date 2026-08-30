import {
  resolveHouseholdMembershipAuthority,
  type HouseholdMembershipAuthority,
} from "./household-role-authority.ts";

export class HouseholdAuthoritySnapshotError extends Error {
  readonly status: 403 | 409;

  constructor(
    message = "Household authority changed. Refresh household identity before retrying.",
    status: 403 | 409 = 409,
  ) {
    super(message);
    this.name = "HouseholdAuthoritySnapshotError";
    this.status = status;
  }
}

export interface HouseholdSnapshotUser {
  id: string;
  email: string | null;
  displayName: string | null;
  activeHouseholdId: string | null;
}

export interface HouseholdSnapshotHousehold {
  id: string;
  name: string;
}

export interface HouseholdSnapshotMember {
  id: string;
  userId: string;
  householdId: string;
  role: string;
  displayName: string | null;
  email: string | null;
  accessPassExpiresAt: Date | string | null;
  createdAt: Date | string;
}

export interface HouseholdSnapshotTransaction {
  lockHouseholds(householdIds: readonly string[]): Promise<void>;
  getCurrentTime(): Promise<Date>;
  lockUser(userId: string): Promise<HouseholdSnapshotUser | null>;
  lockHousehold(
    householdId: string,
  ): Promise<HouseholdSnapshotHousehold | null>;
  lockMembers(householdId: string): Promise<HouseholdSnapshotMember[]>;
  confirmActiveHousehold(userId: string, householdId: string): Promise<boolean>;
}

export interface HouseholdSnapshotStore {
  transaction<T>(
    work: (transaction: HouseholdSnapshotTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface ExactHouseholdSnapshot {
  /** Exact transactional provider time used to evaluate this snapshot. */
  authorityObservedAt: string;
  user: { id: string; email: string | null; displayName: string | null };
  household: { id: string; name: string; inviteCode: string };
  members: Array<{
    id: string;
    userId: string;
    role: string;
    displayName: string | null;
    email: string | null;
    isSelf: boolean;
    accessPassExpiresAt: string | null;
    accessPassExpired: boolean;
  }>;
}

function conflict(): never {
  throw new HouseholdAuthoritySnapshotError();
}

export async function buildExactHouseholdSnapshot(input: {
  store: HouseholdSnapshotStore;
  userId: string;
  expectedHouseholdId: string;
}): Promise<ExactHouseholdSnapshot> {
  return input.store.transaction(async (transaction) => {
    await transaction.lockHouseholds([input.expectedHouseholdId]);
    const user = await transaction.lockUser(input.userId);
    if (
      !user ||
      user.id !== input.userId ||
      user.activeHouseholdId !== input.expectedHouseholdId
    ) {
      return conflict();
    }

    const household = await transaction.lockHousehold(
      input.expectedHouseholdId,
    );
    if (!household || household.id !== input.expectedHouseholdId) {
      return conflict();
    }

    const members = await transaction.lockMembers(input.expectedHouseholdId);
    if (
      members.some((member) => member.householdId !== input.expectedHouseholdId)
    ) {
      return conflict();
    }

    const now = await transaction.getCurrentTime();
    if (Number.isNaN(now.getTime())) return conflict();
    const memberAuthorities = new Map<
      string,
      HouseholdMembershipAuthority
    >();
    for (const member of members) {
      const authority = resolveHouseholdMembershipAuthority({
        role: member.role,
        accessPassExpiresAt: member.accessPassExpiresAt,
        now,
      });
      if (authority.state === "invalid" || memberAuthorities.has(member.id)) {
        throw new HouseholdAuthoritySnapshotError(
          "Household member role authority is invalid. Refresh household identity before retrying.",
        );
      }
      memberAuthorities.set(member.id, authority);
    }

    const selfMembers = members.filter(
      (member) => member.userId === input.userId,
    );
    if (selfMembers.length !== 1) {
      return conflict();
    }
    const selfAuthority = memberAuthorities.get(selfMembers[0]!.id);
    if (!selfAuthority) return conflict();
    if (!selfAuthority.householdAccessAllowed) {
      throw new HouseholdAuthoritySnapshotError(
        "Household Access Pass expired. Ask an owner to renew access.",
        403,
      );
    }

    if (
      !(await transaction.confirmActiveHousehold(
        input.userId,
        input.expectedHouseholdId,
      ))
    ) {
      return conflict();
    }

    const orderedMembers = [...members].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime() ||
        left.id.localeCompare(right.id),
    );

    return {
      authorityObservedAt: now.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      household: {
        id: household.id,
        name: household.name,
        // Kept only for generated-client schema compatibility. Durable,
        // revocable invitation rows are the sole production join credential.
        inviteCode: "",
      },
      members: orderedMembers.map((member) => {
        const authority = memberAuthorities.get(member.id);
        if (!authority?.role) return conflict();

        return {
          id: member.id,
          userId: member.userId,
          role: authority.role,
          displayName: member.displayName,
          email: member.email,
          isSelf: member.userId === input.userId,
          accessPassExpiresAt: authority.accessPassExpiresAt,
          accessPassExpired: authority.accessPassExpired,
        };
      }),
    };
  });
}
