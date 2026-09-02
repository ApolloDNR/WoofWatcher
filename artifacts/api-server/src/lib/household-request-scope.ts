export const HOUSEHOLD_SCOPE_HEADER = "x-woofwatcher-household-id";

/**
 * Mobile care sync sends the household verified by its latest /me response.
 * Rejecting a mismatch closes the membership-change window between that read
 * and a later list or mutation; omitted headers remain compatible with older
 * clients while current clients fail closed.
 */
export function rejectMismatchedHouseholdRequestScope(
  req: { headers?: Record<string, unknown> },
  res: {
    status(code: number): { json(body: unknown): unknown };
  },
  activeHouseholdId: string,
): boolean {
  const expected = req.headers?.[HOUSEHOLD_SCOPE_HEADER];
  if (expected === undefined) return false;
  if (
    typeof expected === "string" &&
    expected.trim().length > 0 &&
    expected.trim() === activeHouseholdId
  ) {
    return false;
  }
  res.status(409).json({
    error: "Household scope changed. Refresh before retrying.",
  });
  return true;
}
