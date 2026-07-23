import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldEnforceAuthGate } from "./authGate.ts";

test("always enforces authentication outside development", () => {
  assert.equal(
    shouldEnforceAuthGate({ isDevelopment: false, forceInDevelopment: false }),
    true,
  );
});

test("keeps local development review open unless gated QA is requested", () => {
  assert.equal(shouldEnforceAuthGate({ isDevelopment: true }), false);
  assert.equal(
    shouldEnforceAuthGate({ isDevelopment: true, forceInDevelopment: true }),
    true,
  );
});
