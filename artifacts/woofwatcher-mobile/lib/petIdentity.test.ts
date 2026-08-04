import assert from "node:assert/strict";
import test from "node:test";

import { buildAuthGatewayIdentityCopy } from "./petIdentity.ts";

test("names the active dog throughout the account gateway", () => {
  assert.deepEqual(buildAuthGatewayIdentityCopy("  Luna  "), {
    setupDetail: "Set up Luna, then invite your household when providers are live.",
    stageLabel: "Luna care starts here",
  });
});

test("uses the starter identity before a dog is named", () => {
  assert.deepEqual(buildAuthGatewayIdentityCopy("My Dog"), {
    setupDetail: "Set up Phoenix, then invite your household when providers are live.",
    stageLabel: "Phoenix care starts here",
  });
  assert.deepEqual(buildAuthGatewayIdentityCopy("   "), {
    setupDetail: "Set up Phoenix, then invite your household when providers are live.",
    stageLabel: "Phoenix care starts here",
  });
});
