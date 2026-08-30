export interface CarePersistenceWriter<T> {
  enqueue(value: T): Promise<void>;
  drain(): Promise<void>;
  invalidateAndDrain(): Promise<void>;
}

export function createCarePersistenceWriter<T>(
  write: (value: T) => Promise<void>,
): CarePersistenceWriter<T> {
  interface QueuedWrite {
    generation: number;
    value: T;
    resolve: () => void;
    reject: (reason?: unknown) => void;
  }

  let generation = 0;
  let active: Promise<void> | null = null;
  const pending: QueuedWrite[] = [];
  const accepted = new Set<Promise<void>>();

  const pump = () => {
    if (active) return;
    const next = pending.shift();
    if (!next) return;
    if (next.generation !== generation) {
      next.resolve();
      pump();
      return;
    }

    let writeResult: Promise<void>;
    try {
      writeResult = write(next.value);
    } catch (error) {
      next.reject(error);
      pump();
      return;
    }
    active = Promise.resolve(writeResult).then(next.resolve, next.reject);
    void active.then(() => {
      active = null;
      pump();
    });
  };

  return {
    enqueue(value) {
      const acceptedGeneration = generation;
      const result = new Promise<void>((resolve, reject) => {
        pending.push({
          generation: acceptedGeneration,
          value,
          resolve,
          reject,
        });
      });
      accepted.add(result);
      void result.then(
        () => accepted.delete(result),
        () => accepted.delete(result),
      );
      pump();
      return result;
    },
    drain() {
      return Promise.allSettled([...accepted]).then(() => {});
    },
    invalidateAndDrain() {
      generation += 1;
      const activeAtInvalidation = active;
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const queued = pending[index]!;
        if (queued.generation === generation) continue;
        pending.splice(index, 1);
        queued.resolve();
      }
      pump();
      return activeAtInvalidation ?? Promise.resolve();
    },
  };
}
