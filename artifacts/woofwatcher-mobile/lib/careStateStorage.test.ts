import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPrincipalStorageKey,
  cacheBelongsToPrincipal,
  householdCacheIsCompatible,
} from "./careStateStorage.ts";

test("keeps authenticated care caches in exact principal namespaces", () => {
  assert.equal(
    buildPrincipalStorageKey("woofwatcher.v2.state", " user/A "),
    "woofwatcher.v2.state.account.user%2FA",
  );
  assert.equal(
    buildPrincipalStorageKey("woofwatcher.v2.state", null),
    "woofwatcher.v2.state",
  );
  assert.equal(cacheBelongsToPrincipal("user_a", "user_a"), true);
  assert.equal(cacheBelongsToPrincipal("user_a", "user_b"), false);
  assert.equal(cacheBelongsToPrincipal(undefined, "user_b"), false);
  assert.equal(cacheBelongsToPrincipal(undefined, null), true);
});

test("never reconciles one known household cache into another household", () => {
  assert.equal(householdCacheIsCompatible("house_a", "house_a"), true);
  assert.equal(householdCacheIsCompatible("house_a", "house_b"), false);
  assert.equal(householdCacheIsCompatible(null, "house_b"), true);
  assert.equal(householdCacheIsCompatible("house_a", null), false);
});
