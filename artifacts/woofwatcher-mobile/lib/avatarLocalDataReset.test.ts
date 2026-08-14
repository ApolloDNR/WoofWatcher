import assert from "node:assert/strict";
import { test } from "node:test";

import { createLocalDataResetRuntime } from "./localDataResetRuntime.ts";
import { LocalDataResetInProgressError } from "./removableLocalDataStorage.ts";
import {
  AVATAR_CONFIG_KEY,
  AVATAR_KEY,
  AVATAR_LOCAL_DATA_KEYS,
  AvatarLocalDataResetCommitError,
  createAvatarLocalDataResetController,
  createAvatarHydrationRetryScheduler,
  runAvatarHydrationAttempt,
  runTrackedAvatarMutation,
  type AvatarHydrationField,
  type AvatarLocalDataKey,
} from "./avatarLocalDataReset.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createStorageAdapter() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      values.set(key, value);
    },
    async removeItem(key: string) {
      values.delete(key);
    },
  };
}

function attachCareNoOp(runtime: ReturnType<typeof createLocalDataResetRuntime>) {
  return runtime.attachRequiredParticipant("care", {
    prepare: async () => {},
    commit: async () => {},
  });
}

function attachDevicePreferencesNoOp(
  runtime: ReturnType<typeof createLocalDataResetRuntime>,
) {
  return runtime.attachRequiredParticipant("device-preferences", {
    prepare: async () => {},
    commit: async () => {},
  });
}

function createHydrationField<T>({
  value,
  read = async () => "raw",
  resolve = async () => ({ value }),
  apply = () => {},
  revision = { current: 0 },
}: {
  value: T;
  read?: () => Promise<string | null>;
  resolve?: AvatarHydrationField<T>["resolve"];
  apply?: (next: T) => void;
  revision?: { current: number };
}): AvatarHydrationField<T> {
  return {
    captureRevision: () => revision.current,
    isRevisionCurrent: (captured) => revision.current === captured,
    read,
    resolve,
    apply,
  };
}

test("owns the exact two Avatar local-data keys", () => {
  assert.equal(AVATAR_KEY, "woofwatcher.avatarSet.v1");
  assert.equal(AVATAR_CONFIG_KEY, "woofwatcher.petAvatarConfig.v1");
  assert.deepEqual(AVATAR_LOCAL_DATA_KEYS, [AVATAR_KEY, AVATAR_CONFIG_KEY]);
});

test("prepare is nondestructive", async () => {
  const events: string[] = [];
  const controller = createAvatarLocalDataResetController({
    removeItem: async (key) => {
      events.push(`remove:${key}`);
    },
    finalizeSuccessfulCommit: () => {
      events.push("finalize");
    },
  });

  await controller.participant.prepare();

  assert.deepEqual(events, []);
});

test("commit attempts both removals and finalizes only after both settle", async () => {
  const firstRemoval = deferred<void>();
  const events: string[] = [];
  const controller = createAvatarLocalDataResetController({
    removeItem: async (key) => {
      events.push(`start:${key}`);
      if (key === AVATAR_KEY) await firstRemoval.promise;
      events.push(`finish:${key}`);
    },
    finalizeSuccessfulCommit: () => {
      events.push("finalize");
    },
  });
  await controller.participant.prepare();

  const commit = controller.participant.commit();
  await Promise.resolve();

  assert.deepEqual(events, [
    `start:${AVATAR_KEY}`,
    `start:${AVATAR_CONFIG_KEY}`,
    `finish:${AVATAR_CONFIG_KEY}`,
  ]);
  firstRemoval.resolve();
  await commit;

  assert.deepEqual(events, [
    `start:${AVATAR_KEY}`,
    `start:${AVATAR_CONFIG_KEY}`,
    `finish:${AVATAR_CONFIG_KEY}`,
    `finish:${AVATAR_KEY}`,
    "finalize",
  ]);
});

test("a synchronous removal throw still attempts the other exact key", async () => {
  const attempts: string[] = [];
  const controller = createAvatarLocalDataResetController({
    removeItem: ((key: string) => {
      attempts.push(key);
      if (key === AVATAR_KEY) throw new Error("sync removal failure");
      return Promise.resolve();
    }) as Parameters<typeof createAvatarLocalDataResetController>[0]["removeItem"],
    finalizeSuccessfulCommit: () => {
      assert.fail("failed removal must not finalize memory");
    },
  });
  await controller.participant.prepare();

  await assert.rejects(
    controller.participant.commit(),
    AvatarLocalDataResetCommitError,
  );

  assert.deepEqual(attempts, [AVATAR_KEY, AVATAR_CONFIG_KEY]);
});

test("commit reports every exact failed key and preserves live memory", async () => {
  let finalized = 0;
  const controller = createAvatarLocalDataResetController({
    removeItem: async () => {
      throw new Error("disk unavailable");
    },
    finalizeSuccessfulCommit: () => {
      finalized += 1;
    },
  });
  await controller.participant.prepare();

  await assert.rejects(controller.participant.commit(), (error) => {
    assert.ok(error instanceof AvatarLocalDataResetCommitError);
    assert.deepEqual(error.failedKeys, [AVATAR_KEY, AVATAR_CONFIG_KEY]);
    return true;
  });

  assert.equal(finalized, 0);
});

test("commit errors copy and freeze failed keys in manifest order", () => {
  const mutableKeys: AvatarLocalDataKey[] = [AVATAR_KEY, AVATAR_CONFIG_KEY];
  const error = new AvatarLocalDataResetCommitError(mutableKeys);

  mutableKeys.reverse();

  assert.deepEqual(error.failedKeys, [AVATAR_KEY, AVATAR_CONFIG_KEY]);
  assert.equal(Object.isFrozen(error.failedKeys), true);
  assert.throws(
    () => (error.failedKeys as AvatarLocalDataKey[]).push(AVATAR_KEY),
    TypeError,
  );
});

test("commit consumes one preparation and rejects unprepared or repeated calls", async () => {
  let removals = 0;
  const controller = createAvatarLocalDataResetController({
    removeItem: async () => {
      removals += 1;
    },
    finalizeSuccessfulCommit: () => {},
  });

  await assert.rejects(controller.participant.commit(), /not prepared/i);
  await controller.participant.prepare();
  await controller.participant.commit();
  await assert.rejects(controller.participant.commit(), /not prepared/i);

  assert.equal(removals, 2);
});

test("a fresh preparation can retry after a failed commit", async () => {
  let fail = true;
  let finalized = 0;
  const controller = createAvatarLocalDataResetController({
    removeItem: async () => {
      if (fail) throw new Error("first attempt failed");
    },
    finalizeSuccessfulCommit: () => {
      finalized += 1;
    },
  });

  await controller.participant.prepare();
  await assert.rejects(
    controller.participant.commit(),
    AvatarLocalDataResetCommitError,
  );
  fail = false;
  await controller.participant.prepare();
  await controller.participant.commit();

  assert.equal(finalized, 1);
});

test("tracked mutation persists before applying current memory", async () => {
  const persisted = deferred<void>();
  const events: string[] = [];
  const mutation = runTrackedAvatarMutation({
    runTrackedLocalDataWork: async (start) => ({
      status: "complete" as const,
      value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
    }),
    beginCurrentMutation: () => {
      events.push("begin");
    },
    persist: async () => {
      events.push("persist:start");
      await persisted.promise;
      events.push("persist:finish");
    },
    applyCurrent: () => {
      events.push("apply");
    },
  });
  await Promise.resolve();

  assert.deepEqual(events, ["begin", "persist:start"]);
  persisted.resolve();
  await mutation;

  assert.deepEqual(events, ["begin", "persist:start", "persist:finish", "apply"]);
});

test("tracked mutation preserves memory and the exact persistence rejection", async () => {
  const failure = new Error("avatar write failed");
  let applied = 0;

  await assert.rejects(
    runTrackedAvatarMutation({
      runTrackedLocalDataWork: async (start) => ({
        status: "complete" as const,
        value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
      }),
      beginCurrentMutation: () => {},
      persist: async () => {
        throw failure;
      },
      applyCurrent: () => {
        applied += 1;
      },
    }),
    (error) => error === failure,
  );

  assert.equal(applied, 0);
});

test("closed mutation admission invokes neither persistence nor memory", async () => {
  const events: string[] = [];
  const operation: Promise<void> = runTrackedAvatarMutation({
    runTrackedLocalDataWork: async () => {
      throw new LocalDataResetInProgressError();
    },
    beginCurrentMutation: () => {
      events.push("begin");
    },
    persist: async () => {
      events.push("persist");
    },
    applyCurrent: () => {
      events.push("apply");
    },
  });

  await assert.rejects(operation, LocalDataResetInProgressError);
  assert.deepEqual(events, []);
});

test("a revoked tracked result rejects instead of reporting a discarded save", async () => {
  let applied = 0;

  await assert.rejects(
    runTrackedAvatarMutation({
      runTrackedLocalDataWork: async (start) => {
        await start({ permit: Symbol("permit") as never, isCurrent: () => false });
        return { status: "revoked" as const };
      },
      beginCurrentMutation: () => {},
      persist: async () => {},
      applyCurrent: () => {
        applied += 1;
      },
    }),
    LocalDataResetInProgressError,
  );

  assert.equal(applied, 0);
});

test("an accepted mutation released during reset preparation rejects without applying memory", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  const persistence = deferred<void>();
  let applied = 0;
  attachCareNoOp(runtime);
  attachDevicePreferencesNoOp(runtime);
  runtime.attachRequiredParticipant("avatar", {
    prepare: async () => {},
    commit: async () => {},
  });
  const mutation = runTrackedAvatarMutation({
    runTrackedLocalDataWork: runtime.trackedWork.run,
    beginCurrentMutation: () => {},
    persist: () => persistence.promise,
    applyCurrent: () => {
      applied += 1;
    },
  });

  const reset = runtime.operations.runReset();
  assert.equal(runtime.operations.isWriteAdmissionOpen(), false);
  persistence.resolve();

  await assert.rejects(mutation, LocalDataResetInProgressError);
  assert.equal(applied, 0);
  assert.equal((await reset).status, "complete");
});

test("accepted removable storage and tracked verification both hold reset preparation open", async () => {
  const storageWrite = deferred<void>();
  const verification = deferred<void>();
  const events: string[] = [];
  const runtime = createLocalDataResetRuntime({
    getItem: async () => null,
    setItem: async () => storageWrite.promise,
    removeItem: async () => {},
  });
  attachCareNoOp(runtime);
  attachDevicePreferencesNoOp(runtime);
  const controller = createAvatarLocalDataResetController({
    removeItem: async (key) => {
      events.push(`remove:${key}`);
    },
    finalizeSuccessfulCommit: () => {
      events.push("finalize");
    },
  });
  runtime.attachRequiredParticipant("avatar", controller.participant);
  const acceptedStorage = runtime.removableStorage.setItem(AVATAR_CONFIG_KEY, "config");
  const acceptedVerification = runtime.trackedWork.run(() => verification.promise);
  const reset = runtime.operations.runReset();
  await Promise.resolve();

  assert.deepEqual(events, []);
  storageWrite.resolve();
  await acceptedStorage;
  await Promise.resolve();
  assert.deepEqual(events, []);
  verification.resolve();
  await acceptedVerification;
  assert.equal((await reset).status, "complete");
  assert.deepEqual(events, [
    `remove:${AVATAR_KEY}`,
    `remove:${AVATAR_CONFIG_KEY}`,
    "finalize",
  ]);
});

test("peer preparation failure performs zero Avatar destruction and a fresh run can succeed", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  let failCare = true;
  let removals = 0;
  let finalized = 0;
  runtime.attachRequiredParticipant("care", {
    prepare: async () => {
      if (failCare) throw new Error("Care is not ready");
    },
    commit: async () => {},
  });
  const controller = createAvatarLocalDataResetController({
    removeItem: async () => {
      removals += 1;
    },
    finalizeSuccessfulCommit: () => {
      finalized += 1;
    },
  });
  runtime.attachRequiredParticipant("avatar", controller.participant);
  attachDevicePreferencesNoOp(runtime);

  assert.equal((await runtime.operations.runReset()).status, "partial-failure");
  assert.equal(removals, 0);
  assert.equal(finalized, 0);

  failCare = false;
  assert.equal((await runtime.operations.runReset()).status, "complete");
  assert.equal(removals, 2);
  assert.equal(finalized, 1);
});

test("concurrent commit calls consume one preparation and cannot duplicate removal", async () => {
  const removal = deferred<void>();
  let removals = 0;
  const controller = createAvatarLocalDataResetController({
    removeItem: async () => {
      removals += 1;
      await removal.promise;
    },
    finalizeSuccessfulCommit: () => {},
  });
  await controller.participant.prepare();

  const first = controller.participant.commit();
  const second = controller.participant.commit();
  await assert.rejects(second, /not prepared/i);
  removal.resolve();
  await first;

  assert.equal(removals, 2);
});

test("new same-field mutation blocks stale hydration repair and apply", async () => {
  const verification = deferred<{ value: string; repair: () => Promise<void> }>();
  const revision = { current: 0 };
  const events: string[] = [];
  const hydration = runAvatarHydrationAttempt({
    runTrackedLocalDataWork: async (start) => ({
      status: "complete" as const,
      value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
    }),
    drainPendingWrites: async () => {},
    isCancelled: () => false,
    avatarSet: createHydrationField({
      value: "unused",
      revision,
      resolve: () => verification.promise,
      apply: () => events.push("avatar:apply"),
    }),
    avatarConfig: createHydrationField({
      value: "config",
      apply: () => events.push("config:apply"),
    }),
    markLoaded: () => events.push("loaded"),
    requestRetry: () => events.push("retry"),
  });
  await Promise.resolve();
  revision.current += 1;
  verification.resolve({
    value: "old-avatar",
    repair: async () => {
      events.push("avatar:repair");
    },
  });
  await hydration;

  assert.deepEqual(events, ["config:apply"]);
});

test("a revision changed while pending writes drain retries before either storage read", async () => {
  const pendingWrites = deferred<void>();
  const configRevision = { current: 0 };
  const events: string[] = [];
  const hydration = runAvatarHydrationAttempt({
    runTrackedLocalDataWork: async (start) => ({
      status: "complete" as const,
      value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
    }),
    drainPendingWrites: () => pendingWrites.promise,
    isCancelled: () => false,
    avatarSet: createHydrationField({
      value: "avatar",
      read: async () => {
        events.push("avatar:read");
        return "avatar";
      },
      apply: () => events.push("avatar:apply"),
    }),
    avatarConfig: createHydrationField({
      value: "config",
      revision: configRevision,
      read: async () => {
        events.push("config:read");
        return "config";
      },
      apply: () => events.push("config:apply"),
    }),
    markLoaded: () => events.push("loaded"),
    requestRetry: () => events.push("retry"),
  });

  await Promise.resolve();
  configRevision.current += 1;
  pendingWrites.resolve();
  await hydration;

  assert.deepEqual(events, ["retry"]);
});

test("hydration drains an already-admitted mutation write before reading its captured revision", async () => {
  const configWrite = deferred<void>();
  const stored = new Map<string, string>([
    [AVATAR_KEY, "stored-avatar"],
    [AVATAR_CONFIG_KEY, "stale-config"],
  ]);
  const events: string[] = [];
  const appliedConfigs: string[] = [];
  const runtime = createLocalDataResetRuntime({
    async getItem(key) {
      const value = stored.get(key) ?? null;
      events.push(`read:${key}:${value}`);
      return value;
    },
    async setItem(key, value) {
      events.push(`write:start:${key}:${value}`);
      if (key === AVATAR_CONFIG_KEY) await configWrite.promise;
      stored.set(key, value);
      events.push(`write:finish:${key}:${value}`);
    },
    async removeItem(key) {
      stored.delete(key);
    },
  });
  const configRevision = { current: 0 };

  const mutation = runTrackedAvatarMutation({
    runTrackedLocalDataWork: runtime.trackedWork.run,
    beginCurrentMutation: () => {
      configRevision.current += 1;
      events.push("mutation:begin");
    },
    persist: () =>
      runtime.removableStorage.setItem(AVATAR_CONFIG_KEY, "current-config"),
    applyCurrent: () => events.push("mutation:apply:current-config"),
  });
  const hydration = runAvatarHydrationAttempt({
    runTrackedLocalDataWork: runtime.trackedWork.run,
    drainPendingWrites: runtime.removableStorage.drain,
    isCancelled: () => false,
    avatarSet: createHydrationField({
      value: "unused-avatar",
      read: () => runtime.removableStorage.getItem(AVATAR_KEY),
      resolve: (raw) => ({ value: raw ?? "missing-avatar" }),
      apply: (value) => events.push(`avatar:apply:${value}`),
    }),
    avatarConfig: createHydrationField({
      value: "unused-config",
      revision: configRevision,
      read: () => runtime.removableStorage.getItem(AVATAR_CONFIG_KEY),
      resolve: (raw) => ({ value: raw ?? "missing-config" }),
      apply: (value) => {
        appliedConfigs.push(value);
        events.push(`config:apply:${value}`);
      },
    }),
    markLoaded: () => events.push("loaded"),
    requestRetry: () => events.push("retry"),
  });

  await Promise.resolve();
  await Promise.resolve();
  const readsStartedBeforeWriteSettled = events.some((event) =>
    event.startsWith("read:"),
  );
  configWrite.resolve();
  await Promise.all([mutation, hydration]);

  assert.equal(readsStartedBeforeWriteSettled, false);
  assert.deepEqual(appliedConfigs, ["current-config"]);
  assert.ok(
    events.indexOf(
      `write:finish:${AVATAR_CONFIG_KEY}:current-config`,
    ) < events.indexOf(`read:${AVATAR_CONFIG_KEY}:current-config`),
  );
});

test("hydration starts both storage reads before awaiting either one", async () => {
  const avatarRead = deferred<string | null>();
  const events: string[] = [];
  const hydration = runAvatarHydrationAttempt({
    runTrackedLocalDataWork: async (start) => ({
      status: "complete" as const,
      value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
    }),
    drainPendingWrites: async () => {},
    isCancelled: () => false,
    avatarSet: createHydrationField({
      value: "avatar",
      read: () => {
        events.push("avatar:read");
        return avatarRead.promise;
      },
      apply: () => events.push("avatar:apply"),
    }),
    avatarConfig: createHydrationField({
      value: "config",
      read: async () => {
        events.push("config:read");
        return "raw-config";
      },
      apply: () => events.push("config:apply"),
    }),
    markLoaded: () => events.push("loaded"),
    requestRetry: () => events.push("retry"),
  });
  await Promise.resolve();

  assert.deepEqual(events, ["avatar:read", "config:read"]);
  avatarRead.resolve("raw-avatar");
  await hydration;

  assert.deepEqual(events, [
    "avatar:read",
    "config:read",
    "avatar:apply",
    "config:apply",
    "loaded",
  ]);
});

test("hydration retries coalesce, back off to a bounded rate, and reset after current data loads", () => {
  interface ScheduledRetry {
    run(): void;
    delayMs: number;
    cancelled: boolean;
  }
  const scheduled: ScheduledRetry[] = [];
  let retryCount = 0;
  const scheduler = createAvatarHydrationRetryScheduler({
    schedule(run, delayMs) {
      const retry = { run, delayMs, cancelled: false };
      scheduled.push(retry);
      return retry;
    },
    cancel(handle) {
      (handle as ScheduledRetry).cancelled = true;
    },
    onRetry: () => {
      retryCount += 1;
    },
  });

  scheduler.request();
  scheduler.request();
  assert.deepEqual(scheduled.map(({ delayMs }) => delayMs), [250]);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const current = scheduled.at(-1)!;
    current.run();
    assert.equal(retryCount, attempt + 1);
    scheduler.request();
  }
  assert.deepEqual(
    scheduled.map(({ delayMs }) => delayMs),
    [
      250,
      500,
      1_000,
      2_000,
      4_000,
      8_000,
      16_000,
      30_000,
      30_000,
      30_000,
      30_000,
    ],
  );

  const pendingBeforeReset = scheduled.at(-1)!;
  const retryCountBeforeReset = retryCount;
  scheduler.reset();
  assert.equal(pendingBeforeReset.cancelled, true);
  pendingBeforeReset.run();
  assert.equal(retryCount, retryCountBeforeReset);
  scheduler.request();
  assert.equal(scheduled.at(-1)!.delayMs, 250);

  const pendingBeforeDeactivate = scheduled.at(-1)!;
  scheduler.deactivate();
  assert.equal(pendingBeforeDeactivate.cancelled, true);
  scheduler.request();
  assert.equal(scheduled.at(-1), pendingBeforeDeactivate);

  scheduler.activate();
  pendingBeforeDeactivate.run();
  assert.equal(retryCount, retryCountBeforeReset);
  scheduler.request();
  assert.equal(scheduled.at(-1)!.delayMs, 250);
  assert.notEqual(scheduled.at(-1), pendingBeforeDeactivate);
});

test("field revisions suppress only the matching hydration field", async () => {
  for (const changedField of ["avatar", "config"] as const) {
    const avatarRevision = { current: 0 };
    const configRevision = { current: 0 };
    const applied: string[] = [];
    const avatarRead = deferred<string | null>();
    const hydration = runAvatarHydrationAttempt({
      runTrackedLocalDataWork: async (start) => ({
        status: "complete" as const,
        value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
      }),
      drainPendingWrites: async () => {},
      isCancelled: () => false,
      avatarSet: createHydrationField({
        value: "avatar",
        revision: avatarRevision,
        read: () => avatarRead.promise,
        apply: () => applied.push("avatar"),
      }),
      avatarConfig: createHydrationField({
        value: "config",
        revision: configRevision,
        apply: () => applied.push("config"),
      }),
      markLoaded: () => applied.push("loaded"),
      requestRetry: () => applied.push("retry"),
    });
    await Promise.resolve();
    if (changedField === "avatar") avatarRevision.current += 1;
    else configRevision.current += 1;
    avatarRead.resolve("raw");
    await hydration;

    assert.deepEqual(
      applied,
      changedField === "avatar" ? ["config"] : ["avatar"],
    );
  }
});

test("a revision changed after both setters prevents stale loaded publication", async () => {
  const avatarRevision = { current: 0 };
  const events: string[] = [];

  await runAvatarHydrationAttempt({
    runTrackedLocalDataWork: async (start) => ({
      status: "complete" as const,
      value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
    }),
    drainPendingWrites: async () => {},
    isCancelled: () => false,
    avatarSet: createHydrationField({
      value: "avatar",
      revision: avatarRevision,
      apply: () => events.push("avatar:apply"),
    }),
    avatarConfig: createHydrationField({
      value: "config",
      apply: () => {
        events.push("config:apply");
        queueMicrotask(() => {
          avatarRevision.current += 1;
        });
      },
    }),
    markLoaded: () => events.push("loaded"),
    requestRetry: () => events.push("retry"),
  });

  assert.deepEqual(events, ["avatar:apply", "config:apply", "retry"]);
});

test("failed superseding config mutation keeps initial load incomplete until retry reads current config", async () => {
  const configResolution = deferred<{ value: string }>();
  const configRevision = { current: 0 };
  const events: string[] = [];
  const staleHydration = runAvatarHydrationAttempt({
    runTrackedLocalDataWork: async (start) => ({
      status: "complete" as const,
      value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
    }),
    drainPendingWrites: async () => {},
    isCancelled: () => false,
    avatarSet: createHydrationField({
      value: "stored-avatar",
      apply: () => events.push("avatar:loaded"),
    }),
    avatarConfig: createHydrationField({
      value: "unused",
      revision: configRevision,
      resolve: () => configResolution.promise,
      apply: () => events.push("config:loaded"),
    }),
    markLoaded: () => events.push("all:loaded"),
    requestRetry: () => events.push("retry"),
  });
  await Promise.resolve();

  configRevision.current += 1;
  const mutationFailure = new Error("config persistence failed");
  await assert.rejects(
    runTrackedAvatarMutation({
      runTrackedLocalDataWork: async (start) => ({
        status: "complete" as const,
        value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
      }),
      beginCurrentMutation: () => {},
      persist: async () => {
        throw mutationFailure;
      },
      applyCurrent: () => events.push("mutation:applied"),
    }),
    (error) => error === mutationFailure,
  );
  configResolution.resolve({ value: "stale-config" });
  await staleHydration;

  assert.deepEqual(events, ["avatar:loaded"]);

  await runAvatarHydrationAttempt({
    runTrackedLocalDataWork: async (start) => ({
      status: "complete" as const,
      value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
    }),
    drainPendingWrites: async () => {},
    isCancelled: () => false,
    avatarSet: createHydrationField({
      value: "stored-avatar",
      apply: () => events.push("avatar:reloaded"),
    }),
    avatarConfig: createHydrationField({
      value: "stored-config",
      revision: configRevision,
      apply: () => events.push("config:reloaded"),
    }),
    markLoaded: () => events.push("all:loaded"),
    requestRetry: () => events.push("retry"),
  });

  assert.deepEqual(events, [
    "avatar:loaded",
    "avatar:reloaded",
    "config:reloaded",
    "all:loaded",
  ]);
});

test("cancellation during verification prevents repair, setters, and loaded state", async () => {
  const verification = deferred<{ value: string; repair: () => Promise<void> }>();
  let cancelled = false;
  const events: string[] = [];
  const hydration = runAvatarHydrationAttempt({
    runTrackedLocalDataWork: async (start) => ({
      status: "complete" as const,
      value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
    }),
    drainPendingWrites: async () => {},
    isCancelled: () => cancelled,
    avatarSet: createHydrationField({
      value: "unused",
      resolve: () => verification.promise,
      apply: () => events.push("avatar:apply"),
    }),
    avatarConfig: createHydrationField({
      value: "config",
      apply: () => events.push("config:apply"),
    }),
    markLoaded: () => events.push("loaded"),
    requestRetry: () => events.push("retry"),
  });
  await Promise.resolve();
  cancelled = true;
  verification.resolve({
    value: "avatar",
    repair: async () => {
      events.push("repair");
    },
  });
  await hydration;

  assert.deepEqual(events, []);
});

test("read rejection preserves both fields and requests a retry", async () => {
  const events: string[] = [];
  await runAvatarHydrationAttempt({
    runTrackedLocalDataWork: async (start) => ({
      status: "complete" as const,
      value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
    }),
    drainPendingWrites: async () => {},
    isCancelled: () => false,
    avatarSet: createHydrationField({
      value: "avatar",
      read: async () => {
        throw new Error("read failed");
      },
      apply: () => events.push("avatar:apply"),
    }),
    avatarConfig: createHydrationField({
      value: "config",
      apply: () => events.push("config:apply"),
    }),
    markLoaded: () => events.push("loaded"),
    requestRetry: () => events.push("retry"),
  });

  assert.deepEqual(events, ["retry"]);
});

test("repair rejection preserves that field and requests a retry", async () => {
  const events: string[] = [];
  await runAvatarHydrationAttempt({
    runTrackedLocalDataWork: async (start) => ({
      status: "complete" as const,
      value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
    }),
    drainPendingWrites: async () => {},
    isCancelled: () => false,
    avatarSet: createHydrationField({
      value: "avatar",
      resolve: async () => ({
        value: "avatar",
        repair: async () => {
          throw new Error("repair failed");
        },
      }),
      apply: () => events.push("avatar:apply"),
    }),
    avatarConfig: createHydrationField({
      value: "config",
      apply: () => events.push("config:apply"),
    }),
    markLoaded: () => events.push("loaded"),
    requestRetry: () => events.push("retry"),
  });

  assert.deepEqual(events, ["retry", "config:apply"]);
});

test("partial-reset mixed truth applies only after both reload reads succeed", async () => {
  const failedEvents: string[] = [];
  await runAvatarHydrationAttempt({
    runTrackedLocalDataWork: async (start) => ({
      status: "complete" as const,
      value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
    }),
    drainPendingWrites: async () => {},
    isCancelled: () => false,
    avatarSet: createHydrationField({
      value: null,
      read: async () => null,
      apply: () => failedEvents.push("avatar:null"),
    }),
    avatarConfig: createHydrationField({
      value: "persisted-config",
      read: async () => {
        throw new Error("config read failed");
      },
      apply: () => failedEvents.push("config:apply"),
    }),
    markLoaded: () => failedEvents.push("loaded"),
    requestRetry: () => failedEvents.push("retry"),
  });
  assert.deepEqual(failedEvents, ["retry"]);

  const recoveredEvents: string[] = [];
  await runAvatarHydrationAttempt({
    runTrackedLocalDataWork: async (start) => ({
      status: "complete" as const,
      value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
    }),
    drainPendingWrites: async () => {},
    isCancelled: () => false,
    avatarSet: createHydrationField({
      value: null,
      read: async () => null,
      apply: () => recoveredEvents.push("avatar:null"),
    }),
    avatarConfig: createHydrationField({
      value: "persisted-config",
      read: async () => "raw-config",
      apply: () => recoveredEvents.push("config:apply"),
    }),
    markLoaded: () => recoveredEvents.push("loaded"),
    requestRetry: () => recoveredEvents.push("retry"),
  });
  assert.deepEqual(recoveredEvents, ["avatar:null", "config:apply", "loaded"]);

  const oppositeEvents: string[] = [];
  await runAvatarHydrationAttempt({
    runTrackedLocalDataWork: async (start) => ({
      status: "complete" as const,
      value: await start({ permit: Symbol("permit") as never, isCurrent: () => true }),
    }),
    drainPendingWrites: async () => {},
    isCancelled: () => false,
    avatarSet: createHydrationField({
      value: "surviving-avatar",
      read: async () => "stored-avatar",
      apply: () => oppositeEvents.push("avatar:survives"),
    }),
    avatarConfig: createHydrationField({
      value: "unused-config",
      read: async () => null,
      resolve: (raw) => {
        assert.equal(raw, null);
        return { value: "default-config" };
      },
      apply: (value) => oppositeEvents.push(`config:${value}`),
    }),
    markLoaded: () => oppositeEvents.push("loaded"),
    requestRetry: () => oppositeEvents.push("retry"),
  });
  assert.deepEqual(oppositeEvents, [
    "avatar:survives",
    "config:default-config",
    "loaded",
  ]);
});

test("detaching the required Avatar delegate makes the next root reset fail closed", async () => {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  attachCareNoOp(runtime);
  attachDevicePreferencesNoOp(runtime);
  let removals = 0;
  const controller = createAvatarLocalDataResetController({
    removeItem: async () => {
      removals += 1;
    },
    finalizeSuccessfulCommit: () => {},
  });
  const detach = runtime.attachRequiredParticipant("avatar", controller.participant);
  detach();

  const result = await runtime.operations.runReset();

  assert.deepEqual(result, {
    status: "partial-failure",
    committedParticipantIds: [],
    failedParticipantIds: ["avatar"],
  });
  assert.equal(removals, 0);
});
