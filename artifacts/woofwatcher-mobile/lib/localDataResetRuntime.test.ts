import assert from "node:assert/strict";
import { test } from "node:test";

import type { LocalDataStorageAdapter } from "./removableLocalDataStorage.ts";
import { LocalDataResetInProgressError } from "./removableLocalDataStorage.ts";
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
}

test("missing required Care and Avatar owners fail closed with zero commits", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  const oldPermit = runtime.generationAuthority.capture();
  let destructiveCommits = 0;
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
    failedParticipantIds: ["avatar", "care"],
  });
  assert.equal(destructiveCommits, 0);
  assert.equal(runtime.generationAuthority.isValid(oldPermit), true);
  assert.equal(runtime.operations.isWriteAdmissionOpen(), true);
});

test("attached required owners reset completely in deterministic participant order", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  const events: string[] = [];
  for (const id of ["care", "avatar"] as const) {
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
    "prepare:files",
    "commit:avatar",
    "commit:care",
    "commit:files",
  ]);
  assert.deepEqual(result, {
    status: "complete",
    committedParticipantIds: ["avatar", "care", "files", "work-drain"],
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
  for (const id of ["care", "avatar"] as const) {
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
  assert.deepEqual(commitValidity, [false, false]);
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

  const first = runtime.operations.runReset();
  const second = runtime.operations.runReset();

  assert.strictEqual(second, first);

  preparation.resolve();
  await first;
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
