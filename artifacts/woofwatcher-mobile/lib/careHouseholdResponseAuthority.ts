export class CareHouseholdResponseAuthorityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CareHouseholdResponseAuthorityError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactHouseholdObject(
  value: unknown,
  expectedHouseholdId: string,
): void {
  if (!isObject(value) || value.householdId !== expectedHouseholdId) {
    throw new CareHouseholdResponseAuthorityError(
      "The Care response omitted or mismatched its household authority.",
    );
  }
}

/**
 * Validates every successful Care payload before it can touch client state.
 * Empty lists are valid because the required request capability was checked
 * server-side. Only DELETE is allowed to opt into a void response.
 */
export function assertCareHouseholdSuccessAuthority(
  value: unknown,
  expectedHouseholdId: string,
  options: { allowVoid?: boolean } = {},
): void {
  if (value === undefined && options.allowVoid) return;
  if (Array.isArray(value)) {
    value.forEach((row) =>
      assertExactHouseholdObject(row, expectedHouseholdId),
    );
    return;
  }
  assertExactHouseholdObject(value, expectedHouseholdId);
}

/** A 409 is usable only when its authoritative envelope/entry is exact. */
export function assertCareHouseholdConflictAuthority(
  error: unknown,
  expectedHouseholdId: string,
): void {
  if (!isObject(error) || error.status !== 409) return;
  const data = error.data;
  if (!isObject(data)) {
    throw new CareHouseholdResponseAuthorityError(
      "The Care conflict omitted its authoritative household payload.",
    );
  }
  if ("doc" in data) {
    assertExactHouseholdObject(data, expectedHouseholdId);
    return;
  }
  if ("entry" in data) {
    assertExactHouseholdObject(data.entry, expectedHouseholdId);
    return;
  }
  throw new CareHouseholdResponseAuthorityError(
    "The Care conflict omitted its authoritative household payload.",
  );
}

export function isCareHouseholdResponseAuthorityError(
  value: unknown,
): value is CareHouseholdResponseAuthorityError {
  return value instanceof CareHouseholdResponseAuthorityError;
}
