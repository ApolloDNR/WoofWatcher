import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canApplyCareDocUpdate,
  degradeCareStateWriteAccess,
  deriveCareStateWriteAccess,
  isCareStateWriteForbidden,
  selectCareStatePermissionFallback,
} from "./careStateWriteAccess.ts";

function me(input: {
  userId?: string;
  capability?: boolean;
  selfCount?: number;
  selfUserId?: string;
}) {
  const selfCount = input.selfCount ?? 1;
  return {
    user: { id: input.userId ?? "user_a" },
    members: Array.from({ length: selfCount }, (_, index) => ({
      userId: input.selfUserId ?? "user_a",
      isSelf: true,
      role: index ? "adult" : "owner",
      ...(typeof input.capability === "boolean"
        ? { careStateWriteAllowed: input.capability }
        : {}),
    })),
  };
}

test("accepts only a fresh, identity-matched server capability", () => {
  assert.equal(
    deriveCareStateWriteAccess(me({ capability: true }), "user_a"),
    "allowed",
  );
  assert.equal(
    deriveCareStateWriteAccess(me({ capability: false }), "user_a"),
    "restricted",
  );
  assert.equal(
    deriveCareStateWriteAccess(me({ capability: true }), "user_b"),
    "unverified",
    "a cached response from another account cannot authorize this account",
  );
  assert.equal(
    deriveCareStateWriteAccess(
      me({ capability: true, selfUserId: "user_b" }),
      "user_a",
    ),
    "unverified",
  );
});

test("fails closed for missing, duplicate, or malformed self capability", () => {
  assert.equal(
    deriveCareStateWriteAccess(me({ capability: true, selfCount: 0 }), "user_a"),
    "unverified",
  );
  assert.equal(
    deriveCareStateWriteAccess(me({ capability: true, selfCount: 2 }), "user_a"),
    "unverified",
  );
  assert.equal(
    deriveCareStateWriteAccess(me({}), "user_a"),
    "unverified",
  );
  assert.equal(deriveCareStateWriteAccess(null, "user_a"), "unverified");
  assert.equal(deriveCareStateWriteAccess(me({ capability: true }), null), "unverified");
});

test("keeps a known denial restrictive while stale allow/error states become unverified", () => {
  assert.equal(degradeCareStateWriteAccess("restricted"), "restricted");
  assert.equal(degradeCareStateWriteAccess("allowed"), "unverified");
  assert.equal(degradeCareStateWriteAccess("checking"), "unverified");
});

test("allows device-only edits but fail-closes signed-in shared editors until verified", () => {
  assert.equal(canApplyCareDocUpdate("local-only"), true);
  assert.equal(canApplyCareDocUpdate("signed-out"), true);
  assert.equal(canApplyCareDocUpdate("allowed"), true);
  assert.equal(canApplyCareDocUpdate("checking"), false);
  assert.equal(canApplyCareDocUpdate("unverified"), false);
  assert.equal(canApplyCareDocUpdate("restricted"), false);
});

test("classifies only HTTP 403 as a care-document permission denial", () => {
  assert.equal(isCareStateWriteForbidden({ status: 403 }), true);
  assert.equal(isCareStateWriteForbidden({ status: 401 }), false);
  assert.equal(isCareStateWriteForbidden(new TypeError("offline")), false);
  assert.equal(isCareStateWriteForbidden(null), false);
});

test("permission rollback prefers last server-confirmed state over optimistic drafts", () => {
  const confirmed = { profile: { name: "Phoenix" } };
  const baseline = { profile: { name: "First local draft" } };

  assert.equal(
    selectCareStatePermissionFallback(confirmed, baseline),
    confirmed,
  );
  assert.equal(selectCareStatePermissionFallback(null, baseline), baseline);
});
