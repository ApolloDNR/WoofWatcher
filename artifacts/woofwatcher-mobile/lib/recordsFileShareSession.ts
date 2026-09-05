export interface RecordsFileShareSession {
  isPending: () => boolean;
  run: (task: () => Promise<void>, onPendingChange?: (pending: boolean) => void) => Promise<boolean>;
}

export function createRecordsFileShareSession(): RecordsFileShareSession {
  let pending = false;
  return {
    isPending: () => pending,
    run: async (task, onPendingChange) => {
      if (pending) return false;
      pending = true;
      onPendingChange?.(true);
      try {
        await task();
        return true;
      } finally {
        pending = false;
        onPendingChange?.(false);
      }
    },
  };
}
