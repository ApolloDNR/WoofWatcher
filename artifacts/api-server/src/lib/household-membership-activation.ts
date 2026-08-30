import {
  HOUSEHOLD_MEMBER_ROLES,
  resolveHouseholdMembershipAuthority,
  type HouseholdMemberRole,
} from "./household-role-authority.ts";
import type { ExactHouseholdSnapshot } from "./household-me-snapshot.ts";

export const SWITCHABLE_HOUSEHOLD_ROLES = HOUSEHOLD_MEMBER_ROLES;

export type SwitchableHouseholdRole = HouseholdMemberRole;

export const HOUSEHOLD_MEMBERSHIP_TARGET_UNAVAILABLE_ERROR =
  "That household is not available to this authenticated user.";

export interface HouseholdMembershipRecord {
  id: string;
  userId: string;
  householdId: string;
  householdName: string;
  role: string;
  accessPassExpiresAt: Date | string | null;
  createdAt: Date | string;
  /**
   * The current provider removes revoked memberships. This optional field
   * keeps the pure boundary fail-closed for stores that retain tombstones.
   */
  revokedAt?: Date | string | null;
}

export interface SwitchableHouseholdMembership {
  householdId: string;
  householdName: string;
  role: SwitchableHouseholdRole;
  accessPassExpiresAt: string | null;
}

export interface HouseholdMembershipActivationUser {
  id: string;
  activeHouseholdId: string | null;
}

export type HouseholdMembershipCompareAndSetResult =
  | { updated: true }
  | {
      updated: false;
      reason: "source-changed" | "target-invalid" | "conflict";
    };

export interface HouseholdMembershipActivationTransaction {
  lockHouseholds(householdIds: readonly string[]): Promise<void>;
  lockUserHouseholds(
    userId: string,
    includeHouseholdIds?: readonly string[],
  ): Promise<readonly string[]>;
  getCurrentTime(): Promise<Date>;
  lockUser(userId: string): Promise<HouseholdMembershipActivationUser | null>;
  confirmUserHouseholdsLocked(
    userId: string,
    lockedHouseholdIds: readonly string[],
  ): Promise<boolean>;
  listMemberships(userId: string): Promise<HouseholdMembershipRecord[]>;
  lockTargetMembership(
    userId: string,
    householdId: string,
  ): Promise<HouseholdMembershipRecord | null>;
  compareAndSetActiveHousehold(input: {
    userId: string;
    expectedSourceHouseholdId: string;
    targetHouseholdId: string;
    membershipId: string;
  }): Promise<HouseholdMembershipCompareAndSetResult>;
  ensureCareState(householdId: string, userId: string): Promise<void>;
  buildExactMeSnapshot(
    userId: string,
    householdId: string,
  ): Promise<ExactHouseholdSnapshot>;
}

export interface HouseholdMembershipSwitchStore {
  transaction<T>(
    work: (transaction: HouseholdMembershipActivationTransaction) => Promise<T>,
  ): Promise<T>;
}

export class HouseholdMembershipActivationError extends Error {
  readonly status: 400 | 403 | 409 | 412 | 428;

  constructor(message: string, status: 400 | 403 | 409 | 412 | 428 = 409) {
    super(message);
    this.name = "HouseholdMembershipActivationError";
    this.status = status;
  }
}

function requireExpectedSource(value: string | null | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new HouseholdMembershipActivationError(
      "Expected household header is required. Refresh household identity and retry.",
      428,
    );
  }
  return value;
}

function requireTarget(value: string | null | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new HouseholdMembershipActivationError(
      "A target household id is required.",
      400,
    );
  }
  return value;
}

function toValidDate(value: Date | string): Date | null {
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validMembershipAuthority(input: {
  membership: HouseholdMembershipRecord;
  userId: string;
  now: Date;
}): {
  role: SwitchableHouseholdRole;
  accessPassExpiresAt: string | null;
} | null {
  const { membership } = input;
  if (
    membership.userId !== input.userId ||
    !membership.id.trim() ||
    !membership.householdId.trim() ||
    membership.revokedAt != null
  ) {
    return null;
  }

  const authority = resolveHouseholdMembershipAuthority({
    role: membership.role,
    accessPassExpiresAt: membership.accessPassExpiresAt,
    now: input.now,
  });
  if (!authority.householdAccessAllowed || !authority.role) return null;

  return {
    role: authority.role,
    accessPassExpiresAt: authority.accessPassExpiresAt,
  };
}

function assertClock(now: Date): void {
  if (Number.isNaN(now.getTime())) {
    throw new HouseholdMembershipActivationError(
      "Household membership validation time is invalid.",
    );
  }
}

function assertLockedUser(input: {
  user: HouseholdMembershipActivationUser | null;
  userId: string;
  expectedSourceHouseholdId: string;
}): HouseholdMembershipActivationUser {
  if (!input.user || input.user.id !== input.userId) {
    throw new HouseholdMembershipActivationError(
      "Authenticated household identity is unavailable.",
    );
  }
  if (input.user.activeHouseholdId !== input.expectedSourceHouseholdId) {
    throw new HouseholdMembershipActivationError(
      "Active household changed. Refresh household identity before retrying.",
      412,
    );
  }
  return input.user;
}

export async function listSwitchableHouseholdMemberships(input: {
  store: HouseholdMembershipSwitchStore;
  userId: string;
  expectedSourceHouseholdId: string | null | undefined;
  now?: Date;
}): Promise<{
  activeHouseholdId: string;
  memberships: SwitchableHouseholdMembership[];
}> {
  const expectedSourceHouseholdId = requireExpectedSource(
    input.expectedSourceHouseholdId,
  );
  return input.store.transaction(async (transaction) => {
    const lockedHouseholdIds = await transaction.lockUserHouseholds(
      input.userId,
      [expectedSourceHouseholdId],
    );
    const user = assertLockedUser({
      user: await transaction.lockUser(input.userId),
      userId: input.userId,
      expectedSourceHouseholdId,
    });
    if (
      !(await transaction.confirmUserHouseholdsLocked(
        input.userId,
        lockedHouseholdIds,
      ))
    ) {
      throw new HouseholdMembershipActivationError(
        "Household membership changed while acquiring transaction authority. Refresh and retry.",
      );
    }
    const membershipRows = await transaction.listMemberships(input.userId);
    const now = input.now ?? (await transaction.getCurrentTime());
    assertClock(now);

    const seenHouseholdIds = new Set<string>();
    const memberships: Array<{
      view: SwitchableHouseholdMembership;
      createdAt: number;
      membershipId: string;
    }> = [];

    for (const membership of membershipRows) {
      const authority = validMembershipAuthority({
        membership,
        userId: input.userId,
        now,
      });
      if (!authority || !membership.householdName.trim()) continue;

      const createdAt = toValidDate(membership.createdAt)?.getTime();
      if (createdAt === undefined) continue;
      if (seenHouseholdIds.has(membership.householdId)) {
        throw new HouseholdMembershipActivationError(
          "Household membership authority is internally inconsistent.",
        );
      }
      seenHouseholdIds.add(membership.householdId);

      memberships.push({
        view: {
          householdId: membership.householdId,
          householdName: membership.householdName,
          role: authority.role,
          accessPassExpiresAt: authority.accessPassExpiresAt,
        },
        createdAt,
        membershipId: membership.id,
      });
    }

    memberships.sort(
      (left, right) =>
        Number(right.view.householdId === user.activeHouseholdId) -
          Number(left.view.householdId === user.activeHouseholdId) ||
        left.createdAt - right.createdAt ||
        left.membershipId.localeCompare(right.membershipId) ||
        left.view.householdId.localeCompare(right.view.householdId),
    );

    return {
      activeHouseholdId: expectedSourceHouseholdId,
      memberships: memberships.map(({ view }) => view),
    };
  });
}

export async function activateRetainedHousehold(input: {
  store: HouseholdMembershipSwitchStore;
  userId: string;
  expectedSourceHouseholdId: string | null | undefined;
  targetHouseholdId: string | null | undefined;
  now?: Date;
}): Promise<{ householdId: string; me: ExactHouseholdSnapshot }> {
  const expectedSourceHouseholdId = requireExpectedSource(
    input.expectedSourceHouseholdId,
  );
  const targetHouseholdId = requireTarget(input.targetHouseholdId);
  return input.store.transaction(async (transaction) => {
    await transaction.lockHouseholds([
      expectedSourceHouseholdId,
      targetHouseholdId,
    ]);
    assertLockedUser({
      user: await transaction.lockUser(input.userId),
      userId: input.userId,
      expectedSourceHouseholdId,
    });

    const targetMembership = await transaction.lockTargetMembership(
      input.userId,
      targetHouseholdId,
    );
    if (!targetMembership) {
      throw new HouseholdMembershipActivationError(
        HOUSEHOLD_MEMBERSHIP_TARGET_UNAVAILABLE_ERROR,
        403,
      );
    }
    const now = input.now ?? (await transaction.getCurrentTime());
    assertClock(now);
    if (
      targetMembership.userId !== input.userId ||
      targetMembership.householdId !== targetHouseholdId ||
      !targetMembership.id.trim()
    ) {
      throw new HouseholdMembershipActivationError(
        "Household membership authority changed during activation.",
      );
    }

    const targetAuthority = validMembershipAuthority({
      membership: targetMembership,
      userId: input.userId,
      now,
    });
    if (!targetAuthority) {
      throw new HouseholdMembershipActivationError(
        HOUSEHOLD_MEMBERSHIP_TARGET_UNAVAILABLE_ERROR,
        403,
      );
    }

    const updated = await transaction.compareAndSetActiveHousehold({
      userId: input.userId,
      expectedSourceHouseholdId,
      targetHouseholdId,
      membershipId: targetMembership.id,
    });
    if (!updated.updated) {
      if (updated.reason === "source-changed") {
        throw new HouseholdMembershipActivationError(
          "Active household changed. Refresh household identity before retrying.",
          412,
        );
      }
      if (updated.reason === "target-invalid") {
        throw new HouseholdMembershipActivationError(
          HOUSEHOLD_MEMBERSHIP_TARGET_UNAVAILABLE_ERROR,
          403,
        );
      }
      throw new HouseholdMembershipActivationError(
        "Household membership authority changed during activation.",
      );
    }

    await transaction.ensureCareState(targetHouseholdId, input.userId);
    const me = await transaction.buildExactMeSnapshot(
      input.userId,
      targetHouseholdId,
    );
    return { householdId: targetHouseholdId, me };
  });
}
