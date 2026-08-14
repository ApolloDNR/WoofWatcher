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
  getListCareEntriesQueryKey,
  listCareEntries,
  putCareState,
  updateCareEntry,
  type CareEntry as ApiCareEntry,
  type CareEntryInput,
  type CareEntryUpdate,
  type CareStateEnvelope,
} from "@workspace/api-client-react";
import {
  addDiscardedServerEntryId,
  adoptServerEntry,
  applyQueuedPatchToAcknowledgedEntry,
  buildCareEntryRefreshPlan,
  CareEntryConflictRetryError,
  cleanupDiscardedServerEntryRows,
  createSerializedCareSyncWriter,
  createSerializedCareEntryMutationQueue,
  decideCareEntryEditSyncDisposition,
  deriveCareSyncOutbox,
  diffCareEntryPendingDetails,
  filterDiscardedServerEntries,
  findCreatedCareEntryLocalSnapshot,
  mergeCareEntryPendingSyncPatch,
  mergeServerAndLocalEntries,
  normalizeDiscardedServerEntryIds,
  prepareCareEntryForOfflineEdit,
  recoverInterruptedCareEntryMutations,
  rebaseCareEntryAfterConflict,
  reconcileCreatedCareEntryAcknowledgement,
  reconcileCareDocFromServer,
  removeDiscardedServerEntryId,
  restoreEntryAfterDeleteFailure,
  retryCareEntryMutationAfterConflict,
  sanitizeCareEntryDetailsForSync,
  selectWoofWatcherKeysForOwnerWipe,
  shouldRetryCreate,
  shouldRetryUpdate,
  type CareEntryPendingDelete,
  type CareSyncOutbox,
  type EntrySyncStatus,
  type SerializedCareSyncWriter,
  type SerializedCareEntryMutationQueue,
} from "@/lib/careSync";
import {
  CARE_ENTRY_SYNC_PROTOCOL,
  CARE_ENTRY_SYNC_REVISION_KEY,
  nextCareEntrySyncRevision,
  readCareEntrySyncRevision,
  type AccessPass,
  type AdventureMemory,
  type CarePassArtifact,
} from "@workspace/care-domain";
import {
  CURRENT_CARE_DOC_DATA_VERSION,
  isFutureCareDocDataVersion,
  migrateCareDoc,
  type CareCorrectionIssue,
  type CareDocMigrationQuarantineItem,
} from "../lib/careDocMigration";
import {
  createCareWriteProtection,
  prioritizeCareStorageWarning,
  type CareStorageWarning,
} from "@/lib/careWriteProtection";
import {
  createCarePersistenceWriter,
  type CarePersistenceWriter,
} from "@/lib/carePersistenceWriter";
import {
  CARE_PRESERVED_LOCAL_DATA_KEY,
  CARE_PRIMARY_LOCAL_DATA_KEY,
  createCareHydrationAttemptAuthority,
  createCareLocalDataResetController,
  getCarePristineSnapshotPersistenceDecision,
  hasInterruptedCareEntryMutationsToRecover,
  type CareHydrationAttemptAuthority,
  type CareLocalDataResetController,
} from "@/lib/careLocalDataReset";
import { useLocalDataReset } from "@/context/LocalDataResetContext";
import { LocalDataResetInProgressError } from "@/lib/removableLocalDataStorage";
import { useWoofAuth } from "@/lib/auth";
import {
  normalizeReminderNotificationPreferences,
  type ReminderNotificationPreferences,
} from "@/lib/reminderNotificationPreferences";
import { normalizeLaunchProviderProfile, type LaunchStorageProviderEvidence } from "@/lib/launchProviderSetup";
import {
  convertLegacyState,
  parseLegacyState,
  LEGACY_IMPORT_FLAG_KEY,
  LEGACY_STATE_KEY,
  type LegacyImportResult,
} from "@/lib/legacyImport";
import type { SupportLegalReadinessProofEvidence } from "@/lib/supportRunbook";

interface CarePersistenceSnapshot {
  raw: string;
  writeGeneration: number;
  eraseGeneration: number;
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
  correctionIssues?: CareCorrectionIssue[];
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
  correctionIssues?: CareCorrectionIssue[];
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
  correctionIssues?: CareCorrectionIssue[];
}

export type ReportArtifact = CarePassArtifact;

export interface CareEntryMutableFields {
  type: string;
  title: string;
  caregiver: string;
  occurredAt: string;
  durationMinutes?: number;
  amount?: string;
  mood?: string;
  severity?: string;
  note?: string;
  dogInteractions?: number;
  food?: string;
  details?: { [key: string]: unknown };
}

type CareEntryPendingSyncPatch = {
  [K in keyof CareEntryMutableFields]?: K extends "details"
    ? CareEntryMutableFields[K]
    : CareEntryMutableFields[K] | CareEntryPendingDelete;
};

export interface Entry extends CareEntryMutableFields {
  id: string;
  syncStatus?: EntrySyncStatus;
  syncError?: string;
  pendingSyncPatch?: CareEntryPendingSyncPatch;
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
  dataVersion: number;
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
  migrationQuarantine?: CareDocMigrationQuarantineItem[];
}

export interface CareState extends CareDoc {
  version: number;
  entries: Entry[];
}

function normalizeSupportLegalReadinessEvidence(
  value: SupportLegalReadinessProofEvidence | null | undefined,
): SupportLegalReadinessProofEvidence | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function getDefaultDoc(): CareDoc {
  const now = new Date().toISOString();
  return {
    dataVersion: CURRENT_CARE_DOC_DATA_VERSION,
    createdAt: now,
    // Epoch, deliberately: a pristine, never-edited doc must never win
    // wall-clock reconciliation. Stamping install time here made a fresh
    // device look "newer" than the household's real server doc on first
    // sign-in - and push its empty defaults over everyone's data. Real edits
    // stamp a real updatedAt.
    updatedAt: new Date(0).toISOString(),
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
    reminderNotificationPreferences: normalizeReminderNotificationPreferences(null),
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

function mergeDoc(partial: Partial<CareDoc> | null | undefined): CareDoc {
  const merged = migrateCareDoc({ ...getDefaultDoc(), ...(partial ?? {}) });
  const launchSupportProfile = merged.launchSupportProfile ?? getDefaultDoc().launchSupportProfile;
  return {
    ...merged,
    activePetId: typeof merged.activePetId === "string" && merged.activePetId.trim() ? merged.activePetId : "primary",
    pets: Array.isArray(merged.pets) ? merged.pets : [],
    accessPasses: Array.isArray(merged.accessPasses) ? merged.accessPasses : [],
    adventureMemories: Array.isArray(merged.adventureMemories) ? merged.adventureMemories : [],
    reportArtifacts: Array.isArray(merged.reportArtifacts) ? merged.reportArtifacts : [],
    householdSetup: {
      mode:
        merged.householdSetup?.mode === "join" || merged.householdSetup?.mode === "local"
          ? merged.householdSetup.mode
          : "create",
      householdName: typeof merged.householdSetup?.householdName === "string" ? merged.householdSetup.householdName : "",
      inviteCode: typeof merged.householdSetup?.inviteCode === "string" ? merged.householdSetup.inviteCode : "",
      providerStatus:
        merged.householdSetup?.providerStatus === "pending-provider" ? "pending-provider" : "local-only",
      updatedAt: typeof merged.householdSetup?.updatedAt === "string" ? merged.householdSetup.updatedAt : undefined,
    },
    launchSupportProfile: {
      supportEmail:
        typeof launchSupportProfile.supportEmail === "string" ? launchSupportProfile.supportEmail : "",
      privacyPolicyUrl:
        typeof launchSupportProfile.privacyPolicyUrl === "string" ? launchSupportProfile.privacyPolicyUrl : "",
      termsUrl: typeof launchSupportProfile.termsUrl === "string" ? launchSupportProfile.termsUrl : "",
      refundPolicyApproved: Boolean(launchSupportProfile.refundPolicyApproved),
      veterinaryBoundaryApproved: Boolean(launchSupportProfile.veterinaryBoundaryApproved),
      accountDeletionEscalationApproved: Boolean(launchSupportProfile.accountDeletionEscalationApproved),
      incidentResponseApproved: Boolean(launchSupportProfile.incidentResponseApproved),
      supportLegalReadinessEvidence: normalizeSupportLegalReadinessEvidence(launchSupportProfile.supportLegalReadinessEvidence),
      ownerReviewedAt:
        typeof launchSupportProfile.ownerReviewedAt === "string" ? launchSupportProfile.ownerReviewedAt : undefined,
      providerStatus:
        launchSupportProfile.providerStatus === "owner-reviewed" ||
        launchSupportProfile.providerStatus === "provider-approved"
          ? launchSupportProfile.providerStatus
          : "local-draft",
    },
    launchProviderProfile: normalizeLaunchProviderProfile(merged.launchProviderProfile),
    reminderNotificationPreferences: normalizeReminderNotificationPreferences(merged.reminderNotificationPreferences),
  };
}

function toEntry(c: ApiCareEntry): Entry {
  const d = (c.details ?? {}) as { [key: string]: unknown };
  return {
    id: c.id,
    type: c.type,
    title: typeof d.title === "string" ? d.title : "",
    caregiver: c.caregiverName ?? "",
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

function ensureCareEntrySyncRevision(entry: Entry): Entry {
  if (readCareEntrySyncRevision(entry.details) != null) return entry;
  return {
    ...entry,
    details: {
      ...(entry.details ?? {}),
      [CARE_ENTRY_SYNC_REVISION_KEY]: 1,
    },
  };
}

function advanceCareEntrySyncRevision(
  entry: Entry,
  details: { [key: string]: unknown } | null | undefined = entry.details,
): Entry {
  return {
    ...entry,
    details: {
      ...(details ?? {}),
      [CARE_ENTRY_SYNC_REVISION_KEY]:
        nextCareEntrySyncRevision(entry.details),
    },
  };
}

function toCareEntryMutablePatch(
  patch: Partial<Omit<Entry, "id">>,
): Partial<CareEntryMutableFields> {
  const {
    syncStatus: _syncStatus,
    syncError: _syncError,
    pendingSyncPatch: _pendingSyncPatch,
    ...mutablePatch
  } = patch;
  return mutablePatch;
}

function toPendingCareEntrySyncPatch(
  current: Entry,
  mutablePatch: Partial<CareEntryMutableFields>,
): CareEntryPendingSyncPatch {
  if (!Object.prototype.hasOwnProperty.call(mutablePatch, "details")) {
    return mutablePatch;
  }
  const detailPatch = diffCareEntryPendingDetails(
    current.details,
    mutablePatch.details,
  );
  const {
    details: _details,
    ...topLevelPatch
  } = mutablePatch;
  return {
    ...topLevelPatch,
    ...(Object.keys(detailPatch).length > 0
      ? { details: detailPatch }
      : {}),
  };
}

function rebasePendingCareEntryAfterConflict(
  localEntry: Entry,
  serverEntry: Entry,
): Entry | null {
  const pendingPatch = localEntry.pendingSyncPatch;
  if (!pendingPatch || Object.keys(pendingPatch).length === 0) {
    return null;
  }
  const rebased = rebaseCareEntryAfterConflict(
    localEntry,
    serverEntry,
    pendingPatch,
  );
  return {
    ...rebased,
    details: {
      ...(rebased.details ?? {}),
      [CARE_ENTRY_SYNC_REVISION_KEY]:
        nextCareEntrySyncRevision(serverEntry.details),
    },
  };
}

function toCreateInput(e: Omit<Entry, "id">, clientKey?: string): CareEntryInput {
  const details = sanitizeCareEntryDetailsForSync(e.details);
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
function toUpdateInput(e: Entry): CareEntryUpdate {
  const details = sanitizeCareEntryDetailsForSync(e.details);
  if (readCareEntrySyncRevision(details) == null) {
    details[CARE_ENTRY_SYNC_REVISION_KEY] = 1;
  }
  if (e.title) details.title = e.title;
  if (e.durationMinutes != null) details.durationMinutes = e.durationMinutes;
  if (e.amount != null) details.amount = e.amount;
  if (e.dogInteractions != null) details.dogInteractions = e.dogInteractions;
  if (e.food != null) details.food = e.food;
  return {
    clientSyncProtocol: CARE_ENTRY_SYNC_PROTOCOL,
    type: e.type,
    occurredAt: e.occurredAt,
    mood: e.mood ?? null,
    severity: e.severity ?? null,
    note: e.note ?? null,
    details: Object.keys(details).length ? details : null,
  };
}

function isConflict(err: unknown): err is { status: number; data: unknown } {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { status?: unknown }).status === 409
  );
}

function getCareEntryConflictEntry(
  error: unknown,
  entryId: string,
): Entry | null {
  if (!isConflict(error) || !error.data || typeof error.data !== "object") {
    return null;
  }
  const candidate = (error.data as { entry?: unknown }).entry;
  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as Partial<ApiCareEntry>;
  if (
    row.id !== entryId ||
    typeof row.type !== "string" ||
    typeof row.occurredAt !== "string" ||
    typeof row.createdAt !== "string" ||
    typeof row.updatedAt !== "string"
  ) {
    return null;
  }
  return toEntry(row as ApiCareEntry);
}

function isNotFound(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { status?: unknown }).status === 404
  );
}

interface CareContextValue {
  state: CareState;
  careMutationsBlocked: boolean;
  addEntry: (entry: Omit<Entry, "id">) => string;
  deleteEntry: (id: string) => Promise<boolean>;
  updateEntry: (id: string, patch: Partial<Omit<Entry, "id">>) => boolean;
  updateCareDoc: (updater: (doc: CareDoc) => CareDoc) => boolean;
  refresh: () => void;
  /**
   * Store-compliance data deletion: resets the live care document and
   * removes every data-bearing WoofWatcher key on this device (care state,
   * avatar art, QA sessions). Only an opaque, non-renderable remote-deletion
   * ledger may remain until provider cleanup is confirmed.
   */
  eraseAllLocalData: () => Promise<void>;
  syncOutbox: CareSyncOutbox;
  isLoaded: boolean;
  isSyncing: boolean;
  /**
   * Local-storage health. Local-first means a failing device store IS a data
   * risk, so it must be visible ("sync failures visible" applies doubly to
   * the primary store): "save-failed" = writes are erroring, recent logs may
   * not survive a restart; "read-failed" = stored data could not be read, so
   * persistence is paused to protect it; "reset" = the cache was corrupt and
   * was reset, with the raw blob kept under a recovery key.
   */
  storageWarning: CareStorageWarning;
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
  const { isSignedIn, isLoaded: clerkLoaded } = useWoofAuth();
  const queryClient = useQueryClient();
  const {
    attachRequiredParticipant,
    isWriteAdmissionOpen,
    operationSettledEpoch,
    removableStorage,
  } = useLocalDataReset();

  const [doc, setDoc] = useState<CareDoc>(getDefaultDoc);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [serverVersion, setServerVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageWarning, setStorageWarning] = useState<CareStorageWarning>(null);
  const [legacyImport, setLegacyImport] = useState<
    LegacyImportResult["summary"] | null
  >(null);

  // Refs mirror state so async callbacks read fresh values without re-binding.
  const docRef = useRef(doc);
  const entriesRef = useRef(entries);
  const versionRef = useRef(serverVersion);
  const signedInRef = useRef(false);
  const syncingRef = useRef(false);
  const hydratedRef = useRef(false);
  const careHydrationAttemptAuthorityRef =
    useRef<CareHydrationAttemptAuthority | null>(null);
  if (!careHydrationAttemptAuthorityRef.current) {
    careHydrationAttemptAuthorityRef.current =
      createCareHydrationAttemptAuthority();
  }
  const careWriteProtectionRef = useRef(createCareWriteProtection());
  const ownerWipeInProgressRef = useRef(false);
  const setCareStorageWarning = useCallback((warning: CareStorageWarning) => {
    setStorageWarning((current) =>
      prioritizeCareStorageWarning(
        current,
        warning,
        careWriteProtectionRef.current.isBlocked(),
      ),
    );
  }, []);
  // A document from a newer schema is evidence, not input for this client.
  // Keep its exact runtime object available while rendering safe defaults;
  // every local/server write path below is gated until an owner wipe.
  const futureCareDocRef = useRef<object | null>(null);
  const futureCareCacheRawRef = useRef<string | null>(null);
  const preserveFutureCareDoc = useCallback((value: unknown): boolean => {
    if (!isFutureCareDocDataVersion(value)) return false;
    careWriteProtectionRef.current.protect();
    futureCareDocRef.current = value;
    entryUpdateQueueRef.current?.cancelAll();
    setStorageWarning("newer-version");
    return true;
  }, []);
  const careDocWritesBlocked = useCallback(
    (): boolean =>
      ownerWipeInProgressRef.current ||
      !isWriteAdmissionOpen() ||
      careWriteProtectionRef.current.isBlocked(),
    [isWriteAdmissionOpen],
  );
  const careWriteCanContinue = useCallback(
    (generation: number): boolean =>
      !ownerWipeInProgressRef.current &&
      careWriteProtectionRef.current.canContinue(generation),
    [],
  );
  // Maps optimistic temp ids to their server ids, and queues patches that
  // arrive before a create resolves (post-log quick-note race).
  const realIdByTemp = useRef<Map<string, string>>(new Map());
  const pendingPatch = useRef<Map<string, Partial<Omit<Entry, "id">>>>(new Map());
  const cancelledTempEntries = useRef<Set<string>>(new Set());
  const creatingTempEntries = useRef<Set<string>>(new Set());
  // A cancelled create is hidden until its newly-created server row is
  // successfully removed. This prevents a transient DELETE failure from
  // reviving a care moment on the next refresh in the same session.
  const discardedServerEntryIdsRef = useRef<Set<string>>(new Set());
  const recentlyDiscardedServerEntryIdsRef = useRef<Set<string>>(new Set());
  const discardedServerEntryWriterRef =
    useRef<SerializedCareSyncWriter<string[] | null> | null>(null);
  const carePersistenceWriterRef =
    useRef<CarePersistenceWriter<CarePersistenceSnapshot> | null>(null);
  const latestCareSnapshotRef = useRef(0);
  const snapshotPersistencePausedRef = useRef(false);
  const suppressNextSettledSnapshotRef = useRef(false);
  const currentOperationSettledEpochRef = useRef(operationSettledEpoch);
  currentOperationSettledEpochRef.current = operationSettledEpoch;
  const successfulResetStartedAtEpochRef = useRef(-1);
  const suppressedPristineSnapshotRef = useRef<{
    doc: CareDoc;
    entries: Entry[];
    serverVersion: number;
  } | null>(null);
  const eraseAllLocalDataInFlightRef = useRef<Promise<void> | null>(null);
  const legacyOwnerWipeInProgressRef = useRef(false);
  const stagedCareResetTempIdsRef = useRef<Set<string>>(new Set());
  const stagedCareResetCleanupLedgerRef = useRef<string[]>([]);
  const entryUpdateQueueRef =
    useRef<SerializedCareEntryMutationQueue<Entry> | null>(null);
  const entryWriteGenerationRef = useRef<Map<string, number>>(new Map());
  // Bumped by eraseAllLocalData so in-flight sync results can't resurrect
  // data the owner just deleted from this device.
  const eraseGenerationRef = useRef(0);

  if (!carePersistenceWriterRef.current) {
    carePersistenceWriterRef.current =
      createCarePersistenceWriter<CarePersistenceSnapshot>(
        async ({ raw, writeGeneration, eraseGeneration }) => {
          if (
            eraseGeneration !== eraseGenerationRef.current ||
            !careWriteProtectionRef.current.canContinue(writeGeneration)
          ) {
            return;
          }
          await AsyncStorage.setItem(CARE_PRIMARY_LOCAL_DATA_KEY, raw);
        },
      );
  }
  const carePersistenceWriter = carePersistenceWriterRef.current;

  if (!discardedServerEntryWriterRef.current) {
    discardedServerEntryWriterRef.current =
      createSerializedCareSyncWriter<string[] | null>(async (entryIds) => {
        if (entryIds && entryIds.length > 0) {
          await AsyncStorage.setItem(
            CARE_PRESERVED_LOCAL_DATA_KEY,
            JSON.stringify(entryIds),
          );
          return;
        }
        await AsyncStorage.removeItem(CARE_PRESERVED_LOCAL_DATA_KEY);
      });
  }
  const discardedServerEntryWriter =
    discardedServerEntryWriterRef.current;

  const markServerEntryDiscarded = useCallback(
    async (entryId: string) => {
      const next = addDiscardedServerEntryId(
        [...discardedServerEntryIdsRef.current],
        entryId,
      );
      discardedServerEntryIdsRef.current = new Set(next);
      recentlyDiscardedServerEntryIdsRef.current.add(entryId);
      try {
        await discardedServerEntryWriter.enqueue(next);
      } catch {
        setCareStorageWarning("save-failed");
        throw new Error("Could not persist cancelled care-entry cleanup.");
      }
    },
    [discardedServerEntryWriter, setCareStorageWarning],
  );

  const clearDiscardedServerEntry = useCallback(
    async (entryId: string) => {
      const next = removeDiscardedServerEntryId(
        [...discardedServerEntryIdsRef.current],
        entryId,
      );
      discardedServerEntryIdsRef.current = new Set(next);
      try {
        await discardedServerEntryWriter.enqueue(
          next.length > 0 ? next : null,
        );
      } catch {
        setCareStorageWarning("save-failed");
      }
    },
    [discardedServerEntryWriter, setCareStorageWarning],
  );

  if (!entryUpdateQueueRef.current) {
    entryUpdateQueueRef.current =
      createSerializedCareEntryMutationQueue<Entry, ApiCareEntry>({
        mutate: async (entryId, entry, signal) => {
          const writeGeneration = entryWriteGenerationRef.current.get(entryId);
          const canContinue = () =>
            writeGeneration !== undefined &&
            careWriteCanContinue(writeGeneration);
          if (!canContinue()) {
            throw new Error("Care writes are blocked by a newer data version.");
          }
          try {
            const updated = await updateCareEntry(
              entryId,
              toUpdateInput(entry),
              { signal },
            );
            if (!canContinue()) {
              throw new Error("Care writes are blocked by a newer data version.");
            }
            return updated;
          } catch (error) {
            if (!canContinue()) throw error;
            return retryCareEntryMutationAfterConflict({
              error,
              input: entry,
              isConflict,
              fetchCurrent: async () => {
                if (!canContinue()) throw error;
                const conflictEntry = getCareEntryConflictEntry(
                  error,
                  entryId,
                );
                if (conflictEntry) return conflictEntry;
                const rows = await listCareEntries(undefined, {
                  signal,
                });
                if (!canContinue()) throw error;
                const currentServerEntry = rows.find(
                  (row) => row.id === entryId,
                );
                return currentServerEntry
                  ? toEntry(currentServerEntry)
                  : null;
              },
              rebase: rebasePendingCareEntryAfterConflict,
              mutate: (rebasedEntry) => {
                if (!canContinue()) throw error;
                return updateCareEntry(
                  entryId,
                  toUpdateInput(rebasedEntry),
                  { signal },
                );
              },
            });
          }
        },
        onSuccess: (entryId, localEntry, updated) => {
          const writeGeneration = entryWriteGenerationRef.current.get(entryId);
          if (
            writeGeneration === undefined ||
            !careWriteCanContinue(writeGeneration)
          ) return;
          entryWriteGenerationRef.current.delete(entryId);
          const synced = {
            ...adoptServerEntry(localEntry, toEntry(updated)),
            pendingSyncPatch: undefined,
          };
          entriesRef.current = entriesRef.current.map((entry) =>
            entry.id === entryId ? synced : entry,
          );
          setEntries((previous) =>
            previous.map((entry) =>
              entry.id === entryId ? synced : entry,
            ),
          );
          queryClient.invalidateQueries({
            queryKey: getListCareEntriesQueryKey(),
          });
        },
        onFailure: (entryId, localEntry, error) => {
          const writeGeneration = entryWriteGenerationRef.current.get(entryId);
          if (
            writeGeneration === undefined ||
            !careWriteCanContinue(writeGeneration)
          ) return;
          entryWriteGenerationRef.current.delete(entryId);
          const retryBase =
            error instanceof CareEntryConflictRetryError
              ? error.rebasedInput
              : localEntry;
          const failedEntry = advanceCareEntrySyncRevision({
            ...retryBase,
            syncStatus: "failed",
            syncError: "Saved locally. Refresh to retry sync.",
          });
          entriesRef.current = entriesRef.current.map((entry) =>
            entry.id === entryId ? failedEntry : entry,
          );
          setEntries((previous) =>
            previous.map((entry) =>
              entry.id === entryId ? failedEntry : entry,
            ),
          );
        },
      });
  }
  const entryUpdateQueue = entryUpdateQueueRef.current;
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  useEffect(() => {
    versionRef.current = serverVersion;
  }, [serverVersion]);
  // Event handlers can run in the first frame after an auth flip, before
  // effects flush. Mirror this render input synchronously so an offline edit
  // never queues a provider write or accepts an older in-flight result.
  signedInRef.current = !!isSignedIn;

  // Hydrate instantly from the offline cache so the UI never flashes empty.
  // Failure handling is data-safety-critical: `hydrated` gates the persist
  // effect below, so it must only flip true after a read that actually
  // completed - otherwise the persist effect overwrites intact stored data
  // with in-memory defaults.
  useEffect(() => {
    if (hydratedRef.current) return;
    const hydrationAttempt =
      careHydrationAttemptAuthorityRef.current!.begin(
        isWriteAdmissionOpen(),
      );
    if (!hydrationAttempt) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const hydrationEraseGeneration = eraseGenerationRef.current;
    const hydrationCanContinue = () =>
      !cancelled &&
      hydrationAttempt.isCurrent() &&
      !ownerWipeInProgressRef.current &&
      eraseGenerationRef.current === hydrationEraseGeneration;
    if (!hydrationCanContinue()) return;

    interface StagedCareHydration {
      cachedDoc: CareDoc | null;
      cachedEntries: Entry[] | null;
      cachedServerVersion: number | null;
      discardedServerEntryIds: string[];
      futureDoc: object | null;
      futureRaw: string | null;
      legacySummary: LegacyImportResult["summary"] | null;
      warning: CareStorageWarning;
    }

    const persistRecoveryEvidence = async (key: string, raw: string) => {
      try {
        await removableStorage.setItem(key, raw);
      } catch (error) {
        if (error instanceof LocalDataResetInProgressError) throw error;
        // Recovery evidence is best-effort for a failing device store. The
        // visible warning remains staged with the rest of hydration.
      }
    };

    const stageCareHydration = async (): Promise<StagedCareHydration> => {
      const [raw, discardedRaw] = await Promise.all([
        AsyncStorage.getItem(CARE_PRIMARY_LOCAL_DATA_KEY),
        AsyncStorage.getItem(CARE_PRESERVED_LOCAL_DATA_KEY),
      ]);
      if (!hydrationCanContinue()) {
        throw new LocalDataResetInProgressError();
      }

      let warning: CareStorageWarning = null;
      let discardedServerEntryIds: string[] = [];
      try {
        discardedServerEntryIds = normalizeDiscardedServerEntryIds(
          discardedRaw ? JSON.parse(discardedRaw) : [],
        );
      } catch {
        warning = "reset";
        if (discardedRaw) {
          await persistRecoveryEvidence(
            `${CARE_PRESERVED_LOCAL_DATA_KEY}.recovery`,
            discardedRaw,
          );
        }
      }

      let cachedDoc: CareDoc | null = null;
      let cachedEntries: Entry[] | null = null;
      let cachedServerVersion: number | null = null;
      let futureDoc: object | null = null;
      let futureRaw: string | null = null;
      let primaryIsPristine = !raw;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.doc && isFutureCareDocDataVersion(parsed.doc)) {
            futureDoc = parsed.doc;
            futureRaw = raw;
            primaryIsPristine = false;
          } else {
            if (parsed?.doc) cachedDoc = mergeDoc(parsed.doc);
            if (Array.isArray(parsed?.entries)) {
              cachedEntries = recoverInterruptedCareEntryMutations(
                parsed.entries.filter(
                  (entry: unknown): entry is Entry =>
                    !!entry && typeof (entry as Entry).id === "string",
                ),
              );
            }
            if (typeof parsed?.serverVersion === "number") {
              cachedServerVersion = parsed.serverVersion;
            }
            const docUpdatedAt =
              typeof parsed?.doc?.updatedAt === "string"
                ? parsed.doc.updatedAt
                : "";
            primaryIsPristine =
              (cachedEntries?.length ?? 0) === 0 &&
              (!docUpdatedAt || docUpdatedAt === new Date(0).toISOString());
          }
        } catch {
          warning = "reset";
          primaryIsPristine = false;
          await persistRecoveryEvidence(
            `${CARE_PRIMARY_LOCAL_DATA_KEY}.recovery`,
            raw,
          );
        }
      }

      let legacySummary: LegacyImportResult["summary"] | null = null;
      if (primaryIsPristine) {
        try {
          const [flag, legacyRaw] = await Promise.all([
            removableStorage.getItem(LEGACY_IMPORT_FLAG_KEY),
            removableStorage.getItem(LEGACY_STATE_KEY),
          ]);
          if (!hydrationCanContinue()) {
            throw new LocalDataResetInProgressError();
          }
          if (!flag && legacyRaw) {
            const result = convertLegacyState(parseLegacyState(legacyRaw));
            if (result) {
              const previous = cachedDoc ?? docRef.current;
              const importedDoc = Object.keys(result.docPatch).length
                ? mergeDoc({
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
                      ? {
                          ...previous.dietProfile,
                          ...result.docPatch.dietProfile,
                        }
                      : previous.dietProfile,
                    updatedAt: new Date().toISOString(),
                  })
                : previous;
              const importedEntries = [
                ...(cachedEntries ?? entriesRef.current),
                ...result.entries,
              ];
              const writeGeneration =
                careWriteProtectionRef.current.capture();
              await carePersistenceWriter.enqueue({
                raw: JSON.stringify({
                  doc: importedDoc,
                  entries: importedEntries,
                  serverVersion:
                    cachedServerVersion ?? versionRef.current,
                }),
                writeGeneration,
                eraseGeneration: hydrationEraseGeneration,
              });
              if (!hydrationCanContinue()) {
                throw new LocalDataResetInProgressError();
              }
              cachedDoc = importedDoc;
              cachedEntries = importedEntries;
              legacySummary = result.summary;
            }
            const stampPayload = result
              ? { status: "imported", summary: result.summary }
              : { status: "nothing-to-import" };
            await removableStorage.setItem(
              LEGACY_IMPORT_FLAG_KEY,
              JSON.stringify({
                at: new Date().toISOString(),
                ...stampPayload,
              }),
            );
            if (!hydrationCanContinue()) {
              throw new LocalDataResetInProgressError();
            }
          }
        } catch (error) {
          if (error instanceof LocalDataResetInProgressError) throw error;
          // A legacy storage failure never blocks the primary cache. Because
          // memory was only staged after the durable stamp, no partial import
          // can leak into this attempt.
        }
      }

      return {
        cachedDoc,
        cachedEntries,
        cachedServerVersion,
        discardedServerEntryIds,
        futureDoc,
        futureRaw,
        legacySummary,
        warning,
      };
    };

    const applyStagedCareHydration = (staged: StagedCareHydration) => {
      discardedServerEntryIdsRef.current = new Set(
        normalizeDiscardedServerEntryIds([
          ...staged.discardedServerEntryIds,
          ...discardedServerEntryIdsRef.current,
        ]),
      );
      if (staged.futureDoc) {
        preserveFutureCareDoc(staged.futureDoc);
        futureCareCacheRawRef.current = staged.futureRaw;
      } else if (staged.cachedDoc) {
        docRef.current = staged.cachedDoc;
        setDoc(staged.cachedDoc);
      }
      if (staged.cachedEntries) {
        entriesRef.current = staged.cachedEntries;
        setEntries(staged.cachedEntries);
      }
      if (staged.cachedServerVersion !== null) {
        versionRef.current = staged.cachedServerVersion;
        setServerVersion(staged.cachedServerVersion);
      }
      if (staged.legacySummary) setLegacyImport(staged.legacySummary);
      if (staged.warning) setCareStorageWarning(staged.warning);
      hydratedRef.current = true;
      setHydrated(true);
    };

    const hydrate = async (allowRetry: boolean) => {
      if (!hydrationCanContinue() || !isWriteAdmissionOpen()) return;
      try {
        const stagedHydration = await stageCareHydration();
        if (!hydrationCanContinue()) return;
        applyStagedCareHydration(stagedHydration);
      } catch (error) {
        if (!hydrationCanContinue()) return;
        if (error instanceof LocalDataResetInProgressError) return;
        if (allowRetry) {
          retryTimer = setTimeout(() => void hydrate(false), 1500);
          return;
        }
        setCareStorageWarning("read-failed");
      }
    };
    void hydrate(true);
    return () => {
      cancelled = true;
      hydrationAttempt.cancel();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    isWriteAdmissionOpen,
    operationSettledEpoch,
    carePersistenceWriter,
    preserveFutureCareDoc,
    removableStorage,
    setCareStorageWarning,
  ]);

  // Persist the offline cache whenever synced state changes. A failing
  // device store is a data risk in a local-first app, so surface it instead
  // of swallowing it - and clear the warning when writes recover.
  useEffect(() => {
    if (
      !hydrated ||
      !isWriteAdmissionOpen() ||
      careDocWritesBlocked() ||
      snapshotPersistencePausedRef.current
    ) {
      return;
    }
    if (suppressNextSettledSnapshotRef.current) {
      const suppressed = suppressedPristineSnapshotRef.current;
      if (suppressed) {
        const decision = getCarePristineSnapshotPersistenceDecision({
          current: { doc, entries, serverVersion },
          pristine: suppressed,
          operationSettledEpoch,
          resetStartedAtEpoch: successfulResetStartedAtEpochRef.current,
        });
        if (decision === "wait") return;
        suppressNextSettledSnapshotRef.current = false;
        suppressedPristineSnapshotRef.current = null;
        if (decision === "suppress") return;
      } else {
        suppressNextSettledSnapshotRef.current = false;
      }
    }
    const writeGeneration = careWriteProtectionRef.current.capture();
    const eraseGeneration = eraseGenerationRef.current;
    const snapshot = latestCareSnapshotRef.current + 1;
    latestCareSnapshotRef.current = snapshot;
    carePersistenceWriter
      .enqueue({
        raw: JSON.stringify({
          doc,
          entries,
          serverVersion,
        }),
        writeGeneration,
        eraseGeneration,
      })
      .then(() => {
        if (
          snapshot !== latestCareSnapshotRef.current ||
          eraseGeneration !== eraseGenerationRef.current ||
          !careWriteCanContinue(writeGeneration)
        ) {
          return;
        }
        setStorageWarning((current) =>
          prioritizeCareStorageWarning(
            current,
            current === "save-failed" ? null : current,
            careWriteProtectionRef.current.isBlocked(),
          ),
        );
      })
      .catch(() => {
        if (
          eraseGeneration !== eraseGenerationRef.current ||
          !careWriteCanContinue(writeGeneration)
        ) {
          return;
        }
        setCareStorageWarning("save-failed");
      });
  }, [
    doc,
    entries,
    serverVersion,
    hydrated,
    operationSettledEpoch,
    isWriteAdmissionOpen,
    carePersistenceWriter,
    careDocWritesBlocked,
    careWriteCanContinue,
    setCareStorageWarning,
  ]);

  const pushDoc = useCallback(async (next: CareDoc) => {
    if (careDocWritesBlocked() || preserveFutureCareDoc(next)) return;
    // Guard every post-await state write against an owner wipe: a push (or
    // its conflict-retry) that resolves after "All data deleted" must not
    // write the pre-wipe doc back into memory, disk, or the server.
    const eraseGenerationAtStart = eraseGenerationRef.current;
    const writeGeneration = careWriteProtectionRef.current.capture();
    const canContinue = () => careWriteCanContinue(writeGeneration);
    if (!canContinue()) return;
    try {
      const res = await putCareState({
        version: versionRef.current,
        doc: next as unknown as CareStateEnvelope["doc"],
      });
      if (
        eraseGenerationRef.current !== eraseGenerationAtStart ||
        !canContinue()
      ) return;
      setServerVersion(res.version);
    } catch (err) {
      if (!canContinue()) return;
      if (!isConflict(err)) return;
      if (eraseGenerationRef.current !== eraseGenerationAtStart) return;
      // Another device wrote first. Adopt their doc + version, replay our
      // side on top (last-writer-wins per field), and retry once. Replay the
      // LATEST local doc, not the snapshot this push captured - by conflict
      // time the owner may have made further edits, and overlaying the stale
      // snapshot erased them locally and then pushed the erasure.
      const envelope = err.data as CareStateEnvelope | null;
      if (!envelope) return;
      if (preserveFutureCareDoc(envelope.doc)) {
        return;
      }
      if (!canContinue()) return;
      const merged: CareDoc = {
        ...mergeDoc(envelope.doc as Partial<CareDoc>),
        ...docRef.current,
        updatedAt: new Date().toISOString(),
      };
      if (!canContinue()) return;
      setServerVersion(envelope.version);
      if (!canContinue()) return;
      docRef.current = merged;
      if (!canContinue()) return;
      setDoc(merged);
      try {
        if (!canContinue()) return;
        const res = await putCareState({
          version: envelope.version,
          doc: merged as unknown as CareStateEnvelope["doc"],
        });
        if (
          eraseGenerationRef.current !== eraseGenerationAtStart ||
          !canContinue()
        ) return;
        setServerVersion(res.version);
      } catch {
        // Give up; the next full refresh reconciles.
      }
    }
  }, [careDocWritesBlocked, careWriteCanContinue, preserveFutureCareDoc]);

  const persistEntryCreate = useCallback(
    (tempId: string, entry: Omit<Entry, "id">) => {
      if (careDocWritesBlocked()) return;
      if (!signedInRef.current) return;
      const eraseGenerationAtStart = eraseGenerationRef.current;
      const writeGeneration = careWriteProtectionRef.current.capture();
      const canContinue = () => careWriteCanContinue(writeGeneration);
      if (!canContinue()) return;
      const createWasRetried =
        entry.syncStatus === "failed" || entry.syncStatus === "local";
      if (!canContinue()) return;
      creatingTempEntries.current.add(tempId);
      if (!canContinue()) return;
      entriesRef.current = entriesRef.current.map((current) =>
        current.id === tempId
          ? { ...current, syncStatus: "pending", syncError: undefined }
          : current,
      );
      if (!canContinue()) return;
      setEntries((prev) =>
        prev.map((e) =>
          e.id === tempId
            ? { ...e, syncStatus: "pending", syncError: undefined }
            : e,
        ),
      );
      if (!canContinue()) return;
      createCareEntry(toCreateInput(entry, tempId))
        .then(async (created) => {
          if (!canContinue()) return;
          const serverEntry = toEntry(created);
          const deleteAcknowledgedServerEntry = async (
            entryId: string,
          ) => {
            if (!canContinue()) return;
            try {
              await deleteCareEntry(entryId);
              if (!canContinue()) return;
            } catch (error) {
              if (!canContinue()) return;
              if (!isNotFound(error)) throw error;
            }
          };
          let localEntry = findCreatedCareEntryLocalSnapshot(
            entriesRef.current,
            tempId,
            serverEntry.id,
          );
          if (
            cancelledTempEntries.current.has(tempId) ||
            eraseGenerationRef.current !== eraseGenerationAtStart
          ) {
            // Persist both identities before attempting the compensating
            // delete. If the process exits between create and delete, a later
            // refresh can suppress by server id or by details.clientKey.
            if (!canContinue()) return;
            await markServerEntryDiscarded(tempId);
            if (!canContinue()) return;
            await markServerEntryDiscarded(serverEntry.id);
            if (!canContinue()) return;
          }
          if (!canContinue()) return;
          let acknowledgement =
            await reconcileCreatedCareEntryAcknowledgement<Entry>({
              localEntry,
              serverEntry,
              createWasRetried,
              tempWasCancelled: cancelledTempEntries.current.has(tempId),
              eraseGenerationAtStart,
              currentEraseGeneration: eraseGenerationRef.current,
              deleteServerEntry: deleteAcknowledgedServerEntry,
            });
          if (!canContinue()) return;

          if (acknowledgement.status === "adopted") {
            // The first helper call crosses an await boundary even on an
            // adoption. Re-read the live cache, then let the same helper own
            // the final decision for a refreshed real-id row, a queued edit,
            // a missing-snapshot fallback, or a cancellation/owner wipe.
            localEntry = findCreatedCareEntryLocalSnapshot(
              entriesRef.current,
              tempId,
              serverEntry.id,
            );
            const mustDiscard =
              cancelledTempEntries.current.has(tempId) ||
              eraseGenerationRef.current !== eraseGenerationAtStart;
            if (mustDiscard) {
              if (!canContinue()) return;
              await markServerEntryDiscarded(tempId);
              if (!canContinue()) return;
              await markServerEntryDiscarded(serverEntry.id);
              if (!canContinue()) return;
            }
            if (!canContinue()) return;
            acknowledgement =
              await reconcileCreatedCareEntryAcknowledgement<Entry>({
                localEntry,
                serverEntry,
                createWasRetried,
                tempWasCancelled:
                  cancelledTempEntries.current.has(tempId),
                eraseGenerationAtStart,
                currentEraseGeneration: eraseGenerationRef.current,
                deleteServerEntry: deleteAcknowledgedServerEntry,
              });
            if (!canContinue()) return;
          }

          if (acknowledgement.status === "discarded") {
            if (acknowledgement.deleteSucceeded) {
              if (!canContinue()) return;
              await clearDiscardedServerEntry(
                acknowledgement.serverEntryId,
              );
              if (!canContinue()) return;
            } else {
              if (!canContinue()) return;
              await markServerEntryDiscarded(
                acknowledgement.serverEntryId,
              );
              if (!canContinue()) return;
            }
            if (!canContinue()) return;
            cancelledTempEntries.current.delete(tempId);
            if (!canContinue()) return;
            pendingPatch.current.delete(tempId);
            if (!canContinue()) return;
            realIdByTemp.current.delete(tempId);
            if (!canContinue()) return;
            entryUpdateQueue.cancel(tempId);
            if (!canContinue()) return;
            entriesRef.current = entriesRef.current.filter(
              (entry) =>
                entry.id !== tempId &&
                entry.id !== acknowledgement.serverEntryId,
            );
            if (!canContinue()) return;
            setEntries((previous) =>
              previous.filter(
                (entry) =>
                  entry.id !== tempId &&
                  entry.id !== acknowledgement.serverEntryId,
              ),
            );
            if (!canContinue()) return;
            queryClient.invalidateQueries({
              queryKey: getListCareEntriesQueryKey(),
            });
            return;
          }

          const real = acknowledgement.entry;
          if (!canContinue()) return;
          realIdByTemp.current.set(tempId, real.id);
          // Apply any patch that landed while the create was in flight.
          const queued = pendingPatch.current.get(tempId);
          if (!canContinue()) return;
          pendingPatch.current.delete(tempId);
          if (!canContinue()) return;
          cancelledTempEntries.current.delete(tempId);
          const acknowledged: Entry = queued
            ? applyQueuedPatchToAcknowledgedEntry<Entry>(
                real,
                queued,
                signedInRef.current,
              )
            : real;
          const needsUpdate =
            signedInRef.current &&
            (Boolean(queued) || shouldRetryUpdate(acknowledged));
          const merged = needsUpdate
            ? ensureCareEntrySyncRevision(acknowledged)
            : acknowledged;
          const replaceAcknowledgedEntry = (currentEntries: Entry[]) => {
            let inserted = false;
            const next: Entry[] = [];
            for (const current of currentEntries) {
              if (
                current.id === tempId ||
                current.id === serverEntry.id
              ) {
                if (!inserted) {
                  next.push(merged);
                  inserted = true;
                }
                continue;
              }
              next.push(current);
            }
            if (!inserted) next.unshift(merged);
            return next;
          };
          if (!canContinue()) return;
          entriesRef.current = replaceAcknowledgedEntry(
            entriesRef.current,
          );
          if (!canContinue()) return;
          setEntries((previous) =>
            replaceAcknowledgedEntry(previous),
          );
          if (!canContinue()) return;
          queryClient.invalidateQueries({
            queryKey: getListCareEntriesQueryKey(),
          });
          if (needsUpdate) {
            if (!canContinue()) return;
            entryWriteGenerationRef.current.set(real.id, writeGeneration);
            if (!canContinue()) return;
            entryUpdateQueue.enqueue(real.id, merged);
          }
        })
        .catch(() => {
          if (!canContinue()) return;
          if (
            cancelledTempEntries.current.has(tempId) ||
            eraseGenerationRef.current !== eraseGenerationAtStart
          ) {
            return;
          }
          if (!canContinue()) return;
          entriesRef.current = entriesRef.current.map((current) =>
            current.id === tempId
              ? {
                  ...current,
                  syncStatus: "failed",
                  syncError: "Saved locally. Refresh to retry sync.",
                }
              : current,
          );
          if (!canContinue()) return;
          setEntries((prev) =>
            prev.map((e) =>
              e.id === tempId
                ? {
                    ...e,
                    syncStatus: "failed",
                    syncError: "Saved locally. Refresh to retry sync.",
                  }
                : e,
            ),
          );
        })
        .finally(() => {
          if (!canContinue()) return;
          creatingTempEntries.current.delete(tempId);
        });
    },
    [
      clearDiscardedServerEntry,
      careDocWritesBlocked,
      careWriteCanContinue,
      entryUpdateQueue,
      markServerEntryDiscarded,
      queryClient,
    ],
  );

  const persistEntryUpdate = useCallback(
    (id: string, entry: Entry) => {
      if (careDocWritesBlocked()) return;
      if (!signedInRef.current) {
        entryUpdateQueue.cancel(id);
        return;
      }
      const writeGeneration = careWriteProtectionRef.current.capture();
      if (!careWriteCanContinue(writeGeneration)) return;
      const pendingEntry: Entry = {
        ...ensureCareEntrySyncRevision(entry),
        syncStatus: "pending",
        syncError: undefined,
      };
      if (!careWriteCanContinue(writeGeneration)) return;
      entriesRef.current = entriesRef.current.map((current) =>
        current.id === id ? pendingEntry : current,
      );
      if (!careWriteCanContinue(writeGeneration)) return;
      setEntries((prev) =>
        prev.map((current) => (current.id === id ? pendingEntry : current)),
      );
      if (!careWriteCanContinue(writeGeneration)) return;
      entryWriteGenerationRef.current.set(id, writeGeneration);
      if (!careWriteCanContinue(writeGeneration)) return;
      entryUpdateQueue.enqueue(id, pendingEntry);
    },
    [careDocWritesBlocked, careWriteCanContinue, entryUpdateQueue],
  );

  const syncFromServer = useCallback(async () => {
    if (
      !hydratedRef.current ||
      !signedInRef.current ||
      syncingRef.current ||
      careDocWritesBlocked()
    ) {
      return;
    }
    // Capture the erase generation so results from a sync that was in
    // flight when the owner wiped this device are discarded instead of
    // resurrecting the deleted data.
    const eraseGenerationAtStart = eraseGenerationRef.current;
    const writeGeneration = careWriteProtectionRef.current.capture();
    const canContinue = () => careWriteCanContinue(writeGeneration);
    if (!canContinue()) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const envelope = await getCareState();
      if (
        eraseGenerationRef.current !== eraseGenerationAtStart ||
        !signedInRef.current ||
        !canContinue()
      ) {
        return;
      }
      if (preserveFutureCareDoc(envelope.doc)) {
        return;
      }
      if (!canContinue()) return;
      const plan = reconcileCareDocFromServer<CareDoc>({
        localDoc: docRef.current,
        localVersion: versionRef.current,
        serverDoc: envelope.doc as Partial<CareDoc>,
        serverVersion: envelope.version,
        serverUpdatedAt: envelope.updatedAt,
      });
      if (plan.shouldPushLocal) {
        if (!canContinue()) return;
        const res = await putCareState({
          version: plan.version,
          doc: plan.doc as unknown as CareStateEnvelope["doc"],
        });
        // Re-check after the await: a wipe during the PUT must not have its
        // pre-wipe doc restored into memory (and re-persisted) here.
        if (
          eraseGenerationRef.current !== eraseGenerationAtStart ||
          !signedInRef.current ||
          !canContinue()
        ) {
          return;
        }
        if (preserveFutureCareDoc(res.doc)) return;
        if (!canContinue()) return;
        setDoc(mergeDoc(res.doc as Partial<CareDoc>));
        if (!canContinue()) return;
        setServerVersion(res.version);
      } else {
        if (!canContinue()) return;
        setDoc(mergeDoc(plan.doc as Partial<CareDoc>));
        if (!canContinue()) return;
        setServerVersion(plan.version);
      }

      if (!canContinue()) return;
      const entryRefreshPlan = buildCareEntryRefreshPlan({
        // The current API `since` filter is occurrence-based, not a server
        // update cursor, so full refresh remains the safe household sync path.
        hasUpdatedAtCursor: false,
        hasDeleteTombstones: false,
      });
      const rows = await listCareEntries(entryRefreshPlan.params);
      if (
        eraseGenerationRef.current !== eraseGenerationAtStart ||
        !signedInRef.current ||
        !canContinue()
      ) {
        return;
      }
      const suppressedIds = new Set(discardedServerEntryIdsRef.current);
      const rowsById = new Map(rows.map((row) => [row.id, row]));
      const rowsByClientKey = new Map<string, ApiCareEntry[]>();
      for (const row of rows) {
        const clientKey = row.details?.clientKey;
        if (typeof clientKey !== "string") continue;
        rowsByClientKey.set(clientKey, [
          ...(rowsByClientKey.get(clientKey) ?? []),
          row,
        ]);
      }
      // Cleanup is deliberately serialized with the durable ledger writes.
      // A temp id is a cancelled create's clientKey; a server id is a known
      // orphan. Both stay opaque and non-renderable until full-list absence or
      // a compensating DELETE confirms the remote row is gone.
      for (const discardedId of suppressedIds) {
        if (!signedInRef.current || !canContinue()) return;
        if (discardedId.startsWith("temp_")) {
          const matchingRows = rowsByClientKey.get(discardedId) ?? [];
          if (matchingRows.length === 0) {
            // One empty list is not proof that a cancelled CREATE cannot
            // commit later (especially after process death, when the in-memory
            // request set is gone). The opaque clientKey stays in the local
            // deletion ledger permanently; later matching rows are deleted
            // without reopening a path for an even later retry to reappear.
            continue;
          }
          await cleanupDiscardedServerEntryRows({
            rows: matchingRows,
            markDiscarded: async (entryId) => {
              if (!canContinue()) return;
              await markServerEntryDiscarded(entryId);
              if (!canContinue()) return;
            },
            deleteEntry: async (entryId) => {
              if (!canContinue()) return;
              try {
                await deleteCareEntry(entryId);
                if (!canContinue()) return;
              } catch (error) {
                if (!canContinue()) return;
                if (!isNotFound(error)) throw error;
              }
            },
            clearDiscarded: async (entryId) => {
              if (!canContinue()) return;
              await clearDiscardedServerEntry(entryId);
              if (!canContinue()) return;
            },
            shouldContinue: () => signedInRef.current && canContinue(),
          });
          if (!canContinue()) return;
          continue;
        }
        if (!rowsById.has(discardedId)) {
          if (!canContinue()) return;
          await clearDiscardedServerEntry(discardedId);
          if (!canContinue()) return;
          continue;
        }
        try {
          if (!canContinue()) return;
          try {
            await deleteCareEntry(discardedId);
            if (!canContinue()) return;
          } catch (error) {
            if (!canContinue()) return;
            if (!isNotFound(error)) throw error;
          }
          if (!canContinue()) return;
          await clearDiscardedServerEntry(discardedId);
          if (!canContinue()) return;
        } catch {
          // Keep suppressing the cancelled create and retry next refresh.
        }
      }
      if (
        eraseGenerationRef.current !== eraseGenerationAtStart ||
        !signedInRef.current ||
        !canContinue()
      ) {
        return;
      }
      const recentlySuppressed = [
        ...recentlyDiscardedServerEntryIdsRef.current,
      ];
      const serverEntries = filterDiscardedServerEntries(
        rows,
        [...suppressedIds],
        [...discardedServerEntryIdsRef.current],
        recentlySuppressed,
      ).map(toEntry);
      const mergedEntries = mergeServerAndLocalEntries(
        entriesRef.current,
        serverEntries,
      );
      if (!canContinue()) return;
      entriesRef.current = mergedEntries;
      if (!canContinue()) return;
      setEntries(mergedEntries);
      // Drain only the ids observed by this refresh. Tombstones added after
      // the snapshot remain in the set for the next refresh.
      for (const discardedId of recentlySuppressed) {
        if (!canContinue()) return;
        recentlyDiscardedServerEntryIdsRef.current.delete(discardedId);
      }
      const retryableCreates = mergedEntries.filter(
        (entry) => shouldRetryCreate(entry) && entry.syncStatus !== "pending",
      );
      const retryableUpdates = mergedEntries.filter(
        (entry) => shouldRetryUpdate(entry),
      );
      retryableCreates.forEach((entry) => {
        if (!canContinue()) return;
        persistEntryCreate(entry.id, entry);
      });
      retryableUpdates.forEach((entry) => {
        if (!canContinue()) return;
        persistEntryUpdate(entry.id, entry);
      });
    } catch {
      // Offline or transient failure: keep showing the cached state.
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [
    careDocWritesBlocked,
    careWriteCanContinue,
    clearDiscardedServerEntry,
    markServerEntryDiscarded,
    persistEntryCreate,
    persistEntryUpdate,
    preserveFutureCareDoc,
  ]);

  useEffect(() => {
    if (!hydrated || !clerkLoaded || !isSignedIn) return;
    void syncFromServer();
  }, [clerkLoaded, hydrated, isSignedIn, syncFromServer]);

  const addEntry = useCallback(
    (entry: Omit<Entry, "id">) => {
      if (careDocWritesBlocked()) return "";
      const tempId = `temp_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const localEntry: Entry = {
        id: tempId,
        ...entry,
        syncStatus: signedInRef.current ? "pending" : "local",
      };
      entriesRef.current = [localEntry, ...entriesRef.current];
      setEntries((prev) => [localEntry, ...prev]);
      if (!signedInRef.current) return tempId;
      persistEntryCreate(tempId, entry);
      return tempId;
    },
    [careDocWritesBlocked, persistEntryCreate],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (careDocWritesBlocked()) return false;
      const writeGeneration = careWriteProtectionRef.current.capture();
      const canContinue = () => careWriteCanContinue(writeGeneration);
      if (!canContinue()) return false;
      // A quick undo can arrive after the optimistic create already swapped
      // its temp id for the server id; resolve through the mapping so the
      // right row is removed locally AND on the server.
      const realId = realIdByTemp.current.get(id) ?? id;
      const removed = entriesRef.current.find(
        (entry) => entry.id === realId || entry.id === id,
      );
      const cancelledClientKey =
        typeof removed?.details?.clientKey === "string" &&
        removed.details.clientKey.startsWith("temp_")
          ? removed.details.clientKey
          : undefined;
      const cancelledTempId = realId.startsWith("temp_")
        ? realId
        : cancelledClientKey;
      const deletionLedgerIds: string[] = [];
      if (realId.startsWith("temp_")) {
        const mayHaveReachedServer =
          creatingTempEntries.current.has(realId) ||
          removed?.syncStatus === "pending" ||
          removed?.syncStatus === "failed";
        if (mayHaveReachedServer) {
          deletionLedgerIds.push(realId);
        }
        cancelledTempEntries.current.add(realId);
        pendingPatch.current.delete(realId);
      } else if (cancelledClientKey) {
        // A refresh may already have migrated the temp row onto its server id
        // before the original CREATE callback resolves. Cancel by both
        // identities so that late callback cannot revive the entry.
        deletionLedgerIds.push(cancelledClientKey, realId);
        cancelledTempEntries.current.add(cancelledClientKey);
        pendingPatch.current.delete(cancelledClientKey);
      }
      try {
        // Commit cancellation intent before hiding the row. If the create
        // response was lost, a future refresh will suppress/delete the server
        // row by id or by details.clientKey.
        for (const discardedId of deletionLedgerIds) {
          if (!canContinue()) return false;
          await markServerEntryDiscarded(discardedId);
          if (!canContinue()) return false;
        }
      } catch {
        if (!canContinue()) return false;
        for (const discardedId of deletionLedgerIds) {
          if (!canContinue()) return false;
          await clearDiscardedServerEntry(discardedId);
          if (!canContinue()) return false;
          recentlyDiscardedServerEntryIdsRef.current.delete(discardedId);
        }
        if (cancelledTempId) {
          cancelledTempEntries.current.delete(cancelledTempId);
        }
        return false;
      }
      if (!canContinue()) return false;
      entryUpdateQueue.cancel(realId);
      const eraseGenerationAtStart = eraseGenerationRef.current;
      // Computed outside the updater (see updateEntry): a deferred updater
      // left `removed` undefined, silently losing the failure-restore.
      entriesRef.current = entriesRef.current.filter(
        (e) => e.id !== realId && e.id !== id,
      );
      if (!canContinue()) return false;
      setEntries((prev) => prev.filter((e) => e.id !== realId && e.id !== id));
      if (!signedInRef.current || realId.startsWith("temp_")) return true;
      try {
        try {
          if (!canContinue()) return false;
          await deleteCareEntry(realId);
          if (!canContinue()) return false;
        } catch (error) {
          if (!canContinue()) return false;
          if (!isNotFound(error)) throw error;
        }
        if (!canContinue()) return false;
        for (const discardedId of deletionLedgerIds) {
          if (!discardedId.startsWith("temp_")) {
            if (!canContinue()) return false;
            await clearDiscardedServerEntry(discardedId);
            if (!canContinue()) return false;
          }
        }
        if (!canContinue()) return false;
        queryClient.invalidateQueries({
          queryKey: getListCareEntriesQueryKey(),
        });
        return true;
      } catch {
        if (!canContinue()) return false;
        // Never restore across an owner wipe: a slow delete that fails after
        // "All data deleted" must not resurrect the entry into the freshly
        // wiped store.
        if (removed && eraseGenerationRef.current === eraseGenerationAtStart) {
          for (const discardedId of deletionLedgerIds) {
            if (!canContinue()) return false;
            await clearDiscardedServerEntry(discardedId);
            if (!canContinue()) return false;
            recentlyDiscardedServerEntryIdsRef.current.delete(discardedId);
          }
          if (cancelledTempId) {
            cancelledTempEntries.current.delete(cancelledTempId);
          }
          const restored = removed;
          if (!canContinue()) return false;
          entriesRef.current = restoreEntryAfterDeleteFailure(
            entriesRef.current,
            restored,
          );
          if (!canContinue()) return false;
          setEntries((previous) =>
            restoreEntryAfterDeleteFailure(previous, restored),
          );
        }
        return false;
      }
    },
    [
      clearDiscardedServerEntry,
      careDocWritesBlocked,
      careWriteCanContinue,
      entryUpdateQueue,
      markServerEntryDiscarded,
      queryClient,
    ],
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<Omit<Entry, "id">>) => {
      if (careDocWritesBlocked()) return false;
      const writeGeneration = careWriteProtectionRef.current.capture();
      if (!careWriteCanContinue(writeGeneration)) return false;
      const realId = realIdByTemp.current.get(id) ?? id;
      // Compute the merge OUTSIDE the setState updater. The old pattern
      // (assign inside the updater, read synchronously after) silently
      // skipped the server patch whenever React deferred the updater - the
      // entry stayed "pending" forever with nothing in flight. entriesRef is
      // committed-fresh and updated eagerly below so sequential same-tick
      // updates compose.
      const current = entriesRef.current.find((e) => e.id === realId);
      if (!current) return false;
      const mutablePatch = toCareEntryMutablePatch(patch);
      const syncDisposition = decideCareEntryEditSyncDisposition(
        current,
        signedInRef.current,
      );
      if (syncDisposition === "review-required") {
        const preserved: Entry = {
          ...prepareCareEntryForOfflineEdit<Entry>(
            current,
            mutablePatch,
          ),
          syncError:
            "Older saved change preserved on this device. Contact support before household sync.",
        };
        entryUpdateQueue.cancel(realId);
        entriesRef.current = entriesRef.current.map((entry) =>
          entry.id === realId ? preserved : entry,
        );
        setEntries((previous) =>
          previous.map((entry) =>
            entry.id === realId ? preserved : entry,
          ),
        );
        return true;
      }
      const pendingPatchDelta = toPendingCareEntrySyncPatch(
        current,
        mutablePatch,
      );
      const pendingSyncPatch =
        mergeCareEntryPendingSyncPatch<Entry>(
          current.pendingSyncPatch,
          pendingPatchDelta,
        );
      const merged: Entry = syncDisposition === "queue"
        ? advanceCareEntrySyncRevision(
            {
              ...current,
              ...mutablePatch,
              pendingSyncPatch,
              syncStatus: "pending",
              syncError: undefined,
            },
            mutablePatch.details ?? current.details,
          )
        : prepareCareEntryForOfflineEdit<Entry>(
            current,
            mutablePatch,
            pendingSyncPatch,
          );
      entriesRef.current = entriesRef.current.map((e) =>
        e.id === realId ? merged : e,
      );
      setEntries((prev) => prev.map((e) => (e.id === realId ? merged : e)));
      // Create still in flight; remember the patch and apply it on resolve.
      if (realId.startsWith("temp_")) {
        pendingPatch.current.set(realId, {
          ...(pendingPatch.current.get(realId) ?? {}),
          ...mutablePatch,
          details: merged.details,
          pendingSyncPatch: merged.pendingSyncPatch,
        });
        if (syncDisposition === "local") {
          entryUpdateQueue.cancel(realId);
        }
        return true;
      }
      if (syncDisposition === "local") {
        // Invalidate an older in-flight PATCH generation before returning.
        // Its eventual acknowledgement must not replace this offline edit.
        entryUpdateQueue.cancel(realId);
        return true;
      }
      entryWriteGenerationRef.current.set(realId, writeGeneration);
      if (!careWriteCanContinue(writeGeneration)) return false;
      entryUpdateQueue.enqueue(realId, merged);
      return true;
    },
    [careDocWritesBlocked, careWriteCanContinue, entryUpdateQueue],
  );

  const updateCareDoc = useCallback(
    (updater: (doc: CareDoc) => CareDoc) => {
      if (careDocWritesBlocked()) {
        if (careWriteProtectionRef.current.isBlocked()) {
          setCareStorageWarning("newer-version");
        }
        return false;
      }
      // Compute OUTSIDE the setState updater: calling pushDoc from inside it
      // was a render-phase side effect (duplicate PUTs under StrictMode /
      // replayed concurrent renders). docRef is updated eagerly so two
      // synchronous back-to-back updates compose instead of the second one
      // reading a stale base.
      const next = mergeDoc({
        ...updater(docRef.current),
        updatedAt: new Date().toISOString(),
      });
      docRef.current = next;
      setDoc(next);
      if (signedInRef.current) void pushDoc(next);
      return true;
    },
    [careDocWritesBlocked, pushDoc, setCareStorageWarning],
  );

  const state = useMemo<CareState>(
    () => ({
      version: serverVersion,
      dataVersion: doc.dataVersion,
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

  const syncOutbox = useMemo(() => deriveCareSyncOutbox(entries), [entries]);

  const beginCoordinatedCareReset = useCallback(() => {
    stagedCareResetTempIdsRef.current.clear();
    stagedCareResetCleanupLedgerRef.current = [];
    ownerWipeInProgressRef.current = true;
    eraseGenerationRef.current += 1;
    latestCareSnapshotRef.current += 1;
    careWriteProtectionRef.current.invalidate();
    entryUpdateQueue.cancelAll();
  }, [entryUpdateQueue]);

  const endCoordinatedCareReset = useCallback(
    ({ committed }: { committed: boolean }) => {
      if (
        !committed &&
        hasInterruptedCareEntryMutationsToRecover(entriesRef.current)
      ) {
        const recoveredEntries = recoverInterruptedCareEntryMutations(
          entriesRef.current,
        );
        entriesRef.current = recoveredEntries;
        setEntries(recoveredEntries);
      }
      stagedCareResetTempIdsRef.current.clear();
      stagedCareResetCleanupLedgerRef.current = [];
      ownerWipeInProgressRef.current = false;
    },
    [],
  );

  const persistCareResetCleanupIntent = useCallback(async () => {
    const tempIdsNeedingRemoteCleanup = normalizeDiscardedServerEntryIds([
      ...creatingTempEntries.current,
      ...entriesRef.current
        .filter(
          (entry) =>
            entry.id.startsWith("temp_") &&
            (creatingTempEntries.current.has(entry.id) ||
              entry.syncStatus === "pending" ||
              entry.syncStatus === "failed"),
        )
        .map((entry) => entry.id),
    ]);
    const cleanupLedger = normalizeDiscardedServerEntryIds([
      ...discardedServerEntryIdsRef.current,
      ...tempIdsNeedingRemoteCleanup,
    ]);

    if (cleanupLedger.length > 0) {
      await discardedServerEntryWriter.enqueue(cleanupLedger);
    }
    stagedCareResetCleanupLedgerRef.current = cleanupLedger;
    stagedCareResetTempIdsRef.current = new Set(
      tempIdsNeedingRemoteCleanup,
    );
  }, [discardedServerEntryWriter]);

  const finalizeSuccessfulCareReset = useCallback(() => {
    for (const tempId of stagedCareResetTempIdsRef.current) {
      cancelledTempEntries.current.add(tempId);
    }
    discardedServerEntryIdsRef.current = new Set(
      stagedCareResetCleanupLedgerRef.current,
    );
    stagedCareResetTempIdsRef.current.clear();
    futureCareDocRef.current = null;
    futureCareCacheRawRef.current = null;
    careWriteProtectionRef.current.reset();
    realIdByTemp.current.clear();
    pendingPatch.current.clear();
    creatingTempEntries.current.clear();
    entryWriteGenerationRef.current.clear();
    entryUpdateQueue.cancelAll();
    syncingRef.current = false;

    const defaultDoc = getDefaultDoc();
    const emptyEntries: Entry[] = [];
    docRef.current = defaultDoc;
    entriesRef.current = emptyEntries;
    versionRef.current = 0;
    hydratedRef.current = true;
    suppressNextSettledSnapshotRef.current = true;
    successfulResetStartedAtEpochRef.current =
      currentOperationSettledEpochRef.current;
    suppressedPristineSnapshotRef.current = {
      doc: defaultDoc,
      entries: emptyEntries,
      serverVersion: 0,
    };

    setDoc(defaultDoc);
    setEntries(emptyEntries);
    setServerVersion(0);
    setHydrated(true);
    setIsSyncing(false);
    setStorageWarning(null);
    setLegacyImport(null);
  }, [entryUpdateQueue]);

  const careLocalDataResetControllerRef =
    useRef<CareLocalDataResetController | null>(null);
  if (!careLocalDataResetControllerRef.current) {
    careLocalDataResetControllerRef.current =
      createCareLocalDataResetController({
        canPrepare: () =>
          hydratedRef.current && !legacyOwnerWipeInProgressRef.current,
        drainPrimarySnapshots: () => carePersistenceWriter.drain(),
        drainCleanupLedger: () => discardedServerEntryWriter.drain(),
        beginCommit: beginCoordinatedCareReset,
        endCommit: endCoordinatedCareReset,
        invalidateAndDrainPrimarySnapshots: () =>
          carePersistenceWriter.invalidateAndDrain(),
        persistCleanupIntent: persistCareResetCleanupIntent,
        removeItem: (key) => AsyncStorage.removeItem(key),
        finalizeSuccessfulCommit: finalizeSuccessfulCareReset,
      });
  }
  const careLocalDataResetController =
    careLocalDataResetControllerRef.current;

  useEffect(
    () =>
      attachRequiredParticipant(
        "care",
        careLocalDataResetController.participant,
      ),
    [attachRequiredParticipant, careLocalDataResetController],
  );

  const performOwnerWipe = useCallback(async () => {
    // Stop accepting snapshots, settle the active write, preserve any opaque
    // remote-cleanup identifiers, and remove owner keys before installing the
    // pristine document that the normal persist effect will save afterward.
    snapshotPersistencePausedRef.current = true;
    ownerWipeInProgressRef.current = true;
    eraseGenerationRef.current += 1;
    careWriteProtectionRef.current.reset();
    latestCareSnapshotRef.current += 1;
    futureCareDocRef.current = null;
    futureCareCacheRawRef.current = null;
    setStorageWarning(null);
    try {
      await carePersistenceWriter.invalidateAndDrain();
      const tempIdsNeedingRemoteCleanup = entriesRef.current
        .filter(
          (entry) =>
            entry.id.startsWith("temp_") &&
            (creatingTempEntries.current.has(entry.id) ||
              entry.syncStatus === "pending" ||
              entry.syncStatus === "failed"),
        )
        .map((entry) => entry.id);
      for (const entry of entriesRef.current) {
        if (entry.id.startsWith("temp_")) {
          cancelledTempEntries.current.add(entry.id);
        }
      }
      // Deleting visible local data must not delete the opaque intent needed
      // to clean up an in-flight/lost-response create on the provider. Commit
      // those client keys before clearing the cache; the ledger cannot render
      // or repopulate a care entry.
      for (const tempId of tempIdsNeedingRemoteCleanup) {
        try {
          await markServerEntryDiscarded(tempId);
        } catch {
          // The storage warning is already visible. Continue the
          // owner-requested local wipe; the in-memory ledger remains available
          // this session.
        }
      }
      entryUpdateQueue.cancelAll();
      realIdByTemp.current.clear();
      pendingPatch.current.clear();
      creatingTempEntries.current.clear();
      entryWriteGenerationRef.current.clear();
      try {
        const keys = await AsyncStorage.getAllKeys();
        const owned = selectWoofWatcherKeysForOwnerWipe(
          keys,
          CARE_PRESERVED_LOCAL_DATA_KEY,
        );
        if (owned.length) {
          await AsyncStorage.multiRemove(owned);
        }
      } catch {
        // Best effort: the in-memory reset below still clears the live
        // document, and the persist effect overwrites the primary cache key.
      }
      // "All data deleted" must include the files WoofWatcher wrote, not just
      // its key-value store: exported report artifacts and durable record
      // attachments both live under documentDirectory on native.
      if (Platform.OS !== "web" && FileSystem.documentDirectory) {
        await Promise.all(
          ["WoofWatcherReports", "woofwatcher-attachments"].map((dir) =>
            FileSystem.deleteAsync(`${FileSystem.documentDirectory}${dir}/`, {
              idempotent: true,
            }).catch(() => {}),
          ),
        );
      }
    } finally {
      const defaultDoc = getDefaultDoc();
      entriesRef.current = [];
      docRef.current = defaultDoc;
      versionRef.current = 0;
      hydratedRef.current = true;
      careWriteProtectionRef.current.reset();
      snapshotPersistencePausedRef.current = false;
      ownerWipeInProgressRef.current = false;
      setDoc(defaultDoc);
      setEntries([]);
      setServerVersion(0);
      setHydrated(true);
    }
  }, [carePersistenceWriter, entryUpdateQueue, markServerEntryDiscarded]);

  const eraseAllLocalData = useCallback(() => {
    if (eraseAllLocalDataInFlightRef.current) {
      return eraseAllLocalDataInFlightRef.current;
    }
    if (!isWriteAdmissionOpen()) {
      return Promise.reject(
        new Error("A coordinated local data reset is already in progress."),
      );
    }
    legacyOwnerWipeInProgressRef.current = true;
    const wipe = performOwnerWipe().finally(() => {
      legacyOwnerWipeInProgressRef.current = false;
      if (eraseAllLocalDataInFlightRef.current === wipe) {
        eraseAllLocalDataInFlightRef.current = null;
      }
    });
    eraseAllLocalDataInFlightRef.current = wipe;
    return wipe;
  }, [isWriteAdmissionOpen, performOwnerWipe]);

  const careMutationsBlocked = careDocWritesBlocked();
  const value = useMemo<CareContextValue>(
    () => ({
      state,
      careMutationsBlocked,
      addEntry,
      deleteEntry,
      updateEntry,
      updateCareDoc,
      refresh: () => void syncFromServer(),
      eraseAllLocalData,
      syncOutbox,
      isLoaded: hydrated,
      isSyncing,
      storageWarning,
      legacyImport,
    }),
    [
      state,
      careMutationsBlocked,
      addEntry,
      deleteEntry,
      updateEntry,
      updateCareDoc,
      syncFromServer,
      eraseAllLocalData,
      syncOutbox,
      hydrated,
      isSyncing,
      storageWarning,
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
