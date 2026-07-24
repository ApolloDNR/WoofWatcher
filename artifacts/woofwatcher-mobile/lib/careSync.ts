import type { CareDoc } from "../context/CareContext";
import {
  careDocContentEqual,
  mergeCareDocWithoutBase,
  mergeCareDocThreeWay,
  type CareDocConflict,
} from "./careDocMerge.ts";

export type EntrySyncStatus = "local" | "pending" | "synced" | "failed" | "conflict";

export const CARE_ENTRY_REVISION_CONFLICT_MESSAGE =
  "Household care changed before this edit synced. Review your saved version.";

export interface SyncableEntry {
  id: string;
  revision?: number;
  title?: string;
  occurredAt?: string;
  syncStatus?: EntrySyncStatus;
  syncError?: string;
  details?: Record<string, unknown> | null;
}

export type CareEntryConflictResolution = "keep-local" | "use-household";

export type CareEntryConflictSnapshot<T extends SyncableEntry> = Omit<
  T,
  "syncStatus" | "syncError" | "conflictServerSnapshot"
>;

export interface CareEntryConflictResolutionResult<T extends SyncableEntry> {
  entry: T;
  shouldEnqueue: boolean;
}

export type RefreshedCareEntryConflictResult<T extends SyncableEntry> =
  | { status: "resolved"; entry: T }
  | { status: "refresh-failed" | "stale" | "unavailable" };

export interface CareEntryConflictVersionDescription {
  title: string;
  type: string;
  note: string;
  mood: string;
}

export interface MergeServerAndLocalEntriesOptions {
  hasQueuedMutation?: (key: string) => boolean;
  hasLiveCreate?: (key: string) => boolean;
}

export interface CareEntryHistoryPageRequest {
  householdId: string;
  limit: number;
  beforeOccurredAt?: string;
  beforeId?: string;
  expectedGeneration?: number;
}

export interface CareEntryHistoryPage<T extends SyncableEntry> {
  householdId: string;
  entries: T[];
  historyGeneration: number;
}

export interface CompleteCareEntrySnapshot<T extends SyncableEntry> {
  householdId: string;
  entries: T[];
  historyGeneration: number;
}

export interface PendingCareEntryDeleteCandidate {
  serverId: string;
  pendingKey: string;
}

export interface PendingCareEntryDeleteCleanupPlan {
  deleteCandidates: PendingCareEntryDeleteCandidate[];
  confirmedAbsentServerIds: string[];
}

const CARE_ENTRY_HISTORY_CHANGED_MESSAGE =
  "Care history changed during pagination. Restart from the first page.";
const CARE_ENTRY_HISTORY_PAGE_INVALID_MESSAGE =
  "Care history returned an invalid page. Cached care was kept.";
const CARE_ENTRY_HISTORY_MAX_REVISION = 2_147_483_647;
const careEntryHistoryUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const careEntryHistoryRfc3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-](\d{2}):(\d{2}))$/;

export class CareEntryHistoryGenerationChangedError extends Error {
  readonly currentGeneration?: number;

  constructor(currentGeneration?: number) {
    super(CARE_ENTRY_HISTORY_CHANGED_MESSAGE);
    this.name = "CareEntryHistoryGenerationChangedError";
    this.currentGeneration = currentGeneration;
  }
}

export class CareEntryHistoryHouseholdChangedError extends Error {
  constructor() {
    super(
      "Care history household scope changed during pagination. Cached care was kept.",
    );
    this.name = "CareEntryHistoryHouseholdChangedError";
  }
}

class CareEntryHistoryAttemptChangedError extends Error {
  constructor() {
    super(CARE_ENTRY_HISTORY_CHANGED_MESSAGE);
    this.name = "CareEntryHistoryAttemptChangedError";
  }
}

function careEntryHistoryGenerationError(
  error: unknown,
): CareEntryHistoryGenerationChangedError | null {
  if (error instanceof CareEntryHistoryGenerationChangedError) return error;
  if (
    !isRecord(error) ||
    error.status !== 409 ||
    !isRecord(error.data) ||
    !Number.isSafeInteger(error.data.currentGeneration) ||
    (error.data.currentGeneration as number) < 0
  ) {
    return null;
  }
  return new CareEntryHistoryGenerationChangedError(
    error.data.currentGeneration as number,
  );
}

export function isCareEntryDeleteConfirmedAbsent(
  error: unknown,
  householdId: string,
): boolean {
  return (
    isRecord(error) &&
    error.status === 404 &&
    isRecord(error.data) &&
    error.data.householdId === householdId &&
    error.data.scopeBound === true
  );
}

export function planPendingCareEntryDeleteCleanup(
  completeServerEntries: readonly SyncableEntry[],
  pendingDeleteIds: ReadonlySet<string>,
): PendingCareEntryDeleteCleanupPlan {
  const confirmedPresentKeys = new Set<string>();
  const deleteCandidates: PendingCareEntryDeleteCandidate[] = [];

  completeServerEntries.forEach((entry) => {
    const clientKey = entry.details?.clientKey;
    const pendingKey =
      typeof clientKey === "string" &&
      pendingDeleteIds.has(clientKey)
        ? clientKey
        : pendingDeleteIds.has(entry.id)
          ? entry.id
          : null;
    if (!pendingKey) return;
    confirmedPresentKeys.add(pendingKey);
    confirmedPresentKeys.add(entry.id);
    deleteCandidates.push({
      serverId: entry.id,
      pendingKey,
    });
  });

  const confirmedAbsentServerIds = [...pendingDeleteIds].filter(
    (key) =>
      careEntryHistoryUuid.test(key) &&
      !confirmedPresentKeys.has(key),
  );

  return {
    deleteCandidates,
    confirmedAbsentServerIds,
  };
}

function validCareEntryHistoryTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = careEntryHistoryRfc3339.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] === undefined ? 0 : Number(match[9]);
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10]);
  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= new Date(Date.UTC(year, month, 0)).getUTCDate() &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function validateCareEntryHistoryRow<T extends SyncableEntry>(
  value: unknown,
): T {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !careEntryHistoryUuid.test(value.id) ||
    !validCareEntryHistoryTimestamp(value.occurredAt) ||
    !Number.isInteger(value.revision) ||
    (value.revision as number) < 1 ||
    (value.revision as number) > CARE_ENTRY_HISTORY_MAX_REVISION
  ) {
    throw new Error(CARE_ENTRY_HISTORY_PAGE_INVALID_MESSAGE);
  }
  return value as T;
}

export function assertCareEntryHistoryRowsInHousehold(
  rows: readonly unknown[],
  householdId: string,
): void {
  if (!careEntryHistoryUuid.test(householdId)) {
    throw new Error(
      "Care-history household scope must be a canonical UUID.",
    );
  }
  for (const row of rows) {
    if (
      !isRecord(row) ||
      row.householdId !== householdId
    ) {
      throw new Error(
        "Ignored a care-history row for a different household.",
      );
    }
  }
}

function historyRowComesAfter(
  newer: Pick<SyncableEntry, "id" | "occurredAt">,
  older: Pick<SyncableEntry, "id" | "occurredAt">,
): boolean {
  const newerTime = new Date(newer.occurredAt as string).getTime();
  const olderTime = new Date(older.occurredAt as string).getTime();
  return (
    newerTime > olderTime ||
    (newerTime === olderTime && newer.id > older.id)
  );
}

export async function loadCompleteCareEntrySnapshot<
  T extends SyncableEntry,
>(
  fetchPage: (
    request: CareEntryHistoryPageRequest,
  ) => Promise<unknown>,
  pageSize = 500,
  options: {
    householdId: string;
    isAttemptCurrent?: () => boolean;
  },
): Promise<CompleteCareEntrySnapshot<T>> {
  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 500
  ) {
    throw new Error("Care-history page size must be an integer from 1 to 500.");
  }
  if (!careEntryHistoryUuid.test(options.householdId)) {
    throw new Error("Care-history household scope must be a canonical UUID.");
  }

  const entries: T[] = [];
  const ids = new Set<string>();
  let historyGeneration: number | undefined;
  let cursor:
    | { beforeOccurredAt: string; beforeId: string }
    | undefined;

  for (;;) {
    if (options.isAttemptCurrent && !options.isAttemptCurrent()) {
      throw new CareEntryHistoryAttemptChangedError();
    }
    const request: CareEntryHistoryPageRequest = {
      householdId: options.householdId,
      limit: pageSize,
      ...(cursor ?? {}),
      ...(historyGeneration === undefined
        ? {}
        : { expectedGeneration: historyGeneration }),
    };
    const rawPage = await fetchPage(request);
    if (options.isAttemptCurrent && !options.isAttemptCurrent()) {
      throw new CareEntryHistoryAttemptChangedError();
    }
    if (!isRecord(rawPage) || !Array.isArray(rawPage.entries)) {
      throw new Error(CARE_ENTRY_HISTORY_PAGE_INVALID_MESSAGE);
    }
    if (rawPage.householdId !== options.householdId) {
      throw new CareEntryHistoryHouseholdChangedError();
    }
    const generation = rawPage.historyGeneration;
    if (
      !Number.isSafeInteger(generation) ||
      (generation as number) < 0
    ) {
      throw new Error(CARE_ENTRY_HISTORY_PAGE_INVALID_MESSAGE);
    }
    if (historyGeneration === undefined) {
      historyGeneration = generation as number;
    } else if (generation !== historyGeneration) {
      throw new CareEntryHistoryGenerationChangedError(
        generation as number,
      );
    }
    if (rawPage.entries.length > pageSize) {
      throw new Error(CARE_ENTRY_HISTORY_PAGE_INVALID_MESSAGE);
    }

    const page = rawPage.entries.map((value) =>
      validateCareEntryHistoryRow<T>(value),
    );
    for (const entry of page) {
      const previous = entries.at(-1);
      if (previous && !historyRowComesAfter(previous, entry)) {
        throw new Error(
          ids.has(entry.id)
            ? "Care history returned duplicate IDs."
            : "Care history cursor did not advance in descending order.",
        );
      }
      if (ids.has(entry.id)) {
        throw new Error("Care history returned duplicate IDs.");
      }
      ids.add(entry.id);
      entries.push(entry);
    }

    if (page.length < pageSize) {
      return {
        householdId: options.householdId,
        entries,
        historyGeneration: historyGeneration as number,
      };
    }
    const last = page.at(-1);
    if (!last) {
      throw new Error(CARE_ENTRY_HISTORY_PAGE_INVALID_MESSAGE);
    }
    const nextCursor = {
      beforeOccurredAt: last.occurredAt as string,
      beforeId: last.id,
    };
    if (
      cursor &&
      cursor.beforeOccurredAt === nextCursor.beforeOccurredAt &&
      cursor.beforeId === nextCursor.beforeId
    ) {
      throw new Error("Care history cursor did not advance.");
    }
    cursor = nextCursor;
  }
}

export async function runCompleteCareEntryHistoryRefresh<
  T extends SyncableEntry,
  TToken,
>(input: {
  fetchPage: (
    request: CareEntryHistoryPageRequest,
  ) => Promise<unknown>;
  pageSize?: number;
  maxAttempts?: number;
  householdId: string;
  captureLifecycle: () => TToken;
  isLifecycleCurrent: (token: TToken) => boolean;
  readMutationGeneration: () => number;
  readPendingDeleteIds: () => ReadonlySet<string>;
  readEntries: () => readonly T[];
  mergeEntries: (latest: readonly T[], server: readonly T[]) => T[];
  commitEntries: (
    entries: T[],
    historyGeneration: number,
    completeServerEntries: readonly T[],
    pendingDeleteIds: ReadonlySet<string>,
  ) => void;
}): Promise<boolean> {
  const lifecycleToken = input.captureLifecycle();
  const maxAttempts = input.maxAttempts ?? 2;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw new Error("Care-history refresh attempts must be between 1 and 3.");
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!input.isLifecycleCurrent(lifecycleToken)) return false;
    const mutationGeneration = input.readMutationGeneration();
    const pendingDeleteIds = new Set(input.readPendingDeleteIds());
    const isAttemptCurrent = () =>
      input.isLifecycleCurrent(lifecycleToken) &&
      input.readMutationGeneration() === mutationGeneration;
    try {
      const snapshot = await loadCompleteCareEntrySnapshot<T>(
        input.fetchPage,
        input.pageSize,
        {
          householdId: input.householdId,
          isAttemptCurrent,
        },
      );
      if (!input.isLifecycleCurrent(lifecycleToken)) return false;
      if (!isAttemptCurrent()) {
        if (attempt + 1 < maxAttempts) continue;
        throw new CareEntryHistoryGenerationChangedError();
      }
      const visibleServerEntries = snapshot.entries.filter(
        (entry) => {
          const clientKey = entry.details?.clientKey;
          return (
            !pendingDeleteIds.has(entry.id) &&
            !(
              typeof clientKey === "string" &&
              pendingDeleteIds.has(clientKey)
            )
          );
        },
      );
      const committed = input.mergeEntries(
        input.readEntries(),
        visibleServerEntries,
      );
      if (!input.isLifecycleCurrent(lifecycleToken)) return false;
      if (!isAttemptCurrent()) {
        if (attempt + 1 < maxAttempts) continue;
        throw new CareEntryHistoryGenerationChangedError();
      }
      input.commitEntries(
        committed,
        snapshot.historyGeneration,
        snapshot.entries,
        pendingDeleteIds,
      );
      return true;
    } catch (error) {
      if (!input.isLifecycleCurrent(lifecycleToken)) return false;
      const generationError = careEntryHistoryGenerationError(error);
      if (
        error instanceof CareEntryHistoryAttemptChangedError ||
        generationError
      ) {
        if (attempt + 1 < maxAttempts) continue;
        if (generationError) throw generationError;
      }
      throw error;
    }
  }
  throw new CareEntryHistoryGenerationChangedError();
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
  conflicted: number;
  local: number;
  retryable: number;
  retryableCreateIds: string[];
  retryableUpdateIds: string[];
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
  documentConflictCount?: number;
  documentSyncError?: string | null;
  refreshError?: string | null;
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
  | "merge-and-push"
  | "merge-without-base-and-push"
  | "reject-stale-server";

export interface AcknowledgedCareDoc<T extends CareDoc> {
  version: number;
  doc: T;
}

export interface CareDocRefreshInput<T extends CareDoc> {
  acknowledgedBase?: AcknowledgedCareDoc<T> | null;
  localDoc: T;
  localVersion: number;
  serverDoc?: T | null;
  serverVersion: number;
  serverUpdatedAt?: string | Date | null;
  mergeTimestamp?: string;
}

export interface CareDocRefreshPlan<T extends CareDoc> {
  status: CareDocRefreshStatus;
  doc: T;
  version: number;
  shouldPushLocal: boolean;
  conflicts: CareDocConflict[];
  message: string;
}

export interface CareDocSyncSnapshot<T extends CareDoc> {
  currentDoc: T;
  serverVersion: number;
  acknowledged: AcknowledgedCareDoc<T> | null;
  conflicts: CareDocConflict[];
  documentSyncError: string | null;
}

export interface ParsedCareDocSyncSnapshot<T extends CareDoc>
  extends CareDocSyncSnapshot<T> {
  /**
   * Present when the cached current document or acknowledged baseline cannot
   * safely participate in reconciliation. Callers must quarantine the exact
   * raw cache before hydrating this fresh snapshot.
   */
  cacheStatus?: "corrupt";
}

interface CareDocRemoteEnvelope {
  householdId: string;
  version: number;
  doc: Record<string, unknown>;
  updatedAt: string | Date;
  updatedBy?: string | null;
}

export interface CareDocSyncCoordinatorDependencies<T extends CareDoc> {
  readSnapshot: () => CareDocSyncSnapshot<T>;
  commitSnapshot: (snapshot: CareDocSyncSnapshot<T>) => void;
  normalizeDoc: (value: unknown) => T;
  isCompleteDoc: (value: unknown) => boolean;
  getRemote: (householdId: string) => Promise<unknown>;
  putRemote: (body: {
    householdId: string;
    version: number;
    doc: T;
  }) => Promise<unknown>;
  now: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(
  value: Record<string, unknown>,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function isCareEntryConflictInHousehold(
  error: unknown,
  householdId: string,
): boolean {
  return (
    isRecord(error) &&
    error.status === 409 &&
    isRecord(error.data) &&
    error.data.householdId === householdId
  );
}

function isCareDocConflictOperand(
  value: unknown,
): value is CareDocConflict["base"] {
  return isRecord(value) && typeof value.present === "boolean";
}

function isCareDocConflict(value: unknown): value is CareDocConflict {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    value.resolution === "local" &&
    isCareDocConflictOperand(value.base) &&
    isCareDocConflictOperand(value.server) &&
    isCareDocConflictOperand(value.local)
  );
}

export function parseCareDocSyncSnapshot<T extends CareDoc>(input: {
  parsed: unknown;
  fallbackDoc: T;
  normalizeDoc: (value: unknown) => T;
  isCompleteCurrentDoc: (value: unknown) => boolean;
}): ParsedCareDocSyncSnapshot<T> {
  const parsed = isRecord(input.parsed) ? input.parsed : {};
  const rawCurrentDoc = hasOwn(parsed, "currentDoc")
    ? parsed.currentDoc
    : parsed.doc;
  const rawAcknowledged = parsed.acknowledged;
  const hasAcknowledged =
    rawAcknowledged !== undefined && rawAcknowledged !== null;
  const serverVersion =
    Number.isInteger(parsed.serverVersion) &&
    (parsed.serverVersion as number) >= 0
      ? (parsed.serverVersion as number)
      : 0;
  const establishedCache = serverVersion > 0 || hasAcknowledged;
  const incompleteCurrentDoc =
    rawCurrentDoc !== undefined &&
    !input.isCompleteCurrentDoc(rawCurrentDoc);
  const missingEstablishedCurrentDoc =
    establishedCache && rawCurrentDoc === undefined;
  const incompleteAcknowledged =
    hasAcknowledged &&
    (!isRecord(rawAcknowledged) ||
      rawAcknowledged.version !== serverVersion ||
      !(
        serverVersion === 1 &&
        isRecord(rawAcknowledged.doc) &&
        Object.keys(rawAcknowledged.doc).length === 0
      ) &&
      !input.isCompleteCurrentDoc(rawAcknowledged.doc));
  const corruptSnapshot = (): ParsedCareDocSyncSnapshot<T> => ({
    currentDoc: input.fallbackDoc,
    serverVersion: 0,
    acknowledged: null,
    conflicts: [],
    documentSyncError:
      "Saved household care was invalid and was reset before refresh.",
    cacheStatus: "corrupt",
  });

  if (
    incompleteCurrentDoc ||
    missingEstablishedCurrentDoc ||
    incompleteAcknowledged
  ) {
    return corruptSnapshot();
  }

  let currentDoc = input.fallbackDoc;
  let malformed = false;
  if (isRecord(rawCurrentDoc)) {
    try {
      currentDoc = input.normalizeDoc(rawCurrentDoc);
    } catch {
      return corruptSnapshot();
    }
  } else if (rawCurrentDoc !== undefined) {
    return corruptSnapshot();
  }
  let acknowledged: AcknowledgedCareDoc<T> | null = null;
  if (
    isRecord(rawAcknowledged) &&
    rawAcknowledged.version === serverVersion &&
    isRecord(rawAcknowledged.doc)
  ) {
    try {
      acknowledged = {
        version: serverVersion,
        doc:
          serverVersion === 1 &&
          Object.keys(rawAcknowledged.doc).length === 0
            ? ({} as T)
            : input.normalizeDoc(rawAcknowledged.doc),
      };
    } catch {
      return corruptSnapshot();
    }
  } else if (rawAcknowledged !== undefined && rawAcknowledged !== null) {
    return corruptSnapshot();
  }
  const rawConflicts = parsed.conflicts;
  const conflicts = Array.isArray(rawConflicts)
    ? rawConflicts.filter(isCareDocConflict)
    : [];
  if (
    rawConflicts !== undefined &&
    (!Array.isArray(rawConflicts) ||
      conflicts.length !== rawConflicts.length)
  ) {
    malformed = true;
  }
  const cachedError =
    typeof parsed.documentSyncError === "string"
      ? parsed.documentSyncError
      : null;
  const missingBaseline = serverVersion > 0 && !acknowledged;
  return {
    currentDoc,
    serverVersion,
    acknowledged,
    conflicts,
    documentSyncError:
      cachedError ??
      (malformed || missingBaseline
        ? "Saved household sync baseline is missing or invalid. Refresh to review care safely."
        : null),
  };
}

function parseCareDocRemoteEnvelope(
  value: unknown,
  normalizeDoc: (doc: unknown) => CareDoc,
  isCompleteDoc: (doc: unknown) => boolean,
): (Omit<CareDocRemoteEnvelope, "doc"> & { doc: CareDoc }) | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.householdId !== "string" ||
    !careEntryHistoryUuid.test(value.householdId) ||
    !Number.isInteger(value.version) ||
    (value.version as number) < 0 ||
    !isRecord(value.doc) ||
    !(
      typeof value.updatedAt === "string" ||
      value.updatedAt instanceof Date
    ) ||
    Number.isNaN(dateValue(value.updatedAt))
  ) {
    return null;
  }
  const isBootstrapSeed =
    value.version === 1 && Object.keys(value.doc).length === 0;
  if (!isBootstrapSeed && !isCompleteDoc(value.doc)) return null;
  try {
    return {
      householdId: value.householdId,
      version: value.version as number,
      // The API provisions exactly `{}` at version 1. Preserve that raw
      // sentinel so reconcileCareDocFromServer can take its explicit seed
      // path. Every other remote document must satisfy the full known schema.
      doc: isBootstrapSeed ? ({} as CareDoc) : normalizeDoc(value.doc),
      updatedAt: value.updatedAt as string | Date,
      updatedBy:
        typeof value.updatedBy === "string" || value.updatedBy === null
          ? value.updatedBy
          : undefined,
    };
  } catch {
    return null;
  }
}

function conflictKey(conflict: CareDocConflict): string {
  return JSON.stringify(conflict);
}

export function appendCareDocConflicts(
  current: readonly CareDocConflict[],
  incoming: readonly CareDocConflict[],
): CareDocConflict[] {
  const seen = new Set(current.map(conflictKey));
  const result = [...current];
  for (const conflict of incoming) {
    const key = conflictKey(conflict);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(conflict);
  }
  return result;
}

function friendlyConflictRoot(path: string): string {
  if (path === "$acknowledgedBase") return "Upgraded cache baseline";
  const root = path.match(/^[A-Za-z][A-Za-z0-9]*/)?.[0] ?? "Care document";
  return root
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}

export function summarizeCareDocConflicts(
  conflicts: readonly CareDocConflict[],
  limit = 3,
): string[] {
  const labels = Array.from(
    new Set(conflicts.map((conflict) => friendlyConflictRoot(conflict.path))),
  );
  const visible = labels.slice(0, Math.max(0, limit));
  const remaining = labels.length - visible.length;
  return remaining > 0 ? [...visible, `+${remaining} more`] : visible;
}

export interface CareDocConflictReview {
  path: string;
  localAlternative: string;
  serverAlternative: string;
}

export interface CareDocConflictReviewAccess {
  conflictCount: number;
  ownerReviewConflicts: CareDocConflict[];
  requiresOwnerReview: boolean;
}

export function deriveCareDocConflictReviewAccess(input: {
  activeAuthenticatedScope: boolean;
  viewerRole?: string | null;
  conflicts: readonly CareDocConflict[];
}): CareDocConflictReviewAccess {
  if (!input.activeAuthenticatedScope) {
    return {
      conflictCount: 0,
      ownerReviewConflicts: [],
      requiresOwnerReview: false,
    };
  }
  const conflictCount = input.conflicts.length;
  const canOwnerReview = input.viewerRole === "owner";
  return {
    conflictCount,
    ownerReviewConflicts: canOwnerReview ? [...input.conflicts] : [],
    requiresOwnerReview: conflictCount > 0 && !canOwnerReview,
  };
}

export interface CareDocConflictDismissalInput {
  conflict: CareDocConflict;
  scopeKey: string;
  isLifecycleCurrent: () => boolean;
  readScopeKey: () => string | null;
  readConflicts: () => readonly CareDocConflict[];
  commitConflicts: (conflicts: CareDocConflict[]) => void;
}

function boundReviewText(value: string, limit: number): string {
  const safeLimit = Math.max(8, limit);
  return value.length <= safeLimit
    ? value
    : `${value.slice(0, safeLimit - 1)}…`;
}

function formatConflictOperand(
  operand: CareDocConflict["local"],
  limit: number,
): string {
  if (!operand.present) return "Removed";
  let display: string;
  if (typeof operand.value === "string") {
    display = operand.value || "Empty";
  } else {
    try {
      display = JSON.stringify(operand.value) ?? String(operand.value);
    } catch {
      display = String(operand.value);
    }
  }
  return boundReviewText(display, limit);
}

export function formatCareDocConflictReview(
  conflict: CareDocConflict,
  limit = 96,
): CareDocConflictReview {
  return {
    path: boundReviewText(conflict.path, limit),
    localAlternative: formatConflictOperand(conflict.local, limit),
    serverAlternative: formatConflictOperand(conflict.server, limit),
  };
}

function conflictSnapshotKey(conflicts: readonly CareDocConflict[]): string {
  return JSON.stringify(conflicts);
}

export function createCareDocConflictDismissal({
  conflict,
  scopeKey,
  isLifecycleCurrent,
  readScopeKey,
  readConflicts,
  commitConflicts,
}: CareDocConflictDismissalInput): () => boolean {
  const reviewedConflictKey = conflictKey(conflict);
  const reviewedSnapshotKey = conflictSnapshotKey(readConflicts());
  return () => {
    if (!isLifecycleCurrent() || readScopeKey() !== scopeKey) return false;
    const current = readConflicts();
    if (conflictSnapshotKey(current) !== reviewedSnapshotKey) return false;
    const reviewedIndex = current.findIndex(
      (candidate) => conflictKey(candidate) === reviewedConflictKey,
    );
    if (reviewedIndex < 0) return false;
    commitConflicts([
      ...current.slice(0, reviewedIndex),
      ...current.slice(reviewedIndex + 1),
    ]);
    return true;
  };
}

function careDocSyncFailureMessage(error: unknown): string {
  if (isRecord(error) && error.status === 412) {
    return "Active household changed during care sync. Refresh the selected household and retry.";
  }
  if (isRecord(error) && error.status === 404) {
    return "Household care is missing on the server. Review the account before retrying.";
  }
  if (
    isRecord(error) &&
    typeof error.status === "number" &&
    error.status >= 500
  ) {
    return "Household care sync needs a retry after a server problem.";
  }
  return "Household care sync needs a retry. Local care remains saved.";
}

export function createCareDocSyncCoordinator<T extends CareDoc>(
  dependencies: CareDocSyncCoordinatorDependencies<T>,
) {
  let generation = 0;
  let tail: Promise<unknown> = Promise.resolve();

  const isCurrent = (captured: number) => captured === generation;
  const commitIfCurrent = (
    captured: number,
    snapshot: CareDocSyncSnapshot<T>,
  ): boolean => {
    if (!isCurrent(captured)) return false;
    dependencies.commitSnapshot(snapshot);
    return true;
  };
  const commitError = (captured: number, message: string): false => {
    if (isCurrent(captured)) {
      const current = dependencies.readSnapshot();
      dependencies.commitSnapshot({
        ...current,
        documentSyncError: message,
      });
    }
    return false;
  };
  const parseEnvelope = (value: unknown) =>
    parseCareDocRemoteEnvelope(
      value,
      dependencies.normalizeDoc as (doc: unknown) => CareDoc,
      dependencies.isCompleteDoc,
    ) as (Omit<CareDocRemoteEnvelope, "doc"> & { doc: T }) | null;

  const pushCurrent = async (
    captured: number,
    householdId: string,
  ): Promise<boolean> => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!isCurrent(captured)) return false;
      const before = dependencies.readSnapshot();
      if (
        before.acknowledged &&
        before.acknowledged.version === before.serverVersion &&
        careDocContentEqual(
          before.acknowledged.doc,
          before.currentDoc,
        )
      ) {
        // A no-op is not evidence that the previous network failure recovered.
        // Keep the notice visible until a successful GET/PUT round trip clears
        // it, and report that this request did not complete the retry.
        return before.documentSyncError ? false : true;
      }

      const candidate = before.currentDoc;
      const expectedVersion = before.serverVersion;
      try {
        const raw = await dependencies.putRemote({
          householdId,
          version: expectedVersion,
          doc: candidate,
        });
        if (!isCurrent(captured)) return false;
        const envelope = parseEnvelope(raw);
        if (
          !envelope ||
          envelope.householdId !== householdId ||
          envelope.version !== expectedVersion + 1 ||
          Object.keys(envelope.doc).length === 0
        ) {
          return commitError(
            captured,
            "Ignored a care response for an invalid or different household. Retry sync.",
          );
        }
        const latest = dependencies.readSnapshot();
        const currentDoc = careDocContentEqual(
          latest.currentDoc,
          candidate,
        )
          ? envelope.doc
          : latest.currentDoc;
        return commitIfCurrent(captured, {
          ...latest,
          currentDoc,
          serverVersion: envelope.version,
          acknowledged: {
            version: envelope.version,
            doc: envelope.doc,
          },
          documentSyncError: null,
        });
      } catch (error) {
        if (!isCurrent(captured)) return false;
        if (!isRecord(error) || error.status !== 409) {
          return commitError(captured, careDocSyncFailureMessage(error));
        }
        const envelope = parseEnvelope(error.data);
        const latest = dependencies.readSnapshot();
        if (
          !envelope ||
          envelope.householdId !== householdId ||
          envelope.version <=
            Math.max(expectedVersion, latest.serverVersion)
        ) {
          return commitError(
            captured,
            "The household conflict response was invalid or belonged to a different household. Retry sync.",
          );
        }
        const plan = reconcileCareDocFromServer({
          acknowledgedBase: latest.acknowledged,
          localDoc: latest.currentDoc,
          localVersion: latest.serverVersion,
          serverDoc: envelope.doc,
          serverVersion: envelope.version,
          serverUpdatedAt: envelope.updatedAt,
          mergeTimestamp: dependencies.now(),
        });
        if (plan.status === "reject-stale-server") {
          return commitError(
            captured,
            "Ignored an older household conflict response. Retry sync.",
          );
        }
        if (
          !commitIfCurrent(captured, {
            ...latest,
            currentDoc: plan.doc,
            serverVersion: envelope.version,
            acknowledged: {
              version: envelope.version,
              doc: envelope.doc,
            },
            conflicts: appendCareDocConflicts(
              latest.conflicts,
              plan.conflicts,
            ),
            documentSyncError: null,
          })
        ) {
          return false;
        }
        if (!plan.shouldPushLocal) return true;
        if (attempt === 1) {
          return commitError(
            captured,
            "Household care changed again during retry. Review conflicts and retry sync.",
          );
        }
      }
    }
    return false;
  };

  const syncCurrent = async (
    captured: number,
    householdId: string,
  ): Promise<boolean> => {
    let raw: unknown;
    try {
      raw = await dependencies.getRemote(householdId);
    } catch (error) {
      return commitError(captured, careDocSyncFailureMessage(error));
    }
    if (!isCurrent(captured)) return false;
    const envelope = parseEnvelope(raw);
    const latest = dependencies.readSnapshot();
    if (
      !envelope ||
      envelope.householdId !== householdId ||
      envelope.version < latest.serverVersion
    ) {
      return commitError(
        captured,
        "Ignored a care refresh for an invalid, older, or different household. Retry sync.",
      );
    }
    const plan = reconcileCareDocFromServer({
      acknowledgedBase: latest.acknowledged,
      localDoc: latest.currentDoc,
      localVersion: latest.serverVersion,
      serverDoc: envelope.doc,
      serverVersion: envelope.version,
      serverUpdatedAt: envelope.updatedAt,
      mergeTimestamp: dependencies.now(),
    });
    if (plan.status === "reject-stale-server") {
      return commitError(
        captured,
        "Ignored an older household care refresh. Retry sync.",
      );
    }
    if (
      !commitIfCurrent(captured, {
        ...latest,
        currentDoc: plan.doc,
        serverVersion: envelope.version,
        acknowledged: {
          version: envelope.version,
          doc: envelope.doc,
        },
        conflicts: appendCareDocConflicts(
          latest.conflicts,
          plan.conflicts,
        ),
        documentSyncError: null,
      })
    ) {
      return false;
    }
    return plan.shouldPushLocal
      ? pushCurrent(captured, householdId)
      : true;
  };

  const enqueue = (
    householdId: string,
    work: (captured: number, householdId: string) => Promise<boolean>,
  ): Promise<boolean> => {
    const captured = generation;
    const queued = tail
      .catch(() => undefined)
      .then(() =>
        isCurrent(captured) && careEntryHistoryUuid.test(householdId)
          ? work(captured, householdId)
          : false,
      );
    tail = queued.catch(() => undefined);
    return queued;
  };

  return {
    beginGeneration() {
      generation += 1;
      // A hung request from the prior account/household must not block the
      // next scope's independent document queue.
      tail = Promise.resolve();
    },
    requestPush(householdId: string) {
      return enqueue(householdId, pushCurrent);
    },
    syncFromServer(householdId: string) {
      return enqueue(householdId, syncCurrent);
    },
  };
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
    entry.syncStatus === "failed" ||
    entry.syncStatus === "conflict"
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

export function canApplyCareEntryUpdate(
  entry: Pick<SyncableEntry, "syncStatus">,
): boolean {
  return entry.syncStatus !== "conflict";
}

function boundedCareEntryRevision(value: unknown): number | null {
  return Number.isInteger(value) &&
    (value as number) >= 1 &&
    (value as number) <= 2_147_483_647
    ? (value as number)
    : null;
}

export function applyCareEntryMutationCallback<
  T extends SyncableEntry,
>(
  current: T,
  candidate: T,
  callbackRevision: number,
): T {
  const currentRevision = boundedCareEntryRevision(current.revision) ?? 1;
  const rawSnapshot = (
    current as T & { conflictServerSnapshot?: unknown }
  ).conflictServerSnapshot;
  const snapshotRevision =
    isRecord(rawSnapshot) && rawSnapshot.id === current.id
      ? boundedCareEntryRevision(rawSnapshot.revision)
      : null;
  const observedRevision = Math.max(
    currentRevision,
    snapshotRevision ?? currentRevision,
  );
  const incomingRevision = boundedCareEntryRevision(callbackRevision);
  return incomingRevision !== null && incomingRevision >= observedRevision
    ? candidate
    : current;
}

export function finalizeCareEntryMutation<T extends SyncableEntry>(
  _optimistic: T,
  returned: T,
  serverId: string,
): T & { syncStatus: "synced"; syncError: undefined } {
  return {
    ...returned,
    id: serverId,
    syncStatus: "synced",
    syncError: undefined,
  };
}

export function toCareEntryConflictSnapshot<T extends SyncableEntry>(
  entry: T,
): CareEntryConflictSnapshot<T> {
  return Object.fromEntries(
    Object.entries(entry).filter(
      ([key, value]) =>
        key !== "syncStatus" &&
        key !== "syncError" &&
        key !== "conflictServerSnapshot" &&
        value !== undefined,
    ),
  ) as CareEntryConflictSnapshot<T>;
}

export function sanitizeCareEntryConflictSnapshot<
  T extends SyncableEntry,
>(
  localId: string,
  value: unknown,
): CareEntryConflictSnapshot<T> | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.id !== localId ||
    !Number.isInteger(value.revision) ||
    (value.revision as number) < 1 ||
    (value.revision as number) > 2_147_483_647 ||
    typeof value.type !== "string" ||
    value.type.trim().length === 0 ||
    typeof value.occurredAt !== "string" ||
    Number.isNaN(Date.parse(value.occurredAt))
  ) {
    return undefined;
  }
  const optionalStringFields = [
    "title",
    "caregiver",
    "caregiverUserId",
    "amount",
    "mood",
    "severity",
    "note",
    "food",
  ];
  if (
    optionalStringFields.some(
      (field) =>
        value[field] !== undefined && typeof value[field] !== "string",
    )
  ) {
    return undefined;
  }
  for (const field of ["durationMinutes", "dogInteractions"]) {
    if (
      value[field] !== undefined &&
      (typeof value[field] !== "number" ||
        !Number.isFinite(value[field]))
    ) {
      return undefined;
    }
  }
  if (
    value.details !== undefined &&
    (!isRecord(value.details) || Array.isArray(value.details))
  ) {
    return undefined;
  }
  if (value.conflictServerSnapshot !== undefined) return undefined;
  return toCareEntryConflictSnapshot(
    value as T,
  ) as CareEntryConflictSnapshot<T>;
}

export function sanitizeCachedCareEntryConflict<
  T extends SyncableEntry,
>(
  entry: T,
): T & { conflictServerSnapshot?: CareEntryConflictSnapshot<T> } {
  const rawSnapshot = (
    entry as T & { conflictServerSnapshot?: unknown }
  ).conflictServerSnapshot;
  const conflictServerSnapshot =
    entry.syncStatus === "conflict"
      ? sanitizeCareEntryConflictSnapshot<T>(entry.id, rawSnapshot)
      : undefined;
  const recoveredPending = entry.syncStatus === "pending";
  return {
    ...entry,
    ...(recoveredPending
      ? {
          syncStatus: "failed" as const,
          syncError: "Saved locally. Refresh to retry sync.",
        }
      : {}),
    conflictServerSnapshot,
  };
}

const CACHED_CARE_ENTRY_SYNC_STATUSES = new Set<EntrySyncStatus>([
  "local",
  "pending",
  "synced",
  "failed",
  "conflict",
]);

function parseCachedCareEntries<T extends SyncableEntry>(
  value: unknown,
): Array<T & {
  conflictServerSnapshot?: CareEntryConflictSnapshot<T>;
}> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error("Saved care entries must be an array.");
  }
  return value.map((rawEntry) => {
    if (!isRecord(rawEntry)) {
      throw new Error("Saved care entry must be an object.");
    }
    for (const field of [
      "id",
      "type",
      "title",
      "caregiver",
      "occurredAt",
    ]) {
      if (typeof rawEntry[field] !== "string") {
        throw new Error(`Saved care entry ${field} must be text.`);
      }
    }
    if (
      (rawEntry.id as string).length === 0 ||
      (rawEntry.type as string).length === 0 ||
      Number.isNaN(Date.parse(rawEntry.occurredAt as string))
    ) {
      throw new Error("Saved care entry identity or date is invalid.");
    }
    for (const field of [
      "caregiverUserId",
      "amount",
      "mood",
      "severity",
      "note",
      "food",
      "syncError",
    ]) {
      if (
        rawEntry[field] !== undefined &&
        typeof rawEntry[field] !== "string"
      ) {
        throw new Error(`Saved care entry ${field} must be text.`);
      }
    }
    if (
      rawEntry.revision !== undefined &&
      (!Number.isSafeInteger(rawEntry.revision) ||
        (rawEntry.revision as number) < 1)
    ) {
      throw new Error("Saved care entry revision is invalid.");
    }
    for (const field of ["durationMinutes", "dogInteractions"]) {
      if (
        rawEntry[field] !== undefined &&
        (typeof rawEntry[field] !== "number" ||
          !Number.isFinite(rawEntry[field]))
      ) {
        throw new Error(`Saved care entry ${field} must be a number.`);
      }
    }
    if (
      rawEntry.details !== undefined &&
      rawEntry.details !== null &&
      !isRecord(rawEntry.details)
    ) {
      throw new Error("Saved care entry details must be an object.");
    }
    if (
      rawEntry.syncStatus !== undefined &&
      (typeof rawEntry.syncStatus !== "string" ||
        !CACHED_CARE_ENTRY_SYNC_STATUSES.has(
          rawEntry.syncStatus as EntrySyncStatus,
        ))
    ) {
      throw new Error("Saved care entry sync status is invalid.");
    }
    return sanitizeCachedCareEntryConflict(rawEntry as T);
  });
}

export async function parseCachedCareEntriesWithRecovery<
  T extends SyncableEntry,
>(input: {
  raw: string;
  value: unknown;
  quarantine: (exactRaw: string) => Promise<boolean>;
}): Promise<
  | {
      status: "ready";
      entries: Array<
        T & {
          conflictServerSnapshot?: CareEntryConflictSnapshot<T>;
        }
      >;
    }
  | { status: "quarantined" }
  | { status: "quarantine-failed" }
> {
  try {
    return {
      status: "ready",
      entries: parseCachedCareEntries<T>(input.value),
    };
  } catch {
    try {
      return (await input.quarantine(input.raw))
        ? { status: "quarantined" }
        : { status: "quarantine-failed" };
    } catch {
      return { status: "quarantine-failed" };
    }
  }
}

export function describeCareEntryConflictVersion(
  entry: Pick<SyncableEntry, "title"> & {
    type?: string;
    note?: string;
    mood?: string;
  },
): CareEntryConflictVersionDescription {
  const cleanString = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";
  const rawType = cleanString(entry.type);
  const type = rawType
    ? `${rawType.charAt(0).toUpperCase()}${rawType.slice(1)}`
    : "Care log";
  const title = cleanString(entry.title) || type;
  const note = cleanString(entry.note) || "No note";
  const mood = cleanString(entry.mood);
  return {
    title,
    type,
    note,
    mood: mood ? `Mood: ${mood}` : "Mood not logged",
  };
}

export function resolveCareEntryConflict<T extends SyncableEntry>(
  local: T,
  serverSnapshot: T,
  resolution: CareEntryConflictResolution,
): CareEntryConflictResolutionResult<T> | null {
  const safeSnapshot = sanitizeCareEntryConflictSnapshot<T>(
    local.id,
    serverSnapshot,
  );
  if (!safeSnapshot) return null;
  const household = safeSnapshot as T;
  if (resolution === "use-household") {
    return {
      entry: finalizeCareEntryMutation(
        local,
        household,
        household.id,
      ) as T,
      shouldEnqueue: false,
    };
  }

  const safeLocal = sanitizeCareEntryConflictSnapshot<T>(
    local.id,
    toCareEntryConflictSnapshot(local),
  );
  if (!safeLocal) return null;

  return {
    entry: {
      ...local,
      id: household.id,
      revision: household.revision,
      syncStatus: "pending",
      syncError: undefined,
      conflictServerSnapshot: undefined,
    },
    shouldEnqueue: true,
  };
}

export async function refreshThenResolveCareEntryConflict<
  T extends SyncableEntry,
>(input: {
  refresh: () => Promise<boolean>;
  isCurrent: () => boolean;
  readFreshConflict: () => {
    local: T;
    serverSnapshot: T;
  } | null;
}): Promise<RefreshedCareEntryConflictResult<T>> {
  const refreshed = await input.refresh();
  if (!input.isCurrent()) return { status: "stale" };
  if (!refreshed) return { status: "refresh-failed" };
  const fresh = input.readFreshConflict();
  if (!fresh || fresh.local.syncStatus !== "conflict") {
    return { status: "unavailable" };
  }
  const resolved = resolveCareEntryConflict(
    fresh.local,
    fresh.serverSnapshot,
    "use-household",
  );
  if (!resolved) return { status: "unavailable" };
  return {
    status: "resolved",
    entry: resolved.entry,
  };
}

function timeValue(entry: SyncableEntry): number {
  const parsed = Date.parse(entry.occurredAt ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function plural(value: number, singular: string, pluralValue = `${singular}s`) {
  return value === 1 ? singular : pluralValue;
}

function outboxMessage(retryable: number, pending: number, conflicted: number): string {
  if (conflicted > 0) {
    const conflictMessage = `${conflicted} care ${plural(conflicted, "conflict")} need review.`;
    if (retryable > 0) {
      return `${conflictMessage} ${retryable} other care ${plural(retryable, "change")} need retry.`;
    }
    if (pending > 0) {
      return `${conflictMessage} ${pending} ${pending === 1 ? "is" : "are"} still syncing.`;
    }
    return conflictMessage;
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
  return "Waiting for sync.";
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

export function reconcileCareDocFromServer<T extends CareDoc>({
  acknowledgedBase,
  localDoc,
  localVersion,
  serverDoc,
  serverVersion,
  mergeTimestamp,
}: CareDocRefreshInput<T>): CareDocRefreshPlan<T> {
  if (!serverDoc || Object.keys(serverDoc).length === 0) {
    return {
      status: "seed-server",
      doc: localDoc,
      version: serverVersion,
      shouldPushLocal: true,
      conflicts: [],
      message: "Seeding household care from this device.",
    };
  }

  if (
    serverVersion < localVersion ||
    (acknowledgedBase && serverVersion < acknowledgedBase.version)
  ) {
    return {
      status: "reject-stale-server",
      doc: localDoc,
      version: Math.max(localVersion, acknowledgedBase?.version ?? 0),
      shouldPushLocal: false,
      conflicts: [],
      message: "Ignored an older household care response.",
    };
  }

  const coherentBase =
    acknowledgedBase?.version === localVersion ? acknowledgedBase : null;
  if (coherentBase) {
    const merged = mergeCareDocThreeWay({
      base: coherentBase.doc,
      server: serverDoc,
      local: localDoc,
    });
    const shouldPushLocal = !careDocContentEqual(merged.doc, serverDoc);
    const mergedDoc = shouldPushLocal && mergeTimestamp
      ? { ...merged.doc, updatedAt: mergeTimestamp }
      : merged.doc;
    return {
      status: shouldPushLocal ? "merge-and-push" : "accept-server",
      doc: shouldPushLocal ? mergedDoc : serverDoc,
      version: serverVersion,
      shouldPushLocal,
      conflicts: merged.conflicts,
      message: shouldPushLocal
        ? "Merged offline and household care changes for one ordered update."
        : "Using the latest household care from the server.",
    };
  }

  const localIsPristine =
    localVersion === 0 &&
    careDocTime(localDoc) === new Date(0).getTime();
  if (localIsPristine) {
    return {
      status: "accept-server",
      doc: serverDoc,
      version: serverVersion,
      shouldPushLocal: false,
      conflicts: [],
      message: "Using the latest household care from the server.",
    };
  }

  const conservative = mergeCareDocWithoutBase({
    server: serverDoc,
    local: localDoc,
  });
  const baseConflict: CareDocConflict = {
    path: "$acknowledgedBase",
    base: { present: false },
    server: { present: true, value: { version: serverVersion } },
    local: { present: true, value: { version: localVersion } },
    resolution: "local",
    reason: acknowledgedBase
      ? "mismatched-acknowledged-base"
      : "missing-acknowledged-base",
  };
  const conservativeDoc = mergeTimestamp
    ? { ...conservative.doc, updatedAt: mergeTimestamp }
    : conservative.doc;
  return {
    status: "merge-without-base-and-push",
    doc: conservativeDoc,
    version: serverVersion,
    shouldPushLocal: true,
    conflicts: [baseConflict, ...conservative.conflicts],
    message:
      "Preserved upgraded local care and household care for conflict review.",
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
  const conflicted = items.filter((item) => item.status === "conflict").length;
  const local = items.filter((item) => item.status === "local").length;
  const status: CareSyncOutboxStatus =
    items.length === 0 ? "idle" : retryable > 0 || conflicted > 0 ? "needs-retry" : "syncing";

  return {
    status,
    items,
    total: items.length,
    pending,
    failed,
    conflicted,
    local,
    retryable,
    retryableCreateIds,
    retryableUpdateIds,
    message: outboxMessage(retryable, pending, conflicted),
    actionLabel:
      status === "idle" ? "Synced" : conflicted > 0 ? "Review conflict" : retryable > 0 ? "Retry sync" : "Syncing",
  };
}

export function deriveCareSyncDashboard({
  outbox,
  isLoaded,
  isSyncing,
  lastUpdatedAt,
  householdMemberCount,
  totalEntries,
  documentConflictCount = 0,
  documentSyncError,
  refreshError,
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
      nextStep: "WoofWatcher will show retry options if anything needs attention.",
      actionLabel: "Refresh",
      metrics,
    };
  }

  if (documentConflictCount > 0 && documentSyncError) {
    return {
      status: "attention",
      title: "Care document needs review and retry",
      message: `${documentConflictCount} household care ${
        documentConflictCount === 1 ? "conflict remains" : "conflicts remain"
      } for owner review. ${documentSyncError}`,
      nextStep:
        "Retry sync now, then review each preserved local and server alternative.",
      actionLabel: "Retry sync",
      metrics,
    };
  }

  if (documentConflictCount > 0) {
    return {
      status: "attention",
      title: "Care document needs review",
      message: `${documentConflictCount} household care ${
        documentConflictCount === 1 ? "conflict" : "conflicts"
      } preserved local and server values for owner review.`,
      nextStep:
        "Review the affected sections, then deliberately dismiss the conflict notice.",
      actionLabel: "Review",
      metrics,
    };
  }

  if (documentSyncError) {
    return {
      status: "attention",
      title: "Care document sync needs attention",
      message: documentSyncError,
      nextStep: "Retry sync. Local care remains saved on this device.",
      actionLabel: "Retry sync",
      metrics,
    };
  }

  if (outbox.conflicted > 0) {
    return {
      status: "attention",
      title: outbox.conflicted === 1 ? "Care entry conflict needs review" : "Care entry conflicts need review",
      message: outbox.message,
      nextStep: "Review the preserved local care change before deciding what to save.",
      actionLabel: "Review conflict",
      metrics,
    };
  }

  if (refreshError) {
    return {
      status: "attention",
      title: "Household refresh failed",
      message: refreshError,
      nextStep:
        "Retry refresh. Cached and local care remain saved while WoofWatcher reconnects.",
      actionLabel: "Retry refresh",
      metrics,
    };
  }

  if (outbox.retryable > 0) {
    return {
      status: "attention",
      title: "Sync needs attention",
      message: outbox.message,
      nextStep: "Retry sync so every caregiver sees the latest care.",
      actionLabel: "Retry sync",
      metrics,
    };
  }

  if (isSyncing || outbox.pending > 0) {
    return {
      status: "syncing",
      title: "Syncing household care",
      message: outbox.message,
      nextStep: "Keep WoofWatcher open while the latest care reaches the household.",
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
  options: MergeServerAndLocalEntriesOptions = {},
): T[] {
  // A server row carrying details.clientKey is the server-side identity of a
  // local temp entry (the client stamps its temp id as the idempotency key on
  // create). When that row arrives, the temp entry is superseded - keeping it
  // showed the same care moment twice whenever a create's response was lost.
  const serverById = new Map(serverEntries.map((entry) => [entry.id, entry]));
  const serverByClientKey = new Map(
    serverEntries.flatMap((entry) => {
      const clientKey = entry.details?.clientKey;
      return typeof clientKey === "string" && clientKey.length > 0 ? [[clientKey, entry] as const] : [];
    }),
  );
  const consumedServerIds = new Set<string>();
  const unsyncedLocal = localEntries.filter(isUnsyncedEntry).map((local) => {
    const directServer = serverById.get(local.id);
    const server = directServer ?? serverByClientKey.get(local.id);
    const hasQueuedMutation =
      options.hasQueuedMutation?.(local.id) ?? false;
    const hasLiveCreate = options.hasLiveCreate?.(local.id) ?? false;
    if (!server) {
      if (
        local.syncStatus === "pending" &&
        !hasQueuedMutation &&
        !hasLiveCreate
      ) {
        return {
          ...local,
          syncStatus: "failed",
          syncError: "Saved locally. Refresh to retry sync.",
        } as T;
      }
      return local;
    }
    consumedServerIds.add(server.id);
    const localRevision = boundedCareEntryRevision(local.revision) ?? 1;
    const serverRevision =
      boundedCareEntryRevision(server.revision) ?? localRevision;
    const preserved = {
      ...server,
      ...local,
      id: server.id,
      revision: Math.max(localRevision, serverRevision),
    } as T;
    const persistedContentEqual = directServer
      ? careEntryPersistedContentEqual(local, server)
      : careEntryCreateContentEqual(local, server);

    if (
      local.syncStatus === "pending" &&
      hasQueuedMutation &&
      (directServer || serverRevision <= localRevision)
    ) {
      return {
        ...preserved,
        revision: localRevision,
      };
    }
    if (
      (local.syncStatus === "pending" ||
        local.syncStatus === "failed") &&
      serverRevision === localRevision &&
      !hasQueuedMutation
    ) {
      if (!persistedContentEqual) {
        return {
          ...preserved,
          syncStatus: "failed",
          syncError: "Saved locally. Refresh to retry sync.",
        } as T;
      }
      return {
        ...server,
        id: server.id,
        revision: serverRevision,
        syncStatus: "synced",
        syncError: undefined,
      } as T;
    }
    if (
      local.syncStatus === "conflict"
    ) {
      const existingSnapshot =
        sanitizeCareEntryConflictSnapshot<T>(
          local.id,
          (local as T & { conflictServerSnapshot?: unknown })
            .conflictServerSnapshot,
        );
      const existingSnapshotRevision =
        existingSnapshot?.revision as number | undefined;
      const canAdoptIncomingSnapshot =
        serverRevision >= localRevision &&
        (existingSnapshotRevision === undefined ||
          serverRevision > existingSnapshotRevision);
      return {
        ...preserved,
        revision: Math.max(localRevision, serverRevision),
        conflictServerSnapshot: canAdoptIncomingSnapshot
          ? toCareEntryConflictSnapshot(server)
          : existingSnapshot,
      } as T;
    }
    if (serverRevision <= localRevision) {
      return preserved;
    }
    if (persistedContentEqual) {
      return {
        ...server,
        id: server.id,
        revision: serverRevision,
        syncStatus: "synced",
        syncError: undefined,
      } as T;
    }
    return {
      ...preserved,
      revision: serverRevision,
      syncStatus: "conflict",
      syncError: CARE_ENTRY_REVISION_CONFLICT_MESSAGE,
      conflictServerSnapshot: toCareEntryConflictSnapshot(server),
    } as T;
  });
  const localIds = new Set(unsyncedLocal.map((entry) => entry.id));
  const newerSyncedLocal = localEntries.filter((local) => {
    if (isUnsyncedEntry(local)) return false;
    const server = serverById.get(local.id);
    if (!server) return false;
    const localRevision = boundedCareEntryRevision(local.revision) ?? 1;
    const serverRevision = boundedCareEntryRevision(server.revision) ?? 1;
    return localRevision > serverRevision;
  });
  const newerSyncedLocalIds = new Set(
    newerSyncedLocal.map((entry) => entry.id),
  );
  const serverSynced = withSyncedStatus(
    serverEntries.filter(
      (entry) =>
        !localIds.has(entry.id) &&
        !consumedServerIds.has(entry.id) &&
        !newerSyncedLocalIds.has(entry.id),
    ),
  );

  return [
    ...unsyncedLocal,
    ...withSyncedStatus(newerSyncedLocal),
    ...serverSynced,
  ].sort(
    (a, b) => {
      const timeOrder = timeValue(b) - timeValue(a);
      if (timeOrder !== 0 || a.id === b.id) return timeOrder;
      return a.id < b.id ? 1 : -1;
    },
  ) as T[];
}

export function discardConflictedCareEntryMutations<
  T extends SyncableEntry,
>(
  entries: readonly T[],
  discard: (key: string) => void,
): void {
  for (const entry of entries) {
    if (entry.syncStatus === "conflict") discard(entry.id);
  }
}

const TRANSIENT_CARE_ENTRY_KEYS = new Set([
  "id",
  "revision",
  "syncStatus",
  "syncError",
  "conflictServerSnapshot",
  "caregiver",
  "caregiverUserId",
]);

const DUPLICATED_CARE_ENTRY_DETAIL_KEYS = new Set([
  "clientKey",
  "title",
  "durationMinutes",
  "amount",
  "dogInteractions",
  "food",
]);

const CREATE_SERVER_POLICY_DETAIL_KEYS = new Set([
  "trustState",
  "confirmationRequired",
  "confirmationReason",
  "photoProofPolicy",
]);

function persistedCareEntry(
  entry: SyncableEntry,
  options: { createComparison?: boolean } = {},
): Record<string, unknown> {
  const normalized = Object.fromEntries(
    Object.entries(entry).filter(
      ([key, value]) =>
        !TRANSIENT_CARE_ENTRY_KEYS.has(key) && value !== undefined,
    ),
  );
  if (isRecord(normalized.details)) {
    const details = Object.fromEntries(
      Object.entries(normalized.details).filter(([key, value]) => {
        if (
          DUPLICATED_CARE_ENTRY_DETAIL_KEYS.has(key) ||
          value === undefined
        ) {
          return false;
        }
        if (!options.createComparison) return true;
        if (CREATE_SERVER_POLICY_DETAIL_KEYS.has(key)) return false;
        return !(
          key === "photoProofStatus" &&
          value === "not-attached"
        );
      }),
    );
    if (Object.keys(details).length > 0) {
      normalized.details = details;
    } else {
      delete normalized.details;
    }
  }
  return normalized;
}

export function careEntryPersistedContentEqual(
  left: SyncableEntry,
  right: SyncableEntry,
): boolean {
  return careEntryValueEqual(
    persistedCareEntry(left),
    persistedCareEntry(right),
  );
}

function careEntryCreateContentEqual(
  left: SyncableEntry,
  right: SyncableEntry,
): boolean {
  return careEntryValueEqual(
    persistedCareEntry(left, { createComparison: true }),
    persistedCareEntry(right, { createComparison: true }),
  );
}

export function shouldQueueCareEntryCreateFollowUp(
  local: SyncableEntry,
  returned: SyncableEntry,
): boolean {
  return !careEntryCreateContentEqual(local, returned);
}

function careEntryValueEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) =>
        careEntryValueEqual(value, right[index]),
      )
    );
  }
  if (
    !left ||
    !right ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        careEntryValueEqual(leftRecord[key], rightRecord[key]),
    )
  );
}
