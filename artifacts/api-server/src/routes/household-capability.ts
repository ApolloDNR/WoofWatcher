import type { Request, Response } from "express";

export const EXPECTED_HOUSEHOLD_HEADER = "X-WoofWatcher-Expected-Household-Id";

export const EXPECTED_HOUSEHOLD_REQUIRED_ERROR =
  "Expected household header is required. Refresh household identity and retry.";

export const EXPECTED_HOUSEHOLD_CHANGED_ERROR =
  "Active household changed. Refresh household identity before retrying.";

/**
 * The request's opaque household capability. Its value is intentionally kept
 * byte-for-byte as Express exposes it: household identifiers are not trimmed,
 * case-folded, or otherwise normalized before an authority comparison.
 */
export interface ExpectedHouseholdCapability {
  readonly expectedHouseholdId: string;
}

function setHouseholdCapabilityResponseHeaders(res: Response): void {
  res.set("Cache-Control", "private, no-store");
  res.vary(EXPECTED_HOUSEHOLD_HEADER);
}

function rejectMissingHouseholdCapability(res: Response): void {
  res.status(428).json({ error: EXPECTED_HOUSEHOLD_REQUIRED_ERROR });
}

function rejectChangedHouseholdCapability(res: Response): void {
  res.status(412).json({ error: EXPECTED_HOUSEHOLD_CHANGED_ERROR });
}

/**
 * Parses the expected source household before a route performs provisioning,
 * active-household lookup, table access, or household authorization.
 *
 * Whitespace is inspected only to distinguish a blank header from a supplied
 * capability. A supplied value is returned exactly as received so surrounding
 * whitespace cannot be normalized into a match later.
 */
export function parseExpectedHouseholdCapability(
  req: Request,
  res: Response,
): ExpectedHouseholdCapability | null {
  setHouseholdCapabilityResponseHeaders(res);

  const expectedHouseholdId = req.get(EXPECTED_HOUSEHOLD_HEADER);
  if (
    expectedHouseholdId === undefined ||
    expectedHouseholdId.trim().length === 0
  ) {
    rejectMissingHouseholdCapability(res);
    return null;
  }

  return { expectedHouseholdId };
}

/**
 * Performs the exact compare after an authoritative household id is known.
 * On success, returns the request's expected id so callers use the capability
 * itself as the table/query target rather than substituting the lookup value.
 */
export function verifyExpectedHouseholdCapability(input: {
  capability: ExpectedHouseholdCapability;
  actualHouseholdId: string;
  res: Response;
}): string | null {
  if (input.capability.expectedHouseholdId !== input.actualHouseholdId) {
    rejectChangedHouseholdCapability(input.res);
    return null;
  }

  return input.capability.expectedHouseholdId;
}

/**
 * Convenience guard for ordinary household-scoped routes. Header parsing is
 * completed before the resolver is invoked, and the returned id is the exact
 * expected capability to use as the route's household target.
 *
 * Join routes should instead call parseExpectedHouseholdCapability before
 * provisioning, verifyExpectedHouseholdCapability after resolving the source,
 * and carry the same expected source id into their transactional CAS check.
 */
export async function requireExpectedHouseholdCapability(input: {
  req: Request;
  res: Response;
  resolveActiveHouseholdId: () => Promise<string>;
}): Promise<string | null> {
  const capability = parseExpectedHouseholdCapability(input.req, input.res);
  if (!capability) return null;

  const activeHouseholdId = await input.resolveActiveHouseholdId();
  return verifyExpectedHouseholdCapability({
    capability,
    actualHouseholdId: activeHouseholdId,
    res: input.res,
  });
}
