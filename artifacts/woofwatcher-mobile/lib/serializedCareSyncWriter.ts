export interface SerializedCareSyncWriter<T> {
  /** Current queue epoch; pass it through delayed callers to fence stale work. */
  currentEpoch: () => number;
  enqueue: (value: T, expectedEpoch?: number) => Promise<void>;
  /** Resolve and discard writes that have not started yet. */
  discardPending: () => number;
  /** Resolve after the active write and every still-queued write settle. */
  drain: () => Promise<void>;
  /**
   * Advance the epoch, discard queued older work, and make `value` the next
   * operation after any write that already reached the platform.
   */
  supersede: (value: T) => Promise<void>;
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
    value: T;
    resolve: () => void;
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
    void operation.then(next.resolve, next.reject).then(
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
    enqueue(value, expectedEpoch = epoch) {
      if (expectedEpoch !== epoch) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        pending.push({ epoch: expectedEpoch, value, resolve, reject });
        pump();
      });
    },
    discardPending() {
      const discarded = pending.splice(0);
      for (const item of discarded) item.resolve();
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
      const discarded = pending.splice(0);
      for (const item of discarded) item.resolve();
      return new Promise<void>((resolve, reject) => {
        pending.push({
          epoch: supersedingEpoch,
          value,
          resolve,
          reject,
        });
        pump();
      });
    },
  };
}
