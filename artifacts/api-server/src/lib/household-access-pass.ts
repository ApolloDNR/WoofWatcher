import {
  ACCESS_PASS_COMPATIBLE_ROLES,
  normalizeHouseholdMemberRole,
} from "./household-authorization";

export type AccessPassMutationAction = "activate" | "revoke";
export type HouseholdAuditAction =
  | "invitation-accepted"
  | "member-role-updated"
  | "member-revoked"
  | "access-pass-activated"
  | "access-pass-revoked";

export interface AccessPassMutationInput {
  actorRole?: string | null;
  targetRole?: string | null;
  nextRole?: string | null;
  targetIsSelf?: boolean;
  action: AccessPassMutationAction;
}

export interface AccessPassMutationPolicy {
  allowed: boolean;
  reason?: string;
  nextRole?: string;
}

export interface HouseholdAuditEventInput {
  action: HouseholdAuditAction;
  actorUserId: string;
  householdId: string;
  targetMemberId?: string | null;
  targetUserId?: string | null;
  targetRole?: string | null;
  nextRole?: string | null;
  reason?: string | null;
  note?: string | null;
  expiresAt?: string | null;
}

export interface HouseholdAuditEvent {
  id: string;
  action: HouseholdAuditAction;
  actorUserId: string;
  householdId: string;
  targetMemberId: string | null;
  targetUserId: string | null;
  targetRole: string | null;
  nextRole: string | null;
  reason: string | null;
  note: string | null;
  expiresAt: string | null;
  createdAt: string;
  storage: "response-only";
  boundary: string;
}

const ACCESS_PASS_ROLE_SET = new Set<string>(ACCESS_PASS_COMPATIBLE_ROLES);

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function nullableClean(value: unknown): string | null {
  const cleaned = clean(value);
  return cleaned || null;
}

function isOwnerAdmin(role: string): boolean {
  return role === "owner";
}

function isAccessPassRole(role: string): boolean {
  return ACCESS_PASS_ROLE_SET.has(role);
}

export function normalizeAccessPassRole(role: string | null | undefined): string {
  const normalized = normalizeHouseholdMemberRole(role);
  return isAccessPassRole(normalized) ? normalized : "sitter";
}

export function assertAccessPassMutationAllowed(
  input: AccessPassMutationInput,
): AccessPassMutationPolicy {
  const actorRole = normalizeHouseholdMemberRole(input.actorRole);
  const targetRole = normalizeHouseholdMemberRole(input.targetRole);
  const nextRole = normalizeAccessPassRole(input.nextRole ?? targetRole);

  if (!isOwnerAdmin(actorRole)) {
    return {
      allowed: false,
      reason: "Only an owner/admin can activate or revoke Access Pass helper access.",
      nextRole,
    };
  }

  if (input.targetIsSelf) {
    return {
      allowed: false,
      reason: "Owners cannot manage their own access from the Access Pass helper flow.",
      nextRole,
    };
  }

  if (targetRole === "owner") {
    return {
      allowed: false,
      reason: "Owner access cannot be changed from the Access Pass helper flow.",
      nextRole,
    };
  }

  if (input.action === "activate") {
    return {
      allowed: true,
      reason:
        "Owner/admin Access Pass activation is allowed for sitter, trainer, walker, and vet viewer helper roles.",
      nextRole,
    };
  }

  if (!isAccessPassRole(targetRole)) {
    return {
      allowed: false,
      reason: "Access Pass revocation is limited to active helper roles.",
      nextRole: targetRole,
    };
  }

  return {
    allowed: true,
    reason: "Owner/admin Access Pass helper revocation is allowed and should create helper audit trail metadata.",
    nextRole: targetRole,
  };
}

export function buildHouseholdAuditEvent(
  input: HouseholdAuditEventInput,
  now: Date = new Date(),
): HouseholdAuditEvent {
  const createdAt = now.toISOString();
  const targetMemberId = nullableClean(input.targetMemberId);
  const targetUserId = nullableClean(input.targetUserId);
  const nextRole = nullableClean(input.nextRole);
  const safeAction = input.action;
  const suffix = [targetMemberId, targetUserId, nextRole]
    .filter(Boolean)
    .join("_")
    .replace(/[^a-z0-9_-]/gi, "")
    .slice(0, 40);

  return {
    id: `household_audit_${safeAction}_${now.getTime()}${suffix ? `_${suffix}` : ""}`,
    action: safeAction,
    actorUserId: clean(input.actorUserId),
    householdId: clean(input.householdId),
    targetMemberId,
    targetUserId,
    targetRole: nullableClean(input.targetRole),
    nextRole,
    reason: nullableClean(input.reason),
    note: nullableClean(input.note),
    expiresAt: nullableClean(input.expiresAt),
    createdAt,
    storage: "response-only",
    boundary:
      "Helper audit trail metadata is returned with this mutation; durable provider audit storage is still a launch gate.",
  };
}
