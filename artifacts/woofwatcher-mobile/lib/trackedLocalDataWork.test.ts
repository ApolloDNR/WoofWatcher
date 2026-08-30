import assert from "node:assert/strict";
import { test } from "node:test";

import { createGenerationPermitAuthority } from "./generationPermit.ts";
import { LocalDataResetInProgressError } from "./removableLocalDataStorage.ts";
import { createTrackedLocalDataWork } from "./trackedLocalDataWork.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createHarness() {
  const authority = createGenerationPermitAuthority();
  let admissionOpen = true;
  const tracker = createTrackedLocalDataWork({
    capturePermit: authority.capture,
    isPermitValid: authority.isValid,
    isAdmissionOpen: () => admissionOpen,
  });
  return {
    authority,
    tracker,
    setAdmissionOpen(value: boolean) {
      admissionOpen = value;
    },
  };
}

test("rejects before invoking work when reset admission is closed", async () => {
  const harness = createHarness();
  harness.setAdmissionOpen(false);
  let invoked = false;

  await assert.rejects(
    harness.tracker.run(async () => {
      invoked = true;
      return "must not run";
    }),
    LocalDataResetInProgressError,
  );

  assert.equal(invoked, false);
});

test("rejects before invoking work when the captured permit is invalid", async () => {
  let invoked = false;
  const tracker = createTrackedLocalDataWork({
    capturePermit: createGenerationPermitAuthority().capture,
    isPermitValid: () => false,
    isAdmissionOpen: () => true,
  });

  await assert.rejects(
    tracker.run(async () => {
      invoked = true;
      return "must not run";
    }),
    LocalDataResetInProgressError,
  );

  assert.equal(invoked, false);
});

test("registers the public operation before synchronously invoking work", async () => {
  const harness = createHarness();
  const workGate = deferred<string>();
  let reentrantDrain: Promise<void> | undefined;
  let drainSettled = false;

  const operation = harness.tracker.run(() => {
    reentrantDrain = harness.tracker.drain().then(() => {
      drainSettled = true;
    });
    return workGate.promise;
  });
  await Promise.resolve();

  assert.ok(reentrantDrain);
  assert.equal(drainSettled, false);

  workGate.resolve("saved");
  assert.deepEqual(await operation, { status: "complete", value: "saved" });
  await reentrantDrain;
  assert.equal(drainSettled, true);
});

test("drain waits for work accepted before the call without adopting later work", async () => {
  const harness = createHarness();
  const firstGate = deferred<void>();
  const secondGate = deferred<void>();
  const first = harness.tracker.run(() => firstGate.promise);
  const drain = harness.tracker.drain();
  const second = harness.tracker.run(() => secondGate.promise);
  let drainSettled = false;
  void drain.then(() => {
    drainSettled = true;
  });

  secondGate.resolve();
  await second;
  await Promise.resolve();
  assert.equal(drainSettled, false);

  firstGate.resolve();
  await Promise.all([first, drain]);
  assert.equal(drainSettled, true);
});

test("returns a completed value and exposes synchronous current-state checks", async () => {
  const harness = createHarness();
  let currentDuringStart: boolean | undefined;

  const result = await harness.tracker.run(async (scope) => {
    currentDuringStart = scope.isCurrent();
    assert.equal(harness.authority.isValid(scope.permit), true);
    return { dogName: "Phoenix" };
  });

  assert.equal(currentDuringStart, true);
  assert.deepEqual(result, {
    status: "complete",
    value: { dogName: "Phoenix" },
  });
});

test("isCurrent closes immediately with admission while accepted work may still complete", async () => {
  const harness = createHarness();
  const gate = deferred<string>();
  let isCurrent!: () => boolean;
  const operation = harness.tracker.run((scope) => {
    isCurrent = scope.isCurrent;
    return gate.promise;
  });

  harness.setAdmissionOpen(false);
  assert.equal(isCurrent(), false);
  gate.resolve("drained-before-barrier");

  assert.deepEqual(await operation, {
    status: "complete",
    value: "drained-before-barrier",
  });
});

test("rejects the exact real error while the captured permit remains valid", async () => {
  const harness = createHarness();
  const failure = new Error("picked-file copy failed");

  await assert.rejects(
    harness.tracker.run(async () => {
      throw failure;
    }),
    (error) => error === failure,
  );
});

test("turns both success and failure settlements after invalidation into revoked results", async () => {
  const successHarness = createHarness();
  const successGate = deferred<string>();
  const success = successHarness.tracker.run(() => successGate.promise);
  successHarness.authority.invalidate();
  successGate.resolve("late file");
  assert.deepEqual(await success, { status: "revoked" });

  const failureHarness = createHarness();
  const failureGate = deferred<string>();
  const failure = failureHarness.tracker.run(() => failureGate.promise);
  failureHarness.authority.invalidate();
  failureGate.reject(new Error("late failure"));
  assert.deepEqual(await failure, { status: "revoked" });
});

test("a synchronous throw is removed from tracking and cannot stall later work", async () => {
  const harness = createHarness();
  const failure = new Error("synchronous start failed");
  const rejected = harness.tracker.run((() => {
    throw failure;
  }) as Parameters<typeof harness.tracker.run>[0]);

  await assert.rejects(rejected, (error) => error === failure);
  await harness.tracker.drain();

  assert.deepEqual(await harness.tracker.run(async () => "recovered"), {
    status: "complete",
    value: "recovered",
  });
});
