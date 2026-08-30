import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCareHouseholdConflictAuthority,
  assertCareHouseholdSuccessAuthority,
} from "./careHouseholdResponseAuthority.ts";

const HOUSEHOLD = "household-a";

test("successful Care objects and rows require an exact household id", () => {
  assert.doesNotThrow(() =>
    assertCareHouseholdSuccessAuthority(
      { householdId: HOUSEHOLD, version: 2 },
      HOUSEHOLD,
    ),
  );
  assert.doesNotThrow(() =>
    assertCareHouseholdSuccessAuthority(
      [{ householdId: HOUSEHOLD, id: "entry-a" }],
      HOUSEHOLD,
    ),
  );
  for (const malformed of [
    { version: 2 },
    { householdId: "household-b" },
    [{ id: "missing" }],
    [{ householdId: HOUSEHOLD }, "primitive-row"],
    "primitive-response",
    null,
    undefined,
  ]) {
    assert.throws(
      () => assertCareHouseholdSuccessAuthority(malformed, HOUSEHOLD),
      /household authority/i,
    );
  }
});

test("only an explicitly admitted void DELETE or empty list lacks an object authority", () => {
  assert.doesNotThrow(() => assertCareHouseholdSuccessAuthority([], HOUSEHOLD));
  assert.doesNotThrow(() =>
    assertCareHouseholdSuccessAuthority(undefined, HOUSEHOLD, {
      allowVoid: true,
    }),
  );
  assert.throws(
    () =>
      assertCareHouseholdSuccessAuthority("deleted", HOUSEHOLD, {
        allowVoid: true,
      }),
    /household authority/i,
  );
});

test("409 state envelopes and nested entry conflicts require exact household authority", () => {
  assert.doesNotThrow(() =>
    assertCareHouseholdConflictAuthority(
      {
        status: 409,
        data: { householdId: HOUSEHOLD, doc: {}, version: 2 },
      },
      HOUSEHOLD,
    ),
  );
  assert.doesNotThrow(() =>
    assertCareHouseholdConflictAuthority(
      {
        status: 409,
        data: {
          entry: { householdId: HOUSEHOLD, id: "entry-a" },
        },
      },
      HOUSEHOLD,
    ),
  );
  for (const malformed of [
    { status: 409, data: { doc: {}, version: 2 } },
    { status: 409, data: { householdId: "household-b", doc: {} } },
    { status: 409, data: { entry: { id: "missing" } } },
    { status: 409, data: { error: "conflict" } },
    { status: 409 },
  ]) {
    assert.throws(
      () => assertCareHouseholdConflictAuthority(malformed, HOUSEHOLD),
      /conflict|household authority/i,
    );
  }
});
