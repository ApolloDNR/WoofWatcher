import {
  parseHouseholdMemberRole,
  resolveHouseholdMembershipAuthority,
} from "./household-role-authority.ts";
import type { FreshVerifiedHouseholdJoinIdentity } from "./household-verified-identity.ts";

export interface HouseholdMembershipIdentity {
  id?: string;
  userId: string;
  householdId: string;
  role: string;
  accessPassExpiresAt?: Date | string | null;
  createdAt: Date | string;
}

export interface ActiveHouseholdResolution {
  householdId: string | null;
  shouldPersist: boolean;
  canProvisionDefault: boolean;
}

export function resolveActiveHouseholdMembership(input: {
  userId: string;
  persistedActiveHouseholdId: string | null;
  memberships: readonly HouseholdMembershipIdentity[];
  now: Date;
}): ActiveHouseholdResolution {
  const ownMembershipRecords = input.memberships.filter(
    (membership) => membership.userId === input.userId,
  );
  const ownMemberships = ownMembershipRecords
    .filter(
      (membership) => {
        if (!membership.householdId.trim()) return false;
        if (Number.isNaN(new Date(membership.createdAt).getTime())) return false;
        return resolveHouseholdMembershipAuthority({
          role: membership.role,
          accessPassExpiresAt: membership.accessPassExpiresAt,
          now: input.now,
        }).householdAccessAllowed;
      },
    )
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime() ||
        String(left.id ?? "").localeCompare(String(right.id ?? "")) ||
        left.householdId.localeCompare(right.householdId),
    );

  const activeMembership = input.persistedActiveHouseholdId
    ? ownMemberships.find(
        (membership) =>
          membership.householdId === input.persistedActiveHouseholdId,
      )
    : undefined;
  const selected = activeMembership ?? ownMemberships[0];

  return {
    householdId: selected?.householdId ?? null,
    shouldPersist:
      (selected?.householdId ?? null) !== input.persistedActiveHouseholdId,
    canProvisionDefault: ownMembershipRecords.length === 0,
  };
}

export interface HouseholdIdentityUser {
  id: string;
  displayName: string | null;
  activeHouseholdId: string | null;
}

export type HouseholdJoinUserIdentity = HouseholdIdentityUser;

export interface HouseholdJoinMembershipIdentity extends HouseholdMembershipIdentity {
  id: string;
  role: string;
}

export interface HouseholdJoinInvitationIdentity {
  id: string;
  householdId: string;
  invitedUserId: string | null;
  invitedEmail: string | null;
  role: string;
  lifecycleState: string;
  acceptedByUserId: string | null;
  expiresAt: Date | string | null;
}

export interface HouseholdAcceptanceAuditIdentity {
  action: string;
  actorUserId: string;
  householdId: string;
  targetMemberId: string | null;
  targetUserId: string | null;
  targetRole: string | null;
  nextRole: string | null;
}

export interface HouseholdJoinTransaction<TAuditEvent, TMeSnapshot> {
  lockHouseholds(householdIds: readonly string[]): Promise<void>;
  getCurrentTime(): Promise<Date>;
  lockUser(userId: string): Promise<HouseholdJoinUserIdentity | null>;
  lockInvitation(
    invitationId: string,
  ): Promise<HouseholdJoinInvitationIdentity | null>;
  findMembership(
    userId: string,
    householdId: string,
  ): Promise<HouseholdJoinMembershipIdentity | null>;
  findExistingAcceptanceAudit(input: {
    invitationId: string;
    userId: string;
    householdId: string;
    membershipId: string;
  }): Promise<TAuditEvent | null>;
  createMembership(input: {
    userId: string;
    householdId: string;
    role: string;
    displayName: string | null;
  }): Promise<HouseholdJoinMembershipIdentity>;
  acceptInvitation(input: {
    invitationId: string;
    userId: string;
    householdId: string;
    acceptedAt: Date;
  }): Promise<{ allowed: true } | { allowed: false; reason: string }>;
  ensureCareState(householdId: string, userId: string): Promise<void>;
  recordAudit(event: TAuditEvent): Promise<void>;
  setActiveHousehold(input: {
    userId: string;
    householdId: string;
    membershipId: string;
    expectedSourceHouseholdId: string;
  }): Promise<boolean>;
  buildExactMeSnapshot(input: {
    userId: string;
    householdId: string;
  }): Promise<TMeSnapshot>;
}

export interface HouseholdJoinTransactionStore<TAuditEvent, TMeSnapshot> {
  transaction<T>(
    work: (
      transaction: HouseholdJoinTransaction<TAuditEvent, TMeSnapshot>,
    ) => Promise<T>,
  ): Promise<T>;
}

export class HouseholdJoinCommitError extends Error {
  readonly status: 403 | 409 | 412 | 428 | 503;

  constructor(message: string, status: 403 | 409 | 412 | 428 | 503 = 409) {
    super(message);
    this.name = "HouseholdJoinCommitError";
    this.status = status;
  }
}

export interface HouseholdProvisionTransaction<
  TUser extends HouseholdIdentityUser,
> {
  lockUserHouseholds(userId: string): Promise<readonly string[]>;
  getCurrentTime(): Promise<Date>;
  lockUser(userId: string): Promise<TUser | null>;
  confirmUserHouseholdsLocked(
    userId: string,
    lockedHouseholdIds: readonly string[],
  ): Promise<boolean>;
  listMemberships(userId: string): Promise<HouseholdMembershipIdentity[]>;
  createDefaultHousehold(input: {
    name: string;
  }): Promise<{ householdId: string }>;
  createOwnerMembership(input: {
    userId: string;
    householdId: string;
    displayName: string | null;
  }): Promise<HouseholdMembershipIdentity>;
  ensureCareState(householdId: string, userId: string): Promise<void>;
  setActiveHousehold(userId: string, householdId: string): Promise<boolean>;
}

export interface HouseholdProvisionStore<TUser extends HouseholdIdentityUser> {
  transaction<T>(
    work: (transaction: HouseholdProvisionTransaction<TUser>) => Promise<T>,
  ): Promise<T>;
}

export async function ensureActiveHouseholdIdentity<
  TUser extends HouseholdIdentityUser,
>(input: {
  store: HouseholdProvisionStore<TUser>;
  userId: string;
}): Promise<{
  user: TUser;
  householdId: string;
  createdDefaultHousehold: boolean;
}> {
  return input.store.transaction(async (transaction) => {
    const lockedHouseholdIds = await transaction.lockUserHouseholds(
      input.userId,
    );
    const user = await transaction.lockUser(input.userId);
    if (!user || user.id !== input.userId) {
      throw new HouseholdJoinCommitError(
        "Authenticated user is not provisioned for household access.",
      );
    }
    if (
      !(await transaction.confirmUserHouseholdsLocked(
        input.userId,
        lockedHouseholdIds,
      ))
    ) {
      throw new HouseholdJoinCommitError(
        "Household membership changed while acquiring transaction authority. Refresh and retry.",
      );
    }

    const memberships = await transaction.listMemberships(input.userId);
    const now = await transaction.getCurrentTime();
    if (Number.isNaN(now.getTime())) {
      throw new HouseholdJoinCommitError(
        "Household membership authority clock is invalid.",
      );
    }
    const resolution = resolveActiveHouseholdMembership({
      userId: input.userId,
      persistedActiveHouseholdId: user.activeHouseholdId,
      memberships,
      now,
    });

    if (resolution.householdId) {
      await transaction.ensureCareState(resolution.householdId, input.userId);
      if (resolution.shouldPersist) {
        const persisted = await transaction.setActiveHousehold(
          input.userId,
          resolution.householdId,
        );
        if (!persisted) {
          throw new HouseholdJoinCommitError(
            "Household membership changed while repairing active household.",
          );
        }
        user.activeHouseholdId = resolution.householdId;
      }
      return {
        user,
        householdId: resolution.householdId,
        createdDefaultHousehold: false,
      };
    }

    if (!resolution.canProvisionDefault) {
      throw new HouseholdJoinCommitError(
        "Active household membership is expired or invalid.",
        403,
      );
    }

    const household = await transaction.createDefaultHousehold({
      name: user.displayName ? `${user.displayName}'s Pack` : "My Pack",
    });
    const membership = await transaction.createOwnerMembership({
      userId: input.userId,
      householdId: household.householdId,
      displayName: user.displayName,
    });
    if (
      membership.userId !== input.userId ||
      membership.householdId !== household.householdId
    ) {
      throw new HouseholdJoinCommitError(
        "Default household membership authority changed during provisioning.",
      );
    }

    await transaction.ensureCareState(household.householdId, input.userId);
    const persisted = await transaction.setActiveHousehold(
      input.userId,
      household.householdId,
    );
    if (!persisted) {
      throw new HouseholdJoinCommitError(
        "Default household membership changed during provisioning.",
      );
    }
    user.activeHouseholdId = household.householdId;

    return {
      user,
      householdId: household.householdId,
      createdDefaultHousehold: true,
    };
  });
}

function requiredJoinIdentity(
  value: string | null | undefined,
  message: string,
): string {
  if (!value || !value.trim()) {
    throw new HouseholdJoinCommitError(message, 428);
  }
  return value;
}

function caseFoldedExactEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.toLowerCase();
}

function assertExactMembership(input: {
  membership: HouseholdJoinMembershipIdentity;
  userId: string;
  householdId: string;
  expectedRole?: string;
}): HouseholdJoinMembershipIdentity {
  if (
    !input.membership.id.trim() ||
    input.membership.userId !== input.userId ||
    input.membership.householdId !== input.householdId
  ) {
    throw new HouseholdJoinCommitError(
      "Household membership authority changed during join.",
    );
  }

  const role = parseHouseholdMemberRole(input.membership.role);
  if (!role) {
    throw new HouseholdJoinCommitError(
      "Household membership role authority is invalid during join.",
    );
  }
  if (input.expectedRole !== undefined && role !== input.expectedRole) {
    throw new HouseholdJoinCommitError(
      "Household membership role authority changed during join.",
    );
  }
  return { ...input.membership, role };
}

function assertInvitationRecipient(input: {
  invitation: HouseholdJoinInvitationIdentity;
  user: HouseholdJoinUserIdentity;
  verifiedIdentity: FreshVerifiedHouseholdJoinIdentity;
}): void {
  if (
    input.invitation.invitedUserId !== null &&
    input.invitation.invitedUserId !== input.user.id
  ) {
    throw new HouseholdJoinCommitError(
      "Invitation belongs to a different authenticated user.",
      403,
    );
  }

  if (input.invitation.invitedEmail !== null) {
    if (
      input.verifiedIdentity.state === "provider-unavailable" ||
      input.verifiedIdentity.userId !== input.user.id
    ) {
      throw new HouseholdJoinCommitError(
        "Unable to verify the invitation recipient with the identity provider right now.",
        503,
      );
    }
    const invitedEmail = caseFoldedExactEmail(input.invitation.invitedEmail);
    if (
      !invitedEmail ||
      !input.verifiedIdentity.verifiedEmails.some(
        (email) => caseFoldedExactEmail(email) === invitedEmail,
      )
    ) {
      throw new HouseholdJoinCommitError(
        "Invitation belongs to a different email than the authenticated user's fresh verified identity.",
        403,
      );
    }
  }
}

function invitationLifecycleRejection(input: {
  invitation: HouseholdJoinInvitationIdentity;
  acceptedAt: Date;
}): { status: 403 | 409; message: string } | null {
  const lifecycleState = input.invitation.lifecycleState.trim().toLowerCase();
  const expiresAt = input.invitation.expiresAt
    ? new Date(input.invitation.expiresAt)
    : null;

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return {
      status: 409,
      message: "Invitation expiry authority is invalid for acceptance.",
    };
  }

  if (
    lifecycleState === "approved" &&
    expiresAt &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() <= input.acceptedAt.getTime()
  ) {
    return {
      status: 403,
      message: "Invitation expired before it was accepted.",
    };
  }

  if (lifecycleState === "approved" || lifecycleState === "accepted") {
    return null;
  }

  const reasonByLifecycle: Record<string, string> = {
    "pending-approval":
      "Invitation is waiting for owner approval before it can be accepted.",
    revoked: "Invitation was revoked by an owner/admin.",
    expired: "Invitation expired before it was accepted.",
    rejected: "Invitation was rejected by an owner/admin.",
  };
  return {
    status: reasonByLifecycle[lifecycleState] ? 403 : 409,
    message:
      reasonByLifecycle[lifecycleState] ??
      "Invitation lifecycle authority is invalid for acceptance.",
  };
}

function isExactAcceptanceAudit(
  auditEvent: HouseholdAcceptanceAuditIdentity,
  input: {
    userId: string;
    householdId: string;
    membershipId: string;
  },
): boolean {
  return (
    auditEvent.action === "invitation-accepted" &&
    auditEvent.actorUserId === input.userId &&
    auditEvent.householdId === input.householdId &&
    auditEvent.targetUserId === input.userId &&
    auditEvent.targetMemberId === input.membershipId
  );
}

export async function commitJoinedHouseholdActivation<
  TAuditEvent extends HouseholdAcceptanceAuditIdentity,
  TMeSnapshot,
>(input: {
  store: HouseholdJoinTransactionStore<TAuditEvent, TMeSnapshot>;
  userId: string;
  householdId: string;
  expectedSourceHouseholdId: string | null;
  invitationId: string | null;
  verifiedIdentity: FreshVerifiedHouseholdJoinIdentity;
  acceptedAt?: Date;
  buildAuditEvent(context: {
    inThisHousehold: boolean;
    invitationId: string;
    membership: HouseholdJoinMembershipIdentity;
    acceptedAt: Date;
  }): TAuditEvent;
}): Promise<{
  inThisHousehold: boolean;
  auditEvent: TAuditEvent;
  replayed: boolean;
  me: TMeSnapshot;
}> {
  const invitationId = requiredJoinIdentity(
    input.invitationId,
    "A durable invitation id is required to join a household.",
  );
  const expectedSourceHouseholdId = requiredJoinIdentity(
    input.expectedSourceHouseholdId,
    "The expected source household is required to join a household.",
  );
  const householdId = input.householdId;
  if (!householdId.trim()) {
    throw new HouseholdJoinCommitError(
      "Invitation household authority is missing.",
    );
  }

  return input.store.transaction(async (transaction) => {
    await transaction.lockHouseholds([
      expectedSourceHouseholdId,
      householdId,
    ]);
    const user = await transaction.lockUser(input.userId);
    if (!user || user.id !== input.userId) {
      throw new HouseholdJoinCommitError(
        "Authenticated user is not provisioned for household join.",
      );
    }

    if (user.activeHouseholdId !== expectedSourceHouseholdId) {
      throw new HouseholdJoinCommitError(
        "Active household changed before the join could be committed.",
        412,
      );
    }

    const invitation = await transaction.lockInvitation(invitationId);
    if (!invitation) {
      throw new HouseholdJoinCommitError(
        "Durable invitation is no longer available for acceptance.",
        403,
      );
    }
    if (invitation.id !== invitationId) {
      throw new HouseholdJoinCommitError(
        "Invitation authority changed while joining the household.",
      );
    }
    if (invitation.householdId !== householdId) {
      throw new HouseholdJoinCommitError(
        "Invitation does not authorize the requested household.",
        403,
      );
    }

    assertInvitationRecipient({
      invitation,
      user,
      verifiedIdentity: input.verifiedIdentity,
    });
    const invitationRole = parseHouseholdMemberRole(invitation.role);
    if (!invitationRole) {
      throw new HouseholdJoinCommitError(
        "Invitation role authority is invalid for acceptance.",
      );
    }
    const acceptedAt = input.acceptedAt ?? (await transaction.getCurrentTime());
    if (Number.isNaN(acceptedAt.getTime())) {
      throw new HouseholdJoinCommitError(
        "Invitation acceptance time is invalid.",
      );
    }
    const lifecycleRejection = invitationLifecycleRejection({
      invitation,
      acceptedAt,
    });
    if (lifecycleRejection) {
      throw new HouseholdJoinCommitError(
        lifecycleRejection.message,
        lifecycleRejection.status,
      );
    }

    const lifecycleState = invitation.lifecycleState.trim().toLowerCase();
    if (lifecycleState === "accepted") {
      if (!invitation.acceptedByUserId?.trim()) {
        throw new HouseholdJoinCommitError(
          "Accepted invitation is missing acceptance authority.",
        );
      }
      if (invitation.acceptedByUserId !== input.userId) {
        throw new HouseholdJoinCommitError(
          "Invitation was already accepted by a different authenticated user.",
          403,
        );
      }
      if (user.activeHouseholdId !== householdId) {
        throw new HouseholdJoinCommitError(
          "Invitation was already accepted, but its household is not active for this retry.",
        );
      }

      let membership = await transaction.findMembership(
        input.userId,
        householdId,
      );
      if (!membership) {
        throw new HouseholdJoinCommitError(
          "Invitation membership was revoked after acceptance and cannot be recreated by retry.",
        );
      }
      membership = assertExactMembership({
        membership,
        userId: input.userId,
        householdId,
      });

      const auditEvent = await transaction.findExistingAcceptanceAudit({
        invitationId,
        userId: input.userId,
        householdId,
        membershipId: membership.id,
      });
      if (
        !auditEvent ||
        !isExactAcceptanceAudit(auditEvent, {
          userId: input.userId,
          householdId,
          membershipId: membership.id,
        })
      ) {
        throw new HouseholdJoinCommitError(
          "Original membership or acceptance audit no longer proves this invitation retry.",
        );
      }

      const me = await transaction.buildExactMeSnapshot({
        userId: input.userId,
        householdId,
      });
      return {
        inThisHousehold: auditEvent.targetRole !== null,
        auditEvent,
        replayed: true,
        me,
      };
    }

    if (invitation.acceptedByUserId !== null) {
      throw new HouseholdJoinCommitError(
        "Approved invitation already contains conflicting acceptance authority.",
      );
    }

    let membership = await transaction.findMembership(
      input.userId,
      householdId,
    );
    const inThisHousehold = membership !== null;

    if (membership) {
      membership = assertExactMembership({
        membership,
        userId: input.userId,
        householdId,
      });
    }

    const invitationResult = await transaction.acceptInvitation({
      invitationId,
      userId: input.userId,
      householdId,
      acceptedAt,
    });
    if (!invitationResult.allowed) {
      throw new HouseholdJoinCommitError(invitationResult.reason);
    }

    if (!membership) {
      membership = await transaction.createMembership({
        userId: input.userId,
        householdId,
        role: invitationRole,
        displayName: user.displayName,
      });
      membership = assertExactMembership({
        membership,
        userId: input.userId,
        householdId,
        expectedRole: invitationRole,
      });
    }

    await transaction.ensureCareState(householdId, input.userId);
    const auditEvent = input.buildAuditEvent({
      inThisHousehold,
      invitationId,
      membership,
      acceptedAt,
    });
    await transaction.recordAudit(auditEvent);

    const promoted = await transaction.setActiveHousehold({
      userId: input.userId,
      householdId,
      membershipId: membership.id,
      expectedSourceHouseholdId,
    });
    if (!promoted) {
      throw new HouseholdJoinCommitError(
        "Household membership changed before join could become active.",
      );
    }

    const me = await transaction.buildExactMeSnapshot({
      userId: input.userId,
      householdId,
    });
    return { inThisHousehold, auditEvent, replayed: false, me };
  });
}
