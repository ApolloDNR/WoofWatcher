export type EntrySyncStatus = "local" | "pending" | "synced" | "failed";

export interface SyncableEntry {
  id: string;
  title?: string;
  occurredAt?: string;
  syncStatus?: EntrySyncStatus;
  syncError?: string;
}

export type CareSyncOutboxStatus = "idle" | "syncing" | "needs-retry";
export type CareSyncOutboxOperation = "create" | "update";

export interface CareSyncOutboxItem {
  id: string;
  title: string;
  occurredAt: string;
  status: EntrySyncStatus | "unknown";
  operation: CareSyncOutboxOperation;
  retryable: boolean;
  message: string;
  syncError?: string;
}

export interface CareSyncOutbox {
  status: CareSyncOutboxStatus;
  items: CareSyncOutboxItem[];
  total: number;
  pending: number;
  failed: number;
  local: number;
  retryable: number;
  retryableCreateIds: string[];
  retryableUpdateIds: string[];
  message: string;
  actionLabel: string;
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

function plural(value: number, singular: string, pluralValue = `${singular}s`) {
  return value === 1 ? singular : pluralValue;
}

function outboxMessage(retryable: number, pending: number): string {
  if (retryable > 0 && pending > 0) {
    return `${retryable} care ${plural(
      retryable,
      "change",
    )} need retry. ${pending} ${pending === 1 ? "is" : "are"} still syncing.`;
  }
  if (retryable > 0) {
    return `${retryable} care ${plural(retryable, "change")} need retry.`;
  }
  if (pending > 0) {
    return `${pending} care ${plural(pending, "change")} syncing.`;
  }
  return "All care changes are synced.";
}

function outboxItemMessage(entry: SyncableEntry, retryable: boolean): string {
  if (entry.syncStatus === "pending") return "Still syncing to the household.";
  if (entry.syncError) return entry.syncError;
  if (retryable) return "Ready to retry.";
  return "Waiting for sync.";
}

export function deriveCareSyncOutbox<T extends SyncableEntry>(
  entries: readonly T[],
): CareSyncOutbox {
  const items = entries
    .filter(isUnsyncedEntry)
    .sort((a, b) => timeValue(b) - timeValue(a))
    .map<CareSyncOutboxItem>((entry) => {
      const retryableCreate =
        shouldRetryCreate(entry) && entry.syncStatus !== "pending";
      const retryableUpdate = shouldRetryUpdate(entry);
      const retryable = retryableCreate || retryableUpdate;
      return {
        id: entry.id,
        title: entry.title?.trim() || "Care change",
        occurredAt: entry.occurredAt ?? "",
        status: entry.syncStatus ?? "unknown",
        operation: retryableCreate || entry.id.startsWith("temp_") ? "create" : "update",
        retryable,
        message: outboxItemMessage(entry, retryable),
        syncError: entry.syncError,
      };
    });
  const retryableCreateIds = items
    .filter((item) => item.operation === "create" && item.retryable)
    .map((item) => item.id);
  const retryableUpdateIds = items
    .filter((item) => item.operation === "update" && item.retryable)
    .map((item) => item.id);
  const retryable = retryableCreateIds.length + retryableUpdateIds.length;
  const pending = items.filter((item) => item.status === "pending").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const local = items.filter((item) => item.status === "local").length;
  const status: CareSyncOutboxStatus =
    items.length === 0 ? "idle" : retryable > 0 ? "needs-retry" : "syncing";

  return {
    status,
    items,
    total: items.length,
    pending,
    failed,
    local,
    retryable,
    retryableCreateIds,
    retryableUpdateIds,
    message: outboxMessage(retryable, pending),
    actionLabel: status === "idle" ? "Synced" : retryable > 0 ? "Retry sync" : "Syncing",
  };
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
