import assert from "node:assert/strict";
import { test } from "node:test";

import {
  activateDeliberateConfirmation,
  createDeliberateConfirmationLatch,
  getDeliberateConfirmationDelay,
  resetDeliberateConfirmation,
  transitionDeliberateConfirmation,
  trySettleDeliberateConfirmation,
} from "./deliberateConfirmation.ts";

test("successive destructive steps require two deliberate settlements", () => {
  const first = { id: "first" };
  const second = { id: "second" };
  const latch = createDeliberateConfirmationLatch<object>(400);

  assert.equal(activateDeliberateConfirmation(latch, first, 1_000), true);
  assert.equal(trySettleDeliberateConfirmation(latch, first, 1_000), true);
  transitionDeliberateConfirmation(latch, second, 1_000);

  assert.equal(
    trySettleDeliberateConfirmation(latch, first, 1_001),
    false,
    "a stale first-step callback cannot settle the second step",
  );
  assert.equal(
    trySettleDeliberateConfirmation(latch, second, 1_399),
    false,
    "a rapid double activation cannot accept the next step",
  );
  assert.equal(getDeliberateConfirmationDelay(latch, second, 1_399), 1);
  assert.equal(trySettleDeliberateConfirmation(latch, second, 1_400), true);
  assert.equal(
    trySettleDeliberateConfirmation(latch, second, 1_401),
    false,
    "one displayed step settles once",
  );
});

test("cancel/reset invalidates stale controls and a fresh flow starts ready", () => {
  const oldStep = { id: "old" };
  const freshStep = { id: "fresh" };
  const latch = createDeliberateConfirmationLatch<object>(400);

  activateDeliberateConfirmation(latch, oldStep, 10);
  resetDeliberateConfirmation(latch);
  assert.equal(trySettleDeliberateConfirmation(latch, oldStep, 1_000), false);

  assert.equal(activateDeliberateConfirmation(latch, freshStep, 1_000), true);
  assert.equal(getDeliberateConfirmationDelay(latch, freshStep, 1_000), 0);
  assert.equal(trySettleDeliberateConfirmation(latch, freshStep, 1_000), true);
});

test("reentrant starts cannot replace an active destructive flow", () => {
  const first = { id: "first" };
  const intruder = { id: "intruder" };
  const latch = createDeliberateConfirmationLatch<object>(400);

  assert.equal(activateDeliberateConfirmation(latch, first, 10), true);
  assert.equal(activateDeliberateConfirmation(latch, intruder, 20), false);
  assert.equal(trySettleDeliberateConfirmation(latch, intruder, 500), false);
  assert.equal(trySettleDeliberateConfirmation(latch, first, 500), true);
});

test("a cancellation path may settle the new step during its safety pause", () => {
  const first = { id: "first" };
  const second = { id: "second" };
  const latch = createDeliberateConfirmationLatch<object>(500);

  activateDeliberateConfirmation(latch, first, 1_000);
  assert.equal(trySettleDeliberateConfirmation(latch, first, 1_000), true);
  transitionDeliberateConfirmation(latch, second, 1_000);

  assert.equal(
    trySettleDeliberateConfirmation(latch, second, 1_001),
    false,
  );
  assert.equal(
    trySettleDeliberateConfirmation(latch, second, 1_001, {
      allowBeforeReady: true,
    }),
    true,
  );
});
