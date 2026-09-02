export interface CareStateCacheScope {
  ownerUserId: string | null;
  householdId: string | null;
}

export function normalizeStorageUserId(userId: unknown): string | null {
  return typeof userId === "string" && userId.trim().length > 0
    ? userId.trim()
    : null;
}

/**
 * Anonymous/local data keeps the legacy key. Authenticated data receives a
 * principal-specific key so one account can never hydrate another account's
 * document or outbox on a shared device.
 */
export function buildPrincipalStorageKey(
  baseKey: string,
  ownerUserId: string | null,
): string {
  const principal = normalizeStorageUserId(ownerUserId);
  return principal
    ? `${baseKey}.account.${encodeURIComponent(principal)}`
    : baseKey;
}

export function cacheBelongsToPrincipal(
  cachedOwnerUserId: unknown,
  expectedOwnerUserId: string | null,
): boolean {
  // Legacy local-only caches had no owner field; they remain local and are
  // never adopted into an authenticated principal's namespace.
  const cached = normalizeStorageUserId(cachedOwnerUserId);
  return cached === expectedOwnerUserId;
}

export function householdCacheIsCompatible(
  cachedHouseholdId: unknown,
  expectedHouseholdId: unknown,
): boolean {
  const cached = normalizeStorageUserId(cachedHouseholdId);
  const expected = normalizeStorageUserId(expectedHouseholdId);
  // A cache created before the first successful /me response is unclaimed;
  // the exact authenticated user may claim it once. Two known, different
  // households are never allowed to reconcile or merge.
  return cached === null || (expected !== null && cached === expected);
}
