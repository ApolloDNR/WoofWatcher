import { resolveHouseholdMembershipAuthority } from "./household-role-authority.ts";
import {
  HouseholdAuthoritySnapshotError,
  type ExactHouseholdSnapshot,
} from "./household-me-snapshot.ts";

export interface HouseholdProfileUser {
  id: string;
  activeHouseholdId: string | null;
}

export interface HouseholdProfileMembership {
  id: string;
  userId: string;
  householdId: string;
  role: string;
  accessPassExpiresAt: Date | string | null;
}

export interface HouseholdProfileUpdateTransaction {
  lockUserHouseholds(userId: string): Promise<readonly string[]>;
  lockUser(userId: string): Promise<HouseholdProfileUser | null>;
  confirmUserHouseholdsLocked(
    userId: string,
    lockedHouseholdIds: readonly string[],
  ): Promise<boolean>;
  lockActiveMembership(
    userId: string,
    householdId: string,
  ): Promise<HouseholdProfileMembership | null>;
  getCurrentTime(): Promise<Date>;
  updateUserDisplayName(userId: string, displayName: string): Promise<boolean>;
  updateMembershipDisplayNames(
    userId: string,
    activeMembershipId: string,
    displayName: string,
  ): Promise<boolean>;
  buildExactMeSnapshot(
    userId: string,
    householdId: string,
  ): Promise<ExactHouseholdSnapshot>;
}

export interface HouseholdProfileUpdateStore {
  transaction<T>(
    work: (transaction: HouseholdProfileUpdateTransaction) => Promise<T>,
  ): Promise<T>;
}

function conflict(message: string): never {
  throw new HouseholdAuthoritySnapshotError(message);
}

export async function updateHouseholdProfileAtomically(input: {
  store: HouseholdProfileUpdateStore;
  userId: string;
  displayName?: string | null;
}): Promise<ExactHouseholdSnapshot> {
  return input.store.transaction(async (transaction) => {
    const lockedHouseholdIds = await transaction.lockUserHouseholds(
      input.userId,
    );
    const user = await transaction.lockUser(input.userId);
    if (
      !user ||
      user.id !== input.userId ||
      !user.activeHouseholdId?.trim()
    ) {
      return conflict(
        "Authenticated household identity is unavailable for profile update.",
      );
    }
    if (
      !(await transaction.confirmUserHouseholdsLocked(
        input.userId,
        lockedHouseholdIds,
      ))
    ) {
      return conflict(
        "Household membership changed while acquiring transaction authority. Refresh and retry.",
      );
    }

    const householdId = user.activeHouseholdId;
    const membership = await transaction.lockActiveMembership(
      input.userId,
      householdId,
    );
    if (
      !membership ||
      !membership.id.trim() ||
      membership.userId !== input.userId ||
      membership.householdId !== householdId
    ) {
      return conflict(
        "Active household membership changed before profile update.",
      );
    }

    const now = await transaction.getCurrentTime();
    if (Number.isNaN(now.getTime())) {
      return conflict("Profile update authority time is invalid.");
    }
    const authority = resolveHouseholdMembershipAuthority({
      role: membership.role,
      accessPassExpiresAt: membership.accessPassExpiresAt,
      now,
    });
    if (!authority.householdAccessAllowed || !authority.role) {
      throw new HouseholdAuthoritySnapshotError(
        "Authenticated user no longer has valid access to the active household.",
        403,
      );
    }

    if (input.displayName != null) {
      if (
        !(await transaction.updateUserDisplayName(
          input.userId,
          input.displayName,
        ))
      ) {
        return conflict("User identity changed before profile update.");
      }
      if (
        !(await transaction.updateMembershipDisplayNames(
          input.userId,
          membership.id,
          input.displayName,
        ))
      ) {
        return conflict(
          "Household membership changed before profile update completed.",
        );
      }
    }

    return transaction.buildExactMeSnapshot(input.userId, householdId);
  });
}
