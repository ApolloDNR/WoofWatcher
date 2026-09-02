export type CareStateWritePolicy =
  | { allowed: true }
  | { allowed: false; reason: string };

const ADULT_CARE_STATE_WRITE_ROLES = new Set([
  "owner",
  "admin",
  "adult admin",
  "adult",
  "member",
  "primary caregiver",
]);

const FORBIDDEN_REASON =
  "Only an owner or adult household member can replace the shared care document.";

function normalizeRole(role: string | null | undefined): string {
  return String(role ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Replacing the opaque care document can change profiles, routines, records,
 * credentials, and launch proof in one write. Keep that boundary adult-only.
 * A fail-closed allowlist also rejects missing/unknown roles and the runtime
 * `expired access pass` role returned by getHouseholdMemberAuthz.
 */
export function assertCareStateWriteAllowed(
  storedRole: string | null | undefined,
  authorizationRole: string | null | undefined = storedRole,
): CareStateWritePolicy {
  return ADULT_CARE_STATE_WRITE_ROLES.has(normalizeRole(storedRole)) &&
    ADULT_CARE_STATE_WRITE_ROLES.has(normalizeRole(authorizationRole))
    ? { allowed: true }
    : { allowed: false, reason: FORBIDDEN_REASON };
}
