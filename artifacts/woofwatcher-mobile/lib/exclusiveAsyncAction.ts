export type ExclusiveAsyncActionResult<T> =
  | { status: "complete"; value: T }
  | { status: "busy" };

export interface ExclusiveAsyncAction {
  isBusy(): boolean;
  run<T>(work: () => Promise<T>): Promise<ExclusiveAsyncActionResult<T>>;
}

/** A synchronous admission gate for native actions that must never queue. */
export function createExclusiveAsyncAction(): ExclusiveAsyncAction {
  let busy = false;
  return Object.freeze({
    isBusy: () => busy,
    async run<T>(work: () => Promise<T>) {
      if (busy) return { status: "busy" } as const;
      busy = true;
      try {
        return { status: "complete", value: await work() } as const;
      } finally {
        busy = false;
      }
    },
  });
}
