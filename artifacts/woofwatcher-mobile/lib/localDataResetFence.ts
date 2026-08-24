import type { LocalDataStorageAdapter } from "./removableLocalDataStorage.ts";

export const LOCAL_DATA_RESET_EPOCH_KEY =
  "woofwatcher.localDataResetEpoch.v1";
export const LOCAL_DATA_RESET_IN_PROGRESS_KEY =
  "woofwatcher.localDataResetInProgress.v1";

const LOCAL_DATA_RESET_LOCK_NAME = "woofwatcher.localDataReset.v1";
const LOCAL_DATA_RESET_IN_PROGRESS_VALUE = "active";
const INITIAL_RESET_EPOCH = 0;

export interface LocalDataResetWebLockManager {
  request<T>(
    name: string,
    options: { mode: "exclusive" },
    callback: () => Promise<T>,
  ): Promise<T>;
}

export interface LocalDataResetFenceOptions {
  /**
   * Web reset cannot honestly claim cross-tab exclusion without Web Locks.
   * Native and test runtimes use the process-local lock below.
   */
  requireWebLock?: boolean;
  webLockManager?: LocalDataResetWebLockManager | null;
  /** Defaults on with requireWebLock; native has one JS runtime/generation. */
  enableDurableEpoch?: boolean;
}

export interface LocalDataResetFence {
  runProtectedOperation<T>(operation: () => Promise<T>): Promise<T>;
  runStorageOperation<T>(operation: () => Promise<T>): Promise<T>;
  runResetCommitStorageOperation<T>(operation: () => Promise<T>): Promise<T>;
  beginReset(): Promise<() => Promise<void>>;
}

export class StaleLocalDataRuntimeError extends Error {
  constructor() {
    super(
      "This app runtime predates a completed local data reset and cannot write local data.",
    );
    this.name = "StaleLocalDataRuntimeError";
  }
}

export class CrossRuntimeResetLockUnavailableError extends Error {
  constructor() {
    super(
      "Cross-tab reset protection is unavailable in this browser, so no local data was deleted.",
    );
    this.name = "CrossRuntimeResetLockUnavailableError";
  }
}

export class ResetFenceOwnershipError extends Error {
  constructor() {
    super("Reset-owned storage requires ownership of the held reset fence.");
    this.name = "ResetFenceOwnershipError";
  }
}

interface ProcessLock {
  tail: Promise<void>;
}

const processLocks = new WeakMap<LocalDataStorageAdapter, ProcessLock>();

function getProcessLock(storage: LocalDataStorageAdapter): ProcessLock {
  const existing = processLocks.get(storage);
  if (existing) return existing;
  const created = { tail: Promise.resolve() };
  processLocks.set(storage, created);
  return created;
}

function acquireProcessLock(
  storage: LocalDataStorageAdapter,
): Promise<() => Promise<void>> {
  const lock = getProcessLock(storage);
  const previous = lock.tail;
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  lock.tail = previous.catch(() => {}).then(() => current);

  return previous.catch(() => {}).then(() => {
    let released = false;
    return async () => {
      if (released) return;
      released = true;
      releaseCurrent();
      await current;
    };
  });
}

function detectedWebLockManager(): LocalDataResetWebLockManager | null {
  const candidate = (
    globalThis as typeof globalThis & {
      navigator?: { locks?: LocalDataResetWebLockManager };
    }
  ).navigator?.locks;
  return candidate && typeof candidate.request === "function"
    ? candidate
    : null;
}

function parseResetEpoch(raw: string | null): number {
  if (raw === null) return INITIAL_RESET_EPOCH;
  if (!/^(?:0|[1-9]\d{0,14})$/.test(raw)) {
    throw new Error("The durable local data reset epoch is invalid.");
  }
  const epoch = Number(raw);
  if (!Number.isSafeInteger(epoch)) {
    throw new Error("The durable local data reset epoch is invalid.");
  }
  return epoch;
}

function hasResetInProgressMarker(raw: string | null): boolean {
  return raw !== null;
}

function createBrowserLockAcquirer(
  options: LocalDataResetFenceOptions,
): (() => Promise<() => Promise<void>>) | null {
  if (!options.requireWebLock) return null;
  const manager =
    options.webLockManager === undefined
      ? detectedWebLockManager()
      : options.webLockManager;
  if (!manager) return null;

  return async () => {
    let markAcquired!: () => void;
    let releaseHold!: () => void;
    const acquired = new Promise<void>((resolve) => {
      markAcquired = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      releaseHold = resolve;
    });
    let callbackEntered = false;
    const request = Promise.resolve().then(() =>
      manager.request(
        LOCAL_DATA_RESET_LOCK_NAME,
        { mode: "exclusive" },
        async () => {
          callbackEntered = true;
          markAcquired();
          await hold;
        },
      ),
    );
    await Promise.race([
      acquired,
      request.then(() => {
        if (!callbackEntered) {
          throw new Error("The browser released the reset lock before use.");
        }
      }),
    ]);
    let released = false;
    return async () => {
      if (released) return;
      released = true;
      releaseHold();
      await request;
    };
  };
}

export function createLocalDataResetFence(
  storage: LocalDataStorageAdapter,
  options: LocalDataResetFenceOptions = {},
): LocalDataResetFence {
  const webAcquire = createBrowserLockAcquirer(options);
  const acquire = webAcquire ?? (() => acquireProcessLock(storage));
  const durableEpochEnabled =
    options.enableDurableEpoch ?? Boolean(options.requireWebLock);
  const initialFenceState = durableEpochEnabled
    ? Promise.resolve()
        .then(() =>
          Promise.all([
            storage.getItem(LOCAL_DATA_RESET_EPOCH_KEY),
            storage.getItem(LOCAL_DATA_RESET_IN_PROGRESS_KEY),
          ]),
        )
        .then(([epoch, marker]) => ({
          epoch: parseResetEpoch(epoch),
          resetInProgress: hasResetInProgressMarker(marker),
        }))
    : Promise.resolve({
        epoch: INITIAL_RESET_EPOCH,
        resetInProgress: false,
      });
  let runtimeEpoch: number | null = null;
  let runtimeObservedResetInProgress = false;
  let resetCommitLease: {
    open: boolean;
    operations: Set<Promise<unknown>>;
  } | null = null;

  const getRuntimeEpoch = async () => {
    if (runtimeEpoch === null) {
      const initial = await initialFenceState;
      runtimeEpoch = initial.epoch;
      runtimeObservedResetInProgress = initial.resetInProgress;
    }
    return runtimeEpoch;
  };

  const assertCurrent = async () => {
    if (!durableEpochEnabled) return;
    const [captured, currentRaw, markerRaw] = await Promise.all([
      getRuntimeEpoch(),
      storage.getItem(LOCAL_DATA_RESET_EPOCH_KEY),
      storage.getItem(LOCAL_DATA_RESET_IN_PROGRESS_KEY),
    ]);
    if (
      runtimeObservedResetInProgress ||
      hasResetInProgressMarker(markerRaw) ||
      parseResetEpoch(currentRaw) !== captured
    ) {
      throw new StaleLocalDataRuntimeError();
    }
  };

  const acquireForReset = async () => {
    if (options.requireWebLock && !webAcquire) {
      throw new CrossRuntimeResetLockUnavailableError();
    }
    return acquire();
  };

  const runProtectedOperation = async <T>(
    operation: () => Promise<T>,
  ): Promise<T> => {
    const release = await acquire();
    try {
      await assertCurrent();
      return await operation();
    } finally {
      await release();
    }
  };

  const createResetRelease = (
    releaseFence: () => Promise<void>,
    finalizeDurableReset?: () => Promise<void>,
  ): (() => Promise<void>) => {
    if (resetCommitLease) {
      throw new ResetFenceOwnershipError();
    }
    const lease = {
      open: true,
      operations: new Set<Promise<unknown>>(),
    };
    resetCommitLease = lease;
    let released = false;
    return async () => {
      if (released) return;
      released = true;
      lease.open = false;
      try {
        await Promise.allSettled([...lease.operations]);
        await finalizeDurableReset?.();
      } finally {
        if (resetCommitLease === lease) resetCommitLease = null;
        await releaseFence();
      }
    };
  };

  return Object.freeze({
    runProtectedOperation,
    runStorageOperation: runProtectedOperation,
    runResetCommitStorageOperation<T>(operation: () => Promise<T>) {
      const lease = resetCommitLease;
      if (!lease?.open) {
        return Promise.reject<T>(new ResetFenceOwnershipError());
      }
      const result = Promise.resolve().then(() => {
        if (resetCommitLease !== lease || !lease.open) {
          throw new ResetFenceOwnershipError();
        }
        return operation();
      });
      const tracked = result as Promise<unknown>;
      lease.operations.add(tracked);
      void tracked.then(
        () => lease.operations.delete(tracked),
        () => lease.operations.delete(tracked),
      );
      return result;
    },
    async beginReset() {
      const release = await acquireForReset();
      try {
        if (!durableEpochEnabled) {
          return createResetRelease(release);
        }
        await getRuntimeEpoch();
        const current = parseResetEpoch(
          await storage.getItem(LOCAL_DATA_RESET_EPOCH_KEY),
        );
        const next = current + 1;
        if (!Number.isSafeInteger(next)) {
          throw new Error("The durable local data reset epoch is exhausted.");
        }
        await storage.setItem(
          LOCAL_DATA_RESET_IN_PROGRESS_KEY,
          LOCAL_DATA_RESET_IN_PROGRESS_VALUE,
        );
        const persistedMarker = await storage.getItem(
          LOCAL_DATA_RESET_IN_PROGRESS_KEY,
        );
        if (persistedMarker !== LOCAL_DATA_RESET_IN_PROGRESS_VALUE) {
          throw new Error(
            "The durable local data reset marker was not saved.",
          );
        }
        return createResetRelease(release, async () => {
          const [currentRaw, markerRaw] = await Promise.all([
            storage.getItem(LOCAL_DATA_RESET_EPOCH_KEY),
            storage.getItem(LOCAL_DATA_RESET_IN_PROGRESS_KEY),
          ]);
          if (
            parseResetEpoch(currentRaw) !== current ||
            markerRaw !== LOCAL_DATA_RESET_IN_PROGRESS_VALUE
          ) {
            throw new Error(
              "The durable local data reset fence changed before completion.",
            );
          }
          await storage.setItem(LOCAL_DATA_RESET_EPOCH_KEY, String(next));
          const persisted = parseResetEpoch(
            await storage.getItem(LOCAL_DATA_RESET_EPOCH_KEY),
          );
          if (persisted !== next) {
            throw new Error(
              "The durable local data reset epoch was not saved.",
            );
          }
          await storage.removeItem(LOCAL_DATA_RESET_IN_PROGRESS_KEY);
          const clearedMarker = await storage.getItem(
            LOCAL_DATA_RESET_IN_PROGRESS_KEY,
          );
          if (clearedMarker !== null) {
            throw new Error(
              "The durable local data reset marker was not cleared.",
            );
          }
          runtimeEpoch = next;
          runtimeObservedResetInProgress = false;
        });
      } catch (error) {
        await release();
        throw error;
      }
    },
  });
}
