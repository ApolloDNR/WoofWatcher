import { randomUUID } from "node:crypto";
import {
  isHouseholdAccessPassRole,
  parseHouseholdMemberRole,
  resolveHouseholdMembershipAuthority,
} from "./household-role-authority.ts";

export type AccessPassMutationAction = "activate" | "revoke";
export type HouseholdAuditAction =
  | "invitation-created"
  | "invitation-accepted"
  | "invitation-revoked"
  | "member-role-updated"
  | "member-revoked"
  | "access-pass-activated"
  | "access-pass-revoked";
export type HouseholdAuditLifecycleState =
  | "invite-created"
  | "invite-accepted"
  | "invite-revoked"
  | "member-updated"
  | "member-revoked"
  | "access-pass-active"
  | "access-pass-revoked"
  | "access-pass-expired";

export interface HouseholdAuditListQuery {
  limit: number;
  action?: HouseholdAuditAction;
  lifecycleState?: HouseholdAuditLifecycleState;
}

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

export interface AccessPassExpiryPolicy {
  allowed: boolean;
  expiresAt: string | null;
  lifecycleState: "access-pass-active" | "access-pass-expired";
  reason?: string;
}

export interface AccessPassRuntimeStatus {
  role: string;
  authorizationRole: string;
  accessPassExpiresAt: string | null;
  accessPassExpired: boolean;
  reason?: string;
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
  lifecycleState: HouseholdAuditLifecycleState;
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
  storage: "provider-durable";
  boundary: string;
}

export interface HouseholdAuditInsertRecord {
  id: string;
  action: HouseholdAuditAction;
  lifecycleState: HouseholdAuditLifecycleState;
  actorUserId: string;
  householdId: string;
  targetMemberId: string | null;
  targetUserId: string | null;
  targetRole: string | null;
  nextRole: string | null;
  reason: string | null;
  note: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  metadata: {
    boundary: string;
    storage: "provider-durable";
  };
}

export interface HouseholdAuditSelectRecord {
  id: string;
  action: string;
  lifecycleState: string;
  actorUserId: string;
  householdId: string;
  targetMemberId: string | null;
  targetUserId: string | null;
  targetRole: string | null;
  nextRole: string | null;
  reason: string | null;
  note: string | null;
  expiresAt: Date | string | null;
  createdAt: Date | string;
  metadata?: {
    boundary?: string;
    storage?: string;
  } | null;
}

const ACCESS_PASS_COMPATIBLE_ROLES = [
  "sitter",
  "trainer",
  "walker",
  "vet viewer",
] as const;

const ACCESS_PASS_ROLE_SET = new Set<string>(ACCESS_PASS_COMPATIBLE_ROLES);
const HOUSEHOLD_AUDIT_ACTIONS = [
  "invitation-created",
  "invitation-accepted",
  "invitation-revoked",
  "member-role-updated",
  "member-revoked",
  "access-pass-activated",
  "access-pass-revoked",
] as const satisfies readonly HouseholdAuditAction[];
const HOUSEHOLD_AUDIT_LIFECYCLE_STATES = [
  "invite-created",
  "invite-accepted",
  "invite-revoked",
  "member-updated",
  "member-revoked",
  "access-pass-active",
  "access-pass-revoked",
  "access-pass-expired",
] as const satisfies readonly HouseholdAuditLifecycleState[];
const HOUSEHOLD_AUDIT_ACTION_SET = new Set<string>(HOUSEHOLD_AUDIT_ACTIONS);
const HOUSEHOLD_AUDIT_LIFECYCLE_SET = new Set<string>(
  HOUSEHOLD_AUDIT_LIFECYCLE_STATES,
);
const DURABLE_AUDIT_BOUNDARY =
  "Durable provider audit storage is ready for household invite, role, and Access Pass mutations; retention/export/deletion policy remains a launch approval gate.";

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function nullableClean(value: unknown): string | null {
  const cleaned = clean(value);
  return cleaned || null;
}

function isOwnerAdmin(role: string | null): boolean {
  return role === "owner";
}

function isAccessPassRole(role: string): boolean {
  return ACCESS_PASS_ROLE_SET.has(role) && isHouseholdAccessPassRole(role);
}

function normalizeHouseholdMemberRole(role: string | null | undefined): string {
  return parseHouseholdMemberRole(role) ?? "";
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoString(value: Date | string | null): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const date = parseIsoDate(value);
  return date ? date.toISOString() : null;
}

function isHouseholdAuditAction(value: string): value is HouseholdAuditAction {
  return HOUSEHOLD_AUDIT_ACTION_SET.has(value);
}

function isHouseholdAuditLifecycleState(
  value: string,
): value is HouseholdAuditLifecycleState {
  return HOUSEHOLD_AUDIT_LIFECYCLE_SET.has(value);
}

function deriveLifecycleState(
  input: HouseholdAuditEventInput,
): HouseholdAuditLifecycleState {
  if (input.action === "invitation-created") return "invite-created";
  if (input.action === "invitation-accepted") return "invite-accepted";
  if (input.action === "invitation-revoked") return "invite-revoked";
  if (input.action === "member-role-updated") return "member-updated";
  if (input.action === "member-revoked") return "member-revoked";
  if (input.action === "access-pass-revoked") return "access-pass-revoked";
  if (input.action === "access-pass-activated") return "access-pass-active";
  return "member-updated";
}

export function normalizeAccessPassRole(
  role: string | null | undefined,
): string {
  const normalized = normalizeHouseholdMemberRole(role);
  return isAccessPassRole(normalized) ? normalized : "";
}

export function isAccessPassHelperRole(
  role: string | null | undefined,
): boolean {
  return isAccessPassRole(normalizeHouseholdMemberRole(role));
}

export function normalizeHouseholdAuditListQuery(
  query: Record<string, unknown>,
): HouseholdAuditListQuery {
  const requestedLimit = Number(query.limit ?? 50);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.trunc(requestedLimit)))
    : 50;
  const action = clean(query.action).toLowerCase();
  const lifecycleState = clean(query.lifecycleState).toLowerCase();

  return {
    limit,
    ...(isHouseholdAuditAction(action) ? { action } : {}),
    ...(isHouseholdAuditLifecycleState(lifecycleState)
      ? { lifecycleState }
      : {}),
  };
}

export function assertAccessPassExpiryAllowed(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): AccessPassExpiryPolicy {
  const cleaned = nullableClean(expiresAt);
  if (!cleaned) {
    return {
      allowed: true,
      expiresAt: null,
      lifecycleState: "access-pass-active",
    };
  }

  const date = parseIsoDate(cleaned);
  if (!date) {
    return {
      allowed: false,
      expiresAt: null,
      lifecycleState: "access-pass-expired",
      reason: "Access Pass expiration must be a valid ISO date.",
    };
  }

  if (date.getTime() <= now.getTime()) {
    return {
      allowed: false,
      expiresAt: date.toISOString(),
      lifecycleState: "access-pass-expired",
      reason:
        "Access Pass expiration must be in the future before helper access can be activated.",
    };
  }

  return {
    allowed: true,
    expiresAt: date.toISOString(),
    lifecycleState: "access-pass-active",
  };
}

export function deriveAccessPassRuntimeStatus(input: {
  role?: string | null;
  accessPassExpiresAt?: Date | string | null;
  now?: Date;
}): AccessPassRuntimeStatus {
  const now = input.now ?? new Date();
  const authority = resolveHouseholdMembershipAuthority({
    role: input.role,
    accessPassExpiresAt: input.accessPassExpiresAt,
    now,
  });
  if (authority.state === "invalid" || !authority.role) {
    return {
      role: "",
      authorizationRole: "invalid household role",
      accessPassExpiresAt: null,
      accessPassExpired: false,
      reason: "Household role or Access Pass authority is invalid.",
    };
  }
  if (authority.state === "expired") {
    return {
      role: authority.role,
      authorizationRole: "expired access pass",
      accessPassExpiresAt: authority.accessPassExpiresAt,
      accessPassExpired: true,
      reason:
        "Access Pass expired; helper writes should be blocked until an owner/admin renews access.",
    };
  }

  return {
    role: authority.role,
    authorizationRole: authority.authorizationRole,
    accessPassExpiresAt: authority.accessPassExpiresAt,
    accessPassExpired: false,
  };
}

export function assertAccessPassMutationAllowed(
  input: AccessPassMutationInput,
): AccessPassMutationPolicy {
  const actorRole = parseHouseholdMemberRole(input.actorRole);
  const targetRole = parseHouseholdMemberRole(input.targetRole);
  const requestedNextRole = parseHouseholdMemberRole(
    input.nextRole ?? targetRole,
  );
  const nextRole =
    requestedNextRole && isHouseholdAccessPassRole(requestedNextRole)
      ? requestedNextRole
      : "";

  if (!isOwnerAdmin(actorRole)) {
    return {
      allowed: false,
      reason:
        "Only an owner/admin can activate or revoke Access Pass helper access.",
      nextRole,
    };
  }

  if (input.targetIsSelf) {
    return {
      allowed: false,
      reason:
        "Owners cannot manage their own access from the Access Pass helper flow.",
      nextRole,
    };
  }

  if (targetRole === "owner") {
    return {
      allowed: false,
      reason:
        "Owner access cannot be changed from the Access Pass helper flow.",
      nextRole,
    };
  }

  if (input.action === "activate") {
    if (!nextRole) {
      return {
        allowed: false,
        reason: "Access Pass activation requires a valid helper role.",
      };
    }
    return {
      allowed: true,
      reason:
        "Owner/admin Access Pass activation is allowed for sitter, trainer, walker, and vet viewer helper roles.",
      nextRole,
    };
  }

  if (!targetRole || !isAccessPassRole(targetRole)) {
    return {
      allowed: false,
      reason: "Access Pass revocation is limited to active helper roles.",
      ...(targetRole ? { nextRole: targetRole } : {}),
    };
  }

  return {
    allowed: true,
    reason:
      "Owner/admin Access Pass helper revocation is allowed and should create helper audit trail metadata.",
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
  const lifecycleState = deriveLifecycleState(input);

  return {
    id: `household_audit_${randomUUID()}`,
    action: safeAction,
    lifecycleState,
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
    storage: "provider-durable",
    boundary: DURABLE_AUDIT_BOUNDARY,
  };
}

export function buildHouseholdAuditInsert(
  event: HouseholdAuditEvent,
): HouseholdAuditInsertRecord {
  return {
    id: event.id,
    action: event.action,
    lifecycleState: event.lifecycleState,
    actorUserId: event.actorUserId,
    householdId: event.householdId,
    targetMemberId: event.targetMemberId,
    targetUserId: event.targetUserId,
    targetRole: event.targetRole,
    nextRole: event.nextRole,
    reason: event.reason,
    note: event.note,
    expiresAt: parseIsoDate(event.expiresAt),
    createdAt: parseIsoDate(event.createdAt) ?? new Date(event.createdAt),
    metadata: {
      boundary: event.boundary,
      storage: event.storage,
    },
  };
}

export function buildHouseholdAuditEventFromRecord(
  record: HouseholdAuditSelectRecord,
): HouseholdAuditEvent {
  const action = isHouseholdAuditAction(record.action)
    ? record.action
    : "member-role-updated";
  const lifecycleState = isHouseholdAuditLifecycleState(record.lifecycleState)
    ? record.lifecycleState
    : deriveLifecycleState({
        action,
        actorUserId: record.actorUserId,
        householdId: record.householdId,
      });

  return {
    id: clean(record.id),
    action,
    lifecycleState,
    actorUserId: clean(record.actorUserId),
    householdId: clean(record.householdId),
    targetMemberId: nullableClean(record.targetMemberId),
    targetUserId: nullableClean(record.targetUserId),
    targetRole: nullableClean(record.targetRole),
    nextRole: nullableClean(record.nextRole),
    reason: nullableClean(record.reason),
    note: nullableClean(record.note),
    expiresAt: toIsoString(record.expiresAt),
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString(),
    storage: "provider-durable",
    boundary: record.metadata?.boundary ?? DURABLE_AUDIT_BOUNDARY,
  };
}
