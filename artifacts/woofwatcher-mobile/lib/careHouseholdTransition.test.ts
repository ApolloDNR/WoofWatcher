import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createCareHouseholdTransitionController,
  type CareHouseholdTransitionPermit,
} from "./careHouseholdTransition.ts";

const HOUSEHOLD_A_PERMIT: CareHouseholdTransitionPermit = Object.freeze({
  generation: 7,
  dataScope: 'care-v2:["user-a","household-a"]',
  userId: "user-a",
  sessionId: "session-a",
  householdId: "household-a",
  identityKey: '["user-a","session-a","household-a"]',
});

test("a Care household transition suspends resolution synchronously until its exact token resumes", () => {
  const controller = createCareHouseholdTransitionController();

  assert.equal(controller.canResolveHousehold(), true);
  const token = controller.begin(HOUSEHOLD_A_PERMIT);
  assert.ok(token);
  assert.equal(controller.canResolveHousehold(), false);
  assert.equal(controller.begin(HOUSEHOLD_A_PERMIT), null);
  assert.deepEqual(controller.getPermit(token), HOUSEHOLD_A_PERMIT);

  const forged = Object.freeze({ ...token });
  assert.equal(controller.resume(forged), false);
  assert.equal(controller.canResolveHousehold(), false);
  assert.equal(controller.resume(token), true);
  assert.equal(controller.canResolveHousehold(), true);
  assert.equal(controller.resume(token), false, "a transition token is one-shot");
});

test("Care transition permits preserve opaque identity boundaries and reject malformed authority", () => {
  const controller = createCareHouseholdTransitionController();
  assert.equal(
    controller.begin({ ...HOUSEHOLD_A_PERMIT, householdId: " household-a" }),
    null,
  );
  assert.equal(
    controller.begin({ ...HOUSEHOLD_A_PERMIT, sessionId: "" }),
    null,
  );

  const collisionA = controller.begin({
    ...HOUSEHOLD_A_PERMIT,
    userId: "a:b",
    sessionId: "c",
  });
  assert.ok(collisionA);
  assert.equal(controller.resume(collisionA), true);
  const collisionB = controller.begin({
    ...HOUSEHOLD_A_PERMIT,
    userId: "a",
    sessionId: "b:c",
  });
  assert.ok(collisionB);
  assert.notDeepEqual(
    controller.getPermit(collisionA),
    controller.getPermit(collisionB),
  );
});
