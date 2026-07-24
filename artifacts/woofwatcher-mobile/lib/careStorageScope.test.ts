import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getCarePendingDeleteStorageKey,
  getCareRecoveryKey,
  getCareStorageKey,
  shouldAdoptUnscopedV2Cache,
} from "./careStorageScope.ts";

test("different accounts and households never share a care cache key", () => {
  assert.notEqual(
    getCareStorageKey({ kind: "account", userId: "user_a", householdId: "house_1" }),
    getCareStorageKey({ kind: "account", userId: "user_b", householdId: "house_1" }),
  );
  assert.notEqual(
    getCareStorageKey({ kind: "account", userId: "user_a", householdId: "house_1" }),
    getCareStorageKey({ kind: "account", userId: "user_a", householdId: "house_2" }),
  );
});

test("an unscoped v2 cache is adopted only by the explicit local-preview scope", () => {
  assert.equal(
    shouldAdoptUnscopedV2Cache({ clerkConfigured: false, scope: { kind: "local" } }),
    true,
  );
  assert.equal(
    shouldAdoptUnscopedV2Cache({
      clerkConfigured: true,
      scope: { kind: "account", userId: "user_b", householdId: "house_2" },
    }),
    false,
  );
});

test("uses the explicit local-preview key and derives its recovery key", () => {
  const scope = { kind: "local" } as const;
  assert.equal(getCareStorageKey(scope), "woofwatcher.v3.local");
  assert.equal(getCareRecoveryKey(scope), "woofwatcher.v3.local.recovery");
});

test("encodes account and household identifiers in scoped keys", () => {
  const scope = {
    kind: "account",
    userId: "user/a",
    householdId: "house one",
  } as const;
  assert.equal(
    getCareStorageKey(scope),
    "woofwatcher.v3.account.user%2Fa.house%20one",
  );
  assert.equal(
    getCareRecoveryKey(scope),
    "woofwatcher.v3.account.user%2Fa.house%20one.recovery",
  );
  assert.equal(
    getCarePendingDeleteStorageKey(scope),
    "woofwatcher.v3.account.user%2Fa.house%20one.pending-care-entry-deletes",
  );
});
