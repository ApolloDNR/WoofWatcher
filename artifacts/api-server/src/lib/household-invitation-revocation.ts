export interface RevocableHouseholdInvitation {
  id: string;
  householdId: string;
  lifecycleState: string;
  role: string;
  expiresAt: Date | string | null;
  note: string | null;
}

export interface HouseholdInvitationRevocationTransaction<
  TAuditEvent,
  TInvitation extends RevocableHouseholdInvitation = RevocableHouseholdInvitation,
> {
  lockActorMembership(
    userId: string,
    householdId: string,
  ): Promise<{ role: string } | null>;
  lockInvitation(
    invitationId: string,
    householdId: string,
  ): Promise<TInvitation | null>;
  revokePendingInvitation(input: {
    invitationId: string;
    householdId: string;
    actorUserId: string;
    reason: string | null;
    now: Date;
  }): Promise<TInvitation | null>;
  recordAudit(event: TAuditEvent): Promise<void>;
}

export interface HouseholdInvitationRevocationStore<
  TAuditEvent,
  TInvitation extends RevocableHouseholdInvitation = RevocableHouseholdInvitation,
> {
  transaction<T>(
    work: (
      transaction: HouseholdInvitationRevocationTransaction<
        TAuditEvent,
        TInvitation
      >,
    ) => Promise<T>,
  ): Promise<T>;
}

export class HouseholdInvitationRevocationError extends Error {
  readonly status: 403 | 404 | 409;

  constructor(message: string, status: 403 | 404 | 409) {
    super(message);
    this.name = "HouseholdInvitationRevocationError";
    this.status = status;
  }
}

const REVOCABLE_LIFECYCLES = new Set(["pending-approval", "approved"]);

export async function revokePreAcceptanceInvitation<
  TAuditEvent,
  TInvitation extends RevocableHouseholdInvitation = RevocableHouseholdInvitation,
>(input: {
  store: HouseholdInvitationRevocationStore<TAuditEvent, TInvitation>;
  actorUserId: string;
  householdId: string;
  invitationId: string;
  reason: string | null;
  now?: Date;
  buildAuditEvent(context: {
    invitation: TInvitation;
    revoked: TInvitation;
    now: Date;
  }): TAuditEvent;
}): Promise<{
  invitation: TInvitation;
  auditEvent: TAuditEvent;
}> {
  const now = input.now ?? new Date();

  return input.store.transaction(async (transaction) => {
    const actor = await transaction.lockActorMembership(
      input.actorUserId,
      input.householdId,
    );
    if (actor?.role !== "owner") {
      throw new HouseholdInvitationRevocationError(
        "Only an owner/admin can revoke household invitations before acceptance.",
        403,
      );
    }

    const invitation = await transaction.lockInvitation(
      input.invitationId,
      input.householdId,
    );
    if (!invitation) {
      throw new HouseholdInvitationRevocationError(
        "Household invitation not found",
        404,
      );
    }
    if (!REVOCABLE_LIFECYCLES.has(invitation.lifecycleState)) {
      throw new HouseholdInvitationRevocationError(
        "Only pending or approved invitations can be revoked. Accepted invitations are terminal; remove access through household member revocation.",
        409,
      );
    }

    const revoked = await transaction.revokePendingInvitation({
      invitationId: invitation.id,
      householdId: input.householdId,
      actorUserId: input.actorUserId,
      reason: input.reason,
      now,
    });
    if (!revoked || revoked.lifecycleState !== "revoked") {
      throw new HouseholdInvitationRevocationError(
        "Invitation lifecycle changed before revocation completed. Refresh household invitations before retrying.",
        409,
      );
    }

    const auditEvent = input.buildAuditEvent({ invitation, revoked, now });
    await transaction.recordAudit(auditEvent);
    return { invitation: revoked, auditEvent };
  });
}
