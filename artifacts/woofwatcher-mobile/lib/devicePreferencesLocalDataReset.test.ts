import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEVICE_PREFERENCE_RESET_KEYS,
  HOME_WELCOME_DISMISSED_KEY,
  LEGACY_PWA_THEME_KEY,
  MOBILE_QA_SESSION_STORAGE_KEY,
  PACK_SUPPLIES_KEY,
  TRAVEL_BAG_KEY,
  createDevicePreferencesStore,
  type DevicePreferenceResetKey,
} from "./devicePreferences.ts";
import type { GenerationPermit } from "./generationPermit.ts";
import { createLocalDataResetRuntime } from "./localDataResetRuntime.ts";

type ResetModule =
  typeof import("./devicePreferencesLocalDataReset.ts");

const resetModulePromise: Promise<Partial<ResetModule>> = import(
  "./devicePreferencesLocalDataReset.ts"
).catch(() => ({}));

async function loadResetModule(): Promise<ResetModule> {
  const resetModule = await resetModulePromise;
  assert.equal(
    typeof resetModule.createDevicePreferencesLocalDataResetController,
    "function",
    "device-preferences reset controller must exist",
  );
  assert.equal(
    typeof resetModule.DevicePreferencesLocalDataResetCommitError,
    "function",
    "device-preferences reset error must exist",
  );
  return resetModule as ResetModule;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate: () => boolean, message: string) {
  for (let turn = 0; turn < 100 && !predicate(); turn += 1) {
    await Promise.resolve();
  }
  assert.equal(predicate(), true, message);
}

function attachPeerNoOps(
  runtime: ReturnType<typeof createLocalDataResetRuntime>,
) {
  runtime.attachRequiredParticipant("care", {
    prepare: async () => {},
    commit: async () => {},
  });
  runtime.attachRequiredParticipant("avatar", {
    prepare: async () => {},
    commit: async () => {},
  });
}

test("owns the exact frozen five-key destructive manifest in removal order", async () => {
  const { createDevicePreferencesLocalDataResetController } =
    await loadResetModule();
  const removals: string[] = [];
  const controller = createDevicePreferencesLocalDataResetController({
    removeItem: async (key) => {
      removals.push(key);
    },
  });

  assert.deepEqual(DEVICE_PREFERENCE_RESET_KEYS, [
    HOME_WELCOME_DISMISSED_KEY,
    MOBILE_QA_SESSION_STORAGE_KEY,
    PACK_SUPPLIES_KEY,
    TRAVEL_BAG_KEY,
    LEGACY_PWA_THEME_KEY,
  ]);
  assert.equal(Object.isFrozen(DEVICE_PREFERENCE_RESET_KEYS), true);

  await controller.participant.prepare();
  await controller.participant.commit();

  assert.deepEqual(removals, [
    HOME_WELCOME_DISMISSED_KEY,
    MOBILE_QA_SESSION_STORAGE_KEY,
    PACK_SUPPLIES_KEY,
    TRAVEL_BAG_KEY,
    LEGACY_PWA_THEME_KEY,
  ]);
});

test("prepare is fresh and nondestructive", async () => {
  const { createDevicePreferencesLocalDataResetController } =
    await loadResetModule();
  const removals: string[] = [];
  const controller = createDevicePreferencesLocalDataResetController({
    removeItem: async (key) => {
      removals.push(key);
    },
  });

  await controller.participant.prepare();
  await controller.participant.prepare();

  assert.deepEqual(removals, []);
});

test("a synchronous first removal throw still starts all five calls before commit settles", async () => {
  const {
    DevicePreferencesLocalDataResetCommitError,
    createDevicePreferencesLocalDataResetController,
  } = await loadResetModule();
  const delayedRemoval = deferred<void>();
  const attempts: DevicePreferenceResetKey[] = [];
  const controller = createDevicePreferencesLocalDataResetController({
    removeItem: ((key: DevicePreferenceResetKey) => {
      attempts.push(key);
      if (key === HOME_WELCOME_DISMISSED_KEY) {
        throw new Error("synchronous removal failure");
      }
      if (key === MOBILE_QA_SESSION_STORAGE_KEY) {
        return delayedRemoval.promise;
      }
      return Promise.resolve();
    }) as Parameters<
      typeof createDevicePreferencesLocalDataResetController
    >[0]["removeItem"],
  });
  await controller.participant.prepare();

  let commit!: Promise<void>;
  assert.doesNotThrow(() => {
    commit = controller.participant.commit();
  });
  assert.ok(commit instanceof Promise);
  assert.deepEqual(attempts, [...DEVICE_PREFERENCE_RESET_KEYS]);
  let settled = false;
  void commit.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await Promise.resolve();
  assert.equal(settled, false);

  delayedRemoval.resolve();
  await assert.rejects(commit, DevicePreferencesLocalDataResetCommitError);
});

test("out-of-order failures report copied frozen keys in manifest order", async () => {
  const {
    DevicePreferencesLocalDataResetCommitError,
    createDevicePreferencesLocalDataResetController,
  } = await loadResetModule();
  const homeFailure = deferred<void>();
  const travelFailure = deferred<void>();
  const controller = createDevicePreferencesLocalDataResetController({
    removeItem: (key) => {
      if (key === HOME_WELCOME_DISMISSED_KEY) return homeFailure.promise;
      if (key === TRAVEL_BAG_KEY) return travelFailure.promise;
      return Promise.resolve();
    },
  });
  await controller.participant.prepare();
  const commit = controller.participant.commit();

  travelFailure.reject(new Error("travel failed first"));
  await Promise.resolve();
  homeFailure.reject(new Error("home failed later"));

  await assert.rejects(commit, (error) => {
    assert.ok(error instanceof DevicePreferencesLocalDataResetCommitError);
    assert.deepEqual(error.failedKeys, [
      HOME_WELCOME_DISMISSED_KEY,
      TRAVEL_BAG_KEY,
    ]);
    assert.equal(Object.isFrozen(error.failedKeys), true);
    assert.notStrictEqual(error.failedKeys, DEVICE_PREFERENCE_RESET_KEYS);
    assert.throws(
      () =>
        (error.failedKeys as DevicePreferenceResetKey[]).push(
          PACK_SUPPLIES_KEY,
        ),
      TypeError,
    );
    return true;
  });

  const mutableFailedKeys: DevicePreferenceResetKey[] = [
    MOBILE_QA_SESSION_STORAGE_KEY,
  ];
  const copiedError = new DevicePreferencesLocalDataResetCommitError(
    mutableFailedKeys,
  );
  mutableFailedKeys[0] = PACK_SUPPLIES_KEY;
  mutableFailedKeys.push(TRAVEL_BAG_KEY);
  assert.deepEqual(copiedError.failedKeys, [MOBILE_QA_SESSION_STORAGE_KEY]);
  assert.equal(Object.isFrozen(copiedError.failedKeys), true);
});

test("commit consumes one preparation and every misuse rejects as a Promise", async () => {
  const { createDevicePreferencesLocalDataResetController } =
    await loadResetModule();
  const firstRemoval = deferred<void>();
  let removalCount = 0;
  const controller = createDevicePreferencesLocalDataResetController({
    removeItem: (key) => {
      removalCount += 1;
      return key === HOME_WELCOME_DISMISSED_KEY
        ? firstRemoval.promise
        : Promise.resolve();
    },
  });

  let beforePrepare!: Promise<void>;
  assert.doesNotThrow(() => {
    beforePrepare = controller.participant.commit();
  });
  assert.ok(beforePrepare instanceof Promise);
  await assert.rejects(beforePrepare, /not prepared/i);
  assert.equal(removalCount, 0);

  await controller.participant.prepare();
  const firstCommit = controller.participant.commit();
  assert.equal(removalCount, 5);

  let concurrentCommit!: Promise<void>;
  assert.doesNotThrow(() => {
    concurrentCommit = controller.participant.commit();
  });
  assert.ok(concurrentCommit instanceof Promise);
  await assert.rejects(concurrentCommit, /not prepared|in progress/i);

  let overlappingPrepare!: Promise<void>;
  assert.doesNotThrow(() => {
    overlappingPrepare = controller.participant.prepare();
  });
  assert.ok(overlappingPrepare instanceof Promise);
  await assert.rejects(overlappingPrepare, /in progress/i);

  let afterRejectedPrepare!: Promise<void>;
  assert.doesNotThrow(() => {
    afterRejectedPrepare = controller.participant.commit();
  });
  await assert.rejects(afterRejectedPrepare, /not prepared|in progress/i);
  assert.equal(removalCount, 5);

  firstRemoval.resolve();
  await firstCommit;
  await assert.rejects(controller.participant.commit(), /not prepared/i);
  assert.equal(removalCount, 5);
});

test("a removal callback cannot reentrantly prepare or commit overlapping work", async () => {
  const { createDevicePreferencesLocalDataResetController } =
    await loadResetModule();
  let removalCount = 0;
  let reentrantPrepare!: Promise<void>;
  let reentrantCommit!: Promise<void>;
  let controller!: ReturnType<
    typeof createDevicePreferencesLocalDataResetController
  >;
  controller = createDevicePreferencesLocalDataResetController({
    removeItem: async (key) => {
      removalCount += 1;
      if (key !== HOME_WELCOME_DISMISSED_KEY) return;
      assert.doesNotThrow(() => {
        reentrantPrepare = controller.participant.prepare();
        reentrantCommit = controller.participant.commit();
      });
      void reentrantPrepare.catch(() => {});
      void reentrantCommit.catch(() => {});
    },
  });
  await controller.participant.prepare();

  await controller.participant.commit();

  assert.ok(reentrantPrepare instanceof Promise);
  assert.ok(reentrantCommit instanceof Promise);
  await assert.rejects(reentrantPrepare, /in progress/i);
  await assert.rejects(reentrantCommit, /in progress/i);
  assert.equal(removalCount, 5);
  await assert.rejects(controller.participant.commit(), /not prepared/i);
  assert.equal(removalCount, 5);
});

test("a fresh preparation retries all exact keys after a failed commit", async () => {
  const {
    DevicePreferencesLocalDataResetCommitError,
    createDevicePreferencesLocalDataResetController,
  } = await loadResetModule();
  let fail = true;
  const attempts: string[] = [];
  const controller = createDevicePreferencesLocalDataResetController({
    removeItem: async (key) => {
      attempts.push(key);
      if (fail && key === PACK_SUPPLIES_KEY) {
        throw new Error("first attempt failed");
      }
    },
  });

  await controller.participant.prepare();
  await assert.rejects(
    controller.participant.commit(),
    DevicePreferencesLocalDataResetCommitError,
  );
  fail = false;
  await controller.participant.prepare();
  await controller.participant.commit();

  assert.deepEqual(attempts, [
    ...DEVICE_PREFERENCE_RESET_KEYS,
    ...DEVICE_PREFERENCE_RESET_KEYS,
  ]);
});

test("runtime drains an accepted preference save before invalidation and raw removal", async () => {
  const { createDevicePreferencesLocalDataResetController } =
    await loadResetModule();
  const acceptedWrite = deferred<void>();
  const values = new Map<string, string>();
  const events: string[] = [];
  let runtime!: ReturnType<typeof createLocalDataResetRuntime>;
  let oldPermit!: GenerationPermit;
  const adapter = {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      events.push("save:start");
      await acceptedWrite.promise;
      values.set(key, value);
      events.push("save:settled");
    },
    async removeItem(key) {
      events.push(
        `remove:${key}:old-permit-${
          runtime.generationAuthority.isValid(oldPermit) ? "valid" : "invalid"
        }`,
      );
      values.delete(key);
    },
  };
  runtime = createLocalDataResetRuntime(adapter);
  attachPeerNoOps(runtime);
  const controller = createDevicePreferencesLocalDataResetController({
    removeItem: (key) => adapter.removeItem(key),
  });
  runtime.attachRequiredParticipant(
    "device-preferences",
    controller.participant,
  );
  const store = createDevicePreferencesStore(runtime.removableStorage);
  oldPermit = runtime.generationAuthority.capture();
  const save = store.save(HOME_WELCOME_DISMISSED_KEY, "accepted");
  await waitFor(
    () => events.includes("save:start"),
    "accepted preference save did not start",
  );

  const reset = runtime.operations.runReset();
  assert.equal(runtime.operations.isWriteAdmissionOpen(), false);
  assert.equal(runtime.generationAuthority.isValid(oldPermit), true);
  assert.deepEqual(events, ["save:start"]);

  acceptedWrite.resolve();
  await save;
  const result = await reset;

  assert.equal(result.status, "complete");
  assert.equal(runtime.generationAuthority.isValid(oldPermit), false);
  assert.equal(values.has(HOME_WELCOME_DISMISSED_KEY), false);
  assert.deepEqual(events, [
    "save:start",
    "save:settled",
    ...DEVICE_PREFERENCE_RESET_KEYS.map(
      (key) => `remove:${key}:old-permit-invalid`,
    ),
  ]);
});

test("an accepted write rejection drains to quiescence and reset still removes preferences", async () => {
  const { createDevicePreferencesLocalDataResetController } =
    await loadResetModule();
  const acceptedWrite = deferred<void>();
  const failure = new Error("accepted write failed");
  const removals: string[] = [];
  let writeStarted = false;
  const adapter = {
    async getItem() {
      return null;
    },
    async setItem() {
      writeStarted = true;
      await acceptedWrite.promise;
      throw failure;
    },
    async removeItem(key) {
      removals.push(key);
    },
  };
  const runtime = createLocalDataResetRuntime(adapter);
  attachPeerNoOps(runtime);
  const controller = createDevicePreferencesLocalDataResetController({
    removeItem: (key) => adapter.removeItem(key),
  });
  runtime.attachRequiredParticipant(
    "device-preferences",
    controller.participant,
  );
  const store = createDevicePreferencesStore(runtime.removableStorage);
  const save = store.save(HOME_WELCOME_DISMISSED_KEY, "will reject");
  await waitFor(
    () => writeStarted,
    "accepted preference write did not reach the raw adapter",
  );
  const reset = runtime.operations.runReset();

  acceptedWrite.resolve();
  await assert.rejects(save, (error) => error === failure);
  const result = await reset;

  assert.equal(result.status, "complete");
  assert.deepEqual(removals, [...DEVICE_PREFERENCE_RESET_KEYS]);
});

test("a peer preparation failure performs zero preference destruction and retry succeeds", async () => {
  const { createDevicePreferencesLocalDataResetController } =
    await loadResetModule();
  const removals: string[] = [];
  let blockPrepare = true;
  const runtime = createLocalDataResetRuntime({
    async getItem() {
      return null;
    },
    async setItem() {},
    async removeItem() {},
  });
  attachPeerNoOps(runtime);
  const controller = createDevicePreferencesLocalDataResetController({
    removeItem: async (key) => {
      removals.push(key);
    },
  });
  runtime.attachRequiredParticipant(
    "device-preferences",
    controller.participant,
  );
  runtime.registerParticipant({
    id: "blocked-peer",
    async prepare() {
      if (blockPrepare) throw new Error("not ready");
    },
    async commit() {},
  });

  assert.deepEqual(await runtime.operations.runReset(), {
    status: "partial-failure",
    committedParticipantIds: [],
    failedParticipantIds: ["blocked-peer"],
  });
  assert.deepEqual(removals, []);

  blockPrepare = false;
  assert.equal((await runtime.operations.runReset()).status, "complete");
  assert.deepEqual(removals, [...DEVICE_PREFERENCE_RESET_KEYS]);
});

test("peer commit failures do not skip preference removals", async () => {
  const { createDevicePreferencesLocalDataResetController } =
    await loadResetModule();
  const removals: string[] = [];
  const runtime = createLocalDataResetRuntime({
    async getItem() {
      return null;
    },
    async setItem() {},
    async removeItem() {},
  });
  runtime.attachRequiredParticipant("avatar", {
    prepare: async () => {},
    commit: async () => {
      throw new Error("avatar commit failed");
    },
  });
  runtime.attachRequiredParticipant("care", {
    prepare: async () => {},
    commit: async () => {
      throw new Error("care commit failed");
    },
  });
  const controller = createDevicePreferencesLocalDataResetController({
    removeItem: async (key) => {
      removals.push(key);
    },
  });
  runtime.attachRequiredParticipant(
    "device-preferences",
    controller.participant,
  );

  const result = await runtime.operations.runReset();

  assert.deepEqual(removals, [...DEVICE_PREFERENCE_RESET_KEYS]);
  assert.deepEqual(result, {
    status: "partial-failure",
    committedParticipantIds: ["device-preferences", "work-drain"],
    failedParticipantIds: ["avatar", "care"],
  });
});

test("preference failure remains visible without hiding peer commit results", async () => {
  const { createDevicePreferencesLocalDataResetController } =
    await loadResetModule();
  const runtime = createLocalDataResetRuntime({
    async getItem() {
      return null;
    },
    async setItem() {},
    async removeItem() {},
  });
  runtime.attachRequiredParticipant("avatar", {
    prepare: async () => {},
    commit: async () => {
      throw new Error("avatar failed");
    },
  });
  runtime.attachRequiredParticipant("care", {
    prepare: async () => {},
    commit: async () => {},
  });
  const controller = createDevicePreferencesLocalDataResetController({
    removeItem: async (key) => {
      if (key === MOBILE_QA_SESSION_STORAGE_KEY) {
        throw new Error("preference removal failed");
      }
    },
  });
  runtime.attachRequiredParticipant(
    "device-preferences",
    controller.participant,
  );

  const result = await runtime.operations.runReset();

  assert.deepEqual(result, {
    status: "partial-failure",
    committedParticipantIds: ["care", "work-drain"],
    failedParticipantIds: ["avatar", "device-preferences"],
  });
});

test("reset removes legacy theme while preserving the deferred session notification key", async () => {
  const { createDevicePreferencesLocalDataResetController } =
    await loadResetModule();
  const sessionNotificationKey = "woofwatcher.v1.lastNotificationKey";
  const values = new Map<string, string>([
    ...DEVICE_PREFERENCE_RESET_KEYS.map(
      (key) => [key, `stored:${key}`] as const,
    ),
    [sessionNotificationKey, "notification-42"],
  ]);
  const controller = createDevicePreferencesLocalDataResetController({
    removeItem: async (key) => {
      values.delete(key);
    },
  });

  await controller.participant.prepare();
  await controller.participant.commit();

  assert.equal(values.has(LEGACY_PWA_THEME_KEY), false);
  assert.equal(values.get(sessionNotificationKey), "notification-42");
  assert.deepEqual([...values.keys()], [sessionNotificationKey]);
});

for (const rejectionMode of ["retain", "delete"] as const) {
  test(`raw ${rejectionMode}-then-reject reports partial failure and reread publishes physical truth`, async () => {
    const { createDevicePreferencesLocalDataResetController } =
      await loadResetModule();
    const values = new Map<string, string>([
      [HOME_WELCOME_DISMISSED_KEY, "pre-reset-home"],
    ]);
    const adapter = {
      async getItem(key) {
        return values.get(key) ?? null;
      },
      async setItem(key, value) {
        values.set(key, value);
      },
      async removeItem(key) {
        if (key !== HOME_WELCOME_DISMISSED_KEY) {
          values.delete(key);
          return;
        }
        if (rejectionMode === "delete") values.delete(key);
        throw new Error(`${rejectionMode} rejection`);
      },
    };
    const runtime = createLocalDataResetRuntime(adapter);
    attachPeerNoOps(runtime);
    const controller = createDevicePreferencesLocalDataResetController({
      removeItem: (key) => adapter.removeItem(key),
    });
    runtime.attachRequiredParticipant(
      "device-preferences",
      controller.participant,
    );

    const result = await runtime.operations.runReset();
    const rereadValues: Array<string | null> = [];
    const store = createDevicePreferencesStore(runtime.removableStorage, {
      runTrackedHydration: runtime.trackedWork.run,
    });
    const hydration = await store.hydrate(HOME_WELCOME_DISMISSED_KEY, {
      isCancelled: () => false,
      apply: (raw) => rereadValues.push(raw),
    });

    assert.deepEqual(result, {
      status: "partial-failure",
      committedParticipantIds: ["avatar", "care", "work-drain"],
      failedParticipantIds: ["device-preferences"],
    });
    assert.equal(hydration, "applied");
    assert.deepEqual(rereadValues, [
      rejectionMode === "retain" ? "pre-reset-home" : null,
    ]);
  });
}
