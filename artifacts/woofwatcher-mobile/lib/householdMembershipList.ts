import type { HouseholdOperationPermit } from "./householdOperation.ts";

export interface AdmittedHouseholdMembership {
  readonly householdId: string;
  readonly householdName: string;
  readonly role: string;
  readonly accessPassExpiresAt: string | null;
}

export interface AdmittedHouseholdMembershipList {
  readonly activeHouseholdId: string;
  readonly activeMembershipPresent: boolean;
  readonly memberships: readonly AdmittedHouseholdMembership[];
}

export interface HouseholdMembershipListCacheValue {
  readonly activeHouseholdId: string;
  readonly memberships: readonly AdmittedHouseholdMembership[];
}

export interface HouseholdMembershipRow {
  readonly householdId: string;
  readonly householdName: string;
  readonly roleLabel: string;
  readonly current: boolean;
  readonly disabled: boolean;
  readonly accessibilityLabel: string;
}

export interface HouseholdMembershipListFailureCopy {
  readonly title: string;
  readonly message: string;
  readonly rediscoverIdentity: boolean;
}

export interface HouseholdMembershipRediscoveryController {
  /** Grants at most one automatic rediscovery for an unchanged identity key. */
  request(permit: HouseholdOperationPermit): boolean;
  /** Reopens the budget only after that same identity returned a healthy list. */
  confirmHealthy(permit: HouseholdOperationPermit): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exactOpaqueIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value
  );
}

function exactProviderInstant(value: unknown): value is string {
  if (!exactOpaqueIdentifier(value)) return false;
  const instantMs = Date.parse(value);
  return (
    Number.isFinite(instantMs) && new Date(instantMs).toISOString() === value
  );
}

const HOUSEHOLD_MEMBERSHIP_ROLES = new Set([
  "owner",
  "adult",
  "teen",
  "kid",
  "sitter",
  "trainer",
  "walker",
  "vet viewer",
]);
const TEMPORARY_HOUSEHOLD_MEMBERSHIP_ROLES = new Set([
  "sitter",
  "trainer",
  "walker",
  "vet viewer",
]);

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === expected[index])
  );
}

function errorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const status = Reflect.get(error, "status");
  return typeof status === "number" && Number.isFinite(status) ? status : null;
}

export function describeHouseholdMembershipListFailure(
  error: unknown,
): HouseholdMembershipListFailureCopy {
  const status = errorStatus(error);
  if (status === 401) {
    return Object.freeze({
      title: "Sign-in changed",
      message:
        "WoofWatcher could not confirm the signed-in session. It is rechecking your account before showing households.",
      rediscoverIdentity: true,
    });
  }
  if (status === 403) {
    return Object.freeze({
      title: "Household access changed",
      message:
        "Household access may have been removed or expired. Retry after WoofWatcher rechecks your active household.",
      rediscoverIdentity: true,
    });
  }
  if (status === 409 || status === 412 || status === 428) {
    return Object.freeze({
      title: "Household changed",
      message:
        "WoofWatcher could not authorize this household list against the active household and is rechecking your account.",
      rediscoverIdentity: true,
    });
  }
  return Object.freeze({
    title: "Households unavailable",
    message:
      "WoofWatcher could not confirm your retained households. Check your connection and retry; no household was changed.",
    rediscoverIdentity: false,
  });
}

/**
 * Runtime admission for the retained-household list. A query result is UI
 * authority only while its exact captured Care permit remains current and
 * the server echoes that permit's active household byte-for-byte.
 */
export function admitHouseholdMembershipList(
  response: unknown,
  permit: HouseholdOperationPermit,
  isPermitCurrent: (permit: HouseholdOperationPermit) => boolean,
): AdmittedHouseholdMembershipList | null {
  if (!isPermitCurrent(permit) || !isRecord(response)) return null;
  if (!hasExactKeys(response, ["activeHouseholdId", "memberships"])) {
    return null;
  }
  const activeHouseholdId = response.activeHouseholdId;
  if (
    !exactOpaqueIdentifier(activeHouseholdId) ||
    activeHouseholdId !== permit.householdId ||
    !Array.isArray(response.memberships)
  ) {
    return null;
  }

  const seen = new Set<string>();
  const memberships: AdmittedHouseholdMembership[] = [];
  for (const candidate of response.memberships) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, [
        "accessPassExpiresAt",
        "householdId",
        "householdName",
        "role",
      ]) ||
      !exactOpaqueIdentifier(candidate.householdId) ||
      !exactOpaqueIdentifier(candidate.householdName) ||
      !exactOpaqueIdentifier(candidate.role) ||
      !HOUSEHOLD_MEMBERSHIP_ROLES.has(candidate.role) ||
      seen.has(candidate.householdId)
    ) {
      return null;
    }
    const accessPassExpiresAt = candidate.accessPassExpiresAt;
    if (
      accessPassExpiresAt !== null &&
      !exactProviderInstant(accessPassExpiresAt)
    ) {
      return null;
    }
    if (
      !TEMPORARY_HOUSEHOLD_MEMBERSHIP_ROLES.has(candidate.role) &&
      accessPassExpiresAt !== null
    ) {
      return null;
    }
    // This transactional endpoint has already filtered helper authority with
    // the provider clock. A helper may be unbounded (`null`) or carry the
    // provider's canonical expiry; device wall-clock time is not authority.
    seen.add(candidate.householdId);
    memberships.push(
      Object.freeze({
        householdId: candidate.householdId,
        householdName: candidate.householdName,
        role: candidate.role,
        accessPassExpiresAt,
      }),
    );
  }

  return Object.freeze({
    activeHouseholdId,
    activeMembershipPresent: seen.has(activeHouseholdId),
    memberships: Object.freeze(memberships),
  });
}

/**
 * Keeps list-authority recovery bounded across Care generation churn. The
 * controller belongs to CareProvider so unmounting the screen cannot reset
 * the retry budget and create a rediscovery loop.
 */
export function createHouseholdMembershipRediscoveryController(): HouseholdMembershipRediscoveryController {
  const requestedIdentityKeys = new Set<string>();
  return Object.freeze({
    request(permit: HouseholdOperationPermit) {
      if (!exactOpaqueIdentifier(permit.identityKey)) return false;
      if (requestedIdentityKeys.has(permit.identityKey)) return false;
      requestedIdentityKeys.add(permit.identityKey);
      return true;
    },
    confirmHealthy(permit: HouseholdOperationPermit) {
      if (exactOpaqueIdentifier(permit.identityKey)) {
        requestedIdentityKeys.delete(permit.identityKey);
      }
    },
  });
}

/** Applies an exact rename response to the already admitted retained list. */
export function renameHouseholdMembershipInList(
  response: unknown,
  permit: HouseholdOperationPermit,
  householdName: string,
  isPermitCurrent: (permit: HouseholdOperationPermit) => boolean,
): HouseholdMembershipListCacheValue | null {
  if (
    !exactOpaqueIdentifier(householdName) ||
    householdName.trim() !== householdName
  ) {
    return null;
  }
  const admitted = admitHouseholdMembershipList(
    response,
    permit,
    isPermitCurrent,
  );
  if (!admitted) return null;
  return Object.freeze({
    activeHouseholdId: admitted.activeHouseholdId,
    memberships: Object.freeze(
      admitted.memberships.map((membership) =>
        membership.householdId === permit.householdId
          ? Object.freeze({ ...membership, householdName })
          : membership,
      ),
    ),
  });
}

function displayRole(role: string): string {
  return role
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildHouseholdMembershipRows(
  list: AdmittedHouseholdMembershipList,
  householdOperationActive: boolean,
): readonly HouseholdMembershipRow[] {
  return Object.freeze(
    list.memberships.map((membership) => {
      const current = membership.householdId === list.activeHouseholdId;
      const roleLabel = displayRole(membership.role);
      return Object.freeze({
        householdId: membership.householdId,
        householdName: membership.householdName,
        roleLabel,
        current,
        disabled: current || householdOperationActive,
        accessibilityLabel: current
          ? `${membership.householdName}, current household, ${roleLabel}`
          : `Switch to ${membership.householdName} household, ${roleLabel}`,
      });
    }),
  );
}
