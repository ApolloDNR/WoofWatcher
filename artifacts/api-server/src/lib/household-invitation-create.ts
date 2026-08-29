import { parseHouseholdMemberRole } from "./household-role-authority.ts";

export const HOUSEHOLD_INVITATION_CODE_ATTEMPTS = 12;

export type CreatableHouseholdInvitationLifecycle =
  | "approved"
  | "pending-approval";

export interface HouseholdInvitationCreateUser {
  id: string;
  activeHouseholdId: string | null;
}

export interface HouseholdInvitationCreateActorMembership {
  id: string;
  userId: string;
  householdId: string;
  role: string;
}

export interface HouseholdInvitationCreateRecord {
  id: string;
  householdId: string;
  inviteCode: string;
  invitedEmail: string | null;
  role: string;
  lifecycleState: string;
  createdByUserId: string;
  approvedByUserId: string | null;
  note: string | null;
  expiresAt: Date | string | null;
  createdAt: Date | string;
}

export interface HouseholdInvitationCreateInsert {
  householdId: string;
  inviteCode: string;
  invitedEmail: string | null;
  role: string;
  lifecycleState: CreatableHouseholdInvitationLifecycle;
  actorUserId: string;
  approvedByUserId: string | null;
  note: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface HouseholdInvitationCreateAuditEvent {
  id: string;
  action: "invitation-created";
  lifecycleState: "invite-created";
  actorUserId: string;
  householdId: string;
  nextRole: string | null;
  note: string | null;
  expiresAt: Date | string | null;
  createdAt: Date | string;
}

export type HouseholdInvitationInsertResult =
  | { status: "collision" }
  | { status: "created"; invitation: HouseholdInvitationCreateRecord };

export interface HouseholdInvitationCreateTransaction<
  TAuditEvent extends HouseholdInvitationCreateAuditEvent,
> {
  lockHouseholds(householdIds: readonly string[]): Promise<void>;
  lockUser(userId: string): Promise<HouseholdInvitationCreateUser | null>;
  lockActorMembership(
    userId: string,
    householdId: string,
  ): Promise<HouseholdInvitationCreateActorMembership | null>;
  getCurrentTime(): Promise<Date>;
  nextInviteCodeCandidate(): Promise<string>;
  tryInsertInvitation(
    input: HouseholdInvitationCreateInsert,
  ): Promise<HouseholdInvitationInsertResult>;
  recordAudit(event: TAuditEvent): Promise<void>;
}

export interface HouseholdInvitationCreateStore<
  TAuditEvent extends HouseholdInvitationCreateAuditEvent,
> {
  transaction<T>(
    work: (
      transaction: HouseholdInvitationCreateTransaction<TAuditEvent>,
    ) => Promise<T>,
  ): Promise<T>;
}

export class HouseholdInvitationCreateError extends Error {
  readonly status: 400 | 403 | 409 | 412 | 428;

  constructor(message: string, status: 400 | 403 | 409 | 412 | 428) {
    super(message);
    this.name = "HouseholdInvitationCreateError";
    this.status = status;
  }
}

function exactIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.trim() === value
  );
}

function optionalText(value: string | null | undefined): string | null {
  return value ?? null;
}

function normalizedDate(value: Date | string): Date | null {
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function exactDate(
  value: Date | string | null,
  expected: Date | null,
): boolean {
  if (value === null || expected === null) return value === expected;
  const date = normalizedDate(value);
  return date !== null && date.getTime() === expected.getTime();
}

function creatableLifecycle(
  value: string | null | undefined,
): CreatableHouseholdInvitationLifecycle | null {
  return value === "approved" || value === "pending-approval" ? value : null;
}

function assertCreatedInvitation(input: {
  invitation: HouseholdInvitationCreateRecord;
  insert: HouseholdInvitationCreateInsert;
}): void {
  const { invitation, insert } = input;
  if (
    !exactIdentifier(invitation.id) ||
    invitation.householdId !== insert.householdId ||
    invitation.inviteCode !== insert.inviteCode ||
    invitation.invitedEmail !== insert.invitedEmail ||
    invitation.role !== insert.role ||
    invitation.lifecycleState !== insert.lifecycleState ||
    invitation.createdByUserId !== insert.actorUserId ||
    invitation.approvedByUserId !== insert.approvedByUserId ||
    invitation.note !== insert.note ||
    !exactDate(invitation.expiresAt, insert.expiresAt) ||
    !exactDate(invitation.createdAt, insert.createdAt)
  ) {
    throw new HouseholdInvitationCreateError(
      "Created invitation authority did not match the locked household request.",
      409,
    );
  }
}

function assertMatchingAuditEvent(input: {
  event: HouseholdInvitationCreateAuditEvent;
  invitation: HouseholdInvitationCreateRecord;
  actorMembership: HouseholdInvitationCreateActorMembership;
  now: Date;
}): void {
  const { event, invitation, actorMembership, now } = input;
  if (
    !exactIdentifier(event.id) ||
    event.action !== "invitation-created" ||
    event.lifecycleState !== "invite-created" ||
    event.actorUserId !== actorMembership.userId ||
    event.householdId !== actorMembership.householdId ||
    event.nextRole !== invitation.role ||
    event.note !== invitation.note ||
    !exactDate(event.expiresAt, normalizedDateOrNull(invitation.expiresAt)) ||
    !exactDate(event.createdAt, now)
  ) {
    throw new HouseholdInvitationCreateError(
      "Invitation audit authority did not match the created invitation.",
      409,
    );
  }
}

function normalizedDateOrNull(value: Date | string | null): Date | null {
  return value === null ? null : normalizedDate(value);
}

export async function createHouseholdInvitationAtomically<
  TAuditEvent extends HouseholdInvitationCreateAuditEvent,
>(input: {
  store: HouseholdInvitationCreateStore<TAuditEvent>;
  actorUserId: string;
  householdId: string;
  expectedSourceHouseholdId: string | null | undefined;
  invitedEmail?: string | null;
  role: string;
  lifecycleState: string | null | undefined;
  note?: string | null;
  expiresAt?: Date | string | null;
  buildAuditEvent(context: {
    invitation: HouseholdInvitationCreateRecord;
    actorMembership: HouseholdInvitationCreateActorMembership;
    now: Date;
  }): TAuditEvent;
}): Promise<{
  invitation: HouseholdInvitationCreateRecord;
  auditEvent: TAuditEvent;
}> {
  return input.store.transaction(async (transaction) => {
    if (
      !exactIdentifier(input.actorUserId) ||
      !exactIdentifier(input.householdId)
    ) {
      throw new HouseholdInvitationCreateError(
        "Household invitation authority is invalid.",
        409,
      );
    }
    if (!exactIdentifier(input.expectedSourceHouseholdId)) {
      throw new HouseholdInvitationCreateError(
        "The expected source household is required to create an invitation.",
        428,
      );
    }
    if (input.expectedSourceHouseholdId !== input.householdId) {
      throw new HouseholdInvitationCreateError(
        "Active household changed before the invitation could be created.",
        412,
      );
    }

    await transaction.lockHouseholds([input.householdId]);
    const user = await transaction.lockUser(input.actorUserId);
    if (!user || user.id !== input.actorUserId) {
      throw new HouseholdInvitationCreateError(
        "Authenticated user is unavailable for household invitation creation.",
        409,
      );
    }
    if (user.activeHouseholdId !== input.expectedSourceHouseholdId) {
      throw new HouseholdInvitationCreateError(
        "Active household changed before the invitation could be created.",
        412,
      );
    }

    const actorMembership = await transaction.lockActorMembership(
      input.actorUserId,
      input.householdId,
    );
    if (
      !actorMembership ||
      !exactIdentifier(actorMembership.id) ||
      actorMembership.userId !== input.actorUserId ||
      actorMembership.householdId !== input.householdId
    ) {
      throw new HouseholdInvitationCreateError(
        "Only an exact household owner can create caregiver invitations.",
        403,
      );
    }

    const transactionTime = await transaction.getCurrentTime();
    const now =
      transactionTime instanceof Date
        ? new Date(transactionTime.getTime())
        : new Date(Number.NaN);
    if (Number.isNaN(now.getTime())) {
      throw new HouseholdInvitationCreateError(
        "Provider invitation time is invalid.",
        409,
      );
    }
    if (parseHouseholdMemberRole(actorMembership.role) !== "owner") {
      throw new HouseholdInvitationCreateError(
        "Only an owner/admin can create household invitations for caregiver access.",
        403,
      );
    }

    const requestedRole = parseHouseholdMemberRole(input.role);
    if (!requestedRole) {
      throw new HouseholdInvitationCreateError(
        "Invitation role must be a recognized household role.",
        400,
      );
    }
    // Ownership is never delegated through a shareable invitation. Preserve
    // the existing API contract by reducing an explicit owner request to the
    // ordinary adult caregiver role.
    const invitationRole = requestedRole === "owner" ? "adult" : requestedRole;

    const lifecycleState = creatableLifecycle(input.lifecycleState);
    if (!lifecycleState) {
      throw new HouseholdInvitationCreateError(
        "New household invitations can only start as approved or pending approval.",
        400,
      );
    }

    let expiresAt: Date | null = null;
    if (input.expiresAt !== null && input.expiresAt !== undefined) {
      expiresAt = normalizedDate(input.expiresAt);
      if (!expiresAt) {
        throw new HouseholdInvitationCreateError(
          "Invitation expiration must be a valid date.",
          400,
        );
      }
      if (expiresAt.getTime() <= now.getTime()) {
        throw new HouseholdInvitationCreateError(
          "Invitation expiration must be in the future before sharing.",
          400,
        );
      }
    }

    const invitedEmail = optionalText(input.invitedEmail);
    const note = optionalText(input.note);
    const approvedByUserId =
      lifecycleState === "approved" ? input.actorUserId : null;

    for (
      let attempt = 0;
      attempt < HOUSEHOLD_INVITATION_CODE_ATTEMPTS;
      attempt += 1
    ) {
      const inviteCode = await transaction.nextInviteCodeCandidate();
      if (!exactIdentifier(inviteCode)) {
        throw new HouseholdInvitationCreateError(
          "Invitation code generation returned invalid authority.",
          409,
        );
      }

      const insert: HouseholdInvitationCreateInsert = {
        householdId: input.householdId,
        inviteCode,
        invitedEmail,
        role: invitationRole,
        lifecycleState,
        actorUserId: input.actorUserId,
        approvedByUserId,
        note,
        expiresAt,
        createdAt: now,
      };
      const inserted = await transaction.tryInsertInvitation(insert);
      if (inserted.status === "collision") continue;

      assertCreatedInvitation({ invitation: inserted.invitation, insert });
      const auditEvent = input.buildAuditEvent({
        invitation: inserted.invitation,
        actorMembership,
        now: new Date(now),
      });
      assertMatchingAuditEvent({
        event: auditEvent,
        invitation: inserted.invitation,
        actorMembership,
        now,
      });
      await transaction.recordAudit(auditEvent);
      return { invitation: inserted.invitation, auditEvent };
    }

    throw new HouseholdInvitationCreateError(
      "A unique invitation code could not be reserved. Retry invitation creation.",
      409,
    );
  });
}
