import assert from "node:assert/strict";
import test from "node:test";

import {
  isHouseholdVisibleCareEvidence,
  selectSharedCareEvidence,
} from "../src/shared-evidence.ts";

test("legacy absent visibility remains shared while every present malformed value fails closed", () => {
  assert.equal(isHouseholdVisibleCareEvidence({ details: {} }), true);
  assert.equal(isHouseholdVisibleCareEvidence({}), true);
  assert.equal(
    isHouseholdVisibleCareEvidence({ details: { householdVisible: true } }),
    true,
  );
  assert.equal(
    isHouseholdVisibleCareEvidence({ details: { householdVisible: false } }),
    false,
  );

  for (const householdVisible of ["true", "false", null, 0, 1, {}, []]) {
    assert.equal(
      isHouseholdVisibleCareEvidence({ details: { householdVisible } }),
      false,
      JSON.stringify(householdVisible),
    );
  }
});

test("shared evidence selectors exclude malformed-present visibility metadata", () => {
  const occurredAt = "2026-08-29T12:00:00.000Z";
  const entries = [
    { id: "legacy-shared", occurredAt, details: {} },
    {
      id: "explicit-shared",
      occurredAt,
      details: { householdVisible: true },
    },
    ...["true", null, 1, {}, []].map((householdVisible, index) => ({
      id: `malformed-${index}`,
      occurredAt,
      details: { householdVisible },
    })),
  ];

  assert.deepEqual(
    selectSharedCareEvidence(
      entries,
      Date.parse("2026-08-29T13:00:00.000Z"),
    ).map((entry) => entry.id),
    ["legacy-shared", "explicit-shared"],
  );
});
