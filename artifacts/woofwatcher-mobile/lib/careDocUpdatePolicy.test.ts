import { test } from "node:test";
import assert from "node:assert/strict";

import { shouldSkipCareDocWrite } from "./careDocUpdatePolicy.ts";

test("skips only an explicitly opted-in unchanged care-document callback", () => {
  const current = { pets: [] };

  assert.equal(shouldSkipCareDocWrite(current, current), false);
  assert.equal(shouldSkipCareDocWrite(current, current, { skipUnchangedWrite: true }), true);
  assert.equal(
    shouldSkipCareDocWrite(current, { pets: [] }, { skipUnchangedWrite: true }),
    false,
  );
});
