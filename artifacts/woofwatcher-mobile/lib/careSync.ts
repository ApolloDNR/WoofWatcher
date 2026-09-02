import { CARE_ENTRY_SYNC_REVISION_KEY } from "@workspace/care-domain";

export { createSerializedCareSyncWriter } from "./serializedCareSyncWriter.ts";
export type { SerializedCareSyncWriter } from "./serializedCareSyncWriter.ts";

export type EntrySyncStatus = "local" | "pending" | "synced" | "failed";

export interface SyncableEntry {
  id: string;
  title?: string;
  occurredAt?: string;
  syncStatus?: EntrySyncStatus;
  syncError?: string;
  details?: Record<string, unknown> | null;
  pendingSyncPatch?: object;
}

export interface CareEntryPendingDelete {
  readonly __woofWatcherPendingDelete: "delete-v1";
}

export const CARE_ENTRY_PENDING_DELETE: CareEntryPendingDelete = Object.freeze({
  __woofWatcherPendingDelete: "delete-v1",
});

export function isCareEntryPendingDelete(
  value: unknown,
): value is CareEntryPendingDelete {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Partial<CareEntryPendingDelete>).__woofWatcherPendingDelete ===
      "delete-v1"
  );
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
  reviewRequiredIds: string[];
  message: string;
  actionLabel: string;
}

export type CareSyncDashboardStatus =
  | "loading"
  | "syncing"
  | "attention"
  | "healthy";

export interface CareSyncDashboardMetric {
  label: string;
  value: string;
  detail: string;
}

export interface CareSyncDashboardInput {
  outbox: CareSyncOutbox;
  isLoaded: boolean;
  isSyncing: boolean;
  lastUpdatedAt?: string;
  householdMemberCount: number;
  totalEntries: number;
}

export interface CareSyncDashboard {
  status: CareSyncDashboardStatus;
  title: string;
  message: string;
  nextStep: string;
  actionLabel: string;
  metrics: CareSyncDashboardMetric[];
}

export interface SyncableCareDoc {
  updatedAt?: string;
}

export type CareDocRefreshStatus =
  | "seed-server"
  | "accept-server"
  | "keep-local-newer"
  | "accept-server-read-only"
  | "keep-local-unverified";

export type CareDocRefreshWriteAccess = "allowed" | "restricted" | "unverified";

export interface CareDocRefreshInput<T extends SyncableCareDoc> {
  localDoc: T;
  localVersion: number;
  serverDoc?: Partial<T> | null;
  serverVersion: number;
  serverUpdatedAt?: string | Date | null;
  writeAccess?: CareDocRefreshWriteAccess;
}

export interface CareDocRefreshPlan<T extends SyncableCareDoc> {
  status: CareDocRefreshStatus;
  doc: T | Partial<T>;
  version: number;
  shouldPushLocal: boolean;
  message: string;
}

export type CareEntryRefreshPlan =
  | {
      mode: "full";
      params: undefined;
      boundary: string;
    }
  | {
      mode: "incremental";
      params: { since: string };
      boundary: string;
    };

export interface CareEntryRefreshPlanInput {
  hasUpdatedAtCursor: boolean;
  hasDeleteTombstones: boolean;
  latestSyncedAt?: string;
}

const DEVICE_ONLY_CARE_DETAIL_KEYS = ["route", "routeDistanceM"] as const;

/**
 * The exact GPS trace and its GPS-derived distance stay in the device cache.
 * Care-entry sync may still carry non-location walk context such as the
 * owner-entered route name, duration, social outcome, and notes.
 */
export function sanitizeCareEntryDetailsForSync(
  details: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const shareable = { ...(details ?? {}) };
  for (const key of DEVICE_ONLY_CARE_DETAIL_KEYS) {
    delete shareable[key];
  }
  return shareable;
}

function preserveDeviceOnlyCareDetails(
  local: Record<string, unknown> | null | undefined,
  server: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  const merged = server == null ? server : { ...server };
  let next = merged;
  for (const key of DEVICE_ONLY_CARE_DETAIL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(local ?? {}, key)) continue;
    if (next == null) next = {};
    next[key] = local![key];
  }
  return next;
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

export function adoptServerEntry<T extends SyncableEntry>(
  localEntry: T,
  serverEntry: T,
): T & { syncStatus: "synced"; syncError: undefined } {
  return {
    ...localEntry,
    ...serverEntry,
    details: preserveDeviceOnlyCareDetails(
      localEntry.details,
      serverEntry.details,
    ),
    syncStatus: "synced",
    syncError: undefined,
  };
}

type CareEntryPendingFields<T extends SyncableEntry> = Omit<
  T,
  "id" | "syncStatus" | "syncError" | "pendingSyncPatch"
>;

export type CareEntryPendingSyncPatch<T extends SyncableEntry> = {
  [K in keyof CareEntryPendingFields<T>]?: K extends "details"
    ? CareEntryPendingFields<T>[K]
    : CareEntryPendingFields<T>[K] | CareEntryPendingDelete;
};

function careEntryDetailValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export function diffCareEntryPendingDetails(
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const before = previous ?? {};
  const after = next ?? {};
  const patch: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    // Revision is transport state, not an owner edit. Conflict recovery
    // always derives it from the winning server row.
    if (key === CARE_ENTRY_SYNC_REVISION_KEY) continue;
    if (!Object.prototype.hasOwnProperty.call(after, key)) {
      patch[key] = null;
      continue;
    }
    if (!careEntryDetailValuesEqual(before[key], after[key])) {
      patch[key] = after[key];
    }
  }
  return patch;
}

export function mergeCareEntryPendingSyncPatch<T extends SyncableEntry>(
  previous: CareEntryPendingSyncPatch<T> | null | undefined,
  next: CareEntryPendingSyncPatch<T>,
): CareEntryPendingSyncPatch<T> {
  const merged = {
    ...(previous ?? {}),
  } as CareEntryPendingSyncPatch<T>;
  const mergedRecord = merged as Record<string, unknown>;
  for (const [key, value] of Object.entries(next)) {
    // AsyncStorage serializes state as JSON, which drops properties whose
    // value is undefined. Encode explicit top-level clears so they survive a
    // restart and can still win during a later conflict rebase.
    mergedRecord[key] =
      key !== "details" && value === undefined
        ? CARE_ENTRY_PENDING_DELETE
        : value;
  }
  const previousDetails = previous?.details;
  const nextHasDetails = Object.prototype.hasOwnProperty.call(next, "details");
  if (
    nextHasDetails &&
    next.details &&
    typeof next.details === "object" &&
    !Array.isArray(next.details)
  ) {
    (
      merged as {
        details?: Record<string, unknown> | null;
      }
    ).details = {
      ...(previousDetails &&
      typeof previousDetails === "object" &&
      !Array.isArray(previousDetails)
        ? previousDetails
        : {}),
      ...(next.details as Record<string, unknown>),
    };
  }
  return merged;
}

/**
 * Replays only fields edited locally over the newest server row. This avoids
 * resolving a 409 by writing an entire stale local snapshot over another
 * caregiver's newer fields.
 */
export function rebaseCareEntryAfterConflict<T extends SyncableEntry>(
  localEntry: T,
  serverEntry: T,
  pendingPatch: CareEntryPendingSyncPatch<T>,
): T {
  const adopted = adoptServerEntry(localEntry, serverEntry);
  const pendingDetails =
    pendingPatch.details &&
    typeof pendingPatch.details === "object" &&
    !Array.isArray(pendingPatch.details)
      ? (pendingPatch.details as Record<string, unknown>)
      : null;
  const replayed = {
    ...adopted,
  } as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(pendingPatch)) {
    if (key === "details") continue;
    if (isCareEntryPendingDelete(value)) {
      delete replayed[key];
    } else {
      replayed[key] = value;
    }
  }
  replayed.id = serverEntry.id;
  replayed.details = pendingDetails
    ? {
        ...(adopted.details ?? {}),
        ...pendingDetails,
      }
    : adopted.details;
  replayed.syncStatus = "pending";
  replayed.syncError = undefined;
  return replayed as unknown as T;
}

export function applyQueuedPatchToAcknowledgedEntry<T extends SyncableEntry>(
  acknowledgedEntry: T,
  queuedPatch: Partial<T>,
  willSync = true,
): T {
  return {
    ...acknowledgedEntry,
    ...queuedPatch,
    id: acknowledgedEntry.id,
    syncStatus: willSync ? "pending" : "local",
    syncError: willSync ? undefined : "Saved on this device.",
  };
}

export function prepareCareEntryForOfflineEdit<T extends SyncableEntry>(
  entry: T,
  patch: Partial<T>,
  pendingSyncPatch?: CareEntryPendingSyncPatch<T>,
): T {
  return {
    ...entry,
    ...patch,
    ...(pendingSyncPatch ? { pendingSyncPatch } : {}),
    id: entry.id,
    syncStatus: "local",
    syncError: "Saved on this device.",
  } as T;
}

export function recoverInterruptedCareEntryMutations<T extends SyncableEntry>(
  entries: readonly T[],
): T[] {
  return entries.map((entry) =>
    entry.syncStatus === "pending"
      ? ({
          ...entry,
          syncStatus: "failed",
          syncError: "Previous sync was interrupted. Ready to retry.",
        } as T)
      : entry,
  );
}

export function migrateAcknowledgedTempEntryForRetry<T extends SyncableEntry>(
  localEntry: T,
  serverEntry: T,
): T {
  const serverClientKey = serverEntry.details?.clientKey;
  const details = {
    ...(serverEntry.details ?? {}),
    ...(localEntry.details ?? {}),
    ...(typeof serverClientKey === "string"
      ? { clientKey: serverClientKey }
      : {}),
  };
  return {
    ...serverEntry,
    ...localEntry,
    id: serverEntry.id,
    details,
    syncStatus: "failed",
    syncError:
      "The server saved the first version. Ready to sync your latest changes.",
  };
}

export function findCreatedCareEntryLocalSnapshot<T extends SyncableEntry>(
  entries: readonly T[],
  tempId: string,
  serverEntryId: string,
): T | undefined {
  return (
    entries.find((entry) => entry.id === tempId) ??
    entries.find(
      (entry) =>
        entry.id === serverEntryId && entry.details?.clientKey === tempId,
    )
  );
}

export interface SerializedCareEntryMutationQueueOptions<TInput, TResult> {
  mutate: (
    entryId: string,
    input: TInput,
    signal: AbortSignal,
  ) => Promise<TResult>;
  onSuccess: (entryId: string, input: TInput, result: TResult) => void;
  onFailure: (entryId: string, input: TInput, error: unknown) => void;
  timeoutMs?: number;
  timeoutScheduler?: {
    schedule: (callback: () => void, delayMs: number) => unknown;
    cancel: (handle: unknown) => void;
  };
}

export interface SerializedCareEntryMutationQueue<TInput> {
  enqueue: (entryId: string, input: TInput) => number;
  cancel: (entryId: string) => void;
  cancelAll: () => void;
}

export interface CareEntryDeleteFenceLease {
  release: () => void;
}

export interface CareEntryDeleteFence {
  isDeleting: (entryId: string) => boolean;
  tryAcquire: (entryIds: readonly string[]) => CareEntryDeleteFenceLease | null;
  clear: () => void;
}

export interface CareSyncRequestTimeoutOptions {
  timeoutMs?: number;
  timeoutScheduler?: {
    schedule: (callback: () => void, delayMs: number) => unknown;
    cancel: (handle: unknown) => void;
  };
}

export class CareSyncRequestTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Care sync request timed out after ${timeoutMs}ms.`);
    this.name = "CareSyncRequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/** Runs provider I/O with an abort signal and a deterministic time bound. */
export function runCareSyncRequestWithTimeout<T>(
  request: (signal: AbortSignal) => Promise<T>,
  {
    timeoutMs = 30_000,
    timeoutScheduler = {
      schedule: (callback, delayMs) => setTimeout(callback, delayMs),
      cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    },
  }: CareSyncRequestTimeoutOptions = {},
): Promise<T> {
  const effectiveTimeoutMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30_000;
  const abortController = new AbortController();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeoutHandle = timeoutScheduler.schedule(() => {
      if (settled) return;
      settled = true;
      abortController.abort();
      reject(new CareSyncRequestTimeoutError(effectiveTimeoutMs));
    }, effectiveTimeoutMs);

    let operation: Promise<T>;
    try {
      operation = Promise.resolve(request(abortController.signal));
    } catch (error) {
      operation = Promise.reject(error);
    }
    void operation.then(
      (result) => {
        if (settled) return;
        settled = true;
        timeoutScheduler.cancel(timeoutHandle);
        resolve(result);
      },
      (error) => {
        if (settled) return;
        settled = true;
        timeoutScheduler.cancel(timeoutHandle);
        reject(error);
      },
    );
  });
}

/**
 * Prevents edits and duplicate deletes from racing a durable delete setup.
 * Leases are epoch-owned so a pre-erase finally cannot release a newer fence.
 */
export function createCareEntryDeleteFence(): CareEntryDeleteFence {
  const deletingEntryIds = new Set<string>();
  let epoch = 0;

  return {
    isDeleting(entryId) {
      return deletingEntryIds.has(entryId);
    },
    tryAcquire(entryIds) {
      const aliases = [
        ...new Set(
          entryIds
            .filter((entryId): entryId is string => typeof entryId === "string")
            .map((entryId) => entryId.trim())
            .filter(Boolean),
        ),
      ];
      if (
        aliases.length === 0 ||
        aliases.some((entryId) => deletingEntryIds.has(entryId))
      ) {
        return null;
      }

      for (const entryId of aliases) deletingEntryIds.add(entryId);
      const leaseEpoch = epoch;
      let released = false;
      return {
        release() {
          if (released) return;
          released = true;
          if (epoch !== leaseEpoch) return;
          for (const entryId of aliases) deletingEntryIds.delete(entryId);
        },
      };
    },
    clear() {
      epoch += 1;
      deletingEntryIds.clear();
    },
  };
}

export class CareSyncMutationTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Care entry sync timed out after ${timeoutMs}ms.`);
    this.name = "CareSyncMutationTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class CareEntryConflictRetryError<TInput> extends Error {
  readonly rebasedInput: TInput;
  readonly originalError: unknown;

  constructor(rebasedInput: TInput, originalError: unknown) {
    super("Care entry conflict rebase retry failed.");
    this.name = "CareEntryConflictRetryError";
    this.rebasedInput = rebasedInput;
    this.originalError = originalError;
  }
}

export interface RetryCareEntryMutationAfterConflictInput<
  TInput,
  TServer,
  TResult,
> {
  error: unknown;
  input: TInput;
  isConflict: (error: unknown) => boolean;
  fetchCurrent: () => Promise<TServer | null | undefined>;
  rebase: (input: TInput, server: TServer) => TInput | null;
  mutate: (rebasedInput: TInput) => Promise<TResult>;
}

/**
 * Fetches the winning server row after a 409, replays the durable local patch
 * once, and preserves that rebased input if the retry itself fails.
 */
export async function retryCareEntryMutationAfterConflict<
  TInput,
  TServer,
  TResult,
>({
  error,
  input,
  isConflict,
  fetchCurrent,
  rebase,
  mutate,
}: RetryCareEntryMutationAfterConflictInput<
  TInput,
  TServer,
  TResult
>): Promise<TResult> {
  if (!isConflict(error)) throw error;
  const current = await fetchCurrent();
  if (!current) throw error;
  const rebasedInput = rebase(input, current);
  if (!rebasedInput) throw error;

  try {
    return await mutate(rebasedInput);
  } catch (retryError) {
    throw new CareEntryConflictRetryError(rebasedInput, retryError);
  }
}

/**
 * Runs at most one write per care entry at a time and coalesces edits made
 * while that write is in flight to the latest snapshot. Results only reach
 * the caller when they still belong to the newest local generation.
 */
export function createSerializedCareEntryMutationQueue<TInput, TResult>({
  mutate,
  onSuccess,
  onFailure,
  timeoutMs = 30_000,
  timeoutScheduler = {
    schedule: (callback, delayMs) => setTimeout(callback, delayMs),
    cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
}: SerializedCareEntryMutationQueueOptions<
  TInput,
  TResult
>): SerializedCareEntryMutationQueue<TInput> {
  type PendingMutation = {
    generation: number;
    epoch: number;
    input: TInput;
  };

  const latestGeneration = new Map<string, number>();
  const queued = new Map<string, PendingMutation>();
  const inFlight = new Set<string>();
  const abortControllers = new Map<string, AbortController>();
  const effectiveTimeoutMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30_000;
  let epoch = 0;

  const pump = (entryId: string) => {
    if (inFlight.has(entryId)) return;
    const pending = queued.get(entryId);
    if (!pending) return;
    queued.delete(entryId);
    inFlight.add(entryId);
    const abortController = new AbortController();
    abortControllers.set(entryId, abortController);

    let mutation: Promise<TResult>;
    try {
      mutation = Promise.resolve(
        mutate(entryId, pending.input, abortController.signal),
      );
    } catch (error) {
      mutation = Promise.reject(error);
    }

    const boundedMutation = new Promise<TResult>((resolve, reject) => {
      let settled = false;
      const timer = timeoutScheduler.schedule(() => {
        if (settled) return;
        settled = true;
        abortController.abort();
        reject(new CareSyncMutationTimeoutError(effectiveTimeoutMs));
      }, effectiveTimeoutMs);

      mutation.then(
        (result) => {
          if (settled) return;
          settled = true;
          timeoutScheduler.cancel(timer);
          resolve(result);
        },
        (error) => {
          if (settled) return;
          settled = true;
          timeoutScheduler.cancel(timer);
          reject(error);
        },
      );
    });

    void boundedMutation
      .then(
        (result) => {
          if (
            pending.epoch === epoch &&
            latestGeneration.get(entryId) === pending.generation
          ) {
            onSuccess(entryId, pending.input, result);
          }
        },
        (error) => {
          if (
            pending.epoch === epoch &&
            latestGeneration.get(entryId) === pending.generation
          ) {
            onFailure(entryId, pending.input, error);
          }
        },
      )
      .then(
        () => {
          if (abortControllers.get(entryId) === abortController) {
            abortControllers.delete(entryId);
          }
          inFlight.delete(entryId);
          pump(entryId);
        },
        () => {
          // A state callback must never strand a newer queued mutation.
          if (abortControllers.get(entryId) === abortController) {
            abortControllers.delete(entryId);
          }
          inFlight.delete(entryId);
          pump(entryId);
        },
      );
  };

  return {
    enqueue(entryId, input) {
      const generation = (latestGeneration.get(entryId) ?? 0) + 1;
      latestGeneration.set(entryId, generation);
      queued.set(entryId, { generation, epoch, input });
      pump(entryId);
      return generation;
    },
    cancel(entryId) {
      abortControllers.get(entryId)?.abort();
      latestGeneration.set(entryId, (latestGeneration.get(entryId) ?? 0) + 1);
      queued.delete(entryId);
    },
    cancelAll() {
      for (const controller of abortControllers.values()) {
        controller.abort();
      }
      abortControllers.clear();
      epoch += 1;
      latestGeneration.clear();
      queued.clear();
    },
  };
}

export interface CreatedCareEntryAcknowledgementInput<T extends SyncableEntry> {
  localEntry?: T;
  serverEntry: T;
  createWasRetried?: boolean;
  tempWasCancelled: boolean;
  eraseGenerationAtStart: number;
  currentEraseGeneration: number;
  deleteServerEntry: (serverEntryId: string) => Promise<unknown>;
}

export type CreatedCareEntryAcknowledgement<T extends SyncableEntry> =
  | {
      status: "adopted";
      entry: T;
    }
  | {
      status: "discarded";
      serverEntryId: string;
      deleteSucceeded: boolean;
    };

export async function reconcileCreatedCareEntryAcknowledgement<
  T extends SyncableEntry,
>({
  localEntry,
  serverEntry,
  createWasRetried = false,
  tempWasCancelled,
  eraseGenerationAtStart,
  currentEraseGeneration,
  deleteServerEntry,
}: CreatedCareEntryAcknowledgementInput<T>): Promise<
  CreatedCareEntryAcknowledgement<T>
> {
  const shouldDiscard =
    tempWasCancelled || eraseGenerationAtStart !== currentEraseGeneration;
  if (!shouldDiscard) {
    let entry: T;
    if (!localEntry) {
      entry = adoptServerEntry(serverEntry, serverEntry);
    } else if (
      localEntry.id === serverEntry.id &&
      isUnsyncedEntry(localEntry)
    ) {
      entry = localEntry;
    } else if (createWasRetried) {
      entry = migrateAcknowledgedTempEntryForRetry(localEntry, serverEntry);
    } else {
      entry = adoptServerEntry(localEntry, serverEntry);
    }
    return {
      status: "adopted",
      entry,
    };
  }

  let deleteSucceeded = false;
  try {
    await deleteServerEntry(serverEntry.id);
    deleteSucceeded = true;
  } catch {
    // The caller keeps this id suppressed and retries deletion on refresh.
  }
  return {
    status: "discarded",
    serverEntryId: serverEntry.id,
    deleteSucceeded,
  };
}

export function normalizeDiscardedServerEntryIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((entryId): entryId is string => typeof entryId === "string")
        .map((entryId) => entryId.trim())
        .filter(Boolean),
    ),
  ];
}

export function addDiscardedServerEntryId(
  entryIds: readonly string[],
  entryId: string,
): string[] {
  return normalizeDiscardedServerEntryIds([...entryIds, entryId]);
}

export function removeDiscardedServerEntryId(
  entryIds: readonly string[],
  entryId: string,
): string[] {
  return normalizeDiscardedServerEntryIds(entryIds).filter(
    (current) => current !== entryId,
  );
}

export interface ClearDiscardedServerEntryDurablyInput {
  entryId: string;
  readEntryIds: () => readonly string[];
  applyEntryIds: (entryIds: readonly string[]) => void;
  persistEntryIds: (entryIds: readonly string[]) => Promise<void>;
}

/**
 * Clears one deletion tombstone only when that clear is durable. A failed
 * clear restores the live intent and appends a corrective write after any
 * mutations that queued while the first storage operation was in flight.
 */
export async function clearDiscardedServerEntryDurably({
  entryId,
  readEntryIds,
  applyEntryIds,
  persistEntryIds,
}: ClearDiscardedServerEntryDurablyInput): Promise<boolean> {
  const current = normalizeDiscardedServerEntryIds(readEntryIds());
  if (!current.includes(entryId)) return true;

  const cleared = removeDiscardedServerEntryId(current, entryId);
  applyEntryIds(cleared);
  try {
    await persistEntryIds(cleared);
    return true;
  } catch {
    const retained = addDiscardedServerEntryId(readEntryIds(), entryId);
    applyEntryIds(retained);
    try {
      await persistEntryIds(retained);
    } catch {
      // The caller keeps the in-memory tombstone and surfaces storage failure.
    }
    return false;
  }
}

export function selectWoofWatcherKeysForOwnerWipe(
  keys: readonly string[],
  deletionLedgerKeyPrefix: string,
): string[] {
  return keys.filter(
    (key) =>
      key.startsWith("woofwatcher") &&
      key !== deletionLedgerKeyPrefix &&
      !key.startsWith(`${deletionLedgerKeyPrefix}.account.`),
  );
}

export function filterDiscardedServerEntries<
  T extends {
    id: string;
    details?: Record<string, unknown> | null;
  },
>(
  entries: readonly T[],
  ...discardedEntryIdGroups: ReadonlyArray<readonly string[]>
): T[] {
  const discarded = new Set(
    normalizeDiscardedServerEntryIds(discardedEntryIdGroups.flat()),
  );
  return entries.filter((entry) => {
    const clientKey = entry.details?.clientKey;
    return (
      !discarded.has(entry.id) &&
      !(typeof clientKey === "string" && discarded.has(clientKey))
    );
  });
}

export interface DiscardedServerEntryCleanupInput<T extends { id: string }> {
  rows: readonly T[];
  markDiscarded: (entryId: string) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  clearDiscarded: (entryId: string) => Promise<void>;
  shouldContinue?: () => boolean;
}

export async function cleanupDiscardedServerEntryRows<
  T extends { id: string },
>({
  rows,
  markDiscarded,
  deleteEntry,
  clearDiscarded,
  shouldContinue = () => true,
}: DiscardedServerEntryCleanupInput<T>): Promise<boolean> {
  if (rows.length === 0) return false;
  let allRemoved = true;

  for (const row of rows) {
    if (!shouldContinue()) return false;
    try {
      await markDiscarded(row.id);
      await deleteEntry(row.id);
      await clearDiscarded(row.id);
    } catch {
      allRemoved = false;
    }
  }

  return allRemoved && shouldContinue();
}

export function restoreEntryAfterDeleteFailure<T extends SyncableEntry>(
  entries: readonly T[],
  removedEntry: T,
): T[] {
  const retryableEntry =
    removedEntry.syncStatus === "pending"
      ? ({
          ...removedEntry,
          syncStatus: "failed",
          syncError: "Delete failed. Saved changes are ready to retry.",
        } as T)
      : removedEntry;
  return [
    retryableEntry,
    ...entries.filter((entry) => entry.id !== retryableEntry.id),
  ];
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
  entry: Pick<SyncableEntry, "id" | "syncStatus" | "pendingSyncPatch">,
): boolean {
  return (
    (entry.syncStatus === "failed" || entry.syncStatus === "local") &&
    !shouldRetryCreate(entry) &&
    !!entry.pendingSyncPatch &&
    Object.keys(entry.pendingSyncPatch).length > 0
  );
}

export function requiresCareEntrySyncReview(
  entry: Pick<SyncableEntry, "id" | "syncStatus" | "pendingSyncPatch">,
): boolean {
  return (
    (entry.syncStatus === "failed" || entry.syncStatus === "local") &&
    !shouldRetryCreate(entry) &&
    (!entry.pendingSyncPatch ||
      Object.keys(entry.pendingSyncPatch).length === 0)
  );
}

export type CareEntryEditSyncDisposition =
  | "review-required"
  | "queue"
  | "local";

/**
 * Decides the persistence path before an owner edit is journaled. A legacy
 * row without a complete field journal stays quarantined for review in both
 * auth states; sign-out must never turn a partial edit into the row's entire
 * conflict-recovery history.
 */
export function decideCareEntryEditSyncDisposition(
  entry: Pick<SyncableEntry, "id" | "syncStatus" | "pendingSyncPatch">,
  signedIn: boolean,
): CareEntryEditSyncDisposition {
  if (requiresCareEntrySyncReview(entry)) return "review-required";
  return signedIn ? "queue" : "local";
}

function timeValue(entry: SyncableEntry): number {
  const parsed = Date.parse(entry.occurredAt ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function plural(value: number, singular: string, pluralValue = `${singular}s`) {
  return value === 1 ? singular : pluralValue;
}

function outboxMessage(
  retryable: number,
  pending: number,
  reviewRequired: number,
): string {
  if (reviewRequired > 0) {
    const reviewMessage = `${reviewRequired} older care ${plural(
      reviewRequired,
      "change",
    )} ${reviewRequired === 1 ? "is" : "are"} preserved on this device for support review.`;
    if (retryable > 0 || pending > 0) {
      return `${reviewMessage} ${retryable} can retry; ${pending} still syncing.`;
    }
    return reviewMessage;
  }
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
  return "Preserved on this device for support review before household sync.";
}

function formatCareSyncTime(value?: string): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return new Date(time).toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateValue(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string" || !value.trim()) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function careDocTime(
  doc: Partial<SyncableCareDoc> | null | undefined,
  fallback?: string | Date | null,
): number {
  const docTime = dateValue(doc?.updatedAt);
  return Number.isNaN(docTime) ? dateValue(fallback) : docTime;
}

export function reconcileCareDocFromServer<T extends SyncableCareDoc>({
  localDoc,
  localVersion,
  serverDoc,
  serverVersion,
  serverUpdatedAt,
  writeAccess = "allowed",
}: CareDocRefreshInput<T>): CareDocRefreshPlan<T> {
  if (writeAccess === "restricted") {
    return {
      status: "accept-server-read-only",
      doc: serverDoc ?? {},
      version: serverVersion,
      shouldPushLocal: false,
      message:
        "Using the household version because this membership is read-only for shared plans.",
    };
  }

  if (!serverDoc || Object.keys(serverDoc).length === 0) {
    if (writeAccess === "unverified") {
      return {
        status: "keep-local-unverified",
        doc: localDoc,
        version: serverVersion,
        shouldPushLocal: false,
        message:
          "Keeping this device's care plan until shared-edit access can be verified.",
      };
    }
    return {
      status: "seed-server",
      doc: localDoc,
      version: serverVersion,
      shouldPushLocal: true,
      message: "Seeding household care from this device.",
    };
  }

  const localTime = careDocTime(localDoc);
  const serverTime = careDocTime(serverDoc, serverUpdatedAt);
  const localIsNewer =
    !Number.isNaN(localTime) &&
    (Number.isNaN(serverTime) || localTime > serverTime);
  const localVersionIsAhead = localVersion > serverVersion;

  if (localIsNewer || localVersionIsAhead) {
    if (writeAccess === "unverified") {
      return {
        status: "keep-local-unverified",
        doc: localDoc,
        version: serverVersion,
        shouldPushLocal: false,
        message:
          "Keeping this device's newer care plan without sharing it until access is verified.",
      };
    }
    return {
      status: "keep-local-newer",
      doc: localDoc,
      version: serverVersion,
      shouldPushLocal: true,
      message:
        "Keeping newer offline care changes and sending them back to the household.",
    };
  }

  return {
    status: "accept-server",
    doc: serverDoc,
    version: serverVersion,
    shouldPushLocal: false,
    message: "Using the latest household care from the server.",
  };
}

export function buildCareEntryRefreshPlan({
  hasUpdatedAtCursor,
  hasDeleteTombstones,
  latestSyncedAt,
}: CareEntryRefreshPlanInput): CareEntryRefreshPlan {
  const latestSyncedTime = Date.parse(latestSyncedAt ?? "");
  const canUseIncremental =
    hasUpdatedAtCursor &&
    hasDeleteTombstones &&
    !Number.isNaN(latestSyncedTime);

  if (canUseIncremental) {
    return {
      mode: "incremental",
      params: { since: new Date(latestSyncedTime).toISOString() },
      boundary:
        "Incremental care-entry refresh uses a server update cursor with delete tombstones.",
    };
  }

  return {
    mode: "full",
    params: undefined,
    boundary:
      "Full care-entry refresh required until the API exposes an updatedAt cursor and delete tombstones.",
  };
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
        operation:
          retryableCreate || entry.id.startsWith("temp_") ? "create" : "update",
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
  const reviewRequiredIds = items
    .filter(
      (item) =>
        !item.retryable &&
        item.status !== "pending" &&
        item.operation === "update",
    )
    .map((item) => item.id);
  const retryable = retryableCreateIds.length + retryableUpdateIds.length;
  const pending = items.filter((item) => item.status === "pending").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const local = items.filter((item) => item.status === "local").length;
  const reviewRequired = reviewRequiredIds.length;
  const status: CareSyncOutboxStatus =
    items.length === 0
      ? "idle"
      : retryable > 0 || reviewRequired > 0
        ? "needs-retry"
        : "syncing";

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
    reviewRequiredIds,
    message: outboxMessage(retryable, pending, reviewRequired),
    actionLabel:
      status === "idle"
        ? "Synced"
        : retryable > 0
          ? "Retry sync"
          : reviewRequired > 0
            ? "View saved changes"
            : "Syncing",
  };
}

export function deriveCareSyncDashboard({
  outbox,
  isLoaded,
  isSyncing,
  lastUpdatedAt,
  householdMemberCount,
  totalEntries,
}: CareSyncDashboardInput): CareSyncDashboard {
  const metrics: CareSyncDashboardMetric[] = [
    {
      label: "Care log",
      value: `${totalEntries} ${plural(totalEntries, "entry", "entries")}`,
      detail: "Visible care history",
    },
    {
      label: "Care team",
      value: `${householdMemberCount} ${plural(
        householdMemberCount,
        "member",
      )}`,
      detail: "Household sync scope",
    },
    {
      label: "Outbox",
      value: `${outbox.total} waiting`,
      detail: `${outbox.retryable} retryable`,
    },
  ];

  if (!isLoaded) {
    return {
      status: "loading",
      title: "Opening care cache",
      message: "Checking saved care before household sync starts.",
      nextStep:
        "WoofWatcher will show retry options if anything needs attention.",
      actionLabel: "Refresh",
      metrics,
    };
  }

  if (outbox.status === "needs-retry") {
    const canRetry = outbox.retryable > 0;
    return {
      status: "attention",
      title: canRetry ? "Sync needs attention" : "Review saved changes",
      message: outbox.message,
      nextStep: canRetry
        ? "Retry sync so every caregiver sees the latest care."
        : "Open the preserved entries to identify them. Contact support before enabling household sync for those older changes.",
      actionLabel: canRetry ? "Retry sync" : "View saved changes",
      metrics,
    };
  }

  if (isSyncing || outbox.pending > 0) {
    return {
      status: "syncing",
      title: "Syncing household care",
      message: outbox.message,
      nextStep:
        "Keep WoofWatcher open while the latest care reaches the household.",
      actionLabel: "Syncing",
      metrics,
    };
  }

  const formatted = formatCareSyncTime(lastUpdatedAt);
  return {
    status: "healthy",
    title: "Household sync is current",
    message: "Every visible care log is available to the household.",
    nextStep: formatted
      ? `Last care update: ${formatted}.`
      : "No care entries are waiting to sync.",
    actionLabel: "Refresh",
    metrics,
  };
}

export function mergeServerAndLocalEntries<T extends SyncableEntry>(
  localEntries: readonly T[],
  serverEntries: readonly T[],
): T[] {
  // A server row carrying details.clientKey is the server-side identity of a
  // local temp entry (the client stamps its temp id as the idempotency key on
  // create). When that row arrives, the temp entry is superseded - keeping it
  // showed the same care moment twice whenever a create's response was lost.
  const localById = new Map(localEntries.map((entry) => [entry.id, entry]));
  const migratedTempIds = new Set<string>();
  const serverRows: T[] = [];

  for (const serverEntry of serverEntries) {
    const sameIdLocal = localById.get(serverEntry.id);
    if (sameIdLocal && isUnsyncedEntry(sameIdLocal)) {
      // A local edit to an existing row is authoritative until its PATCH
      // succeeds. Do not let a refresh replace it with the older server copy.
      continue;
    }

    const clientKey = serverEntry.details?.clientKey;
    const tempLocal =
      typeof clientKey === "string" ? localById.get(clientKey) : undefined;
    if (
      tempLocal &&
      !migratedTempIds.has(tempLocal.id) &&
      tempLocal.id.startsWith("temp_") &&
      isUnsyncedEntry(tempLocal)
    ) {
      // The create reached the server but its response did not reach this
      // device (or a refresh won the same-session race). Move the latest local
      // snapshot onto the durable server identity, then retry it as an update.
      migratedTempIds.add(tempLocal.id);
      serverRows.push(
        migrateAcknowledgedTempEntryForRetry(tempLocal, serverEntry),
      );
      continue;
    }

    const local = sameIdLocal ?? tempLocal;
    serverRows.push({
      ...serverEntry,
      details: local
        ? preserveDeviceOnlyCareDetails(local.details, serverEntry.details)
        : serverEntry.details,
      syncStatus: "synced",
      syncError: undefined,
    });
  }

  const unsyncedLocal = localEntries.filter(
    (entry) => isUnsyncedEntry(entry) && !migratedTempIds.has(entry.id),
  );

  return [...unsyncedLocal, ...serverRows].sort(
    (a, b) => timeValue(b) - timeValue(a),
  ) as T[];
}
