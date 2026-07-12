export type HouseholdInvitationLifecycleState =
  | "pending-approval"
  | "approved"
  | "accepted"
  | "revoked"
  | "expired"
  | "rejected";

export interface HouseholdInvitationListQuery {
  limit: number;
  lifecycleState?: HouseholdInvitationLifecycleState;
}

export interface HouseholdInvitationRuntimeStatus {
  lifecycleState: HouseholdInvitationLifecycleState;
  runtimeLifecycleState: HouseholdInvitationLifecycleState;
  expiresAt: string | null;
  expired: boolean;
  reason?: string;
}

export interface HouseholdInvitationAcceptPolicy {
  allowed: boolean;
  lifecycleState: HouseholdInvitationLifecycleState;
  reason?: string;
}

export interface HouseholdInvitationRecordLike {
  id: string;
  householdId: string;
  inviteCode: string;
  invitedEmail?: string | null;
  invitedUserId?: string | null;
  role: string;
  lifecycleState: string;
  createdByUserId: string;
  approvedByUserId?: string | null;
  acceptedByUserId?: string | null;
  revokedByUserId?: string | null;
  rejectedByUserId?: string | null;
  note?: string | null;
  expiresAt?: Date | string | null;
  acceptedAt?: Date | string | null;
  revokedAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  metadata?: {
    boundary?: string;
    storage?: string;
  } | null;
}

export interface HouseholdInvitationView {
  id: string;
  householdId: string;
  inviteCode: string;
  invitedEmail: string | null;
  invitedUserId: string | null;
  role: string;
  lifecycleState: HouseholdInvitationLifecycleState;
  runtimeLifecycleState: HouseholdInvitationLifecycleState;
  expired: boolean;
  createdByUserId: string;
  approvedByUserId: string | null;
  acceptedByUserId: string | null;
  revokedByUserId: string | null;
  rejectedByUserId: string | null;
  note: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  storage: "provider-durable";
  boundary: string;
}

const HOUSEHOLD_INVITATION_LIFECYCLE_STATES = [
  "pending-approval",
  "approved",
  "accepted",
  "revoked",
  "expired",
  "rejected",
] as const satisfies readonly HouseholdInvitationLifecycleState[];

const HOUSEHOLD_INVITATION_LIFECYCLE_SET = new Set<string>(
  HOUSEHOLD_INVITATION_LIFECYCLE_STATES,
);

export const HOUSEHOLD_INVITATION_BOUNDARY =
  "Durable household invitation lifecycle storage is provider-ready; Supabase migration, RLS, retention, export/deletion policy, and notification delivery remain launch approval gates.";

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function nullableClean(value: unknown): string | null {
  const cleaned = clean(value);
  return cleaned || null;
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const date = parseIsoDate(value);
  return date ? date.toISOString() : null;
}

export function isHouseholdInvitationLifecycleState(
  value: string,
): value is HouseholdInvitationLifecycleState {
  return HOUSEHOLD_INVITATION_LIFECYCLE_SET.has(value);
}

export function normalizeHouseholdInvitationLifecycleState(
  value: string | null | undefined,
): HouseholdInvitationLifecycleState {
  const normalized = clean(value).toLowerCase();
  return isHouseholdInvitationLifecycleState(normalized)
    ? normalized
    : "pending-approval";
}

export function normalizeHouseholdInvitationListQuery(
  query: Record<string, unknown>,
): HouseholdInvitationListQuery {
  const requestedLimit = Number(query.limit ?? 50);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.trunc(requestedLimit)))
    : 50;
  const lifecycleState = clean(query.lifecycleState).toLowerCase();

  return {
    limit,
    ...(isHouseholdInvitationLifecycleState(lifecycleState)
      ? { lifecycleState }
      : {}),
  };
}

export function normalizeHouseholdInvitationExpiry(
  value: string | null | undefined,
): string | null {
  const cleaned = nullableClean(value);
  if (!cleaned) return null;
  return toIsoString(cleaned);
}

export function deriveHouseholdInvitationRuntimeStatus(input: {
  lifecycleState?: string | null;
  expiresAt?: Date | string | null;
  now?: Date;
}): HouseholdInvitationRuntimeStatus {
  const lifecycleState = normalizeHouseholdInvitationLifecycleState(
    input.lifecycleState,
  );
  const expiresAt = toIsoString(input.expiresAt);
  const expiry = parseIsoDate(expiresAt);
  const now = input.now ?? new Date();

  if (
    expiry &&
    expiry.getTime() <= now.getTime() &&
    (lifecycleState === "approved" || lifecycleState === "pending-approval")
  ) {
    return {
      lifecycleState,
      runtimeLifecycleState: "expired",
      expiresAt,
      expired: true,
      reason: "Invitation expired before it was accepted.",
    };
  }

  return {
    lifecycleState,
    runtimeLifecycleState: lifecycleState,
    expiresAt,
    expired: false,
  };
}

export function assertHouseholdInvitationAcceptAllowed(
  status: HouseholdInvitationRuntimeStatus,
): HouseholdInvitationAcceptPolicy {
  if (status.runtimeLifecycleState === "approved") {
    return {
      allowed: true,
      lifecycleState: "approved",
    };
  }

  const reasonByState: Record<HouseholdInvitationLifecycleState, string> = {
    "pending-approval":
      "Invitation is waiting for owner approval before a caregiver membership can be created.",
    approved: "Invitation is approved.",
    accepted: "Invitation has already been accepted.",
    revoked: "Invitation was revoked by an owner/admin.",
    expired: "Invitation expired before it was accepted.",
    rejected: "Invitation was rejected by an owner/admin.",
  };

  return {
    allowed: false,
    lifecycleState: status.runtimeLifecycleState,
    reason: reasonByState[status.runtimeLifecycleState],
  };
}

export function buildHouseholdInvitationView(
  record: HouseholdInvitationRecordLike,
  now: Date = new Date(),
): HouseholdInvitationView {
  const runtime = deriveHouseholdInvitationRuntimeStatus({
    lifecycleState: record.lifecycleState,
    expiresAt: record.expiresAt ?? null,
    now,
  });
  const metadata = record.metadata ?? {};

  return {
    id: clean(record.id),
    householdId: clean(record.householdId),
    inviteCode: clean(record.inviteCode).toUpperCase(),
    invitedEmail: nullableClean(record.invitedEmail),
    invitedUserId: nullableClean(record.invitedUserId),
    role: clean(record.role) || "adult",
    lifecycleState: runtime.lifecycleState,
    runtimeLifecycleState: runtime.runtimeLifecycleState,
    expired: runtime.expired,
    createdByUserId: clean(record.createdByUserId),
    approvedByUserId: nullableClean(record.approvedByUserId),
    acceptedByUserId: nullableClean(record.acceptedByUserId),
    revokedByUserId: nullableClean(record.revokedByUserId),
    rejectedByUserId: nullableClean(record.rejectedByUserId),
    note: nullableClean(record.note),
    expiresAt: runtime.expiresAt,
    acceptedAt: toIsoString(record.acceptedAt ?? null),
    revokedAt: toIsoString(record.revokedAt ?? null),
    rejectedAt: toIsoString(record.rejectedAt ?? null),
    createdAt: toIsoString(record.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(record.updatedAt ?? null),
    storage: "provider-durable",
    boundary: metadata.boundary || HOUSEHOLD_INVITATION_BOUNDARY,
  };
}
