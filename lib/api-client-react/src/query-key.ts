const EXPECTED_HOUSEHOLD_HEADER =
  "X-WoofWatcher-Expected-Household-Id" as const;

export type HouseholdCapabilityHeaders = {
  [EXPECTED_HOUSEHOLD_HEADER]: string;
};

type QueryKeyContext = {
  url: string;
  queryOptions?: unknown;
};

/**
 * Keeps household-scoped server data in an identity-bound React Query cache.
 *
 * Orval deliberately omits header parameters from its built-in query keys.
 * Every guarded query is configured to use this mutator instead, so the same
 * route and query params cannot reuse data after the active household changes.
 */
export function buildHouseholdQueryKey(
  input: Record<string, unknown> & { headers: HouseholdCapabilityHeaders },
  context: QueryKeyContext,
) {
  const expectedHouseholdId = input.headers?.[EXPECTED_HOUSEHOLD_HEADER];
  if (typeof expectedHouseholdId !== "string" || expectedHouseholdId === "") {
    throw new Error(
      "Expected household identity is required for this query key.",
    );
  }

  const { headers: _headers, ...requestIdentity } = input;
  return [context.url, expectedHouseholdId, requestIdentity] as const;
}

export function getListCareEntriesHouseholdQueryKey(
  headers: HouseholdCapabilityHeaders,
  params?: unknown,
) {
  return buildHouseholdQueryKey(
    { headers, params },
    { url: "/api/care-entries" },
  );
}
