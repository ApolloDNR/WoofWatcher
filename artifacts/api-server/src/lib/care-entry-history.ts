export const CARE_ENTRY_HISTORY_CHANGED_ERROR =
  "Care history changed during pagination. Restart from the first page.";

export type CoherentCareEntryHistoryPage<T> =
  | {
      ok: true;
      historyGeneration: number;
      entries: T[];
    }
  | {
      ok: false;
      status: 409;
      error: string;
      currentGeneration: number;
    };

export async function readCoherentCareEntryHistoryPage<T>(input: {
  expectedGeneration?: number;
  readGeneration: () => Promise<number>;
  readRows: () => Promise<T[]>;
}): Promise<CoherentCareEntryHistoryPage<T>> {
  const before = await input.readGeneration();
  if (
    input.expectedGeneration !== undefined &&
    input.expectedGeneration !== before
  ) {
    return {
      ok: false,
      status: 409,
      error: CARE_ENTRY_HISTORY_CHANGED_ERROR,
      currentGeneration: before,
    };
  }

  const entries = await input.readRows();
  const after = await input.readGeneration();
  if (before !== after) {
    return {
      ok: false,
      status: 409,
      error: CARE_ENTRY_HISTORY_CHANGED_ERROR,
      currentGeneration: after,
    };
  }
  return {
    ok: true,
    historyGeneration: before,
    entries,
  };
}
