import assert from "node:assert/strict";
import { test } from "node:test";

import { createGenerationPermitAuthority } from "./generationPermit.ts";
import {
  createRemovableLocalDataStorage,
  type LocalDataStorageAdapter,
} from "./removableLocalDataStorage.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createHarness(adapter: LocalDataStorageAdapter) {
  const authority = createGenerationPermitAuthority();
  let admissionOpen = true;
  const storage = createRemovableLocalDataStorage({
    storage: adapter,
    capturePermit: authority.capture,
    isPermitValid: authority.isValid,
    isAdmissionOpen: () => admissionOpen,
  });
  return {
    authority,
    storage,
    closeAdmission: () => {
      admissionOpen = false;
    },
  };
}

test("serializes set and remove physical writes in FIFO order", async () => {
  const firstWrite = deferred<void>();
  const events: string[] = [];
  const harness = createHarness({
    getItem: async () => null,
    setItem: async (key) => {
      events.push(`start:set:${key}`);
      await firstWrite.promise;
      events.push(`finish:set:${key}`);
    },
    removeItem: async (key) => {
      events.push(`remove:${key}`);
    },
  });

  const set = harness.storage.setItem("profile", "phoenix");
  const remove = harness.storage.removeItem("profile");
  await Promise.resolve();

  assert.deepEqual(events, ["start:set:profile"]);
  firstWrite.resolve();
  await Promise.all([set, remove]);

  assert.deepEqual(events, [
    "start:set:profile",
    "finish:set:profile",
    "remove:profile",
  ]);
});

test("a queued stale write skips without reporting a storage failure", async () => {
  const activeWrite = deferred<void>();
  const physicalWrites: string[] = [];
  const harness = createHarness({
    getItem: async () => null,
    setItem: async (_key, value) => {
      physicalWrites.push(value);
      if (value === "active") await activeWrite.promise;
    },
    removeItem: async () => {},
  });

  const active = harness.storage.setItem("care", "active");
  await Promise.resolve();
  const stale = harness.storage.setItem("care", "stale");
  harness.authority.invalidate();
  activeWrite.resolve();

  const results = await Promise.allSettled([active, stale]);

  assert.deepEqual(results, [
    { status: "fulfilled", value: undefined },
    { status: "fulfilled", value: undefined },
  ]);
  assert.deepEqual(physicalWrites, ["active"]);
});

test("drain waits for an already-active physical write to settle", async () => {
  const activeWrite = deferred<void>();
  const harness = createHarness({
    getItem: async () => null,
    setItem: async () => activeWrite.promise,
    removeItem: async () => {},
  });

  const write = harness.storage.setItem("care", "snapshot");
  let drained = false;
  const drain = harness.storage.drain().then(() => {
    drained = true;
  });
  await Promise.resolve();

  assert.equal(drained, false);

  activeWrite.resolve();
  await Promise.all([write, drain]);
  assert.equal(drained, true);
});

test("a call made while admission is closed rejects before storage accepts it", async () => {
  const physicalWrites: string[] = [];
  const harness = createHarness({
    getItem: async () => null,
    setItem: async (_key, value) => {
      physicalWrites.push(value);
    },
    removeItem: async () => {},
  });
  harness.closeAdmission();

  await assert.rejects(
    harness.storage.setItem("care", "blocked"),
    /local data reset.*progress/i,
  );
  assert.deepEqual(physicalWrites, []);
});

test("a read rejects its stale result after permit invalidation", async () => {
  const read = deferred<string | null>();
  const harness = createHarness({
    getItem: () => read.promise,
    setItem: async () => {},
    removeItem: async () => {},
  });

  const result = harness.storage.getItem("avatar");
  harness.authority.invalidate();
  read.resolve("pre-reset-avatar");

  await assert.rejects(result, /local data reset.*progress/i);
});

test("a rejected physical write does not stall the next accepted write", async () => {
  const failure = new Error("disk unavailable");
  const attempts: string[] = [];
  const harness = createHarness({
    getItem: async () => null,
    setItem: async (_key, value) => {
      attempts.push(value);
      if (value === "rejected") throw failure;
    },
    removeItem: async () => {},
  });

  const rejected = harness.storage.setItem("care", "rejected");
  const accepted = harness.storage.setItem("care", "accepted");
  const [rejectedResult, acceptedResult] = await Promise.allSettled([
    rejected,
    accepted,
  ]);

  assert.deepEqual(attempts, ["rejected", "accepted"]);
  assert.deepEqual(rejectedResult, { status: "rejected", reason: failure });
  assert.deepEqual(acceptedResult, { status: "fulfilled", value: undefined });
});

test("synchronous adapter re-entry cannot start a second physical write early", async () => {
  const firstWrite = deferred<void>();
  const events: string[] = [];
  let storage!: ReturnType<typeof createHarness>["storage"];
  let reentered!: Promise<void>;
  const harness = createHarness({
    getItem: async () => null,
    setItem: (_key, value) => {
      events.push(`start:${value}`);
      if (value === "first") {
        reentered = storage.setItem("care", "second");
        return firstWrite.promise.then(() => {
          events.push("finish:first");
        });
      }
      events.push("finish:second");
      return Promise.resolve();
    },
    removeItem: async () => {},
  });
  storage = harness.storage;

  const first = storage.setItem("care", "first");
  await Promise.resolve();

  assert.deepEqual(events, ["start:first"]);

  firstWrite.resolve();
  await Promise.all([first, reentered]);
  assert.deepEqual(events, [
    "start:first",
    "finish:first",
    "start:second",
    "finish:second",
  ]);
});

test("a queued accepted write is not skipped merely because admission closes", async () => {
  const activeWrite = deferred<void>();
  const physicalWrites: string[] = [];
  const harness = createHarness({
    getItem: async () => null,
    setItem: async (_key, value) => {
      physicalWrites.push(value);
      if (value === "active") await activeWrite.promise;
    },
    removeItem: async () => {},
  });

  const active = harness.storage.setItem("care", "active");
  const queued = harness.storage.setItem("care", "accepted-before-close");
  await Promise.resolve();
  harness.closeAdmission();
  activeWrite.resolve();

  await Promise.all([active, queued]);
  assert.deepEqual(physicalWrites, ["active", "accepted-before-close"]);
});
