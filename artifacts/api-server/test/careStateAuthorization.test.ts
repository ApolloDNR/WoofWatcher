import assert from "node:assert/strict";
import { test } from "node:test";

import { assertCareStateWriteAllowed } from "../src/lib/care-state-authorization.ts";

test("allows only owner and adult household roles to replace shared care state", () => {
  for (const [storedRole, authorizationRole] of [
    ["owner", "owner"],
    ["adult", "adult"],
    ["admin", "owner"],
    ["adult admin", "owner"],
    ["member", "adult"],
    ["primary caregiver", "adult"],
    ["  PRIMARY   CAREGIVER  ", "adult"],
  ]) {
    assert.deepEqual(
      assertCareStateWriteAllowed(storedRole, authorizationRole),
      { allowed: true },
      storedRole,
    );
  }
});

test("fails closed for helper, youth, read-only, expired, missing, and unknown roles", () => {
  const reason =
    "Only an owner or adult household member can replace the shared care document.";

  for (const role of [
    "teen",
    "kid",
    "child",
    "minor",
    "sitter",
    "trainer",
    "walker",
    "helper",
    "temporary helper",
    "viewer",
    "vet",
    "vet viewer",
    "veterinary viewer",
    "read-only",
    "readonly",
    "  VETERINARY   VIEWER  ",
    "expired access pass",
    "owner impersonator",
    "",
    null,
    undefined,
  ]) {
    assert.deepEqual(
      assertCareStateWriteAllowed(role),
      { allowed: false, reason },
      String(role),
    );
  }
});

test("rejects an unknown stored role even if a legacy normalizer maps its runtime role to adult", () => {
  assert.deepEqual(assertCareStateWriteAllowed("owner impersonator", "adult"), {
    allowed: false,
    reason:
      "Only an owner or adult household member can replace the shared care document.",
  });
});
