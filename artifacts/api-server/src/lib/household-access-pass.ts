export type AccessPassMutationAction = "activate" | "revoke";
export type HouseholdAuditAction =
  | "invitation-accepted"
  | "member-role-updated"
  | "member-revoked"
  | "access-pass-activated"
  | "access-pass-revoked";
export type HouseholdAuditLifecycleState =
  | "invite-accepted"
  | "member-updated"
  | "member-revoked"
  | "access-pass-active"
  | "access-pass-revoked"
  | "access-pass-expired";

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

const ROLE_ALIASES: Record<string, string> = {
  admin: "owner",
  "adult admin": "owner",
  owner: "owner",
  adult: "adult",
  member: "adult",
  "primary caregiver": "adult",
  teen: "teen",
  kid: "kid",
  child: "kid",
  minor: "kid",
  sitter: "sitter",
  trainer: "trainer",
  walker: "walker",
  helper: "sitter",
  "temporary helper": "sitter",
  viewer: "vet viewer",
  vet: "vet viewer",
  "vet viewer": "vet viewer",
  "veterinary viewer": "vet viewer",
  "read-only": "vet viewer",
  readonly: "vet viewer",
};

const ACCESS_PASS_COMPATIBLE_ROLES = [
  "sitter",
  "trainer",
  "walker",
  "vet viewer",
] as const;

const ACCESS_PASS_ROLE_SET = new Set<string>(ACCESS_PASS_COMPATIBLE_ROLES);
const DURABLE_AUDIT_BOUNDARY =
  "Durable provider audit storage is ready for household invite, role, and Access Pass mutations; retention/export/deletion policy remains a launch approval gate.";

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

function normalizeHouseholdMemberRole(role: string | null | undefined): string {
  const normalized = clean(role).toLowerCase();
  return ROLE_ALIASES[normalized] ?? "adult";
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function deriveLifecycleState(input: HouseholdAuditEventInput): HouseholdAuditLifecycleState {
  if (input.action === "invitation-accepted") return "invite-accepted";
  if (input.action === "member-role-updated") return "member-updated";
  if (input.action === "member-revoked") return "member-revoked";
  if (input.action === "access-pass-revoked") return "access-pass-revoked";
  if (input.action === "access-pass-activated") return "access-pass-active";
  return "member-updated";
}

export function normalizeAccessPassRole(role: string | null | undefined): string {
  const normalized = normalizeHouseholdMemberRole(role);
  return isAccessPassRole(normalized) ? normalized : "sitter";
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
      reason: "Access Pass expiration must be in the future before helper access can be activated.",
    };
  }

  return {
    allowed: true,
    expiresAt: date.toISOString(),
    lifecycleState: "access-pass-active",
  };
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
  const lifecycleState = deriveLifecycleState(input);
  const suffix = [targetMemberId, targetUserId, nextRole]
    .filter(Boolean)
    .join("_")
    .replace(/[^a-z0-9_-]/gi, "")
    .slice(0, 40);

  return {
    id: `household_audit_${safeAction}_${now.getTime()}${suffix ? `_${suffix}` : ""}`,
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

export function buildHouseholdAuditInsert(event: HouseholdAuditEvent): HouseholdAuditInsertRecord {
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
