import assert from "node:assert/strict";
import { test } from "node:test";

import { HouseholdJoinCommitError } from "../src/lib/household-active-identity.ts";
import { HouseholdAuthoritySnapshotError } from "../src/lib/household-me-snapshot.ts";
import { runHouseholdAuthorityRequest } from "../src/routes/household-authority-response.ts";

function responseHarness() {
  const state: { status: number | null; body: unknown } = {
    status: null,
    body: null,
  };
  const response = {
    status(code: number) {
      state.status = code;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
  };
  return { response, state };
}

for (const authorityCase of [
  {
    error: new HouseholdJoinCommitError(
      "Active household membership is expired or invalid.",
      403,
    ),
    status: 403,
  },
  {
    error: new HouseholdAuthoritySnapshotError(
      "Household member role authority is invalid.",
      409,
    ),
    status: 409,
  },
] as const) {
  test(`typed household authority ${authorityCase.status} returns only its truthful error body`, async () => {
    const { response, state } = responseHarness();
    const result = await runHouseholdAuthorityRequest({
      res: response,
      async operation() {
        throw authorityCase.error;
      },
    });

    assert.equal(result, null);
    assert.equal(state.status, authorityCase.status);
    assert.deepEqual(state.body, { error: authorityCase.error.message });
    assert.equal("household" in (state.body as object), false);
    assert.equal("members" in (state.body as object), false);
  });
}

test("unknown failures are not mislabeled as household authority errors", async () => {
  const { response, state } = responseHarness();
  await assert.rejects(
    runHouseholdAuthorityRequest({
      res: response,
      async operation() {
        throw new Error("database unavailable");
      },
    }),
    /database unavailable/,
  );
  assert.equal(state.status, null);
  assert.equal(state.body, null);
});
