import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  HOUSEHOLD_SCOPE_HEADER,
  rejectMismatchedHouseholdRequestScope,
} from "../src/lib/household-request-scope.ts";

function responseRecorder() {
  const result: { status?: number; body?: unknown } = {};
  return {
    result,
    response: {
      status(code: number) {
        result.status = code;
        return {
          json(body: unknown) {
            result.body = body;
          },
        };
      },
    },
  };
}

test("accepts an exact expected household or a legacy omitted header", () => {
  const exact = responseRecorder();
  assert.equal(
    rejectMismatchedHouseholdRequestScope(
      { headers: { [HOUSEHOLD_SCOPE_HEADER]: " house_a " } },
      exact.response,
      "house_a",
    ),
    false,
  );
  assert.equal(exact.result.status, undefined);

  const legacy = responseRecorder();
  assert.equal(
    rejectMismatchedHouseholdRequestScope(
      { headers: {} },
      legacy.response,
      "house_a",
    ),
    false,
  );
});

test("rejects stale, empty, and multi-value household scopes", () => {
  for (const expected of ["house_b", "", ["house_a", "house_b"]]) {
    const recorder = responseRecorder();
    assert.equal(
      rejectMismatchedHouseholdRequestScope(
        { headers: { [HOUSEHOLD_SCOPE_HEADER]: expected } },
        recorder.response,
        "house_a",
      ),
      true,
    );
    assert.equal(recorder.result.status, 409);
    assert.deepEqual(recorder.result.body, {
      error: "Household scope changed. Refresh before retrying.",
    });
  }
});

test("gates every care-state and care-entry route after household lookup", () => {
  const careStateRouter = readFileSync(
    new URL("../src/routes/care-state-router.ts", import.meta.url),
    "utf8",
  );
  const careEntriesRouter = readFileSync(
    new URL("../src/routes/care-entries-router.ts", import.meta.url),
    "utf8",
  );
  assert.equal(
    careStateRouter.match(/rejectMismatchedHouseholdRequestScope\(/g)?.length,
    2,
  );
  assert.equal(
    careEntriesRouter.match(/rejectMismatchedHouseholdRequestScope\(/g)?.length,
    5,
  );

  for (const [source, expectedCount] of [
    [careStateRouter, 2],
    [careEntriesRouter, 5],
  ] as const) {
    const guardedLookupSpans = [
      ...source.matchAll(
        /const householdId = await getActiveHouseholdId\(userId\);([\s\S]*?)rejectMismatchedHouseholdRequestScope\(req, res, householdId\)/g,
      ),
    ];
    assert.equal(guardedLookupSpans.length, expectedCount);
    for (const [, workBeforeGuard] of guardedLookupSpans) {
      assert.doesNotMatch(
        workBeforeGuard,
        /\bdb\.|getCaregiverName|getHouseholdMemberAuthz|normalizeListCareEntr/,
        "household disagreement must be rejected before care-table or policy work",
      );
    }
  }
});

test("fences household rename before mutation and publishes the header contract", () => {
  const householdRouter = readFileSync(
    new URL("../src/routes/household.ts", import.meta.url),
    "utf8",
  );
  const householdUpdateRouter = readFileSync(
    new URL("../src/routes/household-update-router.ts", import.meta.url),
    "utf8",
  );
  const apiSpec = readFileSync(
    new URL("../../../lib/api-spec/openapi.yaml", import.meta.url),
    "utf8",
  );
  const zodApi = readFileSync(
    new URL("../../../lib/api-zod/src/generated/api.ts", import.meta.url),
    "utf8",
  );
  const updateHouseholdRoute = householdUpdateRouter.slice(
    householdUpdateRouter.indexOf("router.patch("),
    householdUpdateRouter.indexOf("return router;"),
  );
  const updateHouseholdOperation = apiSpec.slice(
    apiSpec.indexOf("  /household:"),
    apiSpec.indexOf("  /household/invitations:"),
  );

  const householdLookupIndex = updateHouseholdRoute.indexOf(
    "await dependencies.ensureUserAndHousehold(userId)",
  );
  const scopeFenceIndex = updateHouseholdRoute.indexOf(
    "dependencies.rejectMismatchedHouseholdRequestScope(",
  );
  const householdUpdateIndex = updateHouseholdRoute.indexOf(
    "await dependencies.updateHouseholdName(",
  );

  assert.ok(
    householdLookupIndex >= 0,
    "rename must resolve the active household",
  );
  assert.ok(
    scopeFenceIndex > householdLookupIndex,
    "rename must fence after identity lookup",
  );
  assert.ok(
    householdUpdateIndex > scopeFenceIndex,
    "rename must fence before the database update",
  );
  assert.match(
    householdRouter,
    /createHouseholdUpdateRouter\(\{[\s\S]*?updateHouseholdName[\s\S]*?\.update\(householdsTable\)/,
    "the production router must bind the guarded handler to the household table",
  );
  assert.match(
    updateHouseholdOperation,
    /\$ref: "#\/components\/parameters\/ExpectedHouseholdId"/,
  );
  assert.match(updateHouseholdOperation, /^\s{8}"409":/m);
  assert.match(
    zodApi,
    /export const UpdateHouseholdHeader = zod\.object\(\{\s*["']?x-woofwatcher-household-id["']?:\s*zod\s*\.string\(\)\s*\.min\(1\)\s*\.optional\(\)/,
  );
});

test("documents and generates the optional household fence on every care operation", () => {
  const apiSpec = readFileSync(
    new URL("../../../lib/api-spec/openapi.yaml", import.meta.url),
    "utf8",
  );
  const reactSchemas = readFileSync(
    new URL(
      "../../../lib/api-client-react/src/generated/api.schemas.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const zodApi = readFileSync(
    new URL("../../../lib/api-zod/src/generated/api.ts", import.meta.url),
    "utf8",
  );
  const zodTypesIndex = readFileSync(
    new URL(
      "../../../lib/api-zod/src/generated/types/index.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const careOperations = apiSpec.slice(
    apiSpec.indexOf("  /care-state:"),
    apiSpec.indexOf("components:"),
  );

  assert.match(
    apiSpec,
    /ExpectedHouseholdId:\s+[\s\S]*name: x-woofwatcher-household-id\s+[\s\S]*in: header\s+[\s\S]*required: false/,
  );
  assert.equal(
    careOperations.match(
      /\$ref: "#\/components\/parameters\/ExpectedHouseholdId"/g,
    )?.length,
    7,
  );
  assert.equal(careOperations.match(/^\s{8}"409":/gm)?.length, 7);
  assert.match(
    reactSchemas,
    /export type ExpectedHouseholdIdParameter = string/,
  );
  assert.equal(
    zodApi.match(
      /["']?x-woofwatcher-household-id["']?:\s*zod\s*\.string\(\)\s*\.min\(1\)\s*\.optional\(\)/g,
    )?.length,
    8,
  );
  assert.match(
    zodTypesIndex,
    /export \* from ["']\.\/expectedHouseholdIdParameter["']/,
  );
});
