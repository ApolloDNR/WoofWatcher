export type CareStateWriteAccess =
  | "local-only"
  | "signed-out"
  | "checking"
  | "allowed"
  | "restricted"
  | "unverified";

export type CareDocSyncNoticeKind =
  | "read-only"
  | "restored"
  | "not-shared"
  | "checking";

export interface CareDocSyncNotice {
  kind: CareDocSyncNoticeKind;
  message: string;
  assertive: boolean;
}

interface MeLike {
  user?: { id?: unknown } | null;
  members?: unknown;
}

interface MemberLike {
  userId?: unknown;
  isSelf?: unknown;
  careStateWriteAllowed?: unknown;
}

export const CARE_DOC_READ_ONLY_MESSAGE =
  "Shared editing is read-only for your household role. You can still view household care; care-log permissions are handled separately.";

export const CARE_DOC_RESTORED_MESSAGE =
  "That shared change wasn't saved. Only an owner or adult can edit shared plans, profile, records, memories, passes, or settings. We restored the household version.";

export const CARE_DOC_NOT_SHARED_MESSAGE =
  "Saved on this device, not yet shared with the household. Reconnect and retry sync.";

export const CARE_DOC_CHECKING_MESSAGE =
  "Shared editing access is still being checked. Existing care remains available; retry shared changes after the check finishes.";

/**
 * Accepts only a fresh /me response for the exact authenticated account.
 * Mutable caregiver labels and normalized display roles never authorize the
 * protected document; the required server boolean is the sole preflight.
 */
export function deriveCareStateWriteAccess(
  me: MeLike | null | undefined,
  expectedUserId: string | null | undefined,
): Extract<CareStateWriteAccess, "allowed" | "restricted" | "unverified"> {
  if (!expectedUserId || !me?.user || me.user.id !== expectedUserId) {
    return "unverified";
  }
  if (!Array.isArray(me.members)) return "unverified";
  const selfMembers = (me.members as MemberLike[]).filter(
    (member) => member?.isSelf === true,
  );
  if (selfMembers.length !== 1) return "unverified";
  const self = selfMembers[0];
  if (self.userId !== expectedUserId) return "unverified";
  if (typeof self.careStateWriteAllowed !== "boolean") return "unverified";
  return self.careStateWriteAllowed ? "allowed" : "restricted";
}

/** A stale allow never survives a failed refresh; a denial stays fail-closed. */
export function degradeCareStateWriteAccess(
  current: CareStateWriteAccess,
): Extract<CareStateWriteAccess, "restricted" | "unverified"> {
  return current === "restricted" ? "restricted" : "unverified";
}

export function canApplyCareDocUpdate(access: CareStateWriteAccess): boolean {
  return (
    access === "allowed" ||
    access === "local-only" ||
    access === "signed-out"
  );
}

export function isCareStateWriteForbidden(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    (error as { status?: unknown }).status === 403
  );
}

export function selectCareStatePermissionFallback<T>(
  lastServerConfirmed: T | null | undefined,
  optimisticBaseline: T,
): T {
  return lastServerConfirmed ?? optimisticBaseline;
}
