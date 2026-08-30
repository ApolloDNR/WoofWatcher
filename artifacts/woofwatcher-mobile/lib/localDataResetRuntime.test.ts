import assert from "node:assert/strict";
import { test } from "node:test";

import type { LocalDataStorageAdapter } from "./removableLocalDataStorage.ts";
import { LocalDataResetInProgressError } from "./removableLocalDataStorage.ts";
import {
  HOME_WELCOME_DISMISSED_KEY,
  createDevicePreferencesStore,
} from "./devicePreferences.ts";
import {
  REQUIRED_LOCAL_DATA_PARTICIPANT_IDS,
  createLocalDataResetRuntime,
} from "./localDataResetRuntime.ts";
import {
  LOCAL_DATA_RESET_EPOCH_KEY,
  LOCAL_DATA_RESET_IN_PROGRESS_KEY,
  StaleLocalDataRuntimeError,
  type LocalDataResetWebLockManager,
} from "./localDataResetFence.ts";
import {
  CARE_PRESERVED_LOCAL_DATA_KEY,
  CARE_PRIMARY_LOCAL_DATA_KEY,
  createCareLocalDataResetController,
} from "./careLocalDataReset.ts";
import { createSerializedCareSyncWriter } from "./careSync.ts";

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

function attachImplementedRequiredNoOps(
  runtime: ReturnType<typeof createLocalDataResetRuntime>,
) {
  runtime.attachRequiredParticipant("auth-credentials", {
    prepare: async () => {},
    commit: async () => {},
  });
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

function attachFutureRequiredNoOps(
  runtime: ReturnType<typeof createLocalDataResetRuntime>,
) {
  for (const id of [
    "files",
    "query-cache",
    "walk-capture",
    "web-runtime",
  ] as const) {
    runtime.attachRequiredParticipant(id, {
      prepare: async () => {},
      commit: async () => {},
    });
  }
}

function attachAllRequiredNoOps(
  runtime: ReturnType<typeof createLocalDataResetRuntime>,
) {
  attachImplementedRequiredNoOps(runtime);
  attachFutureRequiredNoOps(runtime);
}

test("exports the exact frozen required-owner manifest", () => {
  const requiredParticipantIds = REQUIRED_LOCAL_DATA_PARTICIPANT_IDS;

  assert.deepEqual(requiredParticipantIds, [
    "auth-credentials",
    "avatar",
    "care",
    "device-preferences",
    "files",
    "query-cache",
    "walk-capture",
    "web-runtime",
  ]);
  assert.equal(Object.isFrozen(requiredParticipantIds), true);
});

test("missing future required owners fail closed with zero commits", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  const oldPermit = runtime.generationAuthority.capture();
  let destructiveCommits = 0;
  attachImplementedRequiredNoOps(runtime);
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
    failedParticipantIds: [
      "files",
      "query-cache",
      "walk-capture",
      "web-runtime",
    ],
  });
  assert.equal(destructiveCommits, 0);
  assert.equal(runtime.generationAuthority.isValid(oldPermit), true);
  assert.equal(runtime.operations.isWriteAdmissionOpen(), true);
});

test("missing required device-preferences owner fails closed with zero commits", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  const oldPermit = runtime.generationAuthority.capture();
  let destructiveCommits = 0;
  for (const id of [
    "auth-credentials",
    "avatar",
    "care",
    "files",
    "query-cache",
    "walk-capture",
    "web-runtime",
  ] as const) {
    runtime.attachRequiredParticipant(id, {
      prepare: async () => {},
      commit: async () => {},
    });
  }
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

test("detaching files fails closed without invalidating or committing", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  const oldPermit = runtime.generationAuthority.capture();
  let destructiveCommits = 0;
  attachImplementedRequiredNoOps(runtime);
  const detachFiles = runtime.attachRequiredParticipant("files", {
    prepare: async () => {},
    commit: async () => {},
  });
  for (const id of ["query-cache", "walk-capture", "web-runtime"] as const) {
    runtime.attachRequiredParticipant(id, {
      prepare: async () => {},
      commit: async () => {},
    });
  }
  runtime.registerParticipant({
    id: "destructive-proof",
    prepare: async () => {},
    commit: async () => {
      destructiveCommits += 1;
    },
  });
  detachFiles();

  const result = await runtime.operations.runReset();

  assert.deepEqual(result, {
    status: "partial-failure",
    committedParticipantIds: [],
    failedParticipantIds: ["files"],
  });
  assert.equal(destructiveCommits, 0);
  assert.equal(runtime.generationAuthority.isValid(oldPermit), true);
  assert.equal(runtime.operations.isWriteAdmissionOpen(), true);
});

test("all eight attached required owners reset in deterministic participant order", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  const events: string[] = [];
  for (const id of [
    "auth-credentials",
    "avatar",
    "care",
    "device-preferences",
    "files",
    "query-cache",
    "walk-capture",
    "web-runtime",
  ] as const) {
    runtime.attachRequiredParticipant(id, {
      prepare: async () => {
        events.push(`prepare:${id}`);
      },
      commit: async () => {
        events.push(`commit:${id}`);
      },
    });
  }

  const result = await runtime.operations.runReset();

  assert.deepEqual(events, [
    "prepare:auth-credentials",
    "prepare:avatar",
    "prepare:care",
    "prepare:device-preferences",
    "prepare:files",
    "prepare:query-cache",
    "prepare:walk-capture",
    "prepare:web-runtime",
    "commit:avatar",
    "commit:care",
    "commit:device-preferences",
    "commit:files",
    "commit:query-cache",
    "commit:walk-capture",
    "commit:web-runtime",
    "commit:auth-credentials",
  ]);
  assert.deepEqual(result, {
    status: "complete",
    committedParticipantIds: [
      "avatar",
      "care",
      "device-preferences",
      "files",
      "query-cache",
      "walk-capture",
      "web-runtime",
      "work-drain",
      "auth-credentials",
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
  runtime.attachRequiredParticipant("auth-credentials", {
    prepare: async () => {},
    commit: async () => {},
  });
  attachFutureRequiredNoOps(runtime);

  detachOld();
  const result = await runtime.operations.runReset();

  assert.equal(result.status, "complete");
  assert.deepEqual(events, ["new:prepare", "new:commit"]);
});

test("work-drain waits for accepted storage and tracked work before invalidation", async () => {
  const storageWrite = deferred<void>();
  const trackedWork = deferred<string>();
  const physicalWrites: string[] = [];
  let physicalEpoch: string | null = null;
  const runtime = createLocalDataResetRuntime({
    getItem: async (key) =>
      key === LOCAL_DATA_RESET_EPOCH_KEY
        ? physicalEpoch
        : null,
    setItem: async (key, value) => {
      if (key === LOCAL_DATA_RESET_EPOCH_KEY) {
        physicalEpoch = value;
        return;
      }
      physicalWrites.push(value);
      await storageWrite.promise;
    },
    removeItem: async () => {},
  });
  const oldPermit = runtime.generationAuthority.capture();
  const commitValidity: boolean[] = [];
  for (const id of REQUIRED_LOCAL_DATA_PARTICIPANT_IDS) {
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
  assert.deepEqual(commitValidity, [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
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
  attachFutureRequiredNoOps(runtime);

  const reset = runtime.operations.runReset();
  const blocked = runtime.removableStorage.setItem("late", "resurrection");

  await assert.rejects(blocked, LocalDataResetInProgressError);
  assert.equal(adapter.values.has("late"), false);

  preparation.resolve();
  await reset;
});

test("the runtime does not expose a generic reset-time storage capability", () => {
  const adapter = createStorageAdapter();
  const runtime = createLocalDataResetRuntime(adapter);

  assert.equal("resetCommitStorage" in runtime, false);
});

test("a nonempty Care cleanup ledger persists inside the reset fence before primary deletion", async () => {
  const adapter = createStorageAdapter();
  adapter.values.set(CARE_PRIMARY_LOCAL_DATA_KEY, "private-care-state");
  const runtime = createLocalDataResetRuntime(adapter);
  const cleanupLedgerWriter = createSerializedCareSyncWriter<string[] | null>(
    async (entryIds) => {
      if (entryIds && entryIds.length > 0) {
        await runtime.removableStorage.setItem(
          CARE_PRESERVED_LOCAL_DATA_KEY,
          JSON.stringify(entryIds),
        );
        return;
      }
      await runtime.removableStorage.removeItem(
        CARE_PRESERVED_LOCAL_DATA_KEY,
      );
    },
  );
  const careController = createCareLocalDataResetController({
    canPrepare: () => true,
    drainPrimarySnapshots: async () => {},
    drainCleanupLedger: () => cleanupLedgerWriter.drain(),
    beginCommit: () => {},
    endCommit: () => {},
    invalidateAndDrainPrimarySnapshots: async () => {},
    persistCleanupIntent: (context) =>
      context!.persistCareCleanupLedger(["temp_pending_create"]),
    removeItem: (key) => adapter.removeItem(key),
    finalizeSuccessfulCommit: () => {},
  });
  for (const id of REQUIRED_LOCAL_DATA_PARTICIPANT_IDS) {
    runtime.attachRequiredParticipant(
      id,
      id === "care"
        ? careController.participant
        : { prepare: async () => {}, commit: async () => {} },
    );
  }

  const result = await runtime.operations.runReset();

  assert.deepEqual(result, {
    status: "complete",
    committedParticipantIds: [
      "avatar",
      "care",
      "device-preferences",
      "files",
      "query-cache",
      "walk-capture",
      "web-runtime",
      "work-drain",
      "auth-credentials",
    ],
    failedParticipantIds: [],
  });
  assert.equal(adapter.values.has(CARE_PRIMARY_LOCAL_DATA_KEY), false);
  assert.equal(
    adapter.values.get(CARE_PRESERVED_LOCAL_DATA_KEY),
    '["temp_pending_create"]',
  );
});

test("an unawaited Care reset write failure is drained and reported against Care", async () => {
  const adapter = createStorageAdapter();
  let preservedWriteAttempts = 0;
  const originalSetItem = adapter.setItem;
  adapter.setItem = async (key, value) => {
    if (key === CARE_PRESERVED_LOCAL_DATA_KEY) {
      preservedWriteAttempts += 1;
      throw new Error("preserved ledger write denied");
    }
    await originalSetItem(key, value);
  };
  const runtime = createLocalDataResetRuntime(adapter);
  const careController = createCareLocalDataResetController({
    canPrepare: () => true,
    drainPrimarySnapshots: async () => {},
    drainCleanupLedger: async () => {},
    beginCommit: () => {},
    endCommit: () => {},
    invalidateAndDrainPrimarySnapshots: async () => {},
    persistCleanupIntent(context) {
      void context!.persistCareCleanupLedger(["temp_unawaited"]);
      return Promise.resolve();
    },
    removeItem: (key) => adapter.removeItem(key),
    finalizeSuccessfulCommit: () => {},
  });
  for (const id of REQUIRED_LOCAL_DATA_PARTICIPANT_IDS) {
    runtime.attachRequiredParticipant(
      id,
      id === "care"
        ? careController.participant
        : { prepare: async () => {}, commit: async () => {} },
    );
  }

  const result = await runtime.operations.runReset();

  assert.equal(preservedWriteAttempts, 1);
  assert.equal(result.status, "partial-failure");
  assert.deepEqual(result.failedParticipantIds, ["care"]);
});

test("Care commit reports null and undefined rejection values as partial failures", async () => {
  for (const rejection of [undefined, null] as const) {
    const runtime = createLocalDataResetRuntime(createStorageAdapter());
    for (const id of REQUIRED_LOCAL_DATA_PARTICIPANT_IDS) {
      runtime.attachRequiredParticipant(
        id,
        id === "care"
          ? {
              prepare: async () => {},
              commit: async () => {
                throw rejection;
              },
            }
          : { prepare: async () => {}, commit: async () => {} },
      );
    }

    const result = await runtime.operations.runReset();

    assert.equal(
      result.status,
      "partial-failure",
      `Care rejection ${String(rejection)} must not report reset complete`,
    );
    assert.deepEqual(result.failedParticipantIds, ["care"]);
  }
});

test("a reset fences a second runtime so it cannot recreate deleted local data", async () => {
  const adapter = createStorageAdapter();
  const deletingRuntime = createLocalDataResetRuntime(adapter, {
    enableDurableEpoch: true,
  });
  const staleRuntime = createLocalDataResetRuntime(adapter, {
    enableDurableEpoch: true,
  });
  attachAllRequiredNoOps(deletingRuntime);

  await staleRuntime.removableStorage.setItem("care", "before-reset");
  deletingRuntime.registerParticipant({
    id: "physical-delete-proof",
    prepare: async () => {},
    commit: async () => {
      await adapter.removeItem("care");
    },
  });

  assert.equal((await deletingRuntime.operations.runReset()).status, "complete");
  assert.equal(adapter.values.has("care"), false);
  await assert.rejects(
    staleRuntime.removableStorage.setItem("care", "resurrected"),
    StaleLocalDataRuntimeError,
  );
  assert.equal(adapter.values.has("care"), false);

  await deletingRuntime.removableStorage.setItem("care", "new-owner-data");
  assert.equal(adapter.values.get("care"), "new-owner-data");
  assert.equal(adapter.values.get(LOCAL_DATA_RESET_EPOCH_KEY), "1");
});

test("the web lock and durable epoch fence stale writers across distinct tab adapters", async () => {
  const values = new Map<string, string>();
  const createTabAdapter = (): LocalDataStorageAdapter => ({
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  });
  let lockTail = Promise.resolve();
  const webLockManager: LocalDataResetWebLockManager = {
    request<T>(_name, _options, callback): Promise<T> {
      const request = lockTail.then(callback);
      lockTail = request.then(
        () => {},
        () => {},
      );
      return request;
    },
  };
  const deletingAdapter = createTabAdapter();
  const deletingRuntime = createLocalDataResetRuntime(deletingAdapter, {
    requireWebLock: true,
    webLockManager,
  });
  const staleRuntime = createLocalDataResetRuntime(createTabAdapter(), {
    requireWebLock: true,
    webLockManager,
  });
  attachAllRequiredNoOps(deletingRuntime);

  await staleRuntime.removableStorage.setItem("care", "tab-b-before-reset");
  deletingRuntime.registerParticipant({
    id: "physical-delete-proof",
    prepare: async () => {},
    commit: async () => deletingAdapter.removeItem("care"),
  });
  assert.equal((await deletingRuntime.operations.runReset()).status, "complete");

  await assert.rejects(
    staleRuntime.removableStorage.setItem("care", "tab-b-resurrection"),
    StaleLocalDataRuntimeError,
  );
  assert.equal(values.has("care"), false);

  const freshRuntime = createLocalDataResetRuntime(createTabAdapter(), {
    requireWebLock: true,
    webLockManager,
  });
  await freshRuntime.removableStorage.setItem("care", "tab-c-after-reset");
  assert.equal(values.get("care"), "tab-c-after-reset");
});

test("a web runtime created while reset holds the lock cannot queue a post-delete resurrection", async () => {
  const values = new Map<string, string>([["care", "before-reset"]]);
  const createTabAdapter = (): LocalDataStorageAdapter => ({
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  });
  let lockTail = Promise.resolve();
  const webLockManager: LocalDataResetWebLockManager = {
    request<T>(_name, _options, callback): Promise<T> {
      const request = lockTail.then(callback);
      lockTail = request.then(
        () => {},
        () => {},
      );
      return request;
    },
  };
  const deletionPaused = deferred<void>();
  const deletionEntered = deferred<void>();
  const deletingRuntime = createLocalDataResetRuntime(createTabAdapter(), {
    requireWebLock: true,
    webLockManager,
  });
  attachAllRequiredNoOps(deletingRuntime);
  deletingRuntime.registerParticipant({
    id: "physical-delete-proof",
    prepare: async () => {},
    commit: async () => {
      deletionEntered.resolve();
      await deletionPaused.promise;
      values.delete("care");
    },
  });

  const reset = deletingRuntime.operations.runReset();
  await deletionEntered.promise;
  const midResetRuntime = createLocalDataResetRuntime(createTabAdapter(), {
    requireWebLock: true,
    webLockManager,
  });
  const queuedWrite = midResetRuntime.removableStorage.setItem(
    "care",
    "resurrected-after-delete",
  );
  await Promise.resolve();
  await Promise.resolve();

  deletionPaused.resolve();
  assert.equal((await reset).status, "complete");
  await assert.rejects(queuedWrite, StaleLocalDataRuntimeError);
  assert.equal(values.has("care"), false);
});

test("a web runtime created after epoch publication still cannot write before the reset marker clears", async () => {
  const values = new Map<string, string>([["care", "before-reset"]]);
  const markerRemovalEntered = deferred<void>();
  const allowMarkerRemoval = deferred<void>();
  const createTabAdapter = (): LocalDataStorageAdapter => ({
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      if (key === LOCAL_DATA_RESET_IN_PROGRESS_KEY) {
        markerRemovalEntered.resolve();
        await allowMarkerRemoval.promise;
      }
      values.delete(key);
    },
  });
  let lockTail = Promise.resolve();
  const webLockManager: LocalDataResetWebLockManager = {
    request<T>(_name, _options, callback): Promise<T> {
      const request = lockTail.then(callback);
      lockTail = request.then(
        () => {},
        () => {},
      );
      return request;
    },
  };
  const deletingRuntime = createLocalDataResetRuntime(createTabAdapter(), {
    requireWebLock: true,
    webLockManager,
  });
  attachAllRequiredNoOps(deletingRuntime);
  deletingRuntime.registerParticipant({
    id: "physical-delete-proof",
    prepare: async () => {},
    commit: async () => {
      values.delete("care");
    },
  });

  const reset = deletingRuntime.operations.runReset();
  await markerRemovalEntered.promise;
  assert.equal(values.get(LOCAL_DATA_RESET_EPOCH_KEY), "1");
  assert.equal(values.get(LOCAL_DATA_RESET_IN_PROGRESS_KEY), "active");
  const midFinalizeRuntime = createLocalDataResetRuntime(createTabAdapter(), {
    requireWebLock: true,
    webLockManager,
  });
  const queuedWrite = midFinalizeRuntime.removableStorage.setItem(
    "care",
    "resurrected-during-finalization",
  );
  await Promise.resolve();
  await Promise.resolve();

  allowMarkerRemoval.resolve();
  assert.equal((await reset).status, "complete");
  await assert.rejects(queuedWrite, StaleLocalDataRuntimeError);
  assert.equal(values.has("care"), false);
  assert.equal(values.has(LOCAL_DATA_RESET_IN_PROGRESS_KEY), false);
});

test("a failed final epoch write cannot report a completed reset and leaves the durable marker fail-closed", async () => {
  const adapter = createStorageAdapter();
  adapter.values.set("care", "before-reset");
  const originalSetItem = adapter.setItem;
  adapter.setItem = async (key, value) => {
    if (key === LOCAL_DATA_RESET_EPOCH_KEY) {
      throw new Error("epoch persistence denied");
    }
    await originalSetItem(key, value);
  };
  const runtime = createLocalDataResetRuntime(adapter, {
    enableDurableEpoch: true,
  });
  attachAllRequiredNoOps(runtime);
  runtime.registerParticipant({
    id: "physical-delete-proof",
    prepare: async () => {},
    commit: async () => {
      adapter.values.delete("care");
    },
  });

  await assert.rejects(
    runtime.operations.runReset(),
    /epoch persistence denied/,
  );
  assert.deepEqual(runtime.operations.getState(), {
    status: "failed",
    operation: "delete",
    failedParticipantIds: [],
  });
  assert.equal(adapter.values.has("care"), false);
  assert.equal(
    adapter.values.get(LOCAL_DATA_RESET_IN_PROGRESS_KEY),
    "active",
  );
  await assert.rejects(
    runtime.removableStorage.setItem("care", "must-not-reappear"),
    StaleLocalDataRuntimeError,
  );
  assert.equal(adapter.values.has("care"), false);
});

test("a failed reset-marker write starts zero destructive commits", async () => {
  const adapter = createStorageAdapter();
  adapter.values.set("care", "must-survive");
  const originalSetItem = adapter.setItem;
  adapter.setItem = async (key, value) => {
    if (key === LOCAL_DATA_RESET_IN_PROGRESS_KEY) {
      throw new Error("reset marker persistence denied");
    }
    await originalSetItem(key, value);
  };
  const runtime = createLocalDataResetRuntime(adapter, {
    enableDurableEpoch: true,
  });
  attachAllRequiredNoOps(runtime);
  let destructiveCommits = 0;
  runtime.registerParticipant({
    id: "physical-delete-proof",
    prepare: async () => {},
    commit: async () => {
      destructiveCommits += 1;
      adapter.values.delete("care");
    },
  });

  await assert.rejects(
    runtime.operations.runReset(),
    /reset marker persistence denied/,
  );
  assert.equal(destructiveCommits, 0);
  assert.equal(adapter.values.get("care"), "must-survive");
  assert.equal(adapter.values.has(LOCAL_DATA_RESET_EPOCH_KEY), false);
  assert.deepEqual(runtime.operations.getState(), {
    status: "failed",
    operation: "delete",
    failedParticipantIds: [],
  });
});

test("a failed reset-marker clear cannot report complete and leaves writes fail-closed", async () => {
  const adapter = createStorageAdapter();
  adapter.values.set("care", "before-reset");
  const originalRemoveItem = adapter.removeItem;
  adapter.removeItem = async (key) => {
    if (key === LOCAL_DATA_RESET_IN_PROGRESS_KEY) {
      throw new Error("reset marker removal denied");
    }
    await originalRemoveItem(key);
  };
  const runtime = createLocalDataResetRuntime(adapter, {
    enableDurableEpoch: true,
  });
  attachAllRequiredNoOps(runtime);
  runtime.registerParticipant({
    id: "physical-delete-proof",
    prepare: async () => {},
    commit: async () => {
      adapter.values.delete("care");
    },
  });

  await assert.rejects(
    runtime.operations.runReset(),
    /reset marker removal denied/,
  );
  assert.equal(adapter.values.get(LOCAL_DATA_RESET_EPOCH_KEY), "1");
  assert.equal(
    adapter.values.get(LOCAL_DATA_RESET_IN_PROGRESS_KEY),
    "active",
  );
  assert.equal(adapter.values.has("care"), false);
  assert.deepEqual(runtime.operations.getState(), {
    status: "failed",
    operation: "delete",
    failedParticipantIds: [],
  });
  await assert.rejects(
    runtime.removableStorage.setItem("care", "must-not-reappear"),
    StaleLocalDataRuntimeError,
  );
  assert.equal(adapter.values.has("care"), false);
});

test("a later explicit reset recovers a durable marker left by interrupted finalization", async () => {
  const adapter = createStorageAdapter();
  adapter.values.set(LOCAL_DATA_RESET_EPOCH_KEY, "4");
  adapter.values.set(LOCAL_DATA_RESET_IN_PROGRESS_KEY, "active");
  adapter.values.set("care", "survived-interrupted-reset");
  const runtime = createLocalDataResetRuntime(adapter, {
    enableDurableEpoch: true,
  });
  attachAllRequiredNoOps(runtime);
  runtime.registerParticipant({
    id: "physical-delete-proof",
    prepare: async () => {},
    commit: async () => {
      adapter.values.delete("care");
    },
  });

  await assert.rejects(
    runtime.removableStorage.setItem("care", "blocked-before-recovery"),
    StaleLocalDataRuntimeError,
  );
  assert.equal((await runtime.operations.runReset()).status, "complete");
  assert.equal(adapter.values.get(LOCAL_DATA_RESET_EPOCH_KEY), "5");
  assert.equal(adapter.values.has(LOCAL_DATA_RESET_IN_PROGRESS_KEY), false);
  assert.equal(adapter.values.has("care"), false);

  await runtime.removableStorage.setItem("care", "fresh-after-recovery");
  assert.equal(adapter.values.get("care"), "fresh-after-recovery");
});

test("an explicit reset recovers a malformed durable marker while normal writes stay fail-closed", async () => {
  const adapter = createStorageAdapter();
  adapter.values.set(LOCAL_DATA_RESET_EPOCH_KEY, "7");
  adapter.values.set(LOCAL_DATA_RESET_IN_PROGRESS_KEY, "damaged-marker");
  adapter.values.set("care", "must-be-deleted");
  const runtime = createLocalDataResetRuntime(adapter, {
    enableDurableEpoch: true,
  });
  attachAllRequiredNoOps(runtime);
  runtime.registerParticipant({
    id: "physical-delete-proof",
    prepare: async () => {},
    commit: async () => {
      adapter.values.delete("care");
    },
  });

  await assert.rejects(
    runtime.removableStorage.setItem("care", "blocked-before-recovery"),
    StaleLocalDataRuntimeError,
  );
  assert.equal((await runtime.operations.runReset()).status, "complete");
  assert.equal(adapter.values.get(LOCAL_DATA_RESET_EPOCH_KEY), "8");
  assert.equal(adapter.values.has(LOCAL_DATA_RESET_IN_PROGRESS_KEY), false);
  assert.equal(adapter.values.has("care"), false);
});

test("a partial reset still closes the durable fence and stales older runtimes", async () => {
  const adapter = createStorageAdapter();
  adapter.values.set("care", "before-partial-reset");
  const deletingRuntime = createLocalDataResetRuntime(adapter, {
    enableDurableEpoch: true,
  });
  const staleRuntime = createLocalDataResetRuntime(adapter, {
    enableDurableEpoch: true,
  });
  for (const id of REQUIRED_LOCAL_DATA_PARTICIPANT_IDS) {
    deletingRuntime.attachRequiredParticipant(
      id,
      id === "query-cache"
        ? {
            prepare: async () => {},
            commit: async () => {
              throw new Error("cache clear denied");
            },
          }
        : { prepare: async () => {}, commit: async () => {} },
    );
  }
  deletingRuntime.registerParticipant({
    id: "physical-delete-proof",
    prepare: async () => {},
    commit: async () => {
      adapter.values.delete("care");
    },
  });

  const result = await deletingRuntime.operations.runReset();

  assert.equal(result.status, "partial-failure");
  assert.deepEqual(result.failedParticipantIds, ["query-cache"]);
  assert.equal(adapter.values.get(LOCAL_DATA_RESET_EPOCH_KEY), "1");
  assert.equal(adapter.values.has(LOCAL_DATA_RESET_IN_PROGRESS_KEY), false);
  await assert.rejects(
    staleRuntime.removableStorage.setItem("care", "stale-after-partial"),
    StaleLocalDataRuntimeError,
  );
  assert.equal(adapter.values.has("care"), false);
});

test("a web reset waits for an export already sharing from another tab", async () => {
  const values = new Map<string, string>();
  const createTabAdapter = (): LocalDataStorageAdapter => ({
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  });
  let lockTail = Promise.resolve();
  let activeLocks = 0;
  let maxActiveLocks = 0;
  const webLockManager: LocalDataResetWebLockManager = {
    request<T>(_name, _options, callback): Promise<T> {
      const request = lockTail.then(async () => {
        activeLocks += 1;
        maxActiveLocks = Math.max(maxActiveLocks, activeLocks);
        try {
          return await callback();
        } finally {
          activeLocks -= 1;
        }
      });
      lockTail = request.then(
        () => {},
        () => {},
      );
      return request;
    },
  };
  const deletingRuntime = createLocalDataResetRuntime(createTabAdapter(), {
    requireWebLock: true,
    webLockManager,
  });
  const exportingRuntime = createLocalDataResetRuntime(createTabAdapter(), {
    requireWebLock: true,
    webLockManager,
  });
  attachAllRequiredNoOps(deletingRuntime);
  const share = deferred<void>();
  const events: string[] = [];
  const exported = exportingRuntime.operations.runExport(
    () => {
      events.push("export:capture");
      return Object.freeze({ privateCare: "before-reset" });
    },
    async (captured) => {
      events.push(`export:share:${captured.privateCare}`);
      await share.promise;
      events.push("export:complete");
    },
  );
  while (!events.includes("export:share:before-reset")) await Promise.resolve();
  const exportHeldCrossTabLock = activeLocks === 1;

  let resetSettled = false;
  const reset = deletingRuntime.operations.runReset().then((result) => {
    resetSettled = true;
    events.push("reset:complete");
    return result;
  });
  for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
  const resetWasHeld = !resetSettled;

  share.resolve();
  await exported;
  assert.equal((await reset).status, "complete");
  assert.equal(exportHeldCrossTabLock, true);
  assert.equal(resetWasHeld, true);
  assert.equal(maxActiveLocks, 1);
  assert.ok(events.indexOf("export:complete") < events.indexOf("reset:complete"));
});

test("a stale web tab cannot share an export captured after another tab resets", async () => {
  const values = new Map<string, string>();
  const createTabAdapter = (): LocalDataStorageAdapter => ({
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  });
  let lockTail = Promise.resolve();
  const webLockManager: LocalDataResetWebLockManager = {
    request<T>(_name, _options, callback): Promise<T> {
      const request = lockTail.then(callback);
      lockTail = request.then(
        () => {},
        () => {},
      );
      return request;
    },
  };
  const deletingRuntime = createLocalDataResetRuntime(createTabAdapter(), {
    requireWebLock: true,
    webLockManager,
  });
  const staleRuntime = createLocalDataResetRuntime(createTabAdapter(), {
    requireWebLock: true,
    webLockManager,
  });
  attachAllRequiredNoOps(deletingRuntime);

  assert.equal((await deletingRuntime.operations.runReset()).status, "complete");
  let captures = 0;
  let shares = 0;
  await assert.rejects(
    staleRuntime.operations.runExport(
      () => {
        captures += 1;
        return Object.freeze({ privateCare: "stale" });
      },
      async () => {
        shares += 1;
      },
    ),
    StaleLocalDataRuntimeError,
  );
  assert.equal(captures, 1);
  assert.equal(shares, 0);
});

test("a reset waits for an accepted write in another runtime before deleting it", async () => {
  const acceptedWrite = deferred<void>();
  const values = new Map<string, string>();
  const adapter: LocalDataStorageAdapter = {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
      if (key === "care" && value === "accepted-before-reset") {
        await acceptedWrite.promise;
      }
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
  const deletingRuntime = createLocalDataResetRuntime(adapter, {
    enableDurableEpoch: true,
  });
  const writingRuntime = createLocalDataResetRuntime(adapter, {
    enableDurableEpoch: true,
  });
  attachAllRequiredNoOps(deletingRuntime);
  deletingRuntime.registerParticipant({
    id: "physical-delete-proof",
    prepare: async () => {},
    commit: async () => {
      await adapter.removeItem("care");
    },
  });

  const write = writingRuntime.removableStorage.setItem(
    "care",
    "accepted-before-reset",
  );
  await Promise.resolve();
  const reset = deletingRuntime.operations.runReset();
  let resetSettled = false;
  void reset.then(() => {
    resetSettled = true;
  });
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  assert.equal(resetSettled, false);

  acceptedWrite.resolve();
  await write;
  assert.equal((await reset).status, "complete");
  assert.equal(values.has("care"), false);
});

test("web reset fails closed before deletion when the cross-tab lock is unavailable", async () => {
  const adapter = createStorageAdapter();
  adapter.values.set("care", "must-survive-failed-reset");
  const runtime = createLocalDataResetRuntime(adapter, {
    requireWebLock: true,
    webLockManager: null,
  });
  attachAllRequiredNoOps(runtime);
  let commits = 0;
  runtime.registerParticipant({
    id: "physical-delete-proof",
    prepare: async () => {},
    commit: async () => {
      commits += 1;
      await adapter.removeItem("care");
    },
  });

  await assert.rejects(runtime.operations.runReset(), /no local data was deleted/i);
  assert.equal(commits, 0);
  assert.equal(adapter.values.get("care"), "must-survive-failed-reset");
  assert.equal(adapter.values.has(LOCAL_DATA_RESET_EPOCH_KEY), false);
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
  attachFutureRequiredNoOps(runtime);

  const first = runtime.operations.runReset();
  const second = runtime.operations.runReset();

  assert.strictEqual(second, first);

  preparation.resolve();
  await first;
});

test("an accepted preference save holds prepare open and a late save is rejected", async () => {
  const acceptedWrite = deferred<void>();
  const physicalWrites: string[] = [];
  let physicalEpoch: string | null = null;
  const runtime = createLocalDataResetRuntime({
    getItem: async (key) =>
      key === LOCAL_DATA_RESET_EPOCH_KEY ? physicalEpoch : null,
    setItem: async (key, value) => {
      if (key === LOCAL_DATA_RESET_EPOCH_KEY) {
        physicalEpoch = value;
        return;
      }
      physicalWrites.push(value);
      if (value === "accepted") await acceptedWrite.promise;
    },
    removeItem: async () => {},
  });
  attachAllRequiredNoOps(runtime);
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
  let physicalEpoch: string | null = null;
  const adapter: LocalDataStorageAdapter = {
    getItem(key) {
      if (key === LOCAL_DATA_RESET_EPOCH_KEY) {
        return Promise.resolve(physicalEpoch);
      }
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
    async setItem(key, value) {
      if (key === LOCAL_DATA_RESET_EPOCH_KEY) physicalEpoch = value;
    },
    async removeItem() {},
  };
  runtime = createLocalDataResetRuntime(adapter);
  attachAllRequiredNoOps(runtime);
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
  let physicalEpoch: string | null = null;
  const runtime = createLocalDataResetRuntime({
    getItem(key) {
      if (key === LOCAL_DATA_RESET_EPOCH_KEY) {
        return Promise.resolve(physicalEpoch);
      }
      readStarted = true;
      return read.promise;
    },
    async setItem(key, value) {
      if (key === LOCAL_DATA_RESET_EPOCH_KEY) physicalEpoch = value;
    },
    async removeItem() {},
  });
  attachAllRequiredNoOps(runtime);
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
  attachAllRequiredNoOps(runtime);
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
