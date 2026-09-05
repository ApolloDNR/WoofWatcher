export type SerializedCareSyncWriteClass = "discardable" | "critical";
export type SerializedCareSyncWriteResult = "applied" | "superseded";

export interface SerializedCareSyncWriter<T> {
  /** Current queue epoch; pass it through delayed callers to fence stale work. */
  currentEpoch: () => number;
  enqueue: (
    value: T,
    expectedEpoch?: number,
    writeClass?: SerializedCareSyncWriteClass,
  ) => Promise<SerializedCareSyncWriteResult>;
  /** Resolve and discard non-critical writes that have not started yet. */
  discardPending: () => number;
  /** Resolve after the active write and every still-queued write settle. */
  drain: () => Promise<void>;
  /**
   * Advance the epoch, discard queued older work, and make `value` the next
   * operation after any write that already reached the platform.
   */
  supersede: (value: T) => Promise<SerializedCareSyncWriteResult>;
}

const sharedCareSyncWritersByOwner = new WeakMap<object, object>();

/**
 * Returns one durable writer for the lifetime of a storage backend.
 *
 * Care's React subtree is intentionally remounted when the auth principal
 * changes. Keeping the writer in this module-level registry ensures the new
 * principal's hydration drain waits for any platform operation that the old
 * principal already started. A given owner must always use one mutation
 * contract and write callback.
 */
export function getOrCreateSharedCareSyncWriter<T>(
  owner: object,
  write: (value: T) => Promise<void>,
): SerializedCareSyncWriter<T> {
  const existing = sharedCareSyncWritersByOwner.get(owner) as
    | SerializedCareSyncWriter<T>
    | undefined;
  if (existing) return existing;

  const writer = createSerializedCareSyncWriter(write);
  sharedCareSyncWritersByOwner.set(owner, writer);
  return writer;
}

/**
 * Runs durable writes in issue order. The explicit discard/drain barrier lets
 * owner-wipe code prevent an older queued snapshot from landing after data
 * deletion, while still waiting for an already-started platform write.
 */
export function createSerializedCareSyncWriter<T>(
  write: (value: T) => Promise<void>,
): SerializedCareSyncWriter<T> {
  type PendingWrite = {
    epoch: number;
    writeClass: SerializedCareSyncWriteClass;
    value: T;
    resolve: (result: SerializedCareSyncWriteResult) => void;
    reject: (error: unknown) => void;
  };
  const pending: PendingWrite[] = [];
  const idleWaiters: Array<() => void> = [];
  let active = false;
  let epoch = 0;

  const settleIdle = () => {
    if (active || pending.length > 0) return;
    for (const resolve of idleWaiters.splice(0)) resolve();
  };

  const pump = () => {
    if (active) return;
    const next = pending.shift();
    if (!next) {
      settleIdle();
      return;
    }
    active = true;

    let operation: Promise<void>;
    try {
      operation = Promise.resolve(write(next.value));
    } catch (error) {
      operation = Promise.reject(error);
    }
    void operation
      .then(() => next.resolve("applied"), next.reject)
      .then(
        () => {
          active = false;
          pump();
        },
        () => {
          active = false;
          pump();
        },
      );
  };

  return {
    currentEpoch() {
      return epoch;
    },
    enqueue(value, expectedEpoch = epoch, writeClass = "discardable") {
      if (expectedEpoch !== epoch) return Promise.resolve("superseded");
      return new Promise<SerializedCareSyncWriteResult>((resolve, reject) => {
        pending.push({
          epoch: expectedEpoch,
          writeClass,
          value,
          resolve,
          reject,
        });
        pump();
      });
    },
    discardPending() {
      const discarded = pending.filter(
        (item) => item.writeClass === "discardable",
      );
      const retained = pending.filter((item) => item.writeClass === "critical");
      pending.splice(0, pending.length, ...retained);
      for (const item of discarded) item.resolve("superseded");
      settleIdle();
      return discarded.length;
    },
    drain() {
      if (!active && pending.length === 0) return Promise.resolve();
      return new Promise<void>((resolve) => idleWaiters.push(resolve));
    },
    supersede(value) {
      epoch += 1;
      const supersedingEpoch = epoch;
      // Remote-cleanup ledgers are deliberately retained ahead of the wipe.
      // They contain no renderable owner data and are the only durable proof
      // needed to clean a CREATE whose response was lost during deletion.
      const discarded = pending.filter(
        (item) => item.writeClass === "discardable",
      );
      const retained = pending.filter((item) => item.writeClass === "critical");
      pending.splice(0, pending.length, ...retained);
      for (const item of discarded) item.resolve("superseded");
      return new Promise<SerializedCareSyncWriteResult>((resolve, reject) => {
        pending.push({
          epoch: supersedingEpoch,
          writeClass: "critical",
          value,
          resolve,
          reject,
        });
        pump();
      });
    },
  };
}
