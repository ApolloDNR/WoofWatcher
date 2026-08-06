import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CARE_READ_ONLY_MESSAGE,
  careMutationWasAccepted,
  createCareWriteProtection,
  prioritizeCareStorageWarning,
  runAcceptedCareMutation,
  type CareStorageWarning,
} from "./careWriteProtection.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("a future-document generation blocks a deferred mutation continuation", async () => {
  const protection = createCareWriteProtection();
  const generation = protection.capture();
  const gate = deferred<void>();
  const sideEffects: string[] = [];
  const mutation = (async () => {
    await gate.promise;
    if (!protection.canContinue(generation)) return;
    sideEffects.push("provider-write");
    sideEffects.push("state-write");
  })();

  const protectedGeneration = protection.protect();
  gate.resolve();
  await mutation;

  assert.equal(protectedGeneration > generation, true);
  assert.equal(protection.isBlocked(), true);
  assert.deepEqual(sideEffects, []);
  protection.reset();
  assert.equal(protection.capture() > protectedGeneration, true);
  assert.equal(protection.isBlocked(), false);
});

test("every deferred callback boundary stops side effects after protection flips", async () => {
  for (const protectAfter of [0, 1, 2]) {
    const protection = createCareWriteProtection();
    const generation = protection.capture();
    const gates = [deferred<void>(), deferred<void>(), deferred<void>()];
    const sideEffects: string[] = [];
    const callback = (async () => {
      for (let index = 0; index < gates.length; index += 1) {
        await gates[index]!.promise;
        if (!protection.canContinue(generation)) return;
        sideEffects.push(`after-${index}`);
      }
    })();

    for (let index = 0; index < protectAfter; index += 1) {
      gates[index]!.resolve();
      await Promise.resolve();
    }
    assert.equal(sideEffects.length, protectAfter);
    protection.protect();
    for (let index = protectAfter; index < gates.length; index += 1) {
      gates[index]!.resolve();
    }
    await callback;

    assert.equal(sideEffects.length, protectAfter);
  }
});

test("an explicit reset never reopens a callback captured before future protection", async () => {
  const protection = createCareWriteProtection();
  const staleGeneration = protection.capture();
  const gate = deferred<void>();
  let resumed = false;
  const callback = (async () => {
    await gate.promise;
    if (!protection.canContinue(staleGeneration)) return;
    resumed = true;
  })();

  protection.protect();
  protection.reset();
  gate.resolve();
  await callback;

  assert.equal(protection.isBlocked(), false);
  assert.equal(resumed, false);
});

test("a delayed failure cannot replace the newer-version warning", async () => {
  const protection = createCareWriteProtection();
  const lateWrite = deferred<void>();
  let warning: CareStorageWarning = null;
  const completion = lateWrite.promise.catch(() => {
    warning = prioritizeCareStorageWarning(warning, "save-failed", protection.isBlocked());
  });

  protection.protect();
  warning = "newer-version";
  lateWrite.reject(new Error("late storage failure"));
  await completion;

  assert.equal(warning, "newer-version");
  assert.equal(
    prioritizeCareStorageWarning(warning, "read-failed", protection.isBlocked()),
    "newer-version",
  );
});

test("rejected create, update, and delete results never qualify for success feedback", () => {
  assert.equal(careMutationWasAccepted(""), false);
  assert.equal(careMutationWasAccepted(false), false);
  assert.equal(careMutationWasAccepted("temp_123"), true);
  assert.equal(careMutationWasAccepted(true), true);
  assert.match(CARE_READ_ONLY_MESSAGE, /newer WoofWatcher version/i);
  assert.match(CARE_READ_ONLY_MESSAGE, /update/i);
});

test("Home quick log, walk start, walk finish, and undo emit no success effects when rejected", () => {
  for (const scenario of ["quick-log", "walk-start", "walk-finish", "undo"]) {
    const successEffects: string[] = [];
    const result = scenario === "quick-log" || scenario === "walk-start" ? "" : false;
    const accepted = runAcceptedCareMutation(result, () => {
      successEffects.push("haptic", "speech", "toast", "xp");
    });

    assert.equal(accepted, false, scenario);
    assert.deepEqual(successEffects, [], scenario);
  }
});

test("document saves emit no haptic, close, navigation, secondary write, or share when rejected", () => {
  for (const scenario of ["more", "records", "privacy", "setup"]) {
    const successEffects: string[] = [];
    const accepted = runAcceptedCareMutation(false, () => {
      successEffects.push("haptic", "close", "navigate", "secondary-write", "share");
    });

    assert.equal(accepted, false, scenario);
    assert.deepEqual(successEffects, [], scenario);
  }
});
