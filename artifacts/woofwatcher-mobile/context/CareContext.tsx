import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createCareEntry,
  deleteCareEntry,
  getCareState,
  getMe,
  getListCareEntriesQueryKey,
  listCareEntryHistory,
  putCareState,
  updateCareEntry,
  type CareEntry as ApiCareEntry,
  type CareEntryInput,
  type CareEntryUpdate,
  type CareStateEnvelope,
} from "@workspace/api-client-react";
import {
  assertCareEntryHistoryRowsInHousehold,
  applyCareEntryMutationCallback,
  CARE_ENTRY_REVISION_CONFLICT_MESSAGE,
  canApplyCareEntryUpdate,
  careEntryPersistedContentEqual,
  createCareDocConflictDismissal,
  createCareDocSyncCoordinator,
  deriveCareSyncOutbox,
  discardConflictedCareEntryMutations,
  finalizeCareEntryMutation,
  isCareEntryDeleteConfirmedAbsent,
  isCareEntryConflictInHousehold,
  mergeServerAndLocalEntries,
  parseCachedCareEntriesWithRecovery,
  parseCareDocSyncSnapshot,
  planPendingCareEntryDeleteCleanup,
  refreshThenResolveCareEntryConflict,
  resolveCareEntryConflict as resolveCareEntryConflictState,
  runCompleteCareEntryHistoryRefresh,
  shouldRetryCreate,
  shouldQueueCareEntryCreateFollowUp,
  shouldRetryUpdate,
  toCareEntryConflictSnapshot,
  type AcknowledgedCareDoc,
  type CareEntryConflictResolution,
  type CareSyncOutbox,
  type EntrySyncStatus,
} from "@/lib/careSync";
import type { CareDocConflict } from "@/lib/careDocMerge";
import type {
  AccessPass,
  AdventureMemory,
  CarePassArtifact,
} from "@workspace/care-domain";
import { isClerkConfigured, useWoofAuth } from "@/lib/auth";
import {
  getCareRecoveryKey,
  getCareStorageKey,
  shouldAdoptUnscopedV2Cache,
  type CareStorageScope,
} from "@/lib/careStorageScope";
import {
  createCareLifecycleCoordinator,
  createHouseholdScopeReloadCoordinator,
  resolveCareWipeCompletion,
  type CareLifecycleToken,
  type HouseholdScopeReloadRequest,
} from "@/lib/careLifecycle";
import {
  assertCareDeviceWipeOperationWritten,
  createCareDirectoryWipeAdapter,
  finalizeCareDeviceWipeReceipt,
  runCareDeviceWipe,
  type CareDeviceWipeReceipt,
} from "@/lib/careDeviceWipe";
import {
  commitCareEntriesIfCurrent,
  runCareEntrySideEffectIfCurrent,
} from "@/lib/careEntryMutation";
import { createCareEntryMutationQueue } from "@/lib/careEntryMutationQueue";
import {
  commitCarePendingDeleteMutationIfCurrent,
  createCarePendingDeleteStore,
  parseCarePendingDeleteKeys,
} from "@/lib/carePendingDeletes";
import {
  normalizeReminderNotificationPreferences,
  type ReminderNotificationPreferences,
} from "@/lib/reminderNotificationPreferences";
import {
  normalizeLaunchProviderProfile,
  type LaunchStorageProviderEvidence,
} from "@/lib/launchProviderSetup";
import {
  createFreshCareDocMetadata,
  createLegacyCareDocMetadata,
  isCompleteCareDocSnapshot,
  normalizeCareDoc,
} from "@/lib/careDocNormalization";
import {
  convertLegacyState,
  parseLegacyState,
  LEGACY_IMPORT_FLAG_KEY,
  LEGACY_STATE_KEY,
  type LegacyImportResult,
} from "@/lib/legacyImport";
import type { SupportLegalReadinessProofEvidence } from "@/lib/supportRunbook";

const UNSCOPED_V2_STORAGE_KEY = "woofwatcher.v2.state";
const MAX_POSTGRES_INTEGER = 2_147_483_647;
const CARE_ENTRY_SYNC_FAILURE = "Saved locally. Refresh to retry sync.";
const CARE_ENTRY_REFRESH_QUIESCENCE_TIMEOUT_MS = 5_000;

interface ScopedCareEntryMutationToken {
  lifecycleToken: CareLifecycleToken;
  householdId: string;
}

export interface WeightInfo {
  current: number;
  goal: string;
  unit: string;
}

export interface Profile {
  name: string;
  publicLabel: string;
  breed: string;
  background: string;
  careFocus: string;
  microchipNumber?: string;
  insuranceProvider?: string;
  insurancePolicy?: string;
  primaryVet?: string;
  emergencyContact?: string;
  weight: WeightInfo;
  vetBoundary: string;
}

export interface PetProfile {
  id: string;
  name: string;
  publicLabel?: string;
  breed: string;
  careFocus?: string;
  avatarTemplateId?: string;
  status?: "live" | "setup-needed" | "provider-gated";
  createdAt?: string;
  weight?: Partial<WeightInfo>;
}

export interface Caregiver {
  name: string;
  role: string;
}

export interface HouseholdSetup {
  mode: "create" | "join" | "local";
  householdName: string;
  inviteCode?: string;
  providerStatus: "local-only" | "pending-provider";
  updatedAt?: string;
}

export interface LaunchSupportProfile {
  supportEmail: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  refundPolicyApproved: boolean;
  veterinaryBoundaryApproved: boolean;
  accountDeletionEscalationApproved: boolean;
  incidentResponseApproved: boolean;
  supportLegalReadinessEvidence?: SupportLegalReadinessProofEvidence | null;
  ownerReviewedAt?: string;
  providerStatus: "local-draft" | "owner-reviewed" | "provider-approved";
}

export interface LaunchProviderProfile {
  authConfigured: boolean;
  authProviderProofReady: boolean;
  databaseConfigured: boolean;
  databaseProviderProofReady: boolean;
  storageProviderConfigured: boolean;
  storageProviderProofReady: boolean;
  storageProviderEvidence?: LaunchStorageProviderEvidence | null;
  aiProviderConfigured: boolean;
  aiProviderProofReady: boolean;
  paymentsEnabled: boolean;
  paymentsProviderProofReady: boolean;
  pushNotificationsConfigured: boolean;
  pushNotificationsProofReady: boolean;
  appStoreAccountsReady: boolean;
  storeAccountsProofReady: boolean;
  accountDeletionEnabled: boolean;
  accountDeletionProofReady: boolean;
  ownerReviewedAt?: string;
  providerStatus: "local-draft" | "owner-reviewed" | "provider-approved";
  notes: string;
}

export interface Routine {
  id: string;
  label: string;
  type: string;
  time: string;
  owner: string;
  note: string;
}

export interface Goal {
  id: string;
  category: string;
  title: string;
  target: string;
  status: string;
  due: string;
  note: string;
}

export interface Record {
  id: string;
  type: string;
  title: string;
  due: string;
  note: string;
  attachmentUri?: string;
  attachmentName?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: string;
  date: string;
  time?: string;
  location?: string;
  note?: string;
  source: "manual" | "woofguide";
}

export type ReportArtifact = CarePassArtifact;

export type CareEntryServerSnapshot = Omit<
  Entry,
  "syncStatus" | "syncError" | "conflictServerSnapshot"
>;

export type CareEntryConflictActionResult =
  | "resolved"
  | "refresh-failed"
  | "stale"
  | "unavailable";

export interface Entry {
  id: string;
  revision?: number;
  type: string;
  title: string;
  caregiver: string;
  caregiverUserId?: string;
  occurredAt: string;
  durationMinutes?: number;
  amount?: string;
  mood?: string;
  severity?: string;
  note?: string;
  dogInteractions?: number;
  food?: string;
  details?: { [key: string]: unknown };
  syncStatus?: EntrySyncStatus;
  syncError?: string;
  conflictServerSnapshot?: CareEntryServerSnapshot;
}

export interface DietProfile {
  primaryFood: string;
  normalPortion: string;
  mealSchedule: string;
  toppers: string;
  supplements: string;
  bedtimeSnack: string;
  treatsAllowed: string;
  avoid: string;
  sensitivities: string;
  appetiteQuirks: string;
  vetNotes: string;
}

/**
 * The shared, synced configuration document. Holds everything about the dog
 * and the household's care plan EXCEPT the running care log, which lives as
 * individual server rows (see {@link Entry}) so concurrent edits are safe.
 */
export interface CareDoc {
  createdAt: string;
  updatedAt: string;
  activePetId: string;
  profile: Profile;
  pets: PetProfile[];
  caregivers: Caregiver[];
  householdSetup: HouseholdSetup;
  launchSupportProfile: LaunchSupportProfile;
  launchProviderProfile: LaunchProviderProfile;
  reminderNotificationPreferences: ReminderNotificationPreferences;
  dietProfile: DietProfile;
  routines: Routine[];
  goals: Goal[];
  records: Record[];
  accessPasses: AccessPass[];
  adventureMemories: AdventureMemory[];
  reportArtifacts: ReportArtifact[];
  calendarEvents: CalendarEvent[];
}

export interface CareState extends CareDoc {
  version: number;
  entries: Entry[];
}

function createDefaultDoc(
  metadata: Pick<CareDoc, "createdAt" | "updatedAt">,
): CareDoc {
  return {
    ...metadata,
    activePetId: "primary",
    profile: {
      name: "My Dog",
      publicLabel: "My Dog",
      breed: "",
      background: "",
      careFocus: "",
      microchipNumber: "",
      insuranceProvider: "",
      insurancePolicy: "",
      primaryVet: "",
      emergencyContact: "",
      weight: {
        current: 0,
        goal: "",
        unit: "lb",
      },
      vetBoundary:
        "WoofWatcher tracks patterns for caregiver and veterinarian review. It is not a veterinary diagnosis.",
    },
    pets: [],
    caregivers: [],
    householdSetup: {
      mode: "create",
      householdName: "",
      inviteCode: "",
      providerStatus: "local-only",
    },
    launchSupportProfile: {
      supportEmail: "",
      privacyPolicyUrl: "",
      termsUrl: "",
      refundPolicyApproved: false,
      veterinaryBoundaryApproved: false,
      accountDeletionEscalationApproved: false,
      incidentResponseApproved: false,
      supportLegalReadinessEvidence: null,
      providerStatus: "local-draft",
    },
    launchProviderProfile: normalizeLaunchProviderProfile(null),
    reminderNotificationPreferences:
      normalizeReminderNotificationPreferences(null),
    dietProfile: {
      primaryFood: "",
      normalPortion: "",
      mealSchedule: "",
      toppers: "",
      supplements: "",
      bedtimeSnack: "",
      treatsAllowed: "",
      avoid: "",
      sensitivities: "",
      appetiteQuirks: "",
      vetNotes: "",
    },
    routines: [],
    goals: [],
    records: [],
    accessPasses: [],
    adventureMemories: [],
    reportArtifacts: [],
    calendarEvents: [],
  };
}

function getFreshDoc(): CareDoc {
  return createDefaultDoc(createFreshCareDocMetadata());
}

function mergeDoc(value: unknown): CareDoc {
  return normalizeCareDoc(
    value,
    createDefaultDoc(createLegacyCareDocMetadata()),
  );
}

function toEntry(c: ApiCareEntry): Entry {
  const d = (c.details ?? {}) as { [key: string]: unknown };
  return {
    id: c.id,
    revision: c.revision,
    type: c.type,
    title: typeof d.title === "string" ? d.title : "",
    caregiver: c.caregiverName ?? "",
    caregiverUserId: c.caregiverUserId ?? undefined,
    occurredAt: c.occurredAt,
    durationMinutes:
      typeof d.durationMinutes === "number" ? d.durationMinutes : undefined,
    amount: typeof d.amount === "string" ? d.amount : undefined,
    mood: c.mood ?? undefined,
    severity: c.severity ?? undefined,
    note: c.note ?? undefined,
    dogInteractions:
      typeof d.dogInteractions === "number" ? d.dogInteractions : undefined,
    food: typeof d.food === "string" ? d.food : undefined,
    details: d,
    syncStatus: "synced",
  };
}

function toCreateInput(
  e: Omit<Entry, "id">,
  clientKey?: string,
): CareEntryInput {
  const details: { [key: string]: unknown } = { ...(e.details ?? {}) };
  if (e.title) details.title = e.title;
  if (e.durationMinutes != null) details.durationMinutes = e.durationMinutes;
  if (e.amount != null) details.amount = e.amount;
  if (e.dogInteractions != null) details.dogInteractions = e.dogInteractions;
  if (e.food != null) details.food = e.food;
  // Idempotency key: the entry's temp id, stable across retries, so a create
  // whose response was lost can be re-sent without duplicating the row (the
  // server dedupes on details.clientKey).
  if (clientKey) details.clientKey = clientKey;
  return {
    type: e.type,
    occurredAt: e.occurredAt,
    mood: e.mood,
    severity: e.severity,
    note: e.note,
    details: Object.keys(details).length ? details : undefined,
  };
}

// Build a full update payload from a merged entry so a partial patch never
// clobbers server-side details (PATCH replaces the details object wholesale).
function toUpdateInput(e: Entry, expectedRevision: number): CareEntryUpdate {
  const details: { [key: string]: unknown } = { ...(e.details ?? {}) };
  if (e.title) details.title = e.title;
  if (e.durationMinutes != null) details.durationMinutes = e.durationMinutes;
  if (e.amount != null) details.amount = e.amount;
  if (e.dogInteractions != null) details.dogInteractions = e.dogInteractions;
  if (e.food != null) details.food = e.food;
  return {
    expectedRevision,
    type: e.type,
    occurredAt: e.occurredAt,
    mood: e.mood ?? null,
    severity: e.severity ?? null,
    note: e.note ?? null,
    details: Object.keys(details).length ? details : null,
  };
}

function careEntryRevision(entry: Pick<Entry, "revision">): number {
  return Number.isInteger(entry.revision) &&
    (entry.revision as number) >= 1 &&
    (entry.revision as number) <= MAX_POSTGRES_INTEGER
    ? (entry.revision as number)
    : 1;
}

function careEntryConflictFromError(error: unknown): Entry | null {
  if (
    !error ||
    typeof error !== "object" ||
    (error as { status?: unknown }).status !== 409
  ) {
    return null;
  }
  const current = (error as { data?: unknown }).data;
  if (
    !current ||
    typeof current !== "object" ||
    typeof (current as { id?: unknown }).id !== "string" ||
    typeof (current as { type?: unknown }).type !== "string" ||
    typeof (current as { occurredAt?: unknown }).occurredAt !== "string" ||
    !Number.isInteger((current as { revision?: unknown }).revision)
  ) {
    return null;
  }
  return toEntry(current as ApiCareEntry);
}

interface CareContextValue {
  state: CareState;
  /** Resolved device-storage partition for the active account + household. */
  storageScope: CareStorageScope | null;
  addEntry: (entry: Omit<Entry, "id">) => string;
  deleteEntry: (id: string) => Promise<boolean>;
  updateEntry: (id: string, patch: Partial<Omit<Entry, "id">>) => boolean;
  resolveEntryConflict: (
    id: string,
    resolution: "keep-local" | "use-household",
  ) => Promise<CareEntryConflictActionResult>;
  updateCareDoc: (updater: (doc: CareDoc) => CareDoc) => void;
  refresh: () => Promise<boolean>;
  /**
   * Re-resolves /me, pauses every old-scope write, clears live/query state,
   * hydrates the newly selected account+household cache, then allows sync.
   */
  rehydrateHouseholdScope: () => Promise<boolean>;
  /**
   * Clears device-local care and returns a target-by-target receipt.
   * Provider-synced care is intentionally outside this device-only action.
   */
  eraseAllLocalData: () => Promise<CareDeviceWipeReceipt>;
  /**
   * Joins Pack, avatar, and other device writes to the same lifecycle queue
   * as care persistence. A wipe pauses new work and drains this queue before
   * removing owned keys, so a delayed feature write cannot resurrect data.
   */
  runDeviceOperation: (operation: () => Promise<void>) => Promise<void>;
  syncOutbox: CareSyncOutbox;
  isLoaded: boolean;
  isSyncing: boolean;
  resolvingEntryConflictIds: readonly string[];
  refreshError: string | null;
  syncRefreshError: string | null;
  /**
   * Local-storage health. Local-first means a failing device store IS a data
   * risk, so it must be visible ("sync failures visible" applies doubly to
   * the primary store): "save-failed" = writes are erroring, recent logs may
   * not survive a restart; "read-failed" = stored data could not be read, so
   * persistence is paused to protect it; "reset" = the cache was corrupt and
   * was reset, with the raw blob kept under a recovery key.
   */
  storageWarning: "save-failed" | "read-failed" | "reset" | null;
  careDocConflicts: CareDocConflict[];
  documentSyncError: string | null;
  prepareCareDocConflictDismissal: (conflict: CareDocConflict) => () => boolean;
  /**
   * Set (for this session only) when boot found and adopted care data from
   * the legacy web PWA's localStorage. Home shows a one-time welcome-back
   * notice from it. The import runs only into a pristine v2 store, never
   * merges into established data, and never deletes the legacy key - the
   * original stays as its own backup until an owner wipe removes both.
   */
  legacyImport: LegacyImportResult["summary"] | null;
}

const CareContext = createContext<CareContextValue | null>(null);

export function CareProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded: clerkLoaded, userId } = useWoofAuth();
  const queryClient = useQueryClient();

  const [doc, setDoc] = useState<CareDoc>(getFreshDoc);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [serverVersion, setServerVersion] = useState(0);
  const [storageScope, setStorageScope] = useState<CareStorageScope | null>(
    null,
  );
  const [hydrated, setHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [resolvingEntryConflictIds, setResolvingEntryConflictIds] = useState<
    string[]
  >([]);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [syncRefreshError, setSyncRefreshError] = useState<string | null>(
    null,
  );
  const [storageWarning, setStorageWarning] = useState<
    "save-failed" | "read-failed" | "reset" | null
  >(null);
  const [careDocConflicts, setCareDocConflicts] = useState<CareDocConflict[]>(
    [],
  );
  const [documentSyncError, setDocumentSyncError] = useState<string | null>(
    null,
  );
  const [legacyImport, setLegacyImport] = useState<
    LegacyImportResult["summary"] | null
  >(null);
  const [pendingCareEntryDeleteKeys, setPendingCareEntryDeleteKeys] = useState<
    string[]
  >([]);
  const [scopeReloadNonce, setScopeReloadNonce] = useState(0);

  // Refs mirror state so async callbacks read fresh values without re-binding.
  const docRef = useRef(doc);
  const entriesRef = useRef(entries);
  const versionRef = useRef(serverVersion);
  const acknowledgedCareDocRef = useRef<AcknowledgedCareDoc<CareDoc> | null>(
    null,
  );
  const careDocConflictsRef = useRef<CareDocConflict[]>([]);
  const documentSyncErrorRef = useRef<string | null>(null);
  const storageScopeRef = useRef<CareStorageScope | null>(null);
  const signedInRef = useRef(false);
  const syncingRef = useRef(false);
  // Maps optimistic temp ids to their server ids and distinguishes a live
  // create from a failed temp row that is only waiting for an explicit retry.
  const realIdByTemp = useRef<Map<string, string>>(new Map());
  const creatingTempIdsRef = useRef<Set<string>>(new Set());
  const entryMutationGenerationRef = useRef(0);
  const pendingCareEntryDeleteIdsRef = useRef<Set<string>>(new Set());
  const resolvingEntryConflictIdsRef = useRef<Set<string>>(new Set());
  const entryRefreshSerialRef = useRef(0);
  const lastEntryRefreshServerEntriesRef = useRef<Map<string, Entry>>(
    new Map(),
  );
  const [lifecycle] = useState(createCareLifecycleCoordinator);
  const [scopeReloadCoordinator] = useState(() =>
    createHouseholdScopeReloadCoordinator(lifecycle),
  );
  const [pendingCareEntryDeleteStore] = useState(() =>
    createCarePendingDeleteStore({
      getItem: (key) => AsyncStorage.getItem(key),
      setItem: (key, value) => AsyncStorage.setItem(key, value),
    }),
  );
  const scopeReloadHandoffRef = useRef<
    (HouseholdScopeReloadRequest & { userId: string }) | null
  >(null);
  const [careDocSyncCoordinator] = useState(() =>
    createCareDocSyncCoordinator<CareDoc>({
      readSnapshot: () => ({
        currentDoc: docRef.current,
        serverVersion: versionRef.current,
        acknowledged: acknowledgedCareDocRef.current,
        conflicts: careDocConflictsRef.current,
        documentSyncError: documentSyncErrorRef.current,
      }),
      commitSnapshot: (snapshot) => {
        docRef.current = snapshot.currentDoc;
        versionRef.current = snapshot.serverVersion;
        acknowledgedCareDocRef.current = snapshot.acknowledged;
        careDocConflictsRef.current = snapshot.conflicts;
        documentSyncErrorRef.current = snapshot.documentSyncError;
        setDoc(snapshot.currentDoc);
        setServerVersion(snapshot.serverVersion);
        setCareDocConflicts(snapshot.conflicts);
        setDocumentSyncError(snapshot.documentSyncError);
      },
      normalizeDoc: mergeDoc,
      isCompleteDoc: isCompleteCareDocSnapshot,
      getRemote: (householdId) => getCareState({ householdId }),
      putRemote: ({ householdId, version, doc: nextDoc }) =>
        putCareState(
          {
            version,
            doc: nextDoc as unknown as CareStateEnvelope["doc"],
          },
          { householdId },
        ),
      now: () => new Date().toISOString(),
    }),
  );
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  useEffect(() => {
    versionRef.current = serverVersion;
  }, [serverVersion]);
  useEffect(() => {
    storageScopeRef.current = storageScope;
  }, [storageScope]);
  useEffect(() => {
    signedInRef.current =
      !!isSignedIn && hydrated && storageScope?.kind === "account";
  }, [isSignedIn, hydrated, storageScope]);

  const commitEntriesForRequest = useCallback(
    (
      lifecycleToken: CareLifecycleToken,
      update: (current: Entry[]) => Entry[],
    ) => {
      return commitCareEntriesIfCurrent({
        lifecycleToken,
        isCurrent: lifecycle.isCurrent,
        entriesRef,
        setEntries,
        update,
      });
    },
    [lifecycle],
  );

  const advanceEntryMutationGeneration = useCallback(() => {
    entryMutationGenerationRef.current += 1;
  }, []);

  const addPendingCareEntryDeleteKey = useCallback((key: string) => {
    if (pendingCareEntryDeleteIdsRef.current.has(key)) return;
    const next = new Set(pendingCareEntryDeleteIdsRef.current);
    next.add(key);
    pendingCareEntryDeleteIdsRef.current = next;
    setPendingCareEntryDeleteKeys([...next]);
  }, []);

  const removePendingCareEntryDeleteKeys = useCallback((...keys: string[]) => {
    const next = new Set(pendingCareEntryDeleteIdsRef.current);
    let changed = false;
    keys.forEach((key) => {
      changed = next.delete(key) || changed;
    });
    if (!changed) return;
    pendingCareEntryDeleteIdsRef.current = next;
    setPendingCareEntryDeleteKeys([...next]);
  }, []);

  const [entryMutationQueue] = useState(() =>
    createCareEntryMutationQueue<Entry, ScopedCareEntryMutationToken>({
      mutate: ({ serverId, optimistic, expectedRevision, token }) => {
        return updateCareEntry(
          serverId,
          toUpdateInput(optimistic, expectedRevision),
          { householdId: token.householdId },
        )
          .then((returned) => {
            if (returned.householdId !== token.householdId) {
              throw new Error(
                "Ignored a care-log update for a different household.",
              );
            }
            return toEntry(returned);
          })
          .catch((error) => {
            if (
              error &&
              typeof error === "object" &&
              (error as { status?: unknown }).status === 409 &&
              !isCareEntryConflictInHousehold(error, token.householdId)
            ) {
              throw new Error(
                "Ignored a care-log conflict for a different household.",
              );
            }
            throw error;
          });
      },
      getRevision: careEntryRevision,
      isCurrent: (token) =>
        lifecycle.isCurrent(token.lifecycleToken) &&
        storageScopeRef.current?.kind === "account" &&
        storageScopeRef.current.householdId === token.householdId,
      getConflictEntry: careEntryConflictFromError,
      onSynced: ({ key, serverId, optimistic, returned, token }) => {
        const synced = finalizeCareEntryMutation(
          optimistic,
          returned,
          serverId,
        );
        if (
          !commitEntriesForRequest(token.lifecycleToken, (current) =>
            current.map((entry) =>
              entry.id === key || entry.id === serverId
                ? applyCareEntryMutationCallback(
                    entry,
                    synced,
                    careEntryRevision(returned),
                  )
                : entry,
            ),
          )
        ) {
          return;
        }
        advanceEntryMutationGeneration();
        queryClient.invalidateQueries({
          queryKey: getListCareEntriesQueryKey(),
        });
      },
      onFailed: ({ key, serverId, optimistic, expectedRevision, token }) => {
        const committed = commitEntriesForRequest(
          token.lifecycleToken,
          (current) =>
            current.map((entry) =>
              entry.id === key || entry.id === serverId
                ? applyCareEntryMutationCallback(
                    entry,
                    {
                      ...optimistic,
                      id: serverId,
                      revision: expectedRevision,
                      syncStatus: "failed",
                      syncError: CARE_ENTRY_SYNC_FAILURE,
                    },
                    expectedRevision,
                  )
                : entry,
            ),
        );
        if (committed) advanceEntryMutationGeneration();
      },
      onConflict: ({ key, serverId, optimistic, current, token }) => {
        const committed = commitEntriesForRequest(
          token.lifecycleToken,
          (entriesCurrent) =>
            entriesCurrent.map((entry) =>
              entry.id === key || entry.id === serverId
                ? applyCareEntryMutationCallback(
                    entry,
                    {
                      ...optimistic,
                      id: serverId,
                      revision: current?.revision ?? optimistic.revision,
                      caregiverUserId:
                        current?.caregiverUserId ?? optimistic.caregiverUserId,
                      syncStatus: "conflict",
                      syncError: CARE_ENTRY_REVISION_CONFLICT_MESSAGE,
                      conflictServerSnapshot: current
                        ? toCareEntryConflictSnapshot(current)
                        : undefined,
                    },
                    careEntryRevision(current ?? optimistic),
                  )
                : entry,
            ),
        );
        if (committed) advanceEntryMutationGeneration();
      },
    }),
  );

  const resetLiveState = useCallback(() => {
    entryMutationQueue.clear();
    advanceEntryMutationGeneration();
    pendingCareEntryDeleteIdsRef.current.clear();
    pendingCareEntryDeleteStore.forget();
    setPendingCareEntryDeleteKeys([]);
    careDocSyncCoordinator.beginGeneration();
    const freshDoc = getFreshDoc();
    docRef.current = freshDoc;
    entriesRef.current = [];
    versionRef.current = 0;
    acknowledgedCareDocRef.current = null;
    careDocConflictsRef.current = [];
    documentSyncErrorRef.current = null;
    setDoc(freshDoc);
    setEntries([]);
    setServerVersion(0);
    setCareDocConflicts([]);
    setDocumentSyncError(null);
    setSyncRefreshError(null);
    realIdByTemp.current.clear();
    creatingTempIdsRef.current.clear();
    resolvingEntryConflictIdsRef.current.clear();
    entryRefreshSerialRef.current += 1;
    lastEntryRefreshServerEntriesRef.current.clear();
    setResolvingEntryConflictIds([]);
  }, [
    advanceEntryMutationGeneration,
    careDocSyncCoordinator,
    entryMutationQueue,
    pendingCareEntryDeleteStore,
  ]);

  const pauseAndResetScope = useCallback(() => {
    // Refs gate async sync/mutation work immediately. Keep these assignments
    // before React state setters, which are intentionally scheduled.
    signedInRef.current = false;
    syncingRef.current = false;
    storageScopeRef.current = null;
    setHydrated(false);
    setStorageScope(null);
    setStorageWarning(null);
    setRefreshError(null);
    setLegacyImport(null);
    setIsSyncing(false);
    resetLiveState();
    queryClient.clear();
  }, [queryClient, resetLiveState]);

  const rehydrateHouseholdScope = useCallback((): Promise<boolean> => {
    if (!clerkLoaded || !isSignedIn || !userId) {
      return Promise.resolve(false);
    }
    const request = scopeReloadCoordinator.requestReload(pauseAndResetScope);
    scopeReloadHandoffRef.current = { ...request, userId };
    setScopeReloadNonce((current) => current + 1);
    return request.promise;
  }, [
    clerkLoaded,
    isSignedIn,
    pauseAndResetScope,
    scopeReloadCoordinator,
    userId,
  ]);

  useEffect(() => {
    scopeReloadCoordinator.activate();
    return () => {
      scopeReloadHandoffRef.current = null;
      entryMutationQueue.clear();
      careDocSyncCoordinator.beginGeneration();
      scopeReloadCoordinator.dispose();
    };
  }, [careDocSyncCoordinator, entryMutationQueue, scopeReloadCoordinator]);

  // Resolve the authenticated household before selecting any account cache.
  // Identity changes immediately pause persistence/sync and empty every live
  // ref and query cache. Only a completed read of the new scoped key may
  // release the hydration gate.
  useEffect(() => {
    const pendingHandoff = scopeReloadHandoffRef.current;
    scopeReloadHandoffRef.current = null;
    const reloadHandoff =
      pendingHandoff &&
      pendingHandoff.userId === userId &&
      lifecycle.isCurrent(pendingHandoff.token)
        ? pendingHandoff
        : null;
    if (!reloadHandoff) scopeReloadCoordinator.cancelActive();
    const lifecycleToken =
      reloadHandoff?.token ?? lifecycle.beginIdentityChange();
    let cancelled = false;

    if (!reloadHandoff) pauseAndResetScope();

    const isCurrentIdentity = () =>
      !cancelled && lifecycle.isCurrent(lifecycleToken);

    const readWithRetry = async (
      key: string,
    ): Promise<
      { completed: true; raw: string | null } | { completed: false }
    > => {
      await lifecycle.waitForDeviceOperations();
      if (!isCurrentIdentity()) return { completed: false };
      try {
        return { completed: true, raw: await AsyncStorage.getItem(key) };
      } catch {
        await new Promise<void>((resolve) => setTimeout(resolve, 1500));
        if (!isCurrentIdentity()) return { completed: false };
        try {
          return { completed: true, raw: await AsyncStorage.getItem(key) };
        } catch {
          if (isCurrentIdentity()) setStorageWarning("read-failed");
          return { completed: false };
        }
      }
    };

    // Returns whether the scoped store is pristine. Corrupt data is backed
    // up before defaults are ever allowed to persist over the primary key.
    const applyRaw = async (
      scope: CareStorageScope,
      raw: string | null,
      recoveryKey: string,
    ): Promise<boolean | null> => {
      let durablePendingCareEntryDeleteKeys: string[];
      try {
        durablePendingCareEntryDeleteKeys =
          await pendingCareEntryDeleteStore.read(scope);
      } catch {
        if (isCurrentIdentity()) setStorageWarning("read-failed");
        return null;
      }
      if (!isCurrentIdentity()) return null;
      if (!raw) {
        pendingCareEntryDeleteIdsRef.current = new Set(
          durablePendingCareEntryDeleteKeys,
        );
        setPendingCareEntryDeleteKeys(durablePendingCareEntryDeleteKeys);
        return true;
      }
      try {
        const parsed = JSON.parse(raw);
        const rawCurrentDoc = parsed?.currentDoc ?? parsed?.doc;
        const cachedDocumentSync = parseCareDocSyncSnapshot({
          parsed,
          fallbackDoc: docRef.current,
          normalizeDoc: mergeDoc,
          isCompleteCurrentDoc: isCompleteCareDocSnapshot,
        });
        if (cachedDocumentSync.cacheStatus === "corrupt") {
          // Do not let fallback defaults inherit a cached version/base. First
          // quarantine the exact raw payload, while persistence is still
          // paused, then hydrate the already-reset pristine v0 document.
          const recoveryWrite = await lifecycle.queueStorageWrite(
            lifecycleToken,
            () => AsyncStorage.setItem(recoveryKey, raw),
            { allowWhilePaused: true },
          );
          if (recoveryWrite !== "written") {
            if (isCurrentIdentity()) setStorageWarning("read-failed");
            return null;
          }
          if (isCurrentIdentity()) setStorageWarning("reset");
          return true;
        }
        const cachedDoc = cachedDocumentSync.currentDoc;
        const cachedEntryHydration =
          await parseCachedCareEntriesWithRecovery<Entry>({
            raw,
            value: parsed?.entries,
            quarantine: async (exactRaw) => {
              const recoveryWrite = await lifecycle.queueStorageWrite(
                lifecycleToken,
                () => AsyncStorage.setItem(recoveryKey, exactRaw),
                { allowWhilePaused: true },
              );
              return recoveryWrite === "written";
            },
          });
        if (cachedEntryHydration.status === "quarantine-failed") {
          if (isCurrentIdentity()) setStorageWarning("read-failed");
          return null;
        }
        if (cachedEntryHydration.status === "quarantined") {
          if (isCurrentIdentity()) setStorageWarning("reset");
          return true;
        }
        const cachedEntries: Entry[] = cachedEntryHydration.entries;
        let legacyPendingCareEntryDeleteKeys: string[];
        try {
          legacyPendingCareEntryDeleteKeys =
            parsed?.pendingCareEntryDeleteKeys === undefined
              ? []
              : parseCarePendingDeleteKeys(
                  JSON.stringify(parsed.pendingCareEntryDeleteKeys),
                );
        } catch {
          if (isCurrentIdentity()) setStorageWarning("read-failed");
          return null;
        }
        const cachedPendingCareEntryDeleteKeys = [
          ...new Set([
            ...durablePendingCareEntryDeleteKeys,
            ...legacyPendingCareEntryDeleteKeys,
          ]),
        ];
        try {
          await pendingCareEntryDeleteStore.replace(
            scope,
            cachedPendingCareEntryDeleteKeys,
          );
        } catch {
          if (isCurrentIdentity()) setStorageWarning("read-failed");
          return null;
        }
        const cachedVersion = cachedDocumentSync.serverVersion;
        const cachedAcknowledged = cachedDocumentSync.acknowledged;
        const cachedConflicts = cachedDocumentSync.conflicts;
        const cachedDocumentSyncError = cachedDocumentSync.documentSyncError;
        if (!isCurrentIdentity()) return null;
        docRef.current = cachedDoc;
        entriesRef.current = cachedEntries;
        pendingCareEntryDeleteIdsRef.current = new Set(
          cachedPendingCareEntryDeleteKeys,
        );
        versionRef.current = cachedVersion;
        acknowledgedCareDocRef.current = cachedAcknowledged;
        careDocConflictsRef.current = cachedConflicts;
        documentSyncErrorRef.current = cachedDocumentSyncError;
        setDoc(cachedDoc);
        setEntries(cachedEntries);
        setPendingCareEntryDeleteKeys(cachedPendingCareEntryDeleteKeys);
        setServerVersion(cachedVersion);
        setCareDocConflicts(cachedConflicts);
        setDocumentSyncError(cachedDocumentSyncError);
        const docUpdatedAt =
          typeof rawCurrentDoc?.updatedAt === "string"
            ? rawCurrentDoc.updatedAt
            : "";
        return (
          cachedEntries.length === 0 &&
          (!docUpdatedAt || docUpdatedAt === new Date(0).toISOString())
        );
      } catch {
        const recoveryWrite = await lifecycle.queueStorageWrite(
          lifecycleToken,
          () => AsyncStorage.setItem(recoveryKey, raw),
          { allowWhilePaused: true },
        );
        if (recoveryWrite !== "written") {
          if (isCurrentIdentity()) setStorageWarning("read-failed");
          return null;
        }
        if (isCurrentIdentity()) setStorageWarning("reset");
        return false;
      }
    };

    // Legacy PWA data is unscoped. It may seed only the explicit local
    // preview, never an authenticated account or household cache.
    const maybeImportLegacyState = async () => {
      try {
        const [flag, legacyRaw] = await Promise.all([
          AsyncStorage.getItem(LEGACY_IMPORT_FLAG_KEY),
          AsyncStorage.getItem(LEGACY_STATE_KEY),
        ]);
        if (!isCurrentIdentity() || flag || !legacyRaw) return;
        const stamp = async (payload: object) => {
          const result = await lifecycle.queueStorageWrite(
            lifecycleToken,
            () =>
              AsyncStorage.setItem(
                LEGACY_IMPORT_FLAG_KEY,
                JSON.stringify({ at: new Date().toISOString(), ...payload }),
              ),
            { allowWhilePaused: true },
          );
          if (result === "failed") {
            throw new Error("Legacy import receipt could not be saved.");
          }
        };
        const result = convertLegacyState(parseLegacyState(legacyRaw));
        if (!result) {
          await stamp({ status: "nothing-to-import" });
          return;
        }
        if (!isCurrentIdentity()) return;
        if (Object.keys(result.docPatch).length) {
          const previous = docRef.current;
          const importedDoc: CareDoc = {
            ...previous,
            ...result.docPatch,
            profile: result.docPatch.profile
              ? {
                  ...previous.profile,
                  ...result.docPatch.profile,
                  weight: {
                    ...previous.profile.weight,
                    ...result.docPatch.profile.weight,
                  },
                }
              : previous.profile,
            dietProfile: result.docPatch.dietProfile
              ? { ...previous.dietProfile, ...result.docPatch.dietProfile }
              : previous.dietProfile,
            updatedAt: new Date().toISOString(),
          };
          docRef.current = importedDoc;
          setDoc(importedDoc);
        }
        if (result.entries.length) {
          const importedEntries = [...entriesRef.current, ...result.entries];
          entriesRef.current = importedEntries;
          setEntries(importedEntries);
        }
        setLegacyImport(result.summary);
        await stamp({ status: "imported", summary: result.summary });
      } catch {
        // A legacy read must never break boot; the scoped store stays usable.
      }
    };

    const hydrateScope = async (scope: CareStorageScope): Promise<boolean> => {
      if (!isCurrentIdentity()) return false;
      const storageKey = getCareStorageKey(scope);
      const recoveryKey = getCareRecoveryKey(scope);
      const adoptUnscopedCache = shouldAdoptUnscopedV2Cache({
        clerkConfigured: isClerkConfigured,
        scope,
      });
      storageScopeRef.current = scope;
      setStorageScope(scope);

      const scopedRead = await readWithRetry(storageKey);
      if (!isCurrentIdentity() || !scopedRead.completed) return false;
      let raw = scopedRead.raw;
      if (!raw && adoptUnscopedCache) {
        const unscopedRead = await readWithRetry(UNSCOPED_V2_STORAGE_KEY);
        if (!isCurrentIdentity() || !unscopedRead.completed) return false;
        raw = unscopedRead.raw;
      }

      const pristine = await applyRaw(scope, raw, recoveryKey);
      if (!isCurrentIdentity() || pristine === null) return false;
      if (pristine && adoptUnscopedCache) await maybeImportLegacyState();
      if (!isCurrentIdentity()) return false;
      if (!lifecycle.completeHydration(lifecycleToken)) return false;
      setHydrated(true);
      signedInRef.current = scope.kind === "account";
      return true;
    };

    const resolveScope = async (): Promise<boolean> => {
      let success = false;
      if (!isClerkConfigured) {
        success = await hydrateScope({ kind: "local" });
      } else if (clerkLoaded && isSignedIn && userId) {
        try {
          const me = await getMe();
          if (isCurrentIdentity() && me.user.id === userId) {
            success = await hydrateScope({
              kind: "account",
              userId,
              householdId: me.household.id,
            });
          }
        } catch {
          // Without /me there is no trustworthy household scope. Keep both
          // persistence and sync paused instead of guessing from old data.
        }
      }
      return isCurrentIdentity() && success;
    };

    const resolution = resolveScope();
    if (reloadHandoff) {
      void scopeReloadCoordinator.settleFrom(reloadHandoff, resolution);
    } else {
      void resolution;
    }
    return () => {
      cancelled = true;
    };
  }, [
    clerkLoaded,
    isSignedIn,
    lifecycle,
    pendingCareEntryDeleteStore,
    pauseAndResetScope,
    scopeReloadCoordinator,
    scopeReloadNonce,
    userId,
  ]);

  // Persist the offline cache whenever synced state changes. A failing
  // device store is a data risk in a local-first app, so surface it instead
  // of swallowing it - and clear the warning when writes recover.
  useEffect(() => {
    if (!hydrated || !storageScope) return;
    const lifecycleToken = lifecycle.capture();
    void lifecycle
      .queueStorageWrite(lifecycleToken, () =>
        AsyncStorage.setItem(
          getCareStorageKey(storageScope),
          JSON.stringify({
            serverVersion,
            currentDoc: doc,
            acknowledged: acknowledgedCareDocRef.current,
            conflicts: careDocConflicts,
            documentSyncError: documentSyncError,
            pendingCareEntryDeleteKeys: pendingCareEntryDeleteKeys,
            entries,
          }),
        ),
      )
      .then((result) => {
        if (!lifecycle.isCurrent(lifecycleToken)) return;
        if (result === "failed") {
          setStorageWarning("save-failed");
          return;
        }
        if (result !== "written") return;
        setStorageWarning((current) =>
          current === "save-failed" ? null : current,
        );
      });
  }, [
    careDocConflicts,
    doc,
    documentSyncError,
    entries,
    hydrated,
    lifecycle,
    pendingCareEntryDeleteKeys,
    serverVersion,
    storageScope,
  ]);

  const pushDoc = useCallback(() => {
    const pushScope = storageScopeRef.current;
    return pushScope?.kind === "account"
      ? careDocSyncCoordinator.requestPush(pushScope.householdId)
      : Promise.resolve(false);
  }, [careDocSyncCoordinator]);

  const persistEntryCreate = useCallback(
    (tempId: string, entry: Omit<Entry, "id">) => {
      const lifecycleToken = lifecycle.capture();
      const createScope = storageScopeRef.current;
      if (createScope?.kind !== "account") {
        const failedCommitted = commitEntriesForRequest(
          lifecycleToken,
          (current) =>
            current.map((candidate) =>
              candidate.id === tempId
                ? {
                    ...candidate,
                    syncStatus: "failed",
                    syncError: CARE_ENTRY_SYNC_FAILURE,
                  }
                : candidate,
            ),
        );
        if (failedCommitted) advanceEntryMutationGeneration();
        return;
      }
      const createHouseholdId = createScope.householdId;
      const isCurrentRequest = () => {
        const currentScope = storageScopeRef.current;
        return (
          lifecycle.isCurrent(lifecycleToken) &&
          currentScope?.kind === "account" &&
          currentScope.userId === createScope.userId &&
          currentScope.householdId === createHouseholdId
        );
      };
      creatingTempIdsRef.current.add(tempId);
      const pendingCommitted = commitEntriesForRequest(
        lifecycleToken,
        (current) =>
          current.map((e) =>
            e.id === tempId
              ? { ...e, syncStatus: "pending", syncError: undefined }
              : e,
          ),
      );
      if (pendingCommitted) advanceEntryMutationGeneration();
      createCareEntry(toCreateInput(entry, tempId), {
        householdId: createHouseholdId,
      })
        .then(async (created) => {
          if (!isCurrentRequest()) return;
          if (created.householdId !== createHouseholdId) {
            throw new Error(
              "Ignored a care-log create for a different household.",
            );
          }
          const real = toEntry(created);
          const wasAlreadyBound = realIdByTemp.current.has(tempId);
          realIdByTemp.current.set(tempId, real.id);
          creatingTempIdsRef.current.delete(tempId);
          advanceEntryMutationGeneration();
          if (pendingCareEntryDeleteIdsRef.current.has(tempId)) {
            try {
              const committed = await commitCarePendingDeleteMutationIfCurrent({
                mutate: () =>
                  pendingCareEntryDeleteStore.add(createScope, real.id),
                isCurrent: isCurrentRequest,
                commit: () => {
                  addPendingCareEntryDeleteKey(real.id);
                  advanceEntryMutationGeneration();
                },
              });
              if (!isCurrentRequest()) return;
              if (!committed) return;
            } catch {
              if (isCurrentRequest()) setStorageWarning("save-failed");
              return;
            }
            try {
              await deleteCareEntry(real.id, {
                householdId: createHouseholdId,
              });
            } catch (error) {
              if (!isCareEntryDeleteConfirmedAbsent(error, createHouseholdId)) {
                if (isCurrentRequest()) {
                  setRefreshError(
                    "A deleted care log is hidden on this device but still needs cloud cleanup. Refresh to retry.",
                  );
                }
                return;
              }
            }
            if (!isCurrentRequest()) return;
            try {
              const committed = await commitCarePendingDeleteMutationIfCurrent({
                mutate: () =>
                  pendingCareEntryDeleteStore.remove(
                    createScope,
                    tempId,
                    real.id,
                  ),
                isCurrent: isCurrentRequest,
                commit: () => {
                  removePendingCareEntryDeleteKeys(tempId, real.id);
                  advanceEntryMutationGeneration();
                },
              });
              if (!isCurrentRequest()) return;
              if (!committed) return;
            } catch {
              if (isCurrentRequest()) setStorageWarning("save-failed");
              return;
            }
            queryClient.invalidateQueries({
              queryKey: getListCareEntriesQueryKey(),
            });
            return;
          }
          if (wasAlreadyBound) {
            queryClient.invalidateQueries({
              queryKey: getListCareEntriesQueryKey(),
            });
            return;
          }
          const latestTemp = entriesRef.current.find(
            (current) => current.id === tempId,
          );
          if (
            latestTemp &&
            !entryMutationQueue.hasQueuedMutation(tempId) &&
            shouldQueueCareEntryCreateFollowUp(latestTemp, real)
          ) {
            entryMutationQueue.enqueue({
              key: tempId,
              optimistic: latestTemp,
              token: {
                lifecycleToken,
                householdId: createHouseholdId,
              },
            });
          }
          // Bind the server id/revision before committing the create response.
          // The queue keeps only the newest temp edit and drains one PATCH.
          const queued = entryMutationQueue.bindServerIdentity({
            key: tempId,
            serverId: real.id,
            revision: careEntryRevision(real),
            token: {
              lifecycleToken,
              householdId: createHouseholdId,
            },
          });
          const merged: Entry = queued
            ? {
                ...real,
                ...queued,
                id: real.id,
                revision: real.revision,
                caregiverUserId: real.caregiverUserId,
                syncStatus: "pending",
                syncError: undefined,
              }
            : real;
          if (
            !commitEntriesForRequest(lifecycleToken, (current) =>
              current.map((e) => (e.id === tempId ? merged : e)),
            )
          ) {
            return;
          }
          advanceEntryMutationGeneration();
          queryClient.invalidateQueries({
            queryKey: getListCareEntriesQueryKey(),
          });
        })
        .catch(() => {
          if (
            !runCareEntrySideEffectIfCurrent({
              lifecycleToken,
              isCurrent: lifecycle.isCurrent,
              run: () => creatingTempIdsRef.current.delete(tempId),
            })
          ) {
            return;
          }
          const failedCommitted = commitEntriesForRequest(
            lifecycleToken,
            (current) =>
              current.map((e) =>
                e.id === tempId
                  ? {
                      ...e,
                      syncStatus: "failed",
                      syncError: CARE_ENTRY_SYNC_FAILURE,
                    }
                  : e,
              ),
          );
          if (failedCommitted) advanceEntryMutationGeneration();
        });
    },
    [
      advanceEntryMutationGeneration,
      addPendingCareEntryDeleteKey,
      commitEntriesForRequest,
      entryMutationQueue,
      lifecycle,
      pendingCareEntryDeleteStore,
      queryClient,
      removePendingCareEntryDeleteKeys,
    ],
  );

  const persistEntryUpdate = useCallback(
    (id: string, entry: Entry) => {
      const lifecycleToken = lifecycle.capture();
      const updateScope = storageScopeRef.current;
      if (updateScope?.kind !== "account") return;
      const optimistic: Entry = {
        ...entry,
        id,
        syncStatus: "pending",
        syncError: undefined,
      };
      const committed = commitEntriesForRequest(lifecycleToken, (current) =>
        current.map((e) => (e.id === id ? optimistic : e)),
      );
      if (committed) advanceEntryMutationGeneration();
      entryMutationQueue.enqueue({
        key: id,
        serverId: id,
        optimistic,
        token: {
          lifecycleToken,
          householdId: updateScope.householdId,
        },
      });
    },
    [
      advanceEntryMutationGeneration,
      commitEntriesForRequest,
      entryMutationQueue,
      lifecycle,
    ],
  );

  const syncFromServer = useCallback(async () => {
    const syncScope = storageScopeRef.current;
    if (
      !signedInRef.current ||
      syncingRef.current ||
      syncScope?.kind !== "account"
    ) {
      return false;
    }
    const syncHouseholdId = syncScope.householdId;
    // Capture both generations so neither a wipe nor an account/household
    // switch can accept stale sync results.
    const lifecycleToken = lifecycle.capture();
    const isCurrentRequest = () => {
      const currentScope = storageScopeRef.current;
      return (
        lifecycle.isCurrent(lifecycleToken) &&
        currentScope?.kind === "account" &&
        currentScope.userId === syncScope.userId &&
        currentScope.householdId === syncHouseholdId
      );
    };
    syncingRef.current = true;
    setIsSyncing(true);
    setRefreshError(null);
    setSyncRefreshError(null);
    const entryMutationPauseToken = entryMutationQueue.pause();
    try {
      const quiescence = await entryMutationQueue.waitForInFlight(
        entryMutationPauseToken,
        CARE_ENTRY_REFRESH_QUIESCENCE_TIMEOUT_MS,
      );
      if (!isCurrentRequest()) return false;
      if (quiescence === "timeout") {
        const refreshMessage =
          "A saved care change is still finishing. Cached and local care remain saved; refresh again after it completes.";
        setRefreshError(refreshMessage);
        setSyncRefreshError(refreshMessage);
        return false;
      }
      const documentSynced =
        await careDocSyncCoordinator.syncFromServer(syncHouseholdId);
      if (!isCurrentRequest()) return false;
      if (!documentSynced) return false;

      let serverEntriesForCommit: Entry[] = [];
      let pendingServerDeletesForCommit = new Map<string, string>();
      let confirmedAbsentPendingServerIds: string[] = [];
      const historySynced = await runCompleteCareEntryHistoryRefresh<
        Entry,
        CareLifecycleToken
      >({
        householdId: syncHouseholdId,
        fetchPage: async (params) => {
          const page = await listCareEntryHistory(params);
          assertCareEntryHistoryRowsInHousehold(page.entries, syncHouseholdId);
          return {
            householdId: page.householdId,
            historyGeneration: page.historyGeneration,
            entries: page.entries.map(toEntry),
          };
        },
        captureLifecycle: () => lifecycleToken,
        isLifecycleCurrent: (token) =>
          lifecycle.isCurrent(token) && isCurrentRequest(),
        readMutationGeneration: () => entryMutationGenerationRef.current,
        readPendingDeleteIds: () => pendingCareEntryDeleteIdsRef.current,
        readEntries: () => entriesRef.current,
        mergeEntries: (latestEntries, serverEntries) => {
          serverEntriesForCommit = [...serverEntries];
          return mergeServerAndLocalEntries(latestEntries, serverEntries, {
            hasQueuedMutation: entryMutationQueue.hasQueuedMutation,
            hasLiveCreate: (key) => creatingTempIdsRef.current.has(key),
          });
        },
        commitEntries: (
          mergedEntries,
          _historyGeneration,
          completeServerEntries,
          pendingDeleteIds,
        ) => {
          const cleanupPlan = planPendingCareEntryDeleteCleanup(
            completeServerEntries,
            pendingDeleteIds,
          );
          pendingServerDeletesForCommit = new Map(
            cleanupPlan.deleteCandidates.map((candidate) => [
              candidate.serverId,
              candidate.pendingKey,
            ]),
          );
          confirmedAbsentPendingServerIds =
            cleanupPlan.confirmedAbsentServerIds;
          discardConflictedCareEntryMutations(
            mergedEntries,
            entryMutationQueue.discard,
          );
          const mergedByServerId = new Map(
            mergedEntries.map((entry) => [entry.id, entry]),
          );
          const queuedBindings = new Set<string>();
          serverEntriesForCommit.forEach((serverEntry) => {
            const clientKey = serverEntry.details?.clientKey;
            if (
              typeof clientKey !== "string" ||
              !clientKey.startsWith("temp_")
            ) {
              return;
            }
            const matchingLocal = entriesRef.current.find(
              (entry) => entry.id === clientKey,
            );
            if (!matchingLocal) return;
            realIdByTemp.current.set(clientKey, serverEntry.id);
            creatingTempIdsRef.current.delete(clientKey);
            advanceEntryMutationGeneration();
            const merged = mergedByServerId.get(serverEntry.id);
            if (
              !merged ||
              merged.syncStatus === "conflict" ||
              merged.syncStatus === "synced"
            ) {
              entryMutationQueue.discard(clientKey);
              return;
            }
            const queued = entryMutationQueue.bindServerIdentity({
              key: clientKey,
              serverId: serverEntry.id,
              revision: careEntryRevision(serverEntry),
              token: {
                lifecycleToken,
                householdId: syncHouseholdId,
              },
            });
            if (queued) queuedBindings.add(serverEntry.id);
          });
          const committedEntries = mergedEntries.map((entry) =>
            queuedBindings.has(entry.id)
              ? {
                  ...entry,
                  syncStatus: "pending" as const,
                  syncError: undefined,
                }
              : entry,
          );
          entriesRef.current = committedEntries;
          setEntries(committedEntries);
          const retryableCreates = committedEntries.filter(
            (entry) =>
              shouldRetryCreate(entry) && entry.syncStatus !== "pending",
          );
          const retryableUpdates = committedEntries.filter(
            (entry) =>
              shouldRetryUpdate(entry) && !queuedBindings.has(entry.id),
          );
          retryableCreates.forEach((entry) => {
            persistEntryCreate(entry.id, entry);
          });
          retryableUpdates.forEach((entry) => {
            persistEntryUpdate(entry.id, entry);
          });
          lastEntryRefreshServerEntriesRef.current = new Map(
            serverEntriesForCommit.map((entry) => [entry.id, entry]),
          );
          entryRefreshSerialRef.current += 1;
        },
      });
      if (!historySynced) return false;

      if (confirmedAbsentPendingServerIds.length > 0) {
        try {
          const committed = await commitCarePendingDeleteMutationIfCurrent({
            mutate: () =>
              pendingCareEntryDeleteStore.remove(
                syncScope,
                ...confirmedAbsentPendingServerIds,
              ),
            isCurrent: isCurrentRequest,
            commit: () => {
              removePendingCareEntryDeleteKeys(
                ...confirmedAbsentPendingServerIds,
              );
              advanceEntryMutationGeneration();
            },
          });
          if (!isCurrentRequest()) return false;
          if (!committed) return false;
        } catch {
          if (isCurrentRequest()) setStorageWarning("save-failed");
          return false;
        }
      }

      for (const [serverId, pendingKey] of pendingServerDeletesForCommit) {
        if (!isCurrentRequest()) return false;
        if (
          !pendingCareEntryDeleteIdsRef.current.has(pendingKey) &&
          !pendingCareEntryDeleteIdsRef.current.has(serverId)
        ) {
          continue;
        }
        try {
          const committed = await commitCarePendingDeleteMutationIfCurrent({
            mutate: () => pendingCareEntryDeleteStore.add(syncScope, serverId),
            isCurrent: isCurrentRequest,
            commit: () => {
              addPendingCareEntryDeleteKey(serverId);
              if (pendingKey.startsWith("temp_")) {
                realIdByTemp.current.set(pendingKey, serverId);
              }
              advanceEntryMutationGeneration();
            },
          });
          if (!isCurrentRequest()) return false;
          if (!committed) return false;
        } catch {
          if (isCurrentRequest()) setStorageWarning("save-failed");
          return false;
        }
        try {
          await deleteCareEntry(serverId, {
            householdId: syncHouseholdId,
          });
        } catch (error) {
          if (!isCareEntryDeleteConfirmedAbsent(error, syncHouseholdId)) {
            if (isCurrentRequest()) {
              const refreshMessage =
                "A deleted care log is hidden on this device but still needs cloud cleanup. Cached and local care remain saved; refresh to retry.";
              setRefreshError(refreshMessage);
              setSyncRefreshError(refreshMessage);
            }
            return false;
          }
        }
        if (!isCurrentRequest()) return false;
        try {
          const committed = await commitCarePendingDeleteMutationIfCurrent({
            mutate: () =>
              pendingCareEntryDeleteStore.remove(
                syncScope,
                pendingKey,
                serverId,
              ),
            isCurrent: isCurrentRequest,
            commit: () => {
              removePendingCareEntryDeleteKeys(pendingKey, serverId);
              advanceEntryMutationGeneration();
            },
          });
          if (!isCurrentRequest()) return false;
          if (!committed) return false;
        } catch {
          if (isCurrentRequest()) setStorageWarning("save-failed");
          return false;
        }
      }
      if (pendingServerDeletesForCommit.size > 0) {
        queryClient.invalidateQueries({
          queryKey: getListCareEntriesQueryKey(),
        });
      }
      if (!isCurrentRequest()) return false;
      setSyncRefreshError(null);
      return true;
    } catch {
      if (isCurrentRequest()) {
        const refreshMessage =
          "Couldn't reach the shared household. Cached and local care remain saved. Retry when the connection is ready.";
        setRefreshError(refreshMessage);
        setSyncRefreshError(refreshMessage);
      }
      return false;
    } finally {
      entryMutationQueue.resume(entryMutationPauseToken);
      if (lifecycle.isCurrent(lifecycleToken)) {
        syncingRef.current = false;
        setIsSyncing(false);
      }
    }
  }, [
    advanceEntryMutationGeneration,
    addPendingCareEntryDeleteKey,
    careDocSyncCoordinator,
    entryMutationQueue,
    lifecycle,
    pendingCareEntryDeleteStore,
    persistEntryCreate,
    persistEntryUpdate,
    queryClient,
    removePendingCareEntryDeleteKeys,
  ]);

  useEffect(() => {
    if (
      !clerkLoaded ||
      !isSignedIn ||
      !hydrated ||
      storageScope?.kind !== "account"
    )
      return;
    void syncFromServer();
  }, [clerkLoaded, hydrated, isSignedIn, storageScope, syncFromServer]);

  const addEntry = useCallback(
    (entry: Omit<Entry, "id">) => {
      const lifecycleToken = lifecycle.capture();
      const tempId = `temp_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const localEntry: Entry = {
        id: tempId,
        ...entry,
        caregiverUserId: entry.caregiverUserId ?? userId ?? undefined,
        syncStatus: signedInRef.current ? "pending" : "local",
      };
      if (
        !commitEntriesForRequest(lifecycleToken, (current) => [
          localEntry,
          ...current,
        ])
      ) {
        return tempId;
      }
      advanceEntryMutationGeneration();
      if (!signedInRef.current) return tempId;
      persistEntryCreate(tempId, entry);
      return tempId;
    },
    [
      advanceEntryMutationGeneration,
      commitEntriesForRequest,
      lifecycle,
      persistEntryCreate,
      userId,
    ],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      // A quick undo can arrive after the optimistic create already swapped
      // its temp id for the server id; resolve through the mapping so the
      // right row is removed locally AND on the server.
      const realId = realIdByTemp.current.get(id) ?? id;
      const lifecycleToken = lifecycle.capture();
      const deleteScope = storageScopeRef.current;
      const signedInDelete = signedInRef.current;
      if (signedInDelete && deleteScope?.kind !== "account") {
        return false;
      }
      const deleteHouseholdId =
        deleteScope?.kind === "account" ? deleteScope.householdId : null;
      const isCurrentRequest = () => {
        const currentScope = storageScopeRef.current;
        return (
          lifecycle.isCurrent(lifecycleToken) &&
          (!signedInDelete ||
            (deleteScope?.kind === "account" &&
              currentScope?.kind === "account" &&
              currentScope.userId === deleteScope.userId &&
              currentScope.householdId === deleteScope.householdId))
        );
      };
      // Computed outside the updater (see updateEntry): a deferred updater
      // left `removed` undefined, silently losing the failure-restore.
      const removed = entriesRef.current.find(
        (e) => e.id === realId || e.id === id,
      );
      if (!signedInDelete) {
        entriesRef.current = entriesRef.current.filter(
          (e) => e.id !== realId && e.id !== id,
        );
        setEntries((prev) =>
          prev.filter((e) => e.id !== realId && e.id !== id),
        );
        advanceEntryMutationGeneration();
        return true;
      }
      if (!deleteScope || deleteScope.kind !== "account") return false;
      const pendingDeleteKey = realId.startsWith("temp_") ? id : realId;
      try {
        const committed = await commitCarePendingDeleteMutationIfCurrent({
          mutate: () =>
            pendingCareEntryDeleteStore.add(deleteScope, pendingDeleteKey),
          isCurrent: isCurrentRequest,
          commit: () => {
            addPendingCareEntryDeleteKey(pendingDeleteKey);
            const nextEntries = entriesRef.current.filter(
              (entry) => entry.id !== realId && entry.id !== id,
            );
            entriesRef.current = nextEntries;
            setEntries(nextEntries);
            advanceEntryMutationGeneration();
          },
        });
        if (!isCurrentRequest()) return false;
        if (!committed) return false;
      } catch {
        if (isCurrentRequest()) setStorageWarning("save-failed");
        return false;
      }
      if (realId.startsWith("temp_")) return true;
      if (!deleteHouseholdId) return false;
      try {
        await deleteCareEntry(realId, {
          householdId: deleteHouseholdId,
        });
        if (!isCurrentRequest()) return true;
        try {
          const committed = await commitCarePendingDeleteMutationIfCurrent({
            mutate: () =>
              pendingCareEntryDeleteStore.remove(deleteScope, realId),
            isCurrent: isCurrentRequest,
            commit: () => {
              removePendingCareEntryDeleteKeys(realId);
              advanceEntryMutationGeneration();
            },
          });
          if (!isCurrentRequest()) return true;
          if (!committed) return true;
        } catch {
          if (isCurrentRequest()) setStorageWarning("save-failed");
        }
        queryClient.invalidateQueries({
          queryKey: getListCareEntriesQueryKey(),
        });
        return true;
      } catch (error) {
        if (isCareEntryDeleteConfirmedAbsent(error, deleteHouseholdId)) {
          if (isCurrentRequest()) {
            try {
              const committed = await commitCarePendingDeleteMutationIfCurrent({
                mutate: () =>
                  pendingCareEntryDeleteStore.remove(deleteScope, realId),
                isCurrent: isCurrentRequest,
                commit: () => {
                  removePendingCareEntryDeleteKeys(realId);
                  advanceEntryMutationGeneration();
                },
              });
              if (!isCurrentRequest()) return true;
              if (!committed) return true;
            } catch {
              if (isCurrentRequest()) setStorageWarning("save-failed");
            }
          }
          return true;
        }
        if (
          isCurrentRequest() &&
          !pendingCareEntryDeleteIdsRef.current.has(realId)
        ) {
          return true;
        }
        // Never restore across an owner wipe: a slow delete that fails after
        // "All data deleted" must not resurrect the entry into the freshly
        // wiped store.
        if (isCurrentRequest()) {
          try {
            const committed = await commitCarePendingDeleteMutationIfCurrent({
              mutate: () =>
                pendingCareEntryDeleteStore.remove(deleteScope, realId),
              isCurrent: isCurrentRequest,
              commit: () => {
                removePendingCareEntryDeleteKeys(realId);
                if (removed) {
                  const restoredEntries = [
                    removed,
                    ...entriesRef.current.filter(
                      (entry) => entry.id !== realId && entry.id !== id,
                    ),
                  ];
                  entriesRef.current = restoredEntries;
                  setEntries(restoredEntries);
                }
                advanceEntryMutationGeneration();
              },
            });
            if (!isCurrentRequest()) return false;
            if (!committed) return false;
          } catch {
            if (isCurrentRequest()) setStorageWarning("save-failed");
            return false;
          }
        }
        return false;
      }
    },
    [
      addPendingCareEntryDeleteKey,
      advanceEntryMutationGeneration,
      lifecycle,
      pendingCareEntryDeleteStore,
      queryClient,
      removePendingCareEntryDeleteKeys,
    ],
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<Omit<Entry, "id">>): boolean => {
      const lifecycleToken = lifecycle.capture();
      const realId = realIdByTemp.current.get(id) ?? id;
      // Compute the merge OUTSIDE the setState updater. The old pattern
      // (assign inside the updater, read synchronously after) silently
      // skipped the server patch whenever React deferred the updater - the
      // entry stayed "pending" forever with nothing in flight. entriesRef is
      // committed-fresh and updated eagerly below so sequential same-tick
      // updates compose.
      const current = entriesRef.current.find((e) => e.id === realId);
      if (!current || !canApplyCareEntryUpdate(current)) return false;
      const merged: Entry = {
        ...current,
        ...patch,
        caregiverUserId: current.caregiverUserId,
        syncStatus: signedInRef.current
          ? realId.startsWith("temp_") &&
            !creatingTempIdsRef.current.has(realId)
            ? current.syncStatus
            : "pending"
          : realId.startsWith("temp_")
            ? current.syncStatus
            : "local",
        syncError: signedInRef.current
          ? realId.startsWith("temp_") &&
            !creatingTempIdsRef.current.has(realId)
            ? current.syncError
            : undefined
          : realId.startsWith("temp_")
            ? current.syncError
            : "Saved offline. Sign in or refresh to sync.",
      };
      if (
        !commitEntriesForRequest(lifecycleToken, (currentEntries) =>
          currentEntries.map((e) => (e.id === realId ? merged : e)),
        )
      ) {
        return false;
      }
      advanceEntryMutationGeneration();
      if (!signedInRef.current) return true;
      const updateScope = storageScopeRef.current;
      if (updateScope?.kind !== "account") return false;
      entryMutationQueue.enqueue({
        key: realId,
        ...(realId.startsWith("temp_") ? {} : { serverId: realId }),
        optimistic: merged,
        token: {
          lifecycleToken,
          householdId: updateScope.householdId,
        },
      });
      return true;
    },
    [
      advanceEntryMutationGeneration,
      commitEntriesForRequest,
      entryMutationQueue,
      lifecycle,
    ],
  );

  const resolveEntryConflict = useCallback(
    async (
      id: string,
      resolution: CareEntryConflictResolution,
    ): Promise<CareEntryConflictActionResult> => {
      if (!signedInRef.current || syncingRef.current) {
        return "unavailable";
      }
      const lifecycleToken = lifecycle.capture();
      const conflictScope = storageScopeRef.current;
      if (conflictScope?.kind !== "account") {
        return "unavailable";
      }
      const realId = realIdByTemp.current.get(id) ?? id;
      if (resolvingEntryConflictIdsRef.current.has(realId)) {
        return "unavailable";
      }
      resolvingEntryConflictIdsRef.current.add(realId);
      setResolvingEntryConflictIds([...resolvingEntryConflictIdsRef.current]);

      try {
        const local = entriesRef.current.find((entry) => entry.id === realId);
        if (!local || local.syncStatus !== "conflict") {
          return "unavailable";
        }

        if (resolution === "keep-local") {
          const serverSnapshot = local.conflictServerSnapshot;
          if (!serverSnapshot) return "unavailable";
          const resolved = resolveCareEntryConflictState(
            local,
            serverSnapshot as Entry,
            resolution,
          );
          if (!resolved) return "unavailable";
          if (
            !commitEntriesForRequest(lifecycleToken, (current) =>
              current.map((entry) =>
                entry.id === realId ? resolved.entry : entry,
              ),
            )
          ) {
            return "stale";
          }
          advanceEntryMutationGeneration();
          entryMutationQueue.discard(realId);
          entryMutationQueue.enqueue({
            key: realId,
            serverId: realId,
            optimistic: resolved.entry,
            token: {
              lifecycleToken,
              householdId: conflictScope.householdId,
            },
          });
          return "resolved";
        }

        const refreshSerialBefore = entryRefreshSerialRef.current;
        const refreshed = await refreshThenResolveCareEntryConflict<Entry>({
          refresh: syncFromServer,
          isCurrent: () => lifecycle.isCurrent(lifecycleToken),
          readFreshConflict: () => {
            if (entryRefreshSerialRef.current <= refreshSerialBefore) {
              return null;
            }
            const observed =
              lastEntryRefreshServerEntriesRef.current.get(realId);
            const freshLocal = entriesRef.current.find(
              (entry) => entry.id === realId,
            );
            const freshSnapshot = freshLocal?.conflictServerSnapshot;
            if (
              !observed ||
              !freshLocal ||
              !freshSnapshot ||
              freshSnapshot.revision !== observed.revision ||
              !careEntryPersistedContentEqual(freshSnapshot, observed)
            ) {
              return null;
            }
            return {
              local: freshLocal,
              serverSnapshot: freshSnapshot as Entry,
            };
          },
        });
        if (refreshed.status !== "resolved") {
          return refreshed.status;
        }
        if (
          !commitEntriesForRequest(lifecycleToken, (current) =>
            current.map((entry) =>
              entry.id === realId ? refreshed.entry : entry,
            ),
          )
        ) {
          return "stale";
        }
        advanceEntryMutationGeneration();
        entryMutationQueue.discard(realId);
        queryClient.invalidateQueries({
          queryKey: getListCareEntriesQueryKey(),
        });
        return "resolved";
      } finally {
        resolvingEntryConflictIdsRef.current.delete(realId);
        if (lifecycle.isCurrent(lifecycleToken)) {
          setResolvingEntryConflictIds([
            ...resolvingEntryConflictIdsRef.current,
          ]);
        }
      }
    },
    [
      advanceEntryMutationGeneration,
      commitEntriesForRequest,
      entryMutationQueue,
      lifecycle,
      queryClient,
      syncFromServer,
    ],
  );

  const updateCareDoc = useCallback(
    (updater: (doc: CareDoc) => CareDoc) => {
      // Compute OUTSIDE the setState updater: calling pushDoc from inside it
      // was a render-phase side effect (duplicate PUTs under StrictMode /
      // replayed concurrent renders). docRef is updated eagerly so two
      // synchronous back-to-back updates compose instead of the second one
      // reading a stale base.
      const next: CareDoc = {
        ...updater(docRef.current),
        updatedAt: new Date().toISOString(),
      };
      docRef.current = next;
      setDoc(next);
      if (signedInRef.current) void pushDoc();
    },
    [pushDoc],
  );

  const prepareCareDocConflictDismissal = useCallback(
    (conflict: CareDocConflict): (() => boolean) => {
      const lifecycleToken = lifecycle.capture();
      const scope =
        isSignedIn && hydrated && storageScope?.kind === "account"
          ? storageScope
          : null;
      if (!scope) return () => false;
      const scopeKey = getCareStorageKey(scope);
      return createCareDocConflictDismissal({
        conflict,
        scopeKey,
        isLifecycleCurrent: () => lifecycle.isCurrent(lifecycleToken),
        readScopeKey: () => {
          const currentScope = storageScopeRef.current;
          return currentScope?.kind === "account"
            ? getCareStorageKey(currentScope)
            : null;
        },
        readConflicts: () => careDocConflictsRef.current,
        commitConflicts: (nextConflicts) => {
          careDocConflictsRef.current = nextConflicts;
          setCareDocConflicts(nextConflicts);
        },
      });
    },
    [hydrated, isSignedIn, lifecycle, storageScope],
  );

  const state = useMemo<CareState>(
    () => ({
      version: serverVersion,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      activePetId: doc.activePetId,
      profile: doc.profile,
      pets: doc.pets,
      caregivers: doc.caregivers,
      householdSetup: doc.householdSetup,
      launchSupportProfile: doc.launchSupportProfile,
      launchProviderProfile: doc.launchProviderProfile,
      reminderNotificationPreferences: doc.reminderNotificationPreferences,
      dietProfile: doc.dietProfile,
      routines: doc.routines,
      goals: doc.goals,
      records: doc.records,
      accessPasses: doc.accessPasses,
      adventureMemories: doc.adventureMemories,
      reportArtifacts: doc.reportArtifacts,
      calendarEvents: doc.calendarEvents,
      entries,
    }),
    [doc, entries, serverVersion],
  );
  const visibleCareDocConflicts =
    isSignedIn && hydrated && storageScope?.kind === "account"
      ? careDocConflicts
      : [];

  const syncOutbox = useMemo(() => deriveCareSyncOutbox(entries), [entries]);

  const eraseAllLocalData = useCallback(async () => {
    // Pause new writes synchronously, invalidate every pre-wipe async result,
    // then drain writes already in flight before removing device data.
    const wipeScopeKind =
      storageScope?.kind ??
      (isClerkConfigured && isSignedIn
        ? "account"
        : !isClerkConfigured
          ? "local"
          : null);
    const wipeToken = lifecycle.beginWipe();
    setHydrated(false);
    signedInRef.current = false;
    syncingRef.current = false;
    setIsSyncing(false);
    setRefreshError(null);
    resetLiveState();
    await lifecycle.waitForDeviceOperations();
    await pendingCareEntryDeleteStore.waitForWrites();
    if (!lifecycle.isCurrent(wipeToken)) {
      const lifecycleFailure = async () => {
        throw new Error("Care lifecycle changed before the wipe began.");
      };
      return runCareDeviceWipe({
        "async-storage": lifecycleFailure,
        reports: createCareDirectoryWipeAdapter({
          platform: Platform.OS,
          documentDirectory: FileSystem.documentDirectory,
          target: "reports",
          relativePath: "WoofWatcherReports/",
          deleteDirectory: lifecycleFailure,
        }),
        attachments: createCareDirectoryWipeAdapter({
          platform: Platform.OS,
          documentDirectory: FileSystem.documentDirectory,
          target: "attachments",
          relativePath: "woofwatcher-attachments/",
          deleteDirectory: lifecycleFailure,
        }),
        "query-cache": lifecycleFailure,
      });
    }

    const runWipeOperation = async (operation: () => Promise<void>) => {
      const operationResult = await lifecycle.queueDeviceOperation(
        wipeToken,
        operation,
        { allowWhilePaused: true, runWhenStale: true },
      );
      assertCareDeviceWipeOperationWritten(operationResult);
    };
    const receipt = await runCareDeviceWipe({
      "async-storage": () =>
        runWipeOperation(async () => {
          const keys = await AsyncStorage.getAllKeys();
          const owned = keys.filter((key) => key.startsWith("woofwatcher"));
          if (owned.length) await AsyncStorage.multiRemove(owned);
          pendingCareEntryDeleteStore.forget();
        }),
      reports: createCareDirectoryWipeAdapter({
        platform: Platform.OS,
        documentDirectory: FileSystem.documentDirectory,
        target: "reports",
        relativePath: "WoofWatcherReports/",
        deleteDirectory: (uri) =>
          runWipeOperation(() =>
            FileSystem.deleteAsync(uri, { idempotent: true }),
          ),
      }),
      attachments: createCareDirectoryWipeAdapter({
        platform: Platform.OS,
        documentDirectory: FileSystem.documentDirectory,
        target: "attachments",
        relativePath: "woofwatcher-attachments/",
        deleteDirectory: (uri) =>
          runWipeOperation(() =>
            FileSystem.deleteAsync(uri, { idempotent: true }),
          ),
      }),
      "query-cache": () =>
        runWipeOperation(async () => {
          entryMutationQueue.clear();
          realIdByTemp.current.clear();
          creatingTempIdsRef.current.clear();
          queryClient.clear();
        }),
    });
    const finalizedReceipt = finalizeCareDeviceWipeReceipt(
      receipt,
      lifecycle.isCurrent(wipeToken),
    );
    const completion = resolveCareWipeCompletion(
      wipeScopeKind,
      finalizedReceipt.complete,
    );
    if (
      completion.resumeHydration &&
      lifecycle.finishWipe(wipeToken) &&
      storageScope
    ) {
      setHydrated(true);
      signedInRef.current = false;
    }
    return finalizedReceipt;
  }, [
    entryMutationQueue,
    isSignedIn,
    lifecycle,
    pendingCareEntryDeleteStore,
    queryClient,
    resetLiveState,
    storageScope,
  ]);

  const runDeviceOperation = useCallback(
    async (operation: () => Promise<void>) => {
      const result = await lifecycle.queueDeviceOperation(
        lifecycle.capture(),
        operation,
      );
      if (result !== "written") {
        throw new Error(`Device operation was not committed (${result}).`);
      }
    },
    [lifecycle],
  );

  const value = useMemo<CareContextValue>(
    () => ({
      state,
      storageScope,
      addEntry,
      deleteEntry,
      updateEntry,
      resolveEntryConflict,
      updateCareDoc,
      refresh: syncFromServer,
      rehydrateHouseholdScope,
      eraseAllLocalData,
      runDeviceOperation,
      syncOutbox,
      isLoaded: hydrated,
      isSyncing,
      resolvingEntryConflictIds,
      refreshError,
      syncRefreshError,
      storageWarning,
      careDocConflicts: visibleCareDocConflicts,
      documentSyncError,
      prepareCareDocConflictDismissal,
      legacyImport,
    }),
    [
      state,
      storageScope,
      addEntry,
      deleteEntry,
      updateEntry,
      resolveEntryConflict,
      updateCareDoc,
      syncFromServer,
      rehydrateHouseholdScope,
      eraseAllLocalData,
      runDeviceOperation,
      syncOutbox,
      hydrated,
      isSyncing,
      resolvingEntryConflictIds,
      refreshError,
      syncRefreshError,
      storageWarning,
      visibleCareDocConflicts,
      documentSyncError,
      prepareCareDocConflictDismissal,
      legacyImport,
    ],
  );

  return <CareContext.Provider value={value}>{children}</CareContext.Provider>;
}

export function useCare() {
  const ctx = useContext(CareContext);
  if (!ctx) throw new Error("useCare must be used within CareProvider");
  return ctx;
}
