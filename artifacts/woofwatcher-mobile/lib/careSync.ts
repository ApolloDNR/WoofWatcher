export type EntrySyncStatus = "local" | "pending" | "synced" | "failed";

export interface SyncableEntry {
  id: string;
  occurredAt?: string;
  syncStatus?: EntrySyncStatus;
  syncError?: string;
}

export function withSyncedStatus<T extends SyncableEntry>(
  entries: readonly T[],
): Array<T & { syncStatus: "synced"; syncError: undefined }> {
  return entries.map((entry) => ({
    ...entry,
    syncStatus: "synced" as const,
    syncError: undefined,
  }));
}

export function isUnsyncedEntry(
  entry: Pick<SyncableEntry, "id" | "syncStatus">,
): boolean {
  return (
    entry.id.startsWith("temp_") ||
    entry.syncStatus === "local" ||
    entry.syncStatus === "pending" ||
    entry.syncStatus === "failed"
  );
}

export function shouldRetryCreate(
  entry: Pick<SyncableEntry, "id" | "syncStatus">,
): boolean {
  return (
    entry.id.startsWith("temp_") ||
    (entry.syncStatus === "local" && entry.id.startsWith("local_"))
  );
}

export function shouldRetryUpdate(
  entry: Pick<SyncableEntry, "id" | "syncStatus">,
): boolean {
  return (
    (entry.syncStatus === "failed" || entry.syncStatus === "local") &&
    !shouldRetryCreate(entry)
  );
}

function timeValue(entry: SyncableEntry): number {
  const parsed = Date.parse(entry.occurredAt ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function mergeServerAndLocalEntries<T extends SyncableEntry>(
  localEntries: readonly T[],
  serverEntries: readonly T[],
): T[] {
  const unsyncedLocal = localEntries.filter(isUnsyncedEntry);
  const localIds = new Set(unsyncedLocal.map((entry) => entry.id));
  const serverSynced = withSyncedStatus(
    serverEntries.filter((entry) => !localIds.has(entry.id)),
  );

  return [...unsyncedLocal, ...serverSynced].sort(
    (a, b) => timeValue(b) - timeValue(a),
  ) as T[];
}
