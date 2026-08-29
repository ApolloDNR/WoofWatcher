import { HouseholdJoinCommitError } from "../lib/household-active-identity.ts";
import { HouseholdAuthoritySnapshotError } from "../lib/household-me-snapshot.ts";

interface HouseholdAuthorityResponse {
  status(code: number): HouseholdAuthorityResponse;
  json(body: { error: string }): unknown;
}

/**
 * Keeps typed authority failures from becoming generic 500s or leaking a
 * partially built household/member response.
 */
export async function runHouseholdAuthorityRequest<T>(input: {
  res: HouseholdAuthorityResponse;
  operation(): Promise<T>;
}): Promise<T | null> {
  try {
    return await input.operation();
  } catch (error) {
    if (
      error instanceof HouseholdJoinCommitError ||
      error instanceof HouseholdAuthoritySnapshotError
    ) {
      input.res.status(error.status).json({ error: error.message });
      return null;
    }
    throw error;
  }
}
