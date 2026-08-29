import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import {
  createCareEntry,
  deleteCareEntry,
  deleteCareEntryByClientKey,
  getCareState,
  getMe,
  getListCareEntriesHouseholdQueryKey,
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
  createSerializedCareSyncWriter,
  createSerializedCareEntryMutationQueue,
  decideCareEntryEditSyncDisposition,
  deriveCareSyncOutbox,
  diffCareEntryPendingDetails,
  filterDiscardedServerEntries,
  findCreatedCareEntryLocalSnapshot,
  isCareEntryMutationNotFound,
  isUnsyncedEntry,
  mergeCareEntryPendingSyncPatch,
  mergeServerAndLocalEntries,
  normalizeDiscardedServerEntryIds,
  partitionCachedCareEntriesByDiscardedIdentity,
  prepareCareEntryForOfflineEdit,
  recoverInterruptedCareEntryMutations,
  rebaseCareEntryAfterConflict,
  reconcileCreatedCareEntryAcknowledgement,
  reconcileCareDocFromServer,
  removeDiscardedServerEntryId,
  restoreEntryAfterDeleteFailure,
  retryCareEntryMutationAfterConflict,
  sanitizeCareEntryDetailsForSync,
  shouldRetryCreate,
  shouldRetryUpdate,
  type CareEntryPendingDelete,
  type CareSyncOutbox,
  type EntrySyncStatus,
  type SerializedCareSyncWriter,
  type SerializedCareEntryMutationQueue,
} from "@/lib/careSync";
import {
  partitionCareEntriesForSignedInUser,
  stampSignedInPrivateCareEntryCreator,
} from "@/lib/careEntryOwnerPrivacy";
import {
  applyExactCareEntryCreateRevocation,
  applyExactCareEntryNotFoundRevocation,
  persistCareEntryRevocationSuppression,
  releaseCareEntryRevocationSuppression,
} from "@/lib/careEntryMutationRevocation";
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
  restoreDeviceOnlyRecordAttachments,
  sanitizeCareDocForProviderSync,
  type CareCorrectionIssue,
  type CareDocMigrationQuarantineItem,
} from "../lib/careDocMigration";
import {
  careWriteAdmissionIsOpen,
  createCareWriteProtection,
  prioritizeCareStorageWarning,
  type CareStorageWarning,
} from "@/lib/careWriteProtection";
import {
  createCarePersistenceWriter,
  type CarePersistenceWriter,
} from "@/lib/carePersistenceWriter";
import {
  createCareInitialSyncReadiness,
  runAtomicCareInitialRefresh,
  type CareInitialSyncStatus,
} from "@/lib/careInitialSyncReadiness";
import {
  beginCareInitialSyncLifecycle,
  type CareInitialSyncSettlement,
} from "@/lib/careInitialSyncLifecycle";
import {
  createCareAuthIdentityBoundary,
  type CareAuthIdentityPermit,
  type CareMutationOriginPermit,
} from "@/lib/careAuthIdentityBoundary";
import {
  createCareIdentityVault,
  decodeCareCleanupLedger,
  parseCareIdentityVault,
  readCareIdentitySlot,
  readCareIdentitySlotRaw,
  replaceCareCleanupLedgerScope,
  scopeCareCleanupEntryIds,
  serializeCareIdentityVault,
  writeCareIdentitySlot,
  type CareIdentityVault,
} from "@/lib/careIdentityStorage";
import {
  createCareHouseholdIdentityResolution,
  createCareHouseholdExpiryRevocation,
  type CareHouseholdIdentityResolutionAttempt,
} from "@/lib/careHouseholdIdentityResolution";
import { createHouseholdMembershipRediscoveryController } from "@/lib/householdMembershipList";
import {
  createCareHouseholdTransitionController,
  type CareHouseholdTransitionToken,
} from "@/lib/careHouseholdTransition";
import {
  createHouseholdOperationController,
  type HouseholdOperationController,
  type HouseholdOperationSnapshot,
} from "@/lib/householdOperation";
import {
  assertCareHouseholdConflictAuthority,
  assertCareHouseholdSuccessAuthority,
  isCareHouseholdResponseAuthorityError,
} from "@/lib/careHouseholdResponseAuthority";
import {
  CARE_PRESERVED_LOCAL_DATA_KEY,
  CARE_PRIMARY_LOCAL_DATA_KEY,
  createCareHydrationAttemptAuthority,
  createCareLocalDataResetController,
  getCarePristineSnapshotPersistenceDecision,
  hasInterruptedCareEntryMutationsToRecover,
  type CareHydrationAttemptAuthority,
  type CareLocalDataResetController,
  type CareResetCommitContext,
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

interface PersistedCareIdentitySnapshot {
  doc: CareDoc;
  entries: Entry[];
  serverVersion: number;
}

interface CareCleanupLedgerPersistence {
  raw: string | null;
}

interface AuthorizedCareEntryMutation {
  authPermit: CareAuthIdentityPermit;
  writeGeneration: number;
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
  attachmentMimeType?: string;
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
  /** Authenticated creator authority returned by the server. */
  caregiverUserId?: string;
  syncStatus?: EntrySyncStatus;
  syncError?: string;
  pendingSyncPatch?: CareEntryPendingSyncPatch;
}

const EMPTY_IDENTITY_SCOPED_ENTRIES: Entry[] = [];

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
    caregiverUserId: _caregiverUserId,
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

function expectedHouseholdHeaders(householdId: string) {
  return {
    "X-WoofWatcher-Expected-Household-Id": householdId,
  } as const;
}

interface CareContextValue {
  state: CareState;
  careMutationsBlocked: boolean;
  addEntry: (entry: Omit<Entry, "id">) => string;
  deleteEntry: (id: string) => Promise<boolean>;
  updateEntry: (id: string, patch: Partial<Omit<Entry, "id">>) => boolean;
  updateCareDoc: (updater: (doc: CareDoc) => CareDoc) => boolean;
  persistCurrentCareSnapshot: () => Promise<boolean>;
  refresh: () => void;
  syncOutbox: CareSyncOutbox;
  isLoaded: boolean;
  isSyncing: boolean;
  isInitialSyncSettled: boolean;
  initialSyncStatus: CareInitialSyncStatus;
  retryInitialSync: () => void;
  retryLocalHydration: () => void;
  /** Exact local/remote identity scope used to synchronously shield consumers. */
  identityScopeKey: string | null;
  identityScopeStatus: CareIdentityScopeStatus;
  retryIdentityScope: () => void;
  restartIdentityScope: () => void;
  rediscoverIdentityScopeFromMembershipList: (
    permit: CareAuthIdentityPermit,
  ) => boolean;
  confirmHouseholdMembershipListHealthy: (
    permit: CareAuthIdentityPermit,
  ) => boolean;
  captureCareHouseholdOperationPermit: () => CareAuthIdentityPermit | null;
  isCareHouseholdOperationPermitCurrent: (
    permit: CareAuthIdentityPermit,
  ) => boolean;
  beginCareHouseholdTransition: (
    permit: CareAuthIdentityPermit,
  ) => CareHouseholdTransitionToken | null;
  resumeCareHouseholdTransition: (
    token: CareHouseholdTransitionToken,
  ) => boolean;
  householdOperationController: HouseholdOperationController;
  householdOperationSnapshot: HouseholdOperationSnapshot;
  captureCareOperationPermit: () => CareMutationOriginPermit | null;
  isCareOperationPermitCurrent: (permit: CareMutationOriginPermit) => boolean;
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

export interface CareIdentityScopeStatus {
  state: "local" | "pending" | "resolved" | "error";
  retryable: boolean;
  message: string | null;
}

const CareContext = createContext<CareContextValue | null>(null);

export function CareProvider({ children }: { children: React.ReactNode }) {
  const {
    isSignedIn,
    isLoaded: clerkLoaded,
    userId,
    sessionId,
  } = useWoofAuth();
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
  const [localHydrationRetryEpoch, setLocalHydrationRetryEpoch] = useState(0);
  const [localHydrationFailure, setLocalHydrationFailure] = useState<{
    dataScope: string;
    generation: number;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [, setInitialSyncReadinessRevision] = useState(0);
  const [authSyncRetryEpoch, setAuthSyncRetryEpoch] = useState(0);
  const [householdResolutionRetryEpoch, setHouseholdResolutionRetryEpoch] =
    useState(0);
  const [householdForegroundEpoch, setHouseholdForegroundEpoch] = useState(0);
  const [storageWarning, setStorageWarning] = useState<CareStorageWarning>(null);
  const [legacyImport, setLegacyImport] = useState<
    LegacyImportResult["summary"] | null
  >(null);

  // Refs mirror state so async callbacks read fresh values without re-binding.
  const docRef = useRef(doc);
  const docRevisionRef = useRef(0);
  const entriesRef = useRef(entries);
  const versionRef = useRef(serverVersion);
  const hiddenIdentityDocRef = useRef<CareDoc>(getDefaultDoc());
  const signedInRef = useRef(false);
  const syncingRef = useRef(false);
  const hydratedRef = useRef(false);
  const hydrationAttemptGenerationRef = useRef(0);
  const activeDataScopeRef = useRef<string | null>(null);
  const careIdentityVaultRef = useRef<CareIdentityVault>(
    createCareIdentityVault(),
  );
  const cleanupLedgerRawRef = useRef<string | null>(null);
  const pendingScopeTransitionSnapshotRef = useRef<{
    dataScope: string;
    snapshot: PersistedCareIdentitySnapshot;
  } | null>(null);
  const authIdentityBoundaryRef = useRef(
    createCareAuthIdentityBoundary(),
  );
  const authIdentityBoundary = authIdentityBoundaryRef.current;
  const householdIdentityResolutionRef = useRef(
    createCareHouseholdIdentityResolution(),
  );
  const householdIdentityResolution = householdIdentityResolutionRef.current;
  const householdExpiryRevocationRef = useRef(
    createCareHouseholdExpiryRevocation(),
  );
  const householdExpiryRevocation = householdExpiryRevocationRef.current;
  const householdForegroundRef = useRef(AppState.currentState === "active");
  const temporaryHouseholdForegroundGuardRef = useRef<{
    identityKey: string | null;
    hasTemporaryAccess: boolean;
  }>({ identityKey: null, hasTemporaryAccess: false });
  const householdMembershipRediscoveryRef = useRef(
    createHouseholdMembershipRediscoveryController(),
  );
  const householdMembershipRediscovery =
    householdMembershipRediscoveryRef.current;
  const householdTransitionControllerRef = useRef(
    createCareHouseholdTransitionController(),
  );
  const householdTransitionController =
    householdTransitionControllerRef.current;
  const householdOperationControllerRef = useRef(
    createHouseholdOperationController(),
  );
  const householdOperationController = householdOperationControllerRef.current;
  const [householdOperationSnapshot, setHouseholdOperationSnapshot] =
    useState<HouseholdOperationSnapshot>(() =>
      householdOperationController.getSnapshot(),
    );
  useEffect(
    () =>
      householdOperationController.subscribe(() => {
        setHouseholdOperationSnapshot(
          householdOperationController.getSnapshot(),
        );
      }),
    [householdOperationController],
  );
  const householdIdentitySnapshot = householdIdentityResolution.observeAuth({
    clerkLoaded,
    isSignedIn: !!isSignedIn,
    userId,
    sessionId,
  });
  const normalizedUserId = householdIdentitySnapshot.userId;
  const normalizedSessionId = householdIdentitySnapshot.sessionId;
  const resolvedHouseholdId = householdIdentitySnapshot.householdId;
  if (
    temporaryHouseholdForegroundGuardRef.current.identityKey !==
    householdIdentitySnapshot.identityKey
  ) {
    temporaryHouseholdForegroundGuardRef.current = {
      identityKey: householdIdentitySnapshot.identityKey,
      hasTemporaryAccess: false,
    };
  }
  const authIdentity = authIdentityBoundary.observe({
    clerkLoaded,
    isSignedIn: !!isSignedIn,
    userId: normalizedUserId,
    sessionId: normalizedSessionId,
    householdId: resolvedHouseholdId,
  });
  const currentClerkIdentityInputRef = useRef({
    clerkLoaded,
    isSignedIn: !!isSignedIn,
    userId: normalizedUserId,
    sessionId: normalizedSessionId,
  });
  currentClerkIdentityInputRef.current = {
    clerkLoaded,
    isSignedIn: !!isSignedIn,
    userId: normalizedUserId,
    sessionId: normalizedSessionId,
  };
  signedInRef.current = authIdentity.phase === "signed-in";
  const initialSyncReadinessRef =
    useRef<ReturnType<typeof createCareInitialSyncReadiness> | null>(null);
  if (!initialSyncReadinessRef.current) {
    initialSyncReadinessRef.current = createCareInitialSyncReadiness();
  }
  const initialSyncReadiness = initialSyncReadinessRef.current;
  initialSyncReadiness.observeAuth({
    clerkLoaded,
    isSignedIn: !!isSignedIn,
    identityKey:
      authIdentity.identityKey ??
      (normalizedUserId && normalizedSessionId
        ? JSON.stringify([normalizedUserId, normalizedSessionId, null])
        : null),
  });
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
      !authIdentityBoundary.canDisplay(activeDataScopeRef.current) ||
      !careWriteAdmissionIsOpen({
          hydrated: hydratedRef.current,
          ownerWipeInProgress: ownerWipeInProgressRef.current,
          localDataAdmissionOpen: isWriteAdmissionOpen(),
          versionProtectionBlocked: careWriteProtectionRef.current.isBlocked(),
        }),
    [authIdentityBoundary, isWriteAdmissionOpen],
  );
  const careWriteCanContinue = useCallback(
    (generation: number): boolean =>
      authIdentityBoundary.canDisplay(activeDataScopeRef.current) &&
      careWriteAdmissionIsOpen({
          hydrated: hydratedRef.current,
          ownerWipeInProgress: ownerWipeInProgressRef.current,
          localDataAdmissionOpen: isWriteAdmissionOpen(),
          versionProtectionBlocked: careWriteProtectionRef.current.isBlocked(),
        }) &&
      careWriteProtectionRef.current.canContinue(generation),
    [authIdentityBoundary, isWriteAdmissionOpen],
  );
  // Maps optimistic temp ids to their server ids, and queues patches that
  // arrive before a create resolves (post-log quick-note race).
  const realIdByTemp = useRef<Map<string, string>>(new Map());
  const pendingPatch = useRef<Map<string, Partial<Omit<Entry, "id">>>>(new Map());
  const cancelledTempEntries = useRef<Set<string>>(new Set());
  const creatingTempEntries = useRef<Set<string>>(new Set());
  const createAttemptTokenByTemp = useRef<Map<string, object>>(new Map());
  // A cancelled create is hidden until its newly-created server row is
  // successfully removed. This prevents a transient DELETE failure from
  // reviving a care moment on the next refresh in the same session.
  const discardedServerEntryIdsRef = useRef<Set<string>>(new Set());
  const recentlyDiscardedServerEntryIdsRef = useRef<Set<string>>(new Set());
  const discardedServerEntryWriterRef =
    useRef<SerializedCareSyncWriter<CareCleanupLedgerPersistence> | null>(null);
  const carePersistenceWriterRef =
    useRef<CarePersistenceWriter<CarePersistenceSnapshot> | null>(null);
  const latestCareSnapshotRef = useRef(0);
  const suppressNextSettledSnapshotRef = useRef(false);
  const currentOperationSettledEpochRef = useRef(operationSettledEpoch);
  currentOperationSettledEpochRef.current = operationSettledEpoch;
  const successfulResetStartedAtEpochRef = useRef(-1);
  const suppressedPristineSnapshotRef = useRef<{
    doc: CareDoc;
    entries: Entry[];
    serverVersion: number;
  } | null>(null);
  const stagedCareResetTempIdsRef = useRef<Set<string>>(new Set());
  const stagedCareResetCleanupLedgerRef = useRef<string[]>([]);
  const entryUpdateQueueRef =
    useRef<SerializedCareEntryMutationQueue<Entry> | null>(null);
  const entryWriteGenerationRef = useRef<Map<string, number>>(new Map());
  const entryAuthPermitRef = useRef<Map<string, CareAuthIdentityPermit>>(new Map());
  const authorizedEntryMutationRef = useRef<
    WeakMap<Entry, AuthorizedCareEntryMutation>
  >(new WeakMap());
  const syncOperationIdRef = useRef(0);
  const initialSyncRetryTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const observedAuthGenerationRef = useRef(authIdentity.generation);
  // Bumped by the coordinated Care owner so in-flight sync results cannot
  // resurrect data the owner just deleted from this device.
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
          await removableStorage.setItem(CARE_PRIMARY_LOCAL_DATA_KEY, raw);
        },
      );
  }
  const carePersistenceWriter = carePersistenceWriterRef.current;

  const persistCurrentCareSnapshot = useCallback(async (): Promise<boolean> => {
    if (!hydratedRef.current || careDocWritesBlocked()) return false;
    const dataScope = activeDataScopeRef.current;
    if (!dataScope || !authIdentityBoundary.canDisplay(dataScope)) return false;
    const writeGeneration = careWriteProtectionRef.current.capture();
    const eraseGeneration = eraseGenerationRef.current;
    const snapshot = latestCareSnapshotRef.current + 1;
    latestCareSnapshotRef.current = snapshot;
    writeCareIdentitySlot<PersistedCareIdentitySnapshot>(
      careIdentityVaultRef.current,
      dataScope,
      {
        doc: docRef.current,
        entries: entriesRef.current,
        serverVersion: versionRef.current,
      },
    );
    try {
      await carePersistenceWriter.enqueue({
        raw: serializeCareIdentityVault(careIdentityVaultRef.current),
        writeGeneration,
        eraseGeneration,
      });
    } catch {
      if (
        eraseGeneration === eraseGenerationRef.current &&
        careWriteCanContinue(writeGeneration)
      ) {
        setCareStorageWarning("save-failed");
      }
      return false;
    }
    if (
      eraseGeneration !== eraseGenerationRef.current ||
      !careWriteCanContinue(writeGeneration)
    ) {
      return false;
    }
    if (snapshot === latestCareSnapshotRef.current) {
      setStorageWarning((current) =>
        prioritizeCareStorageWarning(
          current,
          current === "save-failed" ? null : current,
          careWriteProtectionRef.current.isBlocked(),
        ),
      );
    }
    return true;
  }, [
    authIdentityBoundary,
    careDocWritesBlocked,
    carePersistenceWriter,
    careWriteCanContinue,
    setCareStorageWarning,
  ]);

  if (!discardedServerEntryWriterRef.current) {
    discardedServerEntryWriterRef.current =
      createSerializedCareSyncWriter<CareCleanupLedgerPersistence>(async ({ raw }) => {
        if (raw) {
          await removableStorage.setItem(
            CARE_PRESERVED_LOCAL_DATA_KEY,
            raw,
          );
          return;
        }
        await removableStorage.removeItem(CARE_PRESERVED_LOCAL_DATA_KEY);
      });
  }
  const discardedServerEntryWriter =
    discardedServerEntryWriterRef.current;

  const markServerEntryDiscarded = useCallback(
    async (entryId: string, dataScope = activeDataScopeRef.current) => {
      if (!dataScope) {
        throw new Error("A Care identity scope is required for cleanup.");
      }
      const next = addDiscardedServerEntryId(
        [...discardedServerEntryIdsRef.current],
        entryId,
      );
      discardedServerEntryIdsRef.current = new Set(next);
      recentlyDiscardedServerEntryIdsRef.current.add(entryId);
      const raw = replaceCareCleanupLedgerScope(
        cleanupLedgerRawRef.current,
        dataScope,
        next,
      );
      cleanupLedgerRawRef.current = raw;
      try {
        await discardedServerEntryWriter.enqueue({ raw });
      } catch {
        if (
          activeDataScopeRef.current === dataScope &&
          authIdentityBoundary.canDisplay(dataScope)
        ) {
          setCareStorageWarning("save-failed");
        }
        throw new Error("Could not persist cancelled care-entry cleanup.");
      }
    },
    [
      authIdentityBoundary,
      discardedServerEntryWriter,
      setCareStorageWarning,
    ],
  );

  const clearDiscardedServerEntry = useCallback(
    async (entryId: string, dataScope = activeDataScopeRef.current) => {
      if (!dataScope) return false;
      const next = removeDiscardedServerEntryId(
        [...discardedServerEntryIdsRef.current],
        entryId,
      );
      discardedServerEntryIdsRef.current = new Set(next);
      const raw = replaceCareCleanupLedgerScope(
        cleanupLedgerRawRef.current,
        dataScope,
        next,
      );
      cleanupLedgerRawRef.current = raw;
      try {
        await discardedServerEntryWriter.enqueue({ raw });
        return true;
      } catch {
        if (
          activeDataScopeRef.current !== dataScope ||
          !authIdentityBoundary.canDisplay(dataScope)
        ) {
          return false;
        }
        const retained = addDiscardedServerEntryId(
          [...discardedServerEntryIdsRef.current],
          entryId,
        );
        discardedServerEntryIdsRef.current = new Set(retained);
        cleanupLedgerRawRef.current = replaceCareCleanupLedgerScope(
          cleanupLedgerRawRef.current,
          dataScope,
          retained,
        );
        recentlyDiscardedServerEntryIdsRef.current.add(entryId);
        setCareStorageWarning("save-failed");
        return false;
      }
    },
    [
      authIdentityBoundary,
      discardedServerEntryWriter,
      setCareStorageWarning,
    ],
  );

  if (!entryUpdateQueueRef.current) {
    entryUpdateQueueRef.current =
      createSerializedCareEntryMutationQueue<Entry, ApiCareEntry>({
        mutate: async (entryId, entry, signal) => {
          const authorization = authorizedEntryMutationRef.current.get(entry);
          const writeGeneration = authorization?.writeGeneration;
          const authPermit = authorization?.authPermit;
          const canContinue = () =>
            writeGeneration !== undefined &&
            authPermit !== undefined &&
            authIdentityBoundary.canContinue(authPermit) &&
            activeDataScopeRef.current === authPermit.dataScope &&
            careWriteCanContinue(writeGeneration);
          if (
            writeGeneration === undefined ||
            !authPermit ||
            !canContinue()
          ) {
            throw new Error("Care writes are blocked by a newer data version.");
          }
          try {
            const updated = await runHouseholdBoundRequest(
              authPermit,
              () => updateCareEntry(
                entryId,
                toUpdateInput(entry),
                expectedHouseholdHeaders(authPermit.householdId),
                { signal },
              ),
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
                const rows = await runHouseholdBoundRequest(
                  authPermit,
                  () => listCareEntries(
                    expectedHouseholdHeaders(authPermit.householdId),
                    undefined,
                    { signal },
                  ),
                );
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
                return runHouseholdBoundRequest(
                  authPermit,
                  () => updateCareEntry(
                    entryId,
                    toUpdateInput(rebasedEntry),
                    expectedHouseholdHeaders(authPermit.householdId),
                    { signal },
                  ),
                );
              },
            });
          }
        },
        onSuccess: (entryId, localEntry, updated) => {
          const authorization =
            authorizedEntryMutationRef.current.get(localEntry);
          const writeGeneration = authorization?.writeGeneration;
          const authPermit = authorization?.authPermit;
          if (
            writeGeneration === undefined ||
            authPermit === undefined ||
            !authIdentityBoundary.canContinue(authPermit) ||
            activeDataScopeRef.current !== authPermit.dataScope ||
            !careWriteCanContinue(writeGeneration)
          ) return;
          entryWriteGenerationRef.current.delete(entryId);
          entryAuthPermitRef.current.delete(entryId);
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
            queryKey: getListCareEntriesHouseholdQueryKey(
              expectedHouseholdHeaders(authPermit.householdId),
            ),
          });
        },
        onFailure: async (entryId, localEntry, error) => {
          const authorization =
            authorizedEntryMutationRef.current.get(localEntry);
          const writeGeneration = authorization?.writeGeneration;
          const authPermit = authorization?.authPermit;
          if (
            writeGeneration === undefined ||
            authPermit === undefined ||
            !authIdentityBoundary.canContinue(authPermit) ||
            activeDataScopeRef.current !== authPermit.dataScope ||
            !careWriteCanContinue(writeGeneration)
          ) return;
          const revocation = await applyExactCareEntryNotFoundRevocation({
            entryId,
            submittedEntry: localEntry,
            error,
            isNotFoundError: isCareEntryMutationNotFound,
            canContinue: () =>
              authIdentityBoundary.canContinue(authPermit) &&
              activeDataScopeRef.current === authPermit.dataScope &&
              careWriteCanContinue(writeGeneration),
            readEntries: () => entriesRef.current,
            cancelMutation(revokedId) {
              entryUpdateQueueRef.current?.cancel(revokedId);
            },
            clearMutationAuthority(revokedId, revokedEntry) {
              entryWriteGenerationRef.current.delete(revokedId);
              entryAuthPermitRef.current.delete(revokedId);
              authorizedEntryMutationRef.current.delete(localEntry);
              authorizedEntryMutationRef.current.delete(revokedEntry);
              pendingPatch.current.delete(revokedId);
              for (const [tempId, realId] of realIdByTemp.current) {
                if (realId !== revokedId) continue;
                realIdByTemp.current.delete(tempId);
                pendingPatch.current.delete(tempId);
              }
            },
            replaceActiveSlot(retained, revokedEntry) {
              careIdentityVaultRef.current.quarantine.push({
                reason:
                  "A Care entry became private or was deleted before this device's pending edit completed.",
                snapshot: {
                  dataScope: authPermit.dataScope,
                  entry: revokedEntry,
                },
              });
              entriesRef.current = retained;
              writeCareIdentitySlot<PersistedCareIdentitySnapshot>(
                careIdentityVaultRef.current,
                authPermit.dataScope,
                {
                  doc: docRef.current,
                  entries: retained,
                  serverVersion: versionRef.current,
                },
              );
            },
            publishEntries(retained) {
              setEntries(retained);
            },
            async persistActiveSlot() {
              return persistCareEntryRevocationSuppression({
                persistCleanupLedger: async () => {
                  await markServerEntryDiscarded(
                    entryId,
                    authPermit.dataScope,
                  );
                  return true;
                },
                persistIdentitySlot: persistCurrentCareSnapshot,
              });
            },
            onPersistenceFailure() {
              setCareStorageWarning("save-failed");
            },
          });
          if (revocation.status !== "not-revoked") return;
          entryWriteGenerationRef.current.delete(entryId);
          entryAuthPermitRef.current.delete(entryId);
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
    if (AppState.currentState !== "active") return;
    if (!householdTransitionController.canResolveHousehold()) return;
    const firstAttempt = householdIdentityResolution.captureAttempt();
    if (!firstAttempt) return;
    let cancelled = false;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const runAttempt = async (
      attempt: CareHouseholdIdentityResolutionAttempt,
    ) => {
      if (cancelled || !householdIdentityResolution.canContinue(attempt)) {
        return;
      }
      controller = new AbortController();
      let settlement;
      try {
        const me = await getMe({
          signal: controller.signal,
          cache: "no-store",
        });
        if (cancelled || !householdIdentityResolution.canContinue(attempt)) {
          return;
        }
        settlement = householdIdentityResolution.settleFreshMe(attempt, me);
        if (settlement.householdId) {
          temporaryHouseholdForegroundGuardRef.current = {
            identityKey: attempt.identityKey,
            hasTemporaryAccess:
              householdIdentityResolution.hasActiveTemporaryAccess(),
          };
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        settlement = householdIdentityResolution.settleFailure(attempt, error);
      }
      if (!settlement.accepted || cancelled) return;
      if (settlement.retry && typeof settlement.retryDelayMs === "number") {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (cancelled) return;
          const retryAttempt = householdIdentityResolution.captureRetry(
            settlement.retry!,
          );
          if (retryAttempt) void runAttempt(retryAttempt);
        }, settlement.retryDelayMs);
        return;
      }
      // Resolved and terminal-error snapshots both need one React turn so the
      // auth boundary/AppFrame shield can publish the exact new state.
      setHouseholdResolutionRetryEpoch((epoch) => epoch + 1);
    };

    void runAttempt(firstAttempt);

    return () => {
      cancelled = true;
      controller?.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    householdIdentityResolution,
    householdIdentitySnapshot.generation,
    householdForegroundEpoch,
    householdResolutionRetryEpoch,
    householdTransitionController,
  ]);

  const revokeHouseholdAuthority = useCallback(() => {
    const currentClerkIdentity = currentClerkIdentityInputRef.current;
    authIdentityBoundary.observe({
      ...currentClerkIdentity,
      householdId: null,
    });
    householdIdentityResolution.restartResolution();
    setHouseholdResolutionRetryEpoch((epoch) => epoch + 1);
  }, [authIdentityBoundary, householdIdentityResolution]);

  const rejectHouseholdAuthority = useCallback(() => {
    const currentClerkIdentity = currentClerkIdentityInputRef.current;
    authIdentityBoundary.observe({
      ...currentClerkIdentity,
      householdId: null,
    });
    householdIdentityResolution.rejectAuthority();
    setHouseholdResolutionRetryEpoch((epoch) => epoch + 1);
  }, [authIdentityBoundary, householdIdentityResolution]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState) => {
        const wasForeground = householdForegroundRef.current;
        const nextIsForeground = nextState === "active";
        householdForegroundRef.current = nextIsForeground;

        if (!nextIsForeground) {
          const currentResolution = householdIdentityResolution.snapshot();
          const householdAuthorityPending =
            currentResolution.state === "pending" &&
            currentResolution.pendingFor === "household";
          if (
            wasForeground &&
            (temporaryHouseholdForegroundGuardRef.current.hasTemporaryAccess ||
              householdAuthorityPending)
          ) {
            revokeHouseholdAuthority();
          }
          return;
        }

        if (!wasForeground) {
          setHouseholdForegroundEpoch((epoch) => epoch + 1);
        }
      },
    );
    return () => subscription.remove();
  }, [householdIdentityResolution, revokeHouseholdAuthority]);

  useLayoutEffect(() => {
    if (householdIdentitySnapshot.state !== "resolved") {
      householdExpiryRevocation.cancel();
      return;
    }
    householdExpiryRevocation.arm(
      householdIdentityResolution.activeAccessLease(),
      revokeHouseholdAuthority,
    );
    return () => householdExpiryRevocation.cancel();
  }, [
    householdExpiryRevocation,
    householdIdentityResolution,
    householdIdentitySnapshot.generation,
    householdIdentitySnapshot.state,
    revokeHouseholdAuthority,
  ]);

  const rediscoverIdentityScopeFromMembershipList = useCallback(
    (permit: CareAuthIdentityPermit): boolean => {
      if (!authIdentityBoundary.canContinue(permit)) return false;
      if (householdMembershipRediscovery.request(permit)) {
        revokeHouseholdAuthority();
      } else {
        // A persistent contradiction must not spin or restore A. Revoke the
        // exact permit synchronously and leave the root shield actionable.
        rejectHouseholdAuthority();
      }
      return true;
    }, [
      authIdentityBoundary,
      householdMembershipRediscovery,
      rejectHouseholdAuthority,
      revokeHouseholdAuthority,
    ],
  );
  const confirmHouseholdMembershipListHealthy = useCallback(
    (permit: CareAuthIdentityPermit): boolean => {
      if (!authIdentityBoundary.canContinue(permit)) return false;
      householdMembershipRediscovery.confirmHealthy(permit);
      return true;
    }, [authIdentityBoundary, householdMembershipRediscovery],
  );

  const captureCareHouseholdOperationPermit = useCallback(
    () => authIdentityBoundary.captureSignedIn(),
    [authIdentityBoundary],
  );
  const isCareHouseholdOperationPermitCurrent = useCallback(
    (permit: CareAuthIdentityPermit) =>
      authIdentityBoundary.canContinue(permit),
    [authIdentityBoundary],
  );
  const beginCareHouseholdTransition = useCallback(
    (permit: CareAuthIdentityPermit): CareHouseholdTransitionToken | null => {
      if (!authIdentityBoundary.canContinue(permit)) return null;
      const token = householdTransitionController.begin(permit);
      if (!token) return null;

      // Revoke A in this JavaScript turn. The controller is already suspended,
      // so the fresh /api/me resolver cannot start until the exact token is
      // resumed after the Join transport settles.
      const currentClerkIdentity = currentClerkIdentityInputRef.current;
      authIdentityBoundary.observe({
        ...currentClerkIdentity,
        householdId: null,
      });
      if (!householdIdentityResolution.restartResolution()) {
        householdTransitionController.resume(token);
        return null;
      }
      setHouseholdResolutionRetryEpoch((epoch) => epoch + 1);
      return token;
    }, [
      authIdentityBoundary,
      householdIdentityResolution,
      householdTransitionController,
    ],
  );
  const resumeCareHouseholdTransition = useCallback(
    (token: CareHouseholdTransitionToken): boolean => {
      if (!householdTransitionController.resume(token)) return false;
      // Always begin a fresh authority read after an exact or ambiguous Join
      // settlement. Neither the Join response nor the previous A permit is
      // allowed to guess whether server truth is now A, B, or C.
      householdIdentityResolution.restartResolution();
      setHouseholdResolutionRetryEpoch((epoch) => epoch + 1);
      return true;
    }, [householdIdentityResolution, householdTransitionController],
  );

  const runHouseholdBoundRequest = useCallback(
    async <T,>(
      permit: CareAuthIdentityPermit,
      request: () => Promise<T>,
      options: { allowVoid?: boolean } = {},
    ): Promise<T> => {
      if (!authIdentityBoundary.canContinue(permit)) {
        throw new Error("The Care identity changed before the request began.");
      }
      try {
        const result = await request();
        if (!authIdentityBoundary.canContinue(permit)) {
          throw new Error("The Care identity changed while the request was active.");
        }
        assertCareHouseholdSuccessAuthority(
          result,
          permit.householdId,
          options,
        );
        return result;
      } catch (error) {
        // A rejection may arrive after Clerk/session/household authority has
        // already admitted a replacement identity. Old-A transport evidence
        // is not allowed to revoke or otherwise disturb current B authority.
        if (!authIdentityBoundary.canContinue(permit)) {
          throw error;
        }
        try {
          assertCareHouseholdConflictAuthority(error, permit.householdId);
        } catch (authorityError) {
          if (authIdentityBoundary.canContinue(permit)) {
            revokeHouseholdAuthority();
          }
          throw authorityError;
        }
        const status =
          error && typeof error === "object"
            ? (error as { status?: unknown }).status
            : null;
        if (
          status === 412 ||
          status === 428 ||
          isCareHouseholdResponseAuthorityError(error)
        ) {
          if (authIdentityBoundary.canContinue(permit)) {
            revokeHouseholdAuthority();
          }
        }
        throw error;
      }
    },
    [authIdentityBoundary, revokeHouseholdAuthority],
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
    if (observedAuthGenerationRef.current === authIdentity.generation) return;
    observedAuthGenerationRef.current = authIdentity.generation;
    syncOperationIdRef.current += 1;
    syncingRef.current = false;
    setIsSyncing(false);
    entryUpdateQueue.cancelAll();
    entryWriteGenerationRef.current.clear();
    entryAuthPermitRef.current.clear();
    authorizedEntryMutationRef.current = new WeakMap();
    realIdByTemp.current.clear();
    pendingPatch.current.clear();
    cancelledTempEntries.current.clear();
    creatingTempEntries.current.clear();
    createAttemptTokenByTemp.current.clear();
    recentlyDiscardedServerEntryIdsRef.current.clear();
    const recoveredEntries = recoverInterruptedCareEntryMutations(
      entriesRef.current,
    );
    entriesRef.current = recoveredEntries;
    setEntries(recoveredEntries);
    if (initialSyncRetryTimerRef.current) {
      clearTimeout(initialSyncRetryTimerRef.current);
      initialSyncRetryTimerRef.current = null;
    }
    if (
      authIdentity.phase === "signed-in" &&
      authIdentityBoundary.canDisplay(activeDataScopeRef.current)
    ) {
      setAuthSyncRetryEpoch((epoch) => epoch + 1);
    }
  }, [
    authIdentity.generation,
    authIdentity.phase,
    authIdentityBoundary,
    entryUpdateQueue,
  ]);
  const currentScopeLoaded =
    hydrated && authIdentityBoundary.canDisplay(activeDataScopeRef.current);
  const trackedInitialSyncStatus =
    initialSyncReadiness.getStatus(currentScopeLoaded);
  const initialSyncStatus: CareInitialSyncStatus =
    householdIdentitySnapshot.state === "error"
      ? {
          state: "error",
          isSettled: false,
          retryable: householdIdentitySnapshot.retryable,
          message: householdIdentitySnapshot.message,
        }
      : trackedInitialSyncStatus;
  const isInitialSyncSettled = initialSyncStatus.isSettled;

  const retryLocalHydration = useCallback(() => {
    const currentDataScope = authIdentity.dataScope;
    if (
      !currentDataScope ||
      localHydrationFailure?.dataScope !== currentDataScope ||
      localHydrationFailure.generation !==
        hydrationAttemptGenerationRef.current ||
      (hydratedRef.current &&
        authIdentityBoundary.canDisplay(activeDataScopeRef.current)) ||
      ownerWipeInProgressRef.current ||
      !isWriteAdmissionOpen()
    ) {
      return;
    }
    setLocalHydrationFailure(null);
    setStorageWarning(null);
    setLocalHydrationRetryEpoch((epoch) => epoch + 1);
  }, [
    authIdentity.dataScope,
    authIdentityBoundary,
    isWriteAdmissionOpen,
    localHydrationFailure,
  ]);

  // Hydrate instantly from the offline cache so the UI never flashes empty.
  // Failure handling is data-safety-critical: `hydrated` gates the persist
  // effect below, so it must only flip true after a read that actually
  // completed - otherwise the persist effect overwrites intact stored data
  // with in-memory defaults.
  useEffect(() => {
    const dataScope = authIdentity.dataScope;
    if (!dataScope) return;
    const signedInUserId =
      authIdentity.phase === "signed-in" ? authIdentity.userId : null;
    if (
      hydratedRef.current &&
      activeDataScopeRef.current === dataScope
    ) {
      return;
    }
    const hydrationAttempt =
      careHydrationAttemptAuthorityRef.current!.begin(
        isWriteAdmissionOpen(),
      );
    if (!hydrationAttempt) return;
    const hydrationGeneration = hydrationAttemptGenerationRef.current + 1;
    hydrationAttemptGenerationRef.current = hydrationGeneration;
    const previousDataScope = activeDataScopeRef.current;
    const previousSnapshot =
      previousDataScope &&
      hydratedRef.current &&
      !futureCareDocRef.current
      ? {
          doc: docRef.current,
          entries: entriesRef.current,
          serverVersion: versionRef.current,
        }
      : null;
    if (previousDataScope && previousSnapshot) {
      pendingScopeTransitionSnapshotRef.current = {
        dataScope: previousDataScope,
        snapshot: previousSnapshot,
      };
    }

    // Make the old scope undisplayable before any asynchronous drain or read.
    // The auth boundary already revoked its provider permits synchronously.
    activeDataScopeRef.current = null;
    hydratedRef.current = false;
    setHydrated(false);
    syncingRef.current = false;
    syncOperationIdRef.current += 1;
    setIsSyncing(false);
    entryUpdateQueue.cancelAll();
    entryWriteGenerationRef.current.clear();
    entryAuthPermitRef.current.clear();
    authorizedEntryMutationRef.current = new WeakMap();
    realIdByTemp.current.clear();
    pendingPatch.current.clear();
    cancelledTempEntries.current.clear();
    creatingTempEntries.current.clear();
    createAttemptTokenByTemp.current.clear();
    recentlyDiscardedServerEntryIdsRef.current.clear();
    if (initialSyncRetryTimerRef.current) {
      clearTimeout(initialSyncRetryTimerRef.current);
      initialSyncRetryTimerRef.current = null;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const hydrationEraseGeneration = eraseGenerationRef.current;
    const hydrationCanContinue = () =>
      !cancelled &&
      hydrationAttempt.isCurrent() &&
      !ownerWipeInProgressRef.current &&
      eraseGenerationRef.current === hydrationEraseGeneration &&
      authIdentityBoundary.snapshot().dataScope === dataScope;
    if (!hydrationCanContinue()) return;

    interface StagedCareHydration {
      cachedDoc: CareDoc;
      cachedEntries: Entry[];
      cachedServerVersion: number;
      discardedServerEntryIds: string[];
      futureDoc: object | null;
      futureRaw: string | null;
      legacySummary: LegacyImportResult["summary"] | null;
      warning: CareStorageWarning;
      vault: CareIdentityVault;
      cleanupLedgerRaw: string | null;
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
      // Identity switches share the same physical keys, so both serialized
      // writers must finish before the next scope reads and edits their vaults.
      await discardedServerEntryWriter.drain();
      if (!hydrationCanContinue()) {
        throw new LocalDataResetInProgressError();
      }
      const pendingTransition = pendingScopeTransitionSnapshotRef.current;
      if (pendingTransition) {
        writeCareIdentitySlot(
          careIdentityVaultRef.current,
          pendingTransition.dataScope,
          pendingTransition.snapshot,
        );
        const previousWriteGeneration =
          careWriteProtectionRef.current.capture();
        await carePersistenceWriter.enqueue({
          raw: serializeCareIdentityVault(careIdentityVaultRef.current),
          writeGeneration: previousWriteGeneration,
          eraseGeneration: hydrationEraseGeneration,
        });
        if (!hydrationCanContinue()) {
          throw new LocalDataResetInProgressError();
        }
      }

      const [raw, discardedRaw] = await Promise.all([
        removableStorage.getItem(CARE_PRIMARY_LOCAL_DATA_KEY),
        removableStorage.getItem(CARE_PRESERVED_LOCAL_DATA_KEY),
      ]);
      if (!hydrationCanContinue()) {
        throw new LocalDataResetInProgressError();
      }

      let warning: CareStorageWarning = null;
      const cleanupLedger = decodeCareCleanupLedger(discardedRaw, dataScope);
      const discardedServerEntryIds = normalizeDiscardedServerEntryIds(
        cleanupLedger.entryIds,
      );
      if (cleanupLedger.quarantined.length > 0) {
        warning = "reset";
        await persistRecoveryEvidence(
          `${CARE_PRESERVED_LOCAL_DATA_KEY}.recovery`,
          discardedRaw ?? JSON.stringify(cleanupLedger.quarantined),
        );
      }

      const parsedVault = parseCareIdentityVault(raw, dataScope);
      const vault = parsedVault.vault;
      let cachedDoc = getDefaultDoc();
      let cachedEntries: Entry[] = [];
      let cachedServerVersion = 0;
      let futureDoc: object | null = null;
      let futureRaw: string | null = null;
      let primaryIsPristine = true;
      if (parsedVault.corruptRaw) {
        warning = "reset";
        primaryIsPristine = false;
        await persistRecoveryEvidence(
          `${CARE_PRIMARY_LOCAL_DATA_KEY}.recovery`,
          parsedVault.corruptRaw,
        );
      }
      if (vault.quarantine.length > 0) {
        warning = "reset";
      }
      const selectedSnapshot = readCareIdentitySlot<PersistedCareIdentitySnapshot>(
        vault,
        dataScope,
      );
      if (selectedSnapshot) {
        if (isFutureCareDocDataVersion(selectedSnapshot.doc)) {
          futureDoc = selectedSnapshot.doc;
          futureRaw = readCareIdentitySlotRaw(vault, dataScope);
          primaryIsPristine = false;
        } else {
          cachedDoc = mergeDoc(selectedSnapshot.doc);
          const validCachedEntries = selectedSnapshot.entries.filter(
            (entry: unknown): entry is Entry =>
              !!entry && typeof (entry as Entry).id === "string",
          );
          const cachedPrivacy = signedInUserId
            ? partitionCareEntriesForSignedInUser(
                validCachedEntries,
                signedInUserId,
              )
            : { retained: validCachedEntries, quarantined: [] as Entry[] };
          if (cachedPrivacy.quarantined.length > 0) {
            warning = "reset";
            vault.quarantine.push({
              reason:
                "Private Care entries for another or unknown creator were hidden during signed-in recovery.",
              snapshot: {
                dataScope,
                entries: cachedPrivacy.quarantined,
              },
            });
            writeCareIdentitySlot<PersistedCareIdentitySnapshot>(
              vault,
              dataScope,
              {
                ...selectedSnapshot,
                entries: cachedPrivacy.retained,
              },
            );
            const privacyWriteGeneration =
              careWriteProtectionRef.current.capture();
            await carePersistenceWriter.enqueue({
              raw: serializeCareIdentityVault(vault),
              writeGeneration: privacyWriteGeneration,
              eraseGeneration: hydrationEraseGeneration,
            });
            if (!hydrationCanContinue()) {
              throw new LocalDataResetInProgressError();
            }
          }
          const cachedDeletion =
            partitionCachedCareEntriesByDiscardedIdentity(
              cachedPrivacy.retained,
              discardedServerEntryIds,
            );
          if (cachedDeletion.quarantined.length > 0) {
            warning = "reset";
            vault.quarantine.push({
              reason:
                "Care entries covered by this identity's durable deletion ledger were hidden before local recovery.",
              snapshot: {
                dataScope,
                entries: cachedDeletion.quarantined,
              },
            });
            writeCareIdentitySlot<PersistedCareIdentitySnapshot>(
              vault,
              dataScope,
              {
                ...selectedSnapshot,
                entries: cachedDeletion.retained,
              },
            );
            const deletionWriteGeneration =
              careWriteProtectionRef.current.capture();
            await carePersistenceWriter.enqueue({
              raw: serializeCareIdentityVault(vault),
              writeGeneration: deletionWriteGeneration,
              eraseGeneration: hydrationEraseGeneration,
            });
            if (!hydrationCanContinue()) {
              throw new LocalDataResetInProgressError();
            }
          }
          cachedEntries = recoverInterruptedCareEntryMutations(
            cachedDeletion.retained,
          );
          cachedServerVersion = selectedSnapshot.serverVersion;
          const docUpdatedAt = selectedSnapshot.doc.updatedAt;
          primaryIsPristine =
            cachedEntries.length === 0 &&
            (!docUpdatedAt || docUpdatedAt === new Date(0).toISOString());
        }
      }

      let legacySummary: LegacyImportResult["summary"] | null = null;
      if (primaryIsPristine && dataScope === "local") {
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
              const previous = cachedDoc;
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
                ...cachedEntries,
                ...result.entries,
              ];
              writeCareIdentitySlot<PersistedCareIdentitySnapshot>(
                vault,
                dataScope,
                {
                  doc: importedDoc,
                  entries: importedEntries,
                  serverVersion: cachedServerVersion,
                },
              );
              const writeGeneration =
                careWriteProtectionRef.current.capture();
              await carePersistenceWriter.enqueue({
                raw: serializeCareIdentityVault(vault),
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
        vault,
        cleanupLedgerRaw: discardedRaw,
      };
    };

    const applyStagedCareHydration = (staged: StagedCareHydration) => {
      if (!hydrationCanContinue()) return;
      setLocalHydrationFailure((current) =>
        current?.dataScope === dataScope &&
        current.generation === hydrationGeneration
          ? null
          : current,
      );
      careIdentityVaultRef.current = staged.vault;
      pendingScopeTransitionSnapshotRef.current = null;
      cleanupLedgerRawRef.current = staged.cleanupLedgerRaw;
      discardedServerEntryIdsRef.current = new Set(
        staged.discardedServerEntryIds,
      );
      futureCareDocRef.current = null;
      futureCareCacheRawRef.current = null;
      careWriteProtectionRef.current.reset();
      if (staged.futureDoc) {
        preserveFutureCareDoc(staged.futureDoc);
        futureCareCacheRawRef.current = staged.futureRaw;
      } else {
        setStorageWarning(staged.warning);
      }
      docRef.current = staged.cachedDoc;
      docRevisionRef.current += 1;
      entriesRef.current = staged.cachedEntries;
      versionRef.current = staged.cachedServerVersion;
      activeDataScopeRef.current = dataScope;
      setDoc(staged.cachedDoc);
      setEntries(staged.cachedEntries);
      setServerVersion(staged.cachedServerVersion);
      setLegacyImport(staged.legacySummary);
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
        setLocalHydrationFailure({
          dataScope,
          generation: hydrationGeneration,
        });
        setStorageWarning("read-failed");
      }
    };
    void hydrate(true);
    return () => {
      cancelled = true;
      hydrationAttempt.cancel();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    authIdentity.dataScope,
    authIdentity.phase,
    authIdentity.userId,
    authIdentityBoundary,
    discardedServerEntryWriter,
    entryUpdateQueue,
    isWriteAdmissionOpen,
    localHydrationRetryEpoch,
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
      careDocWritesBlocked()
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
    void persistCurrentCareSnapshot();
  }, [
    doc,
    entries,
    serverVersion,
    hydrated,
    operationSettledEpoch,
    isWriteAdmissionOpen,
    careDocWritesBlocked,
    persistCurrentCareSnapshot,
  ]);

  const pushDoc = useCallback(async (next: CareDoc) => {
    if (careDocWritesBlocked() || preserveFutureCareDoc(next)) return;
    const authPermit = authIdentityBoundary.captureSignedIn();
    if (!authPermit || activeDataScopeRef.current !== authPermit.dataScope) {
      return;
    }
    // Guard every post-await state write against an owner wipe: a push (or
    // its conflict-retry) that resolves after reset completion must not
    // write the pre-wipe doc back into memory, disk, or the server.
    const eraseGenerationAtStart = eraseGenerationRef.current;
    const writeGeneration = careWriteProtectionRef.current.capture();
    const canContinue = () =>
      authIdentityBoundary.canContinue(authPermit) &&
      activeDataScopeRef.current === authPermit.dataScope &&
      careWriteCanContinue(writeGeneration);
    if (!canContinue()) return;
    try {
      const res = await runHouseholdBoundRequest(
        authPermit,
        () => putCareState(
          {
            version: versionRef.current,
            doc: sanitizeCareDocForProviderSync(next) as unknown as CareStateEnvelope["doc"],
          },
          expectedHouseholdHeaders(authPermit.householdId),
        ),
      );
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
        ...restoreDeviceOnlyRecordAttachments(
          mergeDoc(envelope.doc as Partial<CareDoc>),
          docRef.current,
        ),
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
        const res = await runHouseholdBoundRequest(
          authPermit,
          () => putCareState(
            {
              version: envelope.version,
              doc: sanitizeCareDocForProviderSync(merged) as unknown as CareStateEnvelope["doc"],
            },
            expectedHouseholdHeaders(authPermit.householdId),
          ),
        );
        if (
          eraseGenerationRef.current !== eraseGenerationAtStart ||
          !canContinue()
        ) return;
        setServerVersion(res.version);
      } catch {
        // Give up; the next full refresh reconciles.
      }
    }
  }, [
    authIdentityBoundary,
    careDocWritesBlocked,
    careWriteCanContinue,
    preserveFutureCareDoc,
  ]);

  const persistEntryCreate = useCallback(
    (tempId: string, entry: Entry) => {
      if (careDocWritesBlocked()) return;
      if (!signedInRef.current) return;
      const authPermit = authIdentityBoundary.captureSignedIn();
      if (!authPermit || activeDataScopeRef.current !== authPermit.dataScope) {
        return;
      }
      const eraseGenerationAtStart = eraseGenerationRef.current;
      const writeGeneration = careWriteProtectionRef.current.capture();
      const identityCanContinue = () =>
        authIdentityBoundary.canContinue(authPermit) &&
        activeDataScopeRef.current === authPermit.dataScope &&
        careWriteCanContinue(writeGeneration);
      if (!identityCanContinue()) return;
      const createWasRetried =
        entry.syncStatus === "failed" || entry.syncStatus === "local";
      const currentEntry = entriesRef.current.find(
        (candidate) => candidate.id === tempId,
      );
      if (!currentEntry) return;
      const createAttemptToken = {};
      createAttemptTokenByTemp.current.set(tempId, createAttemptToken);
      const isCurrentAttempt = () =>
        createAttemptTokenByTemp.current.get(tempId) === createAttemptToken;
      const canContinue = () =>
        identityCanContinue() && isCurrentAttempt();
      const submittedEntry: Entry = {
        ...currentEntry,
        syncStatus: "pending",
        syncError: undefined,
      };
      if (!canContinue()) return;
      creatingTempEntries.current.add(tempId);
      if (!canContinue()) return;
      entriesRef.current = entriesRef.current.map((current) =>
        current.id === tempId ? submittedEntry : current,
      );
      if (!canContinue()) return;
      setEntries((prev) =>
        prev.map((e) => (e.id === tempId ? submittedEntry : e)),
      );
      if (!canContinue()) return;
      return runHouseholdBoundRequest(
        authPermit,
        () => createCareEntry(
          toCreateInput(submittedEntry, tempId),
          expectedHouseholdHeaders(authPermit.householdId),
        ),
      )
        .then(async (created) => {
          if (!canContinue()) return;
          const serverEntry = toEntry(created);
          const deleteAcknowledgedServerEntry = async (
            entryId: string,
          ) => {
            if (!canContinue()) return;
            try {
              await runHouseholdBoundRequest(
                authPermit,
                () => deleteCareEntry(
                  entryId,
                  expectedHouseholdHeaders(authPermit.householdId),
                ),
                { allowVoid: true },
              );
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
            await markServerEntryDiscarded(tempId, authPermit.dataScope);
            if (!canContinue()) return;
            await markServerEntryDiscarded(
              serverEntry.id,
              authPermit.dataScope,
            );
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
              await markServerEntryDiscarded(tempId, authPermit.dataScope);
              if (!canContinue()) return;
              await markServerEntryDiscarded(
                serverEntry.id,
                authPermit.dataScope,
              );
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
            if (!acknowledgement.deleteSucceeded) {
              if (!canContinue()) return;
              await markServerEntryDiscarded(
                acknowledgement.serverEntryId,
                authPermit.dataScope,
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
            if (acknowledgement.deleteSucceeded) {
              await releaseCareEntryRevocationSuppression({
                persistIdentitySlot: async () => {
                  if (!canContinue()) return false;
                  const persisted = await persistCurrentCareSnapshot();
                  return persisted && canContinue();
                },
                clearCleanupLedger: async () => {
                  if (!canContinue()) {
                    throw new Error(
                      "The Care identity changed before cleanup completed.",
                    );
                  }
                  const cleared = await clearDiscardedServerEntry(
                    acknowledgement.serverEntryId,
                    authPermit.dataScope,
                  );
                  if (!cleared) {
                    throw new Error(
                      "The Care cleanup ledger could not be released.",
                    );
                  }
                },
              });
            }
            if (!canContinue()) return;
            queryClient.invalidateQueries({
              queryKey: getListCareEntriesHouseholdQueryKey(
                expectedHouseholdHeaders(authPermit.householdId),
              ),
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
            (createWasRetried ||
              Boolean(queued) ||
              shouldRetryUpdate(acknowledged));
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
            queryKey: getListCareEntriesHouseholdQueryKey(
              expectedHouseholdHeaders(authPermit.householdId),
            ),
          });
          if (needsUpdate) {
            if (!canContinue()) return;
            entryWriteGenerationRef.current.set(real.id, writeGeneration);
            entryAuthPermitRef.current.set(real.id, authPermit);
            authorizedEntryMutationRef.current.set(merged, {
              authPermit,
              writeGeneration,
            });
            if (!canContinue()) return;
            await entryUpdateQueue.enqueueAndWait(real.id, merged);
          }
        })
        .catch(async (error) => {
          if (!canContinue()) return;
          if (
            cancelledTempEntries.current.has(tempId) ||
            eraseGenerationRef.current !== eraseGenerationAtStart
          ) {
            return;
          }
          const revocation = applyExactCareEntryCreateRevocation({
            tempId,
            error,
            canContinue,
            isCurrentAttempt,
            readEntries: () => entriesRef.current,
            clearCreateState(revokedTempId) {
              creatingTempEntries.current.delete(revokedTempId);
              if (isCurrentAttempt()) {
                createAttemptTokenByTemp.current.delete(revokedTempId);
              }
              cancelledTempEntries.current.delete(revokedTempId);
              pendingPatch.current.delete(revokedTempId);
              realIdByTemp.current.delete(revokedTempId);
              entryUpdateQueue.cancel(revokedTempId);
            },
            replaceActiveSlot(retained, revokedEntry) {
              careIdentityVaultRef.current.quarantine.push({
                reason:
                  "A Care entry deleted on another device was blocked from being recreated by this device.",
                snapshot: {
                  dataScope: authPermit.dataScope,
                  entry: revokedEntry,
                },
              });
              entriesRef.current = retained;
              writeCareIdentitySlot<PersistedCareIdentitySnapshot>(
                careIdentityVaultRef.current,
                authPermit.dataScope,
                {
                  doc: docRef.current,
                  entries: retained,
                  serverVersion: versionRef.current,
                },
              );
            },
            publishEntries(retained) {
              setEntries(retained);
            },
            async persistActiveSlot() {
              return persistCareEntryRevocationSuppression({
                persistCleanupLedger: async () => {
                  await markServerEntryDiscarded(
                    tempId,
                    authPermit.dataScope,
                  );
                  return true;
                },
                persistIdentitySlot: persistCurrentCareSnapshot,
              });
            },
            onPersistenceFailure() {
              setCareStorageWarning("save-failed");
            },
          });
          const revocationResult = await revocation;
          if (revocationResult.status !== "not-revoked") return;
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
          if (!identityCanContinue() || !isCurrentAttempt()) return;
          createAttemptTokenByTemp.current.delete(tempId);
          creatingTempEntries.current.delete(tempId);
        });
    },
    [
      authIdentityBoundary,
      clearDiscardedServerEntry,
      careDocWritesBlocked,
      careWriteCanContinue,
      entryUpdateQueue,
      markServerEntryDiscarded,
      persistCurrentCareSnapshot,
      queryClient,
      setCareStorageWarning,
    ],
  );

  const persistEntryUpdate = useCallback(
    (id: string, entry: Entry) => {
      if (careDocWritesBlocked()) return;
      if (!signedInRef.current) {
        entryUpdateQueue.cancel(id);
        return;
      }
      const authPermit = authIdentityBoundary.captureSignedIn();
      if (!authPermit || activeDataScopeRef.current !== authPermit.dataScope) {
        entryUpdateQueue.cancel(id);
        return;
      }
      const writeGeneration = careWriteProtectionRef.current.capture();
      const canContinue = () =>
        authIdentityBoundary.canContinue(authPermit) &&
        activeDataScopeRef.current === authPermit.dataScope &&
        careWriteCanContinue(writeGeneration);
      if (!canContinue()) return;
      const pendingEntry: Entry = {
        ...ensureCareEntrySyncRevision(entry),
        syncStatus: "pending",
        syncError: undefined,
      };
      if (!canContinue()) return;
      entriesRef.current = entriesRef.current.map((current) =>
        current.id === id ? pendingEntry : current,
      );
      if (!canContinue()) return;
      setEntries((prev) =>
        prev.map((current) => (current.id === id ? pendingEntry : current)),
      );
      if (!canContinue()) return;
      entryWriteGenerationRef.current.set(id, writeGeneration);
      entryAuthPermitRef.current.set(id, authPermit);
      authorizedEntryMutationRef.current.set(pendingEntry, {
        authPermit,
        writeGeneration,
      });
      if (!canContinue()) return;
      return entryUpdateQueue.enqueueAndWait(id, pendingEntry);
    },
    [
      authIdentityBoundary,
      careDocWritesBlocked,
      careWriteCanContinue,
      entryUpdateQueue,
    ],
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
    const authPermit = authIdentityBoundary.captureSignedIn();
    if (!authPermit || activeDataScopeRef.current !== authPermit.dataScope) {
      return;
    }
    let initialFailureRetryDelay: number | null | undefined;
    // Capture the erase generation so results from a sync that was in
    // flight when the owner wiped this device are discarded instead of
    // resurrecting the deleted data.
    const eraseGenerationAtStart = eraseGenerationRef.current;
    const writeGeneration = careWriteProtectionRef.current.capture();
    const syncOperationId = syncOperationIdRef.current + 1;
    syncOperationIdRef.current = syncOperationId;
    const canContinue = () =>
      syncOperationIdRef.current === syncOperationId &&
      authIdentityBoundary.canContinue(authPermit) &&
      activeDataScopeRef.current === authPermit.dataScope &&
      careWriteCanContinue(writeGeneration);
    const exactIdentityStillCurrent = () =>
      authIdentityBoundary.canContinue(authPermit) &&
      activeDataScopeRef.current === authPermit.dataScope;
    if (!canContinue()) return;
    const initialSyncLifecycle = beginCareInitialSyncLifecycle({
      readiness: initialSyncReadiness,
      isIdentityCurrent: exactIdentityStillCurrent,
      canApply: canContinue,
      readLocalDoc: () => ({
        revision: docRevisionRef.current,
        doc: docRef.current,
      }),
    });
    const recordInitialSyncSettlement = (
      settlement: CareInitialSyncSettlement | null | undefined,
    ) => {
      if (!settlement || !settlement.accepted) return;
      if (settlement.kind === "failure") {
        initialFailureRetryDelay = settlement.retryDelayMs;
      }
      setInitialSyncReadinessRevision((revision) => revision + 1);
    };
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const entryRefreshPlan = buildCareEntryRefreshPlan({
        // The current API `since` filter is occurrence-based, not a server
        // update cursor, so full refresh remains the safe household sync path.
        hasUpdatedAtCursor: false,
        hasDeleteTombstones: false,
      });
      let fetched: {
        envelope: CareStateEnvelope;
        rows: ApiCareEntry[];
      } | null = null;
      const refreshResult = await runAtomicCareInitialRefresh({
        permit: authPermit,
        canContinue: () => canContinue(),
        fetchDoc: () => runHouseholdBoundRequest(
          authPermit,
          () => getCareState(
            expectedHouseholdHeaders(authPermit.householdId),
          ),
        ),
        fetchEntries: () => runHouseholdBoundRequest(
          authPermit,
          () => listCareEntries(
            expectedHouseholdHeaders(authPermit.householdId),
            entryRefreshPlan.params,
          ),
        ),
        stage: (envelope, rows) => ({ envelope, rows }),
        commit: (staged) => {
          fetched = staged;
        },
      });
      if (refreshResult === "stale" || !fetched || !canContinue()) return;
      const { envelope, rows } = fetched as {
        envelope: CareStateEnvelope;
        rows: ApiCareEntry[];
      };
      if (preserveFutureCareDoc(envelope.doc)) {
        initialSyncLifecycle?.failForFutureSchema(envelope.doc);
        return;
      }
      if (!canContinue()) return;
      const plannedDocRevision = docRevisionRef.current;
      const plan = reconcileCareDocFromServer<CareDoc>({
        localDoc: docRef.current,
        localVersion: versionRef.current,
        serverDoc: envelope.doc as Partial<CareDoc>,
        serverVersion: envelope.version,
        serverUpdatedAt: envelope.updatedAt,
      });
      let nextDoc: CareDoc;
      let nextServerVersion: number;
      let shouldRepushConcurrentLocalDoc = false;
      if (plan.shouldPushLocal) {
        if (!canContinue()) return;
        const res = await runHouseholdBoundRequest(
          authPermit,
          () => putCareState(
            {
              version: plan.version,
              doc: sanitizeCareDocForProviderSync(plan.doc) as unknown as CareStateEnvelope["doc"],
            },
            expectedHouseholdHeaders(authPermit.householdId),
          ),
        );
        // Re-check after the await: a wipe during the PUT must not have its
        // pre-wipe doc restored into memory (and re-persisted) here.
        if (
          eraseGenerationRef.current !== eraseGenerationAtStart ||
          !signedInRef.current ||
          !canContinue()
        ) {
          return;
        }
        if (preserveFutureCareDoc(res.doc)) {
          initialSyncLifecycle?.failForFutureSchema(res.doc);
          return;
        }
        if (!canContinue()) return;
        nextDoc = restoreDeviceOnlyRecordAttachments(
          mergeDoc(res.doc as Partial<CareDoc>),
          docRef.current,
        );
        nextServerVersion = res.version;
      } else {
        nextDoc = restoreDeviceOnlyRecordAttachments(
          mergeDoc(plan.doc as Partial<CareDoc>),
          docRef.current,
        );
        nextServerVersion = plan.version;
      }
      if (
        eraseGenerationRef.current !== eraseGenerationAtStart ||
        !signedInRef.current ||
        !canContinue()
      ) {
        return;
      }
      const suppressedIds = new Set(discardedServerEntryIdsRef.current);
      const discardedIdsReadyForRelease = new Set<string>();
      // Cleanup is deliberately serialized with the durable ledger writes.
      // A temp id is a cancelled create's clientKey; a server id is a known
      // orphan. Both stay opaque and non-renderable until an exact
      // compensating DELETE returns success/not-found. Capped list absence is
      // never deletion proof. A server-id fallback is released only after the
      // clean primary slot is durable.
      for (const discardedId of suppressedIds) {
        if (!signedInRef.current || !canContinue()) return;
        if (discardedId.startsWith("temp_")) {
          try {
            await runHouseholdBoundRequest(
              authPermit,
              () =>
                deleteCareEntryByClientKey(
                  discardedId,
                  expectedHouseholdHeaders(authPermit.householdId),
                ),
              { allowVoid: true },
            );
            if (!canContinue()) return;
            discardedIdsReadyForRelease.add(discardedId);
          } catch {
            // Unlike a capped list response, the exact endpoint commits a
            // creator/household-scoped tombstone even when the row has not
            // appeared yet. Any failure keeps the client key pinned locally
            // so the remote deletion obligation remains retryable.
          }
          continue;
        }
        try {
          if (!canContinue()) return;
          try {
            await runHouseholdBoundRequest(
              authPermit,
              () => deleteCareEntry(
                discardedId,
                expectedHouseholdHeaders(authPermit.householdId),
              ),
              { allowVoid: true },
            );
            if (!canContinue()) return;
          } catch (error) {
            if (!canContinue()) return;
            if (!isNotFound(error)) throw error;
          }
          if (!canContinue()) return;
          discardedIdsReadyForRelease.add(discardedId);
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
      const localPrivacy = partitionCareEntriesForSignedInUser(
        entriesRef.current,
        authPermit.userId,
      );
      const localDeletion =
        partitionCachedCareEntriesByDiscardedIdentity(
          localPrivacy.retained,
          [
            ...suppressedIds,
            ...discardedServerEntryIdsRef.current,
            ...recentlySuppressed,
          ],
        );
      const serverPrivacy = partitionCareEntriesForSignedInUser(
        serverEntries,
        authPermit.userId,
      );
      const mergedEntries = mergeServerAndLocalEntries(
        localDeletion.retained,
        serverPrivacy.retained,
      );
      const retryableCreates = mergedEntries.filter(
        (entry) => shouldRetryCreate(entry) && entry.syncStatus !== "pending",
      );
      const retryableUpdates = mergedEntries.filter(
        (entry) => shouldRetryUpdate(entry),
      );
      if (!canContinue()) return;
      // Commit the authoritative doc/version and entry list as one staged
      // React turn. Until this point neither half has touched rendered state.
      const commitRefs = (safeDoc: CareDoc) => {
        nextDoc = safeDoc;
        docRef.current = safeDoc;
        entriesRef.current = mergedEntries;
        versionRef.current = nextServerVersion;
      };
      if (initialSyncLifecycle) {
        const selection = initialSyncLifecycle.commitDoc(
          nextDoc,
          ({ doc: safeDoc }) => commitRefs(safeDoc),
        );
        if (!selection) return;
        shouldRepushConcurrentLocalDoc =
          selection.preservedConcurrentLocalEdit;
      } else {
        if (docRevisionRef.current !== plannedDocRevision) {
          nextDoc = docRef.current;
          shouldRepushConcurrentLocalDoc = true;
        }
        commitRefs(nextDoc);
      }
      if (!canContinue()) return;
      if (discardedIdsReadyForRelease.size > 0) {
        await releaseCareEntryRevocationSuppression({
          persistIdentitySlot: async () => {
            if (!canContinue()) return false;
            const persisted = await persistCurrentCareSnapshot();
            return persisted && canContinue();
          },
          clearCleanupLedger: async () => {
            for (const discardedId of discardedIdsReadyForRelease) {
              if (!canContinue()) {
                throw new Error(
                  "The Care identity changed before cleanup completed.",
                );
              }
              const cleared = await clearDiscardedServerEntry(
                discardedId,
                authPermit.dataScope,
              );
              if (!cleared) {
                throw new Error(
                  "The Care cleanup ledger could not be released.",
                );
              }
            }
          },
        });
      }
      if (!canContinue()) return;
      if (
        initialSyncLifecycle &&
        (retryableCreates.length > 0 || retryableUpdates.length > 0)
      ) {
        // A capped list omission is not deletion proof. Keep the personal
        // screen shield closed while each exact pending CREATE/PATCH reaches a
        // trusted success or terminal 410/404 and its callback finishes the
        // durable identity-slot/cleanup-ledger work.
        await Promise.all([
          ...retryableCreates.map((entry) => {
            if (!canContinue()) return Promise.resolve();
            return Promise.resolve(persistEntryCreate(entry.id, entry));
          }),
          ...retryableUpdates.map((entry) => {
            if (!canContinue()) return Promise.resolve();
            return Promise.resolve(persistEntryUpdate(entry.id, entry));
          }),
        ]);
        if (!canContinue()) return;

        const liveEntries = entriesRef.current;
        const unresolvedCreate = retryableCreates.some((candidate) =>
          liveEntries.some(
            (entry) =>
              (entry.id === candidate.id ||
                entry.details?.clientKey === candidate.id) &&
              isUnsyncedEntry(entry),
          ),
        );
        const unresolvedUpdate = retryableUpdates.some((candidate) =>
          liveEntries.some(
            (entry) =>
              entry.id === candidate.id && isUnsyncedEntry(entry),
          ),
        );
        if (unresolvedCreate || unresolvedUpdate) {
          throw new Error(
            "Pending Care changes could not be authoritatively reconciled.",
          );
        }

        // Re-read the live refs after terminal callbacks. Publishing the
        // pre-reconciliation merge here would resurrect an exact 404/410 purge
        // for one render. The final combined snapshot must also be durable
        // before initial readiness can admit personal children.
        const persisted = await persistCurrentCareSnapshot();
        if (!persisted || !canContinue()) {
          throw new Error(
            "Reconciled Care changes could not be saved safely on this device.",
          );
        }
      }
      if (!canContinue()) return;
      const committedEntries = entriesRef.current;
      setDoc(nextDoc);
      setEntries(committedEntries);
      setServerVersion(nextServerVersion);
      if (initialSyncLifecycle) {
        const settlement = initialSyncLifecycle.succeed();
        if (settlement.kind !== "success") return;
      }
      if (shouldRepushConcurrentLocalDoc && canContinue()) {
        void pushDoc(nextDoc);
      }
      // Drain only the ids observed by this refresh. Tombstones added after
      // the snapshot remain in the set for the next refresh.
      for (const discardedId of recentlySuppressed) {
        if (!canContinue()) return;
        recentlyDiscardedServerEntryIdsRef.current.delete(discardedId);
      }
      if (!initialSyncLifecycle) {
        retryableCreates.forEach((entry) => {
          if (!canContinue()) return;
          void persistEntryCreate(entry.id, entry);
        });
        retryableUpdates.forEach((entry) => {
          if (!canContinue()) return;
          void persistEntryUpdate(entry.id, entry);
        });
      }
    } catch (error) {
      // Offline or transient failure: keep showing the identity-scoped cache,
      // retry boundedly, then expose a truthful manual retry state.
      // In particular, a future-schema conflict from an already-revoked A
      // request must not protect the global Care store or settle B's sync.
      if (!canContinue()) return;
      const conflictDoc =
        isConflict(error) &&
        error.data &&
        typeof error.data === "object" &&
        "doc" in error.data
          ? (error.data as { doc?: unknown }).doc
          : null;
      if (conflictDoc && preserveFutureCareDoc(conflictDoc)) {
        initialSyncLifecycle?.failForFutureSchema(conflictDoc);
      } else {
        initialSyncLifecycle?.fail(error);
      }
    } finally {
      if (initialSyncLifecycle) {
        recordInitialSyncSettlement(
          initialSyncLifecycle.finish(
            new Error("The initial Care sync exited before an atomic commit."),
          ),
        );
      }
      if (syncOperationIdRef.current === syncOperationId) {
        syncingRef.current = false;
        setIsSyncing(false);
      }
      if (
        typeof initialFailureRetryDelay === "number" &&
        exactIdentityStillCurrent()
      ) {
        if (initialSyncRetryTimerRef.current) {
          clearTimeout(initialSyncRetryTimerRef.current);
        }
        initialSyncRetryTimerRef.current = setTimeout(() => {
          initialSyncRetryTimerRef.current = null;
          if (!exactIdentityStillCurrent()) return;
          setAuthSyncRetryEpoch((epoch) => epoch + 1);
        }, initialFailureRetryDelay);
      } else if (
        syncOperationIdRef.current === syncOperationId &&
        !authIdentityBoundary.canContinue(authPermit) &&
        authIdentityBoundary.snapshot().phase === "signed-in" &&
        authIdentityBoundary.canDisplay(activeDataScopeRef.current)
      ) {
        setAuthSyncRetryEpoch((epoch) => epoch + 1);
      }
    }
  }, [
    authIdentityBoundary,
    careDocWritesBlocked,
    careWriteCanContinue,
    clearDiscardedServerEntry,
    markServerEntryDiscarded,
    persistCurrentCareSnapshot,
    persistEntryCreate,
    persistEntryUpdate,
    preserveFutureCareDoc,
    pushDoc,
    initialSyncReadiness,
  ]);

  useEffect(() => {
    if (
      !currentScopeLoaded ||
      authIdentity.phase !== "signed-in"
    ) return;
    void syncFromServer();
  }, [
    authIdentity.identityKey,
    authIdentity.phase,
    authSyncRetryEpoch,
    currentScopeLoaded,
    operationSettledEpoch,
    syncFromServer,
  ]);

  const retryIdentityScope = useCallback(() => {
    if (householdIdentityResolution.requestRetry()) {
      setHouseholdResolutionRetryEpoch((epoch) => epoch + 1);
    }
  }, [householdIdentityResolution]);

  const retryInitialSync = useCallback(() => {
    if (
      authIdentityBoundary.snapshot().phase === "household-pending" &&
      householdIdentityResolution.snapshot().state === "error"
    ) {
      retryIdentityScope();
      return;
    }
    if (!initialSyncReadiness.requestRetry()) return;
    if (initialSyncRetryTimerRef.current) {
      clearTimeout(initialSyncRetryTimerRef.current);
      initialSyncRetryTimerRef.current = null;
    }
    setInitialSyncReadinessRevision((revision) => revision + 1);
    setAuthSyncRetryEpoch((epoch) => epoch + 1);
  }, [
    authIdentityBoundary,
    householdIdentityResolution,
    initialSyncReadiness,
    retryIdentityScope,
  ]);

  const addEntry = useCallback(
    (entry: Omit<Entry, "id">) => {
      if (careDocWritesBlocked()) return "";
      const tempId = `temp_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const unstampedLocalEntry: Entry = {
        id: tempId,
        ...entry,
        syncStatus: signedInRef.current ? "pending" : "local",
      };
      const currentUserId = authIdentityBoundary.snapshot().userId;
      const localEntry =
        signedInRef.current && currentUserId
          ? stampSignedInPrivateCareEntryCreator(
              unstampedLocalEntry,
              currentUserId,
            )
          : unstampedLocalEntry;
      entriesRef.current = [localEntry, ...entriesRef.current];
      setEntries((prev) => [localEntry, ...prev]);
      if (!signedInRef.current) return tempId;
      persistEntryCreate(tempId, localEntry);
      return tempId;
    },
    [careDocWritesBlocked, persistEntryCreate],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (careDocWritesBlocked()) return false;
      const dataScopeAtStart = activeDataScopeRef.current;
      if (!dataScopeAtStart) return false;
      const authPermit = signedInRef.current
        ? authIdentityBoundary.captureSignedIn()
        : null;
      if (signedInRef.current && !authPermit) return false;
      const writeGeneration = careWriteProtectionRef.current.capture();
      const canContinue = () =>
        activeDataScopeRef.current === dataScopeAtStart &&
        (!authPermit || authIdentityBoundary.canContinue(authPermit)) &&
        careWriteCanContinue(writeGeneration);
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
      } else if (authPermit) {
        // A real-row delete also gets a durable identity-scoped tombstone
        // before the optimistic hide. If auth changes while DELETE is in
        // flight, A's intent remains retryable without ever running under B.
        deletionLedgerIds.push(realId);
      }
      try {
        // Commit cancellation intent before hiding the row. If the create
        // response was lost, a future refresh will suppress/delete the server
        // row by id or by details.clientKey.
        for (const discardedId of deletionLedgerIds) {
          if (!canContinue()) return false;
          await markServerEntryDiscarded(discardedId, dataScopeAtStart);
          if (!canContinue()) return false;
        }
      } catch {
        if (!canContinue()) return false;
        for (const discardedId of deletionLedgerIds) {
          if (!canContinue()) return false;
          await clearDiscardedServerEntry(discardedId, dataScopeAtStart);
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
          await runHouseholdBoundRequest(
            authPermit!,
            () => deleteCareEntry(
              realId,
              expectedHouseholdHeaders(authPermit!.householdId),
            ),
            { allowVoid: true },
          );
          if (!canContinue()) return false;
        } catch (error) {
          if (!canContinue()) return false;
          if (!isNotFound(error)) throw error;
        }
        if (!canContinue()) return false;
        const serverIdsReadyForRelease = deletionLedgerIds.filter(
          (discardedId) => !discardedId.startsWith("temp_"),
        );
        if (serverIdsReadyForRelease.length > 0) {
          await releaseCareEntryRevocationSuppression({
            persistIdentitySlot: async () => {
              if (!canContinue()) return false;
              const persisted = await persistCurrentCareSnapshot();
              return persisted && canContinue();
            },
            clearCleanupLedger: async () => {
              for (const discardedId of serverIdsReadyForRelease) {
                if (!canContinue()) {
                  throw new Error(
                    "The Care identity changed before cleanup completed.",
                  );
                }
                const cleared = await clearDiscardedServerEntry(
                  discardedId,
                  dataScopeAtStart,
                );
                if (!cleared) {
                  throw new Error(
                    "The Care cleanup ledger could not be released.",
                  );
                }
              }
            },
          });
        }
        if (!canContinue()) return false;
        queryClient.invalidateQueries({
          queryKey: getListCareEntriesHouseholdQueryKey(
            expectedHouseholdHeaders(authPermit!.householdId),
          ),
        });
        return true;
      } catch {
        if (!canContinue()) return false;
        // Never restore across an owner wipe: a slow delete that fails after
        // A completed reset must not resurrect the entry into the freshly
        // wiped store.
        if (removed && eraseGenerationRef.current === eraseGenerationAtStart) {
          for (const discardedId of deletionLedgerIds) {
            if (!canContinue()) return false;
            await clearDiscardedServerEntry(discardedId, dataScopeAtStart);
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
      authIdentityBoundary,
      clearDiscardedServerEntry,
      careDocWritesBlocked,
      careWriteCanContinue,
      entryUpdateQueue,
      markServerEntryDiscarded,
      persistCurrentCareSnapshot,
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
      const currentUserId = signedInRef.current
        ? authIdentityBoundary.snapshot().userId
        : null;
      const syncDisposition = decideCareEntryEditSyncDisposition(
        current,
        signedInRef.current,
      );
      if (syncDisposition === "review-required") {
        const unstampedPreserved: Entry = {
          ...prepareCareEntryForOfflineEdit<Entry>(
            current,
            mutablePatch,
          ),
          syncError:
            "Older saved change preserved on this device. Contact support before household sync.",
        };
        const preserved = currentUserId
          ? stampSignedInPrivateCareEntryCreator(
              unstampedPreserved,
              currentUserId,
            )
          : unstampedPreserved;
        entryUpdateQueue.cancel(realId);
        entryWriteGenerationRef.current.delete(realId);
        entryAuthPermitRef.current.delete(realId);
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
      const unstampedMerged: Entry = syncDisposition === "queue"
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
      const merged = currentUserId
        ? stampSignedInPrivateCareEntryCreator(unstampedMerged, currentUserId)
        : unstampedMerged;
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
        entryWriteGenerationRef.current.delete(realId);
        entryAuthPermitRef.current.delete(realId);
        return true;
      }
      const authPermit = authIdentityBoundary.captureSignedIn();
      if (!authPermit || activeDataScopeRef.current !== authPermit.dataScope) {
        entryUpdateQueue.cancel(realId);
        return false;
      }
      entryWriteGenerationRef.current.set(realId, writeGeneration);
      entryAuthPermitRef.current.set(realId, authPermit);
      authorizedEntryMutationRef.current.set(merged, {
        authPermit,
        writeGeneration,
      });
      if (!careWriteCanContinue(writeGeneration)) return false;
      entryUpdateQueue.enqueue(realId, merged);
      return true;
    },
    [
      authIdentityBoundary,
      careDocWritesBlocked,
      careWriteCanContinue,
      entryUpdateQueue,
    ],
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
      docRevisionRef.current += 1;
      docRef.current = next;
      setDoc(next);
      if (signedInRef.current) void pushDoc(next);
      return true;
    },
    [careDocWritesBlocked, pushDoc, setCareStorageWarning],
  );

  const visibleDoc = currentScopeLoaded ? doc : hiddenIdentityDocRef.current;
  const visibleEntries = currentScopeLoaded
    ? entries
    : EMPTY_IDENTITY_SCOPED_ENTRIES;
  const visibleServerVersion = currentScopeLoaded ? serverVersion : 0;
  const state = useMemo<CareState>(
    () => ({
      version: visibleServerVersion,
      dataVersion: visibleDoc.dataVersion,
      createdAt: visibleDoc.createdAt,
      updatedAt: visibleDoc.updatedAt,
      activePetId: visibleDoc.activePetId,
      profile: visibleDoc.profile,
      pets: visibleDoc.pets,
      caregivers: visibleDoc.caregivers,
      householdSetup: visibleDoc.householdSetup,
      launchSupportProfile: visibleDoc.launchSupportProfile,
      launchProviderProfile: visibleDoc.launchProviderProfile,
      reminderNotificationPreferences: visibleDoc.reminderNotificationPreferences,
      dietProfile: visibleDoc.dietProfile,
      routines: visibleDoc.routines,
      goals: visibleDoc.goals,
      records: visibleDoc.records,
      accessPasses: visibleDoc.accessPasses,
      adventureMemories: visibleDoc.adventureMemories,
      reportArtifacts: visibleDoc.reportArtifacts,
      calendarEvents: visibleDoc.calendarEvents,
      entries: visibleEntries,
    }),
    [visibleDoc, visibleEntries, visibleServerVersion],
  );

  const syncOutbox = useMemo(
    () => deriveCareSyncOutbox(visibleEntries),
    [visibleEntries],
  );

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

  const persistCareResetCleanupIntent = useCallback(async (
    commitContext?: CareResetCommitContext,
  ) => {
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
      const dataScope = activeDataScopeRef.current;
      if (!dataScope) {
        throw new Error("The Care identity scope is unavailable for reset.");
      }
      if (!commitContext) {
        throw new Error("The Care reset commit capability is unavailable.");
      }
      const scopedCleanupLedger = scopeCareCleanupEntryIds(
        dataScope,
        cleanupLedger,
      );
      await commitContext.persistCareCleanupLedger(scopedCleanupLedger);
      cleanupLedgerRawRef.current = JSON.stringify(scopedCleanupLedger);
    } else if (commitContext) {
      // Overwrite any quarantined/other-identity ledger bytes during a full
      // local-data reset. An empty scoped cleanup set must not leave another
      // user's opaque identifiers behind on this device.
      await commitContext.persistCareCleanupLedger([]);
      cleanupLedgerRawRef.current = "[]";
    }
    stagedCareResetCleanupLedgerRef.current = cleanupLedger;
    stagedCareResetTempIdsRef.current = new Set(
      tempIdsNeedingRemoteCleanup,
    );
  }, []);

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
    careIdentityVaultRef.current = createCareIdentityVault();
    pendingScopeTransitionSnapshotRef.current = null;
    careWriteProtectionRef.current.reset();
    realIdByTemp.current.clear();
    pendingPatch.current.clear();
    creatingTempEntries.current.clear();
    createAttemptTokenByTemp.current.clear();
    entryWriteGenerationRef.current.clear();
    entryAuthPermitRef.current.clear();
    entryUpdateQueue.cancelAll();
    syncingRef.current = false;
    syncOperationIdRef.current += 1;
    if (initialSyncRetryTimerRef.current) {
      clearTimeout(initialSyncRetryTimerRef.current);
      initialSyncRetryTimerRef.current = null;
    }

    const defaultDoc = getDefaultDoc();
    const emptyEntries: Entry[] = [];
    docRef.current = defaultDoc;
    docRevisionRef.current += 1;
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
        canPrepare: () => hydratedRef.current,
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

  const refreshCare = useCallback(() => {
    if (initialSyncReadiness.getStatus(currentScopeLoaded).state === "error") {
      retryInitialSync();
      return;
    }
    void syncFromServer();
  }, [
    currentScopeLoaded,
    initialSyncReadiness,
    retryInitialSync,
    syncFromServer,
  ]);

  const careMutationsBlocked = careDocWritesBlocked();
  const currentHydrationReadFailed =
    storageWarning === "read-failed" &&
    localHydrationFailure?.dataScope === authIdentity.dataScope &&
    localHydrationFailure.generation ===
      hydrationAttemptGenerationRef.current;
  const visibleStorageWarning = currentScopeLoaded
    ? storageWarning
    : currentHydrationReadFailed
      ? "read-failed"
      : null;
  const visibleLegacyImport = currentScopeLoaded ? legacyImport : null;
  const identityScopeKey =
    authIdentity.phase === "signed-in" ? authIdentity.identityKey : null;
  const identityScopeStatus: CareIdentityScopeStatus =
    {
      state: householdIdentitySnapshot.state,
      retryable: householdIdentitySnapshot.retryable,
      message: householdIdentitySnapshot.message,
    };
  const restartIdentityScope = revokeHouseholdAuthority;
  const renderMutationOrigin = authIdentityBoundary.captureMutationOrigin();
  const addEntryForRender = useCallback(
    (entry: Omit<Entry, "id">) =>
      renderMutationOrigin && authIdentityBoundary.canInvoke(renderMutationOrigin)
        ? addEntry(entry)
        : "",
    [addEntry, authIdentityBoundary, renderMutationOrigin],
  );
  const deleteEntryForRender = useCallback(
    (id: string) =>
      renderMutationOrigin && authIdentityBoundary.canInvoke(renderMutationOrigin)
        ? deleteEntry(id)
        : Promise.resolve(false),
    [authIdentityBoundary, deleteEntry, renderMutationOrigin],
  );
  const updateEntryForRender = useCallback(
    (id: string, patch: Partial<Omit<Entry, "id">>) =>
      Boolean(
        renderMutationOrigin &&
          authIdentityBoundary.canInvoke(renderMutationOrigin) &&
          updateEntry(id, patch),
      ),
    [authIdentityBoundary, renderMutationOrigin, updateEntry],
  );
  const updateCareDocForRender = useCallback(
    (updater: (doc: CareDoc) => CareDoc) =>
      Boolean(
        renderMutationOrigin &&
          authIdentityBoundary.canInvoke(renderMutationOrigin) &&
          updateCareDoc(updater),
      ),
    [authIdentityBoundary, renderMutationOrigin, updateCareDoc],
  );
  const captureCareOperationPermit = useCallback(
    () => authIdentityBoundary.captureMutationOrigin(),
    [authIdentityBoundary],
  );
  const isCareOperationPermitCurrent = useCallback(
    (permit: CareMutationOriginPermit) => authIdentityBoundary.canInvoke(permit),
    [authIdentityBoundary],
  );
  const value = useMemo<CareContextValue>(
    () => ({
      state,
      careMutationsBlocked,
      addEntry: addEntryForRender,
      deleteEntry: deleteEntryForRender,
      updateEntry: updateEntryForRender,
      updateCareDoc: updateCareDocForRender,
      persistCurrentCareSnapshot,
      refresh: refreshCare,
      syncOutbox,
      isLoaded: currentScopeLoaded,
      isSyncing: currentScopeLoaded && isSyncing,
      isInitialSyncSettled,
      initialSyncStatus,
      retryInitialSync,
      retryLocalHydration,
      identityScopeKey,
      identityScopeStatus,
      retryIdentityScope,
      restartIdentityScope,
      rediscoverIdentityScopeFromMembershipList,
      confirmHouseholdMembershipListHealthy,
      captureCareHouseholdOperationPermit,
      isCareHouseholdOperationPermitCurrent,
      beginCareHouseholdTransition,
      resumeCareHouseholdTransition,
      householdOperationController,
      householdOperationSnapshot,
      captureCareOperationPermit,
      isCareOperationPermitCurrent,
      storageWarning: visibleStorageWarning,
      legacyImport: visibleLegacyImport,
    }),
    [
      state,
      careMutationsBlocked,
      addEntryForRender,
      deleteEntryForRender,
      updateEntryForRender,
      updateCareDocForRender,
      persistCurrentCareSnapshot,
      refreshCare,
      syncOutbox,
      currentScopeLoaded,
      isSyncing,
      isInitialSyncSettled,
      initialSyncStatus,
      retryInitialSync,
      retryLocalHydration,
      identityScopeKey,
      identityScopeStatus,
      retryIdentityScope,
      restartIdentityScope,
      rediscoverIdentityScopeFromMembershipList,
      confirmHouseholdMembershipListHealthy,
      captureCareHouseholdOperationPermit,
      isCareHouseholdOperationPermitCurrent,
      beginCareHouseholdTransition,
      resumeCareHouseholdTransition,
      householdOperationController,
      householdOperationSnapshot,
      captureCareOperationPermit,
      isCareOperationPermitCurrent,
      visibleStorageWarning,
      visibleLegacyImport,
    ],
  );

  return <CareContext.Provider value={value}>{children}</CareContext.Provider>;
}

export function useCare() {
  const ctx = useContext(CareContext);
  if (!ctx) throw new Error("useCare must be used within CareProvider");
  return ctx;
}
