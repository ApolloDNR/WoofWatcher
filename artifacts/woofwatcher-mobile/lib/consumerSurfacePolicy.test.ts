import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveConsumerSurfacePolicy,
  deriveProviderRuntimePolicy,
} from "./consumerSurfacePolicy.ts";

test("free production exposes only complete local consumer surfaces", () => {
  assert.deepEqual(deriveConsumerSurfacePolicy("production"), {
    ownerOps: false,
    discoverEvents: false,
    householdProviderActions: false,
    futureDogPlanning: false,
    providerSyncControls: false,
    householdSetupModes: false,
    pushNotificationControls: false,
  });
});

test("development and internal builds retain provider QA surfaces", () => {
  for (const channel of ["development", "internal"] as const) {
    const policy = deriveConsumerSurfacePolicy(channel);
    assert.equal(policy.ownerOps, true);
    assert.equal(policy.discoverEvents, true);
    assert.equal(policy.householdProviderActions, true);
    assert.equal(policy.futureDogPlanning, true);
    assert.equal(policy.providerSyncControls, true);
    assert.equal(policy.householdSetupModes, true);
    assert.equal(policy.pushNotificationControls, true);
  }
});

test("production ignores stray valid provider secrets and domains", () => {
  assert.deepEqual(
    deriveProviderRuntimePolicy({
      channel: "production",
      clerkConfigured: true,
      apiDomain: "api.woofwatcher.example",
    }),
    {
      clerkEnabled: false,
      apiBaseUrl: null,
    },
  );
});

test("internal builds may activate the configured provider runtime", () => {
  assert.deepEqual(
    deriveProviderRuntimePolicy({
      channel: "internal",
      clerkConfigured: true,
      apiDomain: "api.woofwatcher.example",
    }),
    {
      clerkEnabled: true,
      apiBaseUrl: "https://api.woofwatcher.example",
    },
  );
});
