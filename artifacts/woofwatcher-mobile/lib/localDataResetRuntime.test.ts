import assert from "node:assert/strict";
import { test } from "node:test";

import type { LocalDataStorageAdapter } from "./removableLocalDataStorage.ts";
import { LocalDataResetInProgressError } from "./removableLocalDataStorage.ts";
import {
  HOME_WELCOME_DISMISSED_KEY,
  createDevicePreferencesStore,
} from "./devicePreferences.ts";
import { createLocalDataResetRuntime } from "./localDataResetRuntime.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createStorageAdapter(): LocalDataStorageAdapter & {
  values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
}

function attachRequiredNoOps(runtime: ReturnType<typeof createLocalDataResetRuntime>) {
  runtime.attachRequiredParticipant("care", {
    prepare: async () => {},
    commit: async () => {},
  });
  runtime.attachRequiredParticipant("avatar", {
    prepare: async () => {},
    commit: async () => {},
  });
  runtime.attachRequiredParticipant("device-preferences", {
    prepare: async () => {},
    commit: async () => {},
  });
}

test("missing required device-preferences owner fails closed with zero commits", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  const oldPermit = runtime.generationAuthority.capture();
  let destructiveCommits = 0;
  runtime.attachRequiredParticipant("care", {
    prepare: async () => {},
    commit: async () => {},
  });
  runtime.attachRequiredParticipant("avatar", {
    prepare: async () => {},
    commit: async () => {},
  });
  runtime.registerParticipant({
    id: "destructive-proof",
    prepare: async () => {},
    commit: async () => {
      destructiveCommits += 1;
    },
  });

  const result = await runtime.operations.runReset();

  assert.deepEqual(result, {
    status: "partial-failure",
    committedParticipantIds: [],
    failedParticipantIds: ["device-preferences"],
  });
  assert.equal(destructiveCommits, 0);
  assert.equal(runtime.generationAuthority.isValid(oldPermit), true);
  assert.equal(runtime.operations.isWriteAdmissionOpen(), true);
});

test("all three attached required owners reset in deterministic participant order", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  const events: string[] = [];
  for (const id of ["care", "avatar", "device-preferences"] as const) {
    runtime.attachRequiredParticipant(id, {
      prepare: async () => {
        events.push(`prepare:${id}`);
      },
      commit: async () => {
        events.push(`commit:${id}`);
      },
    });
  }
  runtime.registerParticipant({
    id: "files",
    prepare: async () => {
      events.push("prepare:files");
    },
    commit: async () => {
      events.push("commit:files");
    },
  });

  const result = await runtime.operations.runReset();

  assert.deepEqual(events, [
    "prepare:avatar",
    "prepare:care",
    "prepare:device-preferences",
    "prepare:files",
    "commit:avatar",
    "commit:care",
    "commit:device-preferences",
    "commit:files",
  ]);
  assert.deepEqual(result, {
    status: "complete",
    committedParticipantIds: [
      "avatar",
      "care",
      "device-preferences",
      "files",
      "work-drain",
    ],
    failedParticipantIds: [],
  });
});

test("required attachment uses identity-safe stale detach behavior", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  const events: string[] = [];
  const detachOld = runtime.attachRequiredParticipant("care", {
    prepare: async () => {
      events.push("old:prepare");
    },
    commit: async () => {
      events.push("old:commit");
    },
  });
  runtime.attachRequiredParticipant("care", {
    prepare: async () => {
      events.push("new:prepare");
    },
    commit: async () => {
      events.push("new:commit");
    },
  });
  runtime.attachRequiredParticipant("avatar", {
    prepare: async () => {},
    commit: async () => {},
  });
  runtime.attachRequiredParticipant("device-preferences", {
    prepare: async () => {},
    commit: async () => {},
  });

  detachOld();
  const result = await runtime.operations.runReset();

  assert.equal(result.status, "complete");
  assert.deepEqual(events, ["new:prepare", "new:commit"]);
});

test("work-drain waits for accepted storage and tracked work before invalidation", async () => {
  const storageWrite = deferred<void>();
  const trackedWork = deferred<string>();
  const physicalWrites: string[] = [];
  const runtime = createLocalDataResetRuntime({
    getItem: async () => null,
    setItem: async (_key, value) => {
      physicalWrites.push(value);
      await storageWrite.promise;
    },
    removeItem: async () => {},
  });
  const oldPermit = runtime.generationAuthority.capture();
  const commitValidity: boolean[] = [];
  for (const id of ["care", "avatar", "device-preferences"] as const) {
    runtime.attachRequiredParticipant(id, {
      prepare: async () => {},
      commit: async () => {
        commitValidity.push(runtime.generationAuthority.isValid(oldPermit));
      },
    });
  }
  const storageOperation = runtime.removableStorage.setItem("care", "snapshot");
  const trackedOperation = runtime.trackedWork.run(() => trackedWork.promise);
  await Promise.resolve();

  const reset = runtime.operations.runReset();
  assert.equal(runtime.operations.isWriteAdmissionOpen(), false);
  assert.equal(runtime.generationAuthority.isValid(oldPermit), true);
  assert.deepEqual(commitValidity, []);

  storageWrite.resolve();
  trackedWork.resolve("file saved");
  const [resetResult, storageResult, workResult] = await Promise.all([
    reset,
    storageOperation,
    trackedOperation,
  ]);

  assert.equal(resetResult.status, "complete");
  assert.equal(storageResult, undefined);
  assert.deepEqual(workResult, { status: "complete", value: "file saved" });
  assert.deepEqual(physicalWrites, ["snapshot"]);
  assert.deepEqual(commitValidity, [false, false, false]);
});

test("shared removable storage rejects new work as soon as reset is queued", async () => {
  const adapter = createStorageAdapter();
  const runtime = createLocalDataResetRuntime(adapter);
  const preparation = deferred<void>();
  runtime.attachRequiredParticipant("care", {
    prepare: () => preparation.promise,
    commit: async () => {},
  });
  runtime.attachRequiredParticipant("avatar", {
    prepare: async () => {},
    commit: async () => {},
  });
  runtime.attachRequiredParticipant("device-preferences", {
    prepare: async () => {},
    commit: async () => {},
  });

  const reset = runtime.operations.runReset();
  const blocked = runtime.removableStorage.setItem("late", "resurrection");

  await assert.rejects(blocked, LocalDataResetInProgressError);
  assert.equal(adapter.values.has("late"), false);

  preparation.resolve();
  await reset;
});

test("concurrent reset callers receive the exact runtime operation promise", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  const preparation = deferred<void>();
  runtime.attachRequiredParticipant("care", {
    prepare: () => preparation.promise,
    commit: async () => {},
  });
  runtime.attachRequiredParticipant("avatar", {
    prepare: async () => {},
    commit: async () => {},
  });
  runtime.attachRequiredParticipant("device-preferences", {
    prepare: async () => {},
    commit: async () => {},
  });

  const first = runtime.operations.runReset();
  const second = runtime.operations.runReset();

  assert.strictEqual(second, first);

  preparation.resolve();
  await first;
});

test("an accepted preference save holds prepare open and a late save is rejected", async () => {
  const acceptedWrite = deferred<void>();
  const physicalWrites: string[] = [];
  const runtime = createLocalDataResetRuntime({
    getItem: async () => null,
    setItem: async (_key, value) => {
      physicalWrites.push(value);
      if (value === "accepted") await acceptedWrite.promise;
    },
    removeItem: async () => {},
  });
  attachRequiredNoOps(runtime);
  const store = createDevicePreferencesStore(runtime.removableStorage);
  const permit = runtime.generationAuthority.capture();
  const accepted = store.save(HOME_WELCOME_DISMISSED_KEY, "accepted");
  await Promise.resolve();

  const reset = runtime.operations.runReset();
  let resetSettled = false;
  void reset.then(() => {
    resetSettled = true;
  });
  const late = store.save(HOME_WELCOME_DISMISSED_KEY, "late");

  await assert.rejects(late, LocalDataResetInProgressError);
  assert.equal(runtime.operations.isWriteAdmissionOpen(), false);
  assert.equal(runtime.generationAuthority.isValid(permit), true);
  assert.equal(resetSettled, false);

  acceptedWrite.resolve();
  await accepted;
  const result = await reset;

  assert.equal(result.status, "complete");
  assert.equal(runtime.generationAuthority.isValid(permit), false);
  assert.deepEqual(physicalWrites, ["accepted"]);
});

test("tracked preference hydration cannot apply after reset admission closes in the read microtask gap", async () => {
  let runtime!: ReturnType<typeof createLocalDataResetRuntime>;
  let reset: ReturnType<typeof runtime.operations.runReset> | null = null;
  let resetSettled = false;
  const adapter: LocalDataStorageAdapter = {
    getItem() {
      queueMicrotask(() => {
        queueMicrotask(() => {
          reset = runtime.operations.runReset();
          void reset.then(() => {
            resetSettled = true;
          });
        });
      });
      return Promise.resolve("stale-before-reset");
    },
    async setItem() {},
    async removeItem() {},
  };
  runtime = createLocalDataResetRuntime(adapter);
  attachRequiredNoOps(runtime);
  const store = createDevicePreferencesStore(runtime.removableStorage, {
    runTrackedHydration: runtime.trackedWork.run,
  });
  const applied: Array<string | null> = [];

  const result = await store.hydrate(HOME_WELCOME_DISMISSED_KEY, {
    isCancelled: () => false,
    apply: (raw) => applied.push(raw),
  });

  assert.equal(result, "cancelled");
  assert.deepEqual(applied, []);
  assert.ok(reset);
  assert.equal(resetSettled, false);
  assert.equal((await reset).status, "complete");
});

test("root work-drain waits for a deferred tracked preference read without deadlock", async () => {
  const read = deferred<string | null>();
  let readStarted = false;
  const runtime = createLocalDataResetRuntime({
    getItem() {
      readStarted = true;
      return read.promise;
    },
    async setItem() {},
    async removeItem() {},
  });
  attachRequiredNoOps(runtime);
  const store = createDevicePreferencesStore(runtime.removableStorage, {
    runTrackedHydration: runtime.trackedWork.run,
  });
  let applies = 0;
  const hydration = store.hydrate(HOME_WELCOME_DISMISSED_KEY, {
    isCancelled: () => false,
    apply: () => {
      applies += 1;
    },
  });
  while (!readStarted) await Promise.resolve();

  const reset = runtime.operations.runReset();
  let resetSettled = false;
  void reset.then(() => {
    resetSettled = true;
  });
  for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();

  assert.equal(resetSettled, false);
  assert.equal(runtime.operations.isWriteAdmissionOpen(), false);

  read.resolve("stale-before-reset");
  assert.equal(await hydration, "cancelled");
  assert.equal(applies, 0);
  assert.equal((await reset).status, "complete");
});

test("runtime delegates participant registration and tracked work through stable functions", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  attachRequiredNoOps(runtime);
  let customCommit = 0;
  const unregister = runtime.registerParticipant({
    id: "custom",
    prepare: async () => {},
    commit: async () => {
      customCommit += 1;
    },
  });

  assert.deepEqual(await runtime.trackedWork.run(async () => 7), {
    status: "complete",
    value: 7,
  });
  assert.equal((await runtime.operations.runReset()).status, "complete");
  assert.equal(customCommit, 1);

  unregister();
  assert.equal((await runtime.operations.runReset()).status, "complete");
  assert.equal(customCommit, 1);
});
