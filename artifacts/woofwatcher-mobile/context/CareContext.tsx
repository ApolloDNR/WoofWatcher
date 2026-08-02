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
import { useWoofAuth } from "@/lib/auth";
import {
  normalizeReminderNotificationPreferences,
  type ReminderNotificationPreferences,
} from "@/lib/reminderNotificationPreferences";
import {
  normalizeLaunchProviderProfile,
  type LaunchStorageProviderEvidence,
} from "@/lib/launchProviderSetup";
import type { RecordsLocalFileHandoffProofEvidence } from "@/lib/reportArtifactExportFile";
import type { ReportBinaryExportProofEvidence } from "@/lib/reportBinaryExportProof";
import type { RouteVisualProofManifestInput } from "@/lib/mobileReleaseQa";
import type { AuthSetupProofManifestInput } from "@/lib/authProviderProof";
import type { CareEntryProviderSyncProofEvidence } from "@/lib/careEntryProviderSyncProof";
import type { AiProviderProofEvidence } from "@/lib/aiProviderProof";
import type { PaymentsProviderProofManifestInput } from "@/lib/paymentsProviderProof";
import type { AccountDeletionProofEvidence } from "@/lib/accountDeletionProof";
import type { PushNotificationsProofEvidence } from "@/lib/pushNotificationsProof";
import type { StoreAccountsProofEvidence } from "@/lib/storeAccountsProof";
import {
  convertLegacyState,
  parseLegacyState,
  LEGACY_IMPORT_FLAG_KEY,
  LEGACY_STATE_KEY,
  type LegacyImportResult,
} from "@/lib/legacyImport";
import type { SupportLegalReadinessProofEvidence } from "@/lib/supportRunbook";

const STORAGE_KEY = "woofwatcher.v2.state";
const DISCARDED_SERVER_ENTRY_IDS_KEY =
  "woofwatcher.v2.discarded-server-entry-ids";

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
  authSetupProofEvidence?: AuthSetupProofManifestInput | null;
  databaseConfigured: boolean;
  databaseProviderProofReady: boolean;
  careEntryProviderSyncEvidence?: CareEntryProviderSyncProofEvidence | null;
  storageProviderConfigured: boolean;
  storageProviderProofReady: boolean;
  storageProviderEvidence?: LaunchStorageProviderEvidence | null;
  recordsLocalFileHandoffEvidence?: RecordsLocalFileHandoffProofEvidence | null;
  reportBinaryExportProofEvidence?: ReportBinaryExportProofEvidence | null;
  routeVisualProofEvidence?: RouteVisualProofManifestInput | null;
  aiProviderConfigured: boolean;
  aiProviderProofReady: boolean;
  aiProviderEvidence?: AiProviderProofEvidence | null;
  paymentsEnabled: boolean;
  paymentsProviderProofReady: boolean;
  paymentsProviderEvidence?: PaymentsProviderProofManifestInput | null;
  pushNotificationsConfigured: boolean;
  pushNotificationsProofReady: boolean;
  pushNotificationsProofEvidence?: PushNotificationsProofEvidence | null;
  appStoreAccountsReady: boolean;
  storeAccountsProofReady: boolean;
  storeAccountsProofEvidence?: StoreAccountsProofEvidence | null;
  accountDeletionEnabled: boolean;
  accountDeletionProofReady: boolean;
  accountDeletionEvidence?: AccountDeletionProofEvidence | null;
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

function normalizeSupportLegalReadinessEvidence(
  value: SupportLegalReadinessProofEvidence | null | undefined,
): SupportLegalReadinessProofEvidence | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function getDefaultDoc(): CareDoc {
  const now = new Date().toISOString();
  return {
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
  const merged = { ...getDefaultDoc(), ...(partial ?? {}) };
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
  addEntry: (entry: Omit<Entry, "id">) => string;
  deleteEntry: (id: string) => Promise<boolean>;
  updateEntry: (id: string, patch: Partial<Omit<Entry, "id">>) => void;
  updateCareDoc: (updater: (doc: CareDoc) => CareDoc) => void;
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
  storageWarning: "save-failed" | "read-failed" | "reset" | null;
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

  const [doc, setDoc] = useState<CareDoc>(getDefaultDoc);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [serverVersion, setServerVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageWarning, setStorageWarning] = useState<
    "save-failed" | "read-failed" | "reset" | null
  >(null);
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
  const entryUpdateQueueRef =
    useRef<SerializedCareEntryMutationQueue<Entry> | null>(null);
  // Bumped by eraseAllLocalData so in-flight sync results can't resurrect
  // data the owner just deleted from this device.
  const eraseGenerationRef = useRef(0);

  if (!discardedServerEntryWriterRef.current) {
    discardedServerEntryWriterRef.current =
      createSerializedCareSyncWriter<string[] | null>(async (entryIds) => {
        if (entryIds && entryIds.length > 0) {
          await AsyncStorage.setItem(
            DISCARDED_SERVER_ENTRY_IDS_KEY,
            JSON.stringify(entryIds),
          );
          return;
        }
        await AsyncStorage.removeItem(DISCARDED_SERVER_ENTRY_IDS_KEY);
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
        setStorageWarning("save-failed");
        throw new Error("Could not persist cancelled care-entry cleanup.");
      }
    },
    [discardedServerEntryWriter],
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
        setStorageWarning("save-failed");
      }
    },
    [discardedServerEntryWriter],
  );

  if (!entryUpdateQueueRef.current) {
    entryUpdateQueueRef.current =
      createSerializedCareEntryMutationQueue<Entry, ApiCareEntry>({
        mutate: async (entryId, entry, signal) => {
          try {
            return await updateCareEntry(
              entryId,
              toUpdateInput(entry),
              { signal },
            );
          } catch (error) {
            return retryCareEntryMutationAfterConflict({
              error,
              input: entry,
              isConflict,
              fetchCurrent: async () => {
                const conflictEntry = getCareEntryConflictEntry(
                  error,
                  entryId,
                );
                if (conflictEntry) return conflictEntry;
                const rows = await listCareEntries(undefined, {
                  signal,
                });
                const currentServerEntry = rows.find(
                  (row) => row.id === entryId,
                );
                return currentServerEntry
                  ? toEntry(currentServerEntry)
                  : null;
              },
              rebase: rebasePendingCareEntryAfterConflict,
              mutate: (rebasedEntry) =>
                updateCareEntry(
                  entryId,
                  toUpdateInput(rebasedEntry),
                  { signal },
                ),
            });
          }
        },
        onSuccess: (entryId, localEntry, updated) => {
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
    // Returns whether the store is pristine (no cache, or a cache holding
    // zero entries and a never-edited doc) - the only state the legacy web
    // import below is allowed to write into.
    const applyRaw = (raw: string | null): boolean => {
      if (!raw) return true;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.doc) {
          const cachedDoc = mergeDoc(parsed.doc);
          docRef.current = cachedDoc;
          setDoc(cachedDoc);
        }
        let cachedEntries: Entry[] = [];
        if (Array.isArray(parsed?.entries)) {
          // Drop malformed rows (an id-less entry crashes outbox derivation
          // on every launch - an unrecoverable boot loop, since the persist
          // effect never gets a chance to repair the cache).
          cachedEntries = recoverInterruptedCareEntryMutations(
            parsed.entries.filter(
              (entry: unknown): entry is Entry =>
                !!entry && typeof (entry as Entry).id === "string",
            ),
          );
          entriesRef.current = cachedEntries;
          setEntries(cachedEntries);
        }
        if (typeof parsed?.serverVersion === "number") {
          versionRef.current = parsed.serverVersion;
          setServerVersion(parsed.serverVersion);
        }
        const docUpdatedAt = typeof parsed?.doc?.updatedAt === "string" ? parsed.doc.updatedAt : "";
        return (
          cachedEntries.length === 0 &&
          (!docUpdatedAt || docUpdatedAt === new Date(0).toISOString())
        );
      } catch {
        // Corrupt cache: preserve the evidence under a recovery key BEFORE
        // the persist effect overwrites the primary key with defaults, and
        // tell the owner instead of silently resetting.
        AsyncStorage.setItem(`${STORAGE_KEY}.recovery`, raw).catch(() => {});
        setStorageWarning("reset");
        return false;
      }
    };
    const applyDiscardedRaw = (raw: string | null) => {
      try {
        const cachedDiscardedServerEntryIds =
          normalizeDiscardedServerEntryIds([
            ...(raw ? JSON.parse(raw) : []),
            // A cancellation may occur while the two storage reads are in
            // flight. Union it instead of letting the older disk snapshot
            // erase the newer in-memory deletion intent.
            ...discardedServerEntryIdsRef.current,
          ]);
        discardedServerEntryIdsRef.current = new Set(
          cachedDiscardedServerEntryIds,
        );
      } catch {
        // Keep corrupt deletion metadata for support/recovery while refusing
        // to let it delay hydration indefinitely.
        if (raw) {
          AsyncStorage.setItem(
            `${DISCARDED_SERVER_ENTRY_IDS_KEY}.recovery`,
            raw,
          ).catch(() => {});
        }
        // Preserve any cancellation recorded in this live session even when
        // the older on-disk ledger is corrupt.
        setStorageWarning("reset");
      }
    };
    // One-time adoption of the legacy web PWA's data (see lib/legacyImport).
    // Runs only into a pristine store; the legacy key is left in place as
    // its own backup (the owner wipe removes every woofwatcher* key).
    const maybeImportLegacyState = async () => {
      try {
        const [flag, legacyRaw] = await Promise.all([
          AsyncStorage.getItem(LEGACY_IMPORT_FLAG_KEY),
          AsyncStorage.getItem(LEGACY_STATE_KEY),
        ]);
        if (flag || !legacyRaw) return;
        const stamp = (payload: object) =>
          AsyncStorage.setItem(
            LEGACY_IMPORT_FLAG_KEY,
            JSON.stringify({ at: new Date().toISOString(), ...payload }),
          ).catch(() => {});
        const result = convertLegacyState(parseLegacyState(legacyRaw));
        if (!result) {
          await stamp({ status: "nothing-to-import" });
          return;
        }
        if (Object.keys(result.docPatch).length) {
          const importedAt = new Date().toISOString();
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
              ? {
                  ...previous.dietProfile,
                  ...result.docPatch.dietProfile,
                }
              : previous.dietProfile,
            // A real import is a real edit: the doc must not stay pristine
            // or reconciliation could discard the adopted data.
            updatedAt: importedAt,
          };
          docRef.current = importedDoc;
          setDoc(importedDoc);
        }
        if (result.entries.length) {
          const importedEntries = [
            ...entriesRef.current,
            ...result.entries,
          ];
          entriesRef.current = importedEntries;
          setEntries(importedEntries);
        }
        setLegacyImport(result.summary);
        await stamp({ status: "imported", summary: result.summary });
      } catch {
        // A legacy read must never break boot; the store stays as hydrated.
      }
    };
    const readCacheAndDeletionLedger = () =>
      Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(DISCARDED_SERVER_ENTRY_IDS_KEY),
      ]);
    readCacheAndDeletionLedger()
      .then(async ([raw, discardedRaw]) => {
        // Both reads finish before provider sync is enabled. Otherwise a
        // refresh can briefly revive a row whose deletion ledger is still
        // waiting on storage.
        applyDiscardedRaw(discardedRaw);
        if (applyRaw(raw)) await maybeImportLegacyState();
        hydratedRef.current = true;
        setHydrated(true);
      })
      .catch(() => {
        // The read itself failed (transient storage error). Retry once;
        // if it still fails, stay un-hydrated so persistence is paused for
        // the session - in-memory care still works, but we never clobber
        // the stored data we couldn't read.
        setTimeout(() => {
          readCacheAndDeletionLedger()
            .then(async ([raw, discardedRaw]) => {
              applyDiscardedRaw(discardedRaw);
              if (applyRaw(raw)) await maybeImportLegacyState();
              hydratedRef.current = true;
              setHydrated(true);
            })
            .catch(() => setStorageWarning("read-failed"));
        }, 1500);
      });
  }, []);

  // Persist the offline cache whenever synced state changes. A failing
  // device store is a data risk in a local-first app, so surface it instead
  // of swallowing it - and clear the warning when writes recover.
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        doc,
        entries,
        serverVersion,
      }),
    )
      .then(() => {
        setStorageWarning((current) =>
          current === "save-failed" ? null : current,
        );
      })
      .catch(() => setStorageWarning("save-failed"));
  }, [
    doc,
    entries,
    serverVersion,
    hydrated,
  ]);

  const pushDoc = useCallback(async (next: CareDoc) => {
    // Guard every post-await state write against an owner wipe: a push (or
    // its conflict-retry) that resolves after "All data deleted" must not
    // write the pre-wipe doc back into memory, disk, or the server.
    const eraseGenerationAtStart = eraseGenerationRef.current;
    try {
      const res = await putCareState({
        version: versionRef.current,
        doc: next as unknown as CareStateEnvelope["doc"],
      });
      if (eraseGenerationRef.current !== eraseGenerationAtStart) return;
      setServerVersion(res.version);
    } catch (err) {
      if (!isConflict(err)) return;
      if (eraseGenerationRef.current !== eraseGenerationAtStart) return;
      // Another device wrote first. Adopt their doc + version, replay our
      // side on top (last-writer-wins per field), and retry once. Replay the
      // LATEST local doc, not the snapshot this push captured - by conflict
      // time the owner may have made further edits, and overlaying the stale
      // snapshot erased them locally and then pushed the erasure.
      const envelope = err.data as CareStateEnvelope | null;
      if (!envelope) return;
      const merged: CareDoc = {
        ...mergeDoc(envelope.doc as Partial<CareDoc>),
        ...docRef.current,
        updatedAt: new Date().toISOString(),
      };
      setServerVersion(envelope.version);
      docRef.current = merged;
      setDoc(merged);
      try {
        const res = await putCareState({
          version: envelope.version,
          doc: merged as unknown as CareStateEnvelope["doc"],
        });
        if (eraseGenerationRef.current !== eraseGenerationAtStart) return;
        setServerVersion(res.version);
      } catch {
        // Give up; the next full refresh reconciles.
      }
    }
  }, []);

  const persistEntryCreate = useCallback(
    (tempId: string, entry: Omit<Entry, "id">) => {
      if (!signedInRef.current) return;
      const eraseGenerationAtStart = eraseGenerationRef.current;
      const createWasRetried =
        entry.syncStatus === "failed" || entry.syncStatus === "local";
      creatingTempEntries.current.add(tempId);
      entriesRef.current = entriesRef.current.map((current) =>
        current.id === tempId
          ? { ...current, syncStatus: "pending", syncError: undefined }
          : current,
      );
      setEntries((prev) =>
        prev.map((e) =>
          e.id === tempId
            ? { ...e, syncStatus: "pending", syncError: undefined }
            : e,
        ),
      );
      createCareEntry(toCreateInput(entry, tempId))
        .then(async (created) => {
          const serverEntry = toEntry(created);
          const deleteAcknowledgedServerEntry = async (
            entryId: string,
          ) => {
            try {
              await deleteCareEntry(entryId);
            } catch (error) {
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
            await markServerEntryDiscarded(tempId);
            await markServerEntryDiscarded(serverEntry.id);
          }
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
              await markServerEntryDiscarded(tempId);
              await markServerEntryDiscarded(serverEntry.id);
            }
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
          }

          if (acknowledgement.status === "discarded") {
            if (acknowledgement.deleteSucceeded) {
              await clearDiscardedServerEntry(
                acknowledgement.serverEntryId,
              );
            } else {
              await markServerEntryDiscarded(
                acknowledgement.serverEntryId,
              );
            }
            cancelledTempEntries.current.delete(tempId);
            pendingPatch.current.delete(tempId);
            realIdByTemp.current.delete(tempId);
            entryUpdateQueue.cancel(tempId);
            entriesRef.current = entriesRef.current.filter(
              (entry) =>
                entry.id !== tempId &&
                entry.id !== acknowledgement.serverEntryId,
            );
            setEntries((previous) =>
              previous.filter(
                (entry) =>
                  entry.id !== tempId &&
                  entry.id !== acknowledgement.serverEntryId,
              ),
            );
            queryClient.invalidateQueries({
              queryKey: getListCareEntriesQueryKey(),
            });
            return;
          }

          const real = acknowledgement.entry;
          realIdByTemp.current.set(tempId, real.id);
          // Apply any patch that landed while the create was in flight.
          const queued = pendingPatch.current.get(tempId);
          pendingPatch.current.delete(tempId);
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
          entriesRef.current = replaceAcknowledgedEntry(
            entriesRef.current,
          );
          setEntries((previous) =>
            replaceAcknowledgedEntry(previous),
          );
          queryClient.invalidateQueries({
            queryKey: getListCareEntriesQueryKey(),
          });
          if (needsUpdate) {
            entryUpdateQueue.enqueue(real.id, merged);
          }
        })
        .catch(() => {
          if (
            cancelledTempEntries.current.has(tempId) ||
            eraseGenerationRef.current !== eraseGenerationAtStart
          ) {
            return;
          }
          entriesRef.current = entriesRef.current.map((current) =>
            current.id === tempId
              ? {
                  ...current,
                  syncStatus: "failed",
                  syncError: "Saved locally. Refresh to retry sync.",
                }
              : current,
          );
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
          creatingTempEntries.current.delete(tempId);
        });
    },
    [
      clearDiscardedServerEntry,
      entryUpdateQueue,
      markServerEntryDiscarded,
      queryClient,
    ],
  );

  const persistEntryUpdate = useCallback(
    (id: string, entry: Entry) => {
      if (!signedInRef.current) {
        entryUpdateQueue.cancel(id);
        return;
      }
      const pendingEntry: Entry = {
        ...ensureCareEntrySyncRevision(entry),
        syncStatus: "pending",
        syncError: undefined,
      };
      entriesRef.current = entriesRef.current.map((current) =>
        current.id === id ? pendingEntry : current,
      );
      setEntries((prev) =>
        prev.map((current) => (current.id === id ? pendingEntry : current)),
      );
      entryUpdateQueue.enqueue(id, pendingEntry);
    },
    [entryUpdateQueue],
  );

  const syncFromServer = useCallback(async () => {
    if (
      !hydratedRef.current ||
      !signedInRef.current ||
      syncingRef.current
    ) {
      return;
    }
    // Capture the erase generation so results from a sync that was in
    // flight when the owner wiped this device are discarded instead of
    // resurrecting the deleted data.
    const eraseGenerationAtStart = eraseGenerationRef.current;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const envelope = await getCareState();
      if (
        eraseGenerationRef.current !== eraseGenerationAtStart ||
        !signedInRef.current
      ) {
        return;
      }
      const plan = reconcileCareDocFromServer<CareDoc>({
        localDoc: docRef.current,
        localVersion: versionRef.current,
        serverDoc: envelope.doc as Partial<CareDoc>,
        serverVersion: envelope.version,
        serverUpdatedAt: envelope.updatedAt,
      });
      if (plan.shouldPushLocal) {
        const res = await putCareState({
          version: plan.version,
          doc: plan.doc as unknown as CareStateEnvelope["doc"],
        });
        // Re-check after the await: a wipe during the PUT must not have its
        // pre-wipe doc restored into memory (and re-persisted) here.
        if (
          eraseGenerationRef.current !== eraseGenerationAtStart ||
          !signedInRef.current
        ) {
          return;
        }
        setDoc(mergeDoc(res.doc as Partial<CareDoc>));
        setServerVersion(res.version);
      } else {
        setDoc(mergeDoc(plan.doc as Partial<CareDoc>));
        setServerVersion(plan.version);
      }

      const entryRefreshPlan = buildCareEntryRefreshPlan({
        // The current API `since` filter is occurrence-based, not a server
        // update cursor, so full refresh remains the safe household sync path.
        hasUpdatedAtCursor: false,
        hasDeleteTombstones: false,
      });
      const rows = await listCareEntries(entryRefreshPlan.params);
      if (
        eraseGenerationRef.current !== eraseGenerationAtStart ||
        !signedInRef.current
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
        if (!signedInRef.current) return;
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
            markDiscarded: markServerEntryDiscarded,
            deleteEntry: async (entryId) => {
              try {
                await deleteCareEntry(entryId);
              } catch (error) {
                if (!isNotFound(error)) throw error;
              }
            },
            clearDiscarded: clearDiscardedServerEntry,
            shouldContinue: () => signedInRef.current,
          });
          continue;
        }
        if (!rowsById.has(discardedId)) {
          await clearDiscardedServerEntry(discardedId);
          continue;
        }
        try {
          try {
            await deleteCareEntry(discardedId);
          } catch (error) {
            if (!isNotFound(error)) throw error;
          }
          await clearDiscardedServerEntry(discardedId);
        } catch {
          // Keep suppressing the cancelled create and retry next refresh.
        }
      }
      if (
        eraseGenerationRef.current !== eraseGenerationAtStart ||
        !signedInRef.current
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
      entriesRef.current = mergedEntries;
      setEntries(mergedEntries);
      // Drain only the ids observed by this refresh. Tombstones added after
      // the snapshot remain in the set for the next refresh.
      for (const discardedId of recentlySuppressed) {
        recentlyDiscardedServerEntryIdsRef.current.delete(discardedId);
      }
      const retryableCreates = mergedEntries.filter(
        (entry) => shouldRetryCreate(entry) && entry.syncStatus !== "pending",
      );
      const retryableUpdates = mergedEntries.filter(
        (entry) => shouldRetryUpdate(entry),
      );
      retryableCreates.forEach((entry) => {
        persistEntryCreate(entry.id, entry);
      });
      retryableUpdates.forEach((entry) => {
        persistEntryUpdate(entry.id, entry);
      });
    } catch {
      // Offline or transient failure: keep showing the cached state.
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [
    clearDiscardedServerEntry,
    markServerEntryDiscarded,
    persistEntryCreate,
    persistEntryUpdate,
  ]);

  useEffect(() => {
    if (!hydrated || !clerkLoaded || !isSignedIn) return;
    void syncFromServer();
  }, [clerkLoaded, hydrated, isSignedIn, syncFromServer]);

  const addEntry = useCallback(
    (entry: Omit<Entry, "id">) => {
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
    [persistEntryCreate],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
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
          await markServerEntryDiscarded(discardedId);
        }
      } catch {
        for (const discardedId of deletionLedgerIds) {
          await clearDiscardedServerEntry(discardedId);
          recentlyDiscardedServerEntryIdsRef.current.delete(discardedId);
        }
        if (cancelledTempId) {
          cancelledTempEntries.current.delete(cancelledTempId);
        }
        return false;
      }
      entryUpdateQueue.cancel(realId);
      const eraseGenerationAtStart = eraseGenerationRef.current;
      // Computed outside the updater (see updateEntry): a deferred updater
      // left `removed` undefined, silently losing the failure-restore.
      entriesRef.current = entriesRef.current.filter(
        (e) => e.id !== realId && e.id !== id,
      );
      setEntries((prev) => prev.filter((e) => e.id !== realId && e.id !== id));
      if (!signedInRef.current || realId.startsWith("temp_")) return true;
      try {
        try {
          await deleteCareEntry(realId);
        } catch (error) {
          if (!isNotFound(error)) throw error;
        }
        for (const discardedId of deletionLedgerIds) {
          if (!discardedId.startsWith("temp_")) {
            await clearDiscardedServerEntry(discardedId);
          }
        }
        queryClient.invalidateQueries({
          queryKey: getListCareEntriesQueryKey(),
        });
        return true;
      } catch {
        // Never restore across an owner wipe: a slow delete that fails after
        // "All data deleted" must not resurrect the entry into the freshly
        // wiped store.
        if (removed && eraseGenerationRef.current === eraseGenerationAtStart) {
          for (const discardedId of deletionLedgerIds) {
            await clearDiscardedServerEntry(discardedId);
            recentlyDiscardedServerEntryIdsRef.current.delete(discardedId);
          }
          if (cancelledTempId) {
            cancelledTempEntries.current.delete(cancelledTempId);
          }
          const restored = removed;
          entriesRef.current = restoreEntryAfterDeleteFailure(
            entriesRef.current,
            restored,
          );
          setEntries((previous) =>
            restoreEntryAfterDeleteFailure(previous, restored),
          );
        }
        return false;
      }
    },
    [
      clearDiscardedServerEntry,
      entryUpdateQueue,
      markServerEntryDiscarded,
      queryClient,
    ],
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<Omit<Entry, "id">>) => {
      const realId = realIdByTemp.current.get(id) ?? id;
      // Compute the merge OUTSIDE the setState updater. The old pattern
      // (assign inside the updater, read synchronously after) silently
      // skipped the server patch whenever React deferred the updater - the
      // entry stayed "pending" forever with nothing in flight. entriesRef is
      // committed-fresh and updated eagerly below so sequential same-tick
      // updates compose.
      const current = entriesRef.current.find((e) => e.id === realId);
      if (!current) return;
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
        return;
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
        return;
      }
      if (syncDisposition === "local") {
        // Invalidate an older in-flight PATCH generation before returning.
        // Its eventual acknowledgement must not replace this offline edit.
        entryUpdateQueue.cancel(realId);
        return;
      }
      entryUpdateQueue.enqueue(realId, merged);
    },
    [entryUpdateQueue],
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
      if (signedInRef.current) void pushDoc(next);
    },
    [pushDoc],
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

  const syncOutbox = useMemo(() => deriveCareSyncOutbox(entries), [entries]);

  const eraseAllLocalData = useCallback(async () => {
    // Invalidate in-flight work, commit any remote-cleanup identifiers, then
    // reset the live document and remove every data-bearing WoofWatcher key.
    // The persist effect re-saves only a pristine default household.
    eraseGenerationRef.current += 1;
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
    // Deleting visible local data must not delete the opaque intent needed to
    // clean up an in-flight/lost-response create on the provider. Commit those
    // client keys before clearing the cache; the ledger cannot render or
    // repopulate a care entry.
    for (const tempId of tempIdsNeedingRemoteCleanup) {
      try {
        await markServerEntryDiscarded(tempId);
      } catch {
        // The storage warning is already visible. Continue the owner-requested
        // local wipe; the in-memory ledger remains available this session.
      }
    }
    entryUpdateQueue.cancelAll();
    entriesRef.current = [];
    const defaultDoc = getDefaultDoc();
    docRef.current = defaultDoc;
    versionRef.current = 0;
    setDoc(defaultDoc);
    setEntries([]);
    setServerVersion(0);
    realIdByTemp.current.clear();
    pendingPatch.current.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const owned = selectWoofWatcherKeysForOwnerWipe(
        keys,
        DISCARDED_SERVER_ENTRY_IDS_KEY,
      );
      if (owned.length) {
        await AsyncStorage.multiRemove(owned);
      }
    } catch {
      // Best effort: the in-memory reset above already cleared the live
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
  }, [entryUpdateQueue, markServerEntryDiscarded]);

  const value = useMemo<CareContextValue>(
    () => ({
      state,
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
