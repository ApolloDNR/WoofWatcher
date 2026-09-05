import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
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
import {
  createCareEntry,
  deleteCareEntry,
  getCareState,
  getMe,
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
  clearDiscardedServerEntryDurably,
  cleanupDiscardedServerEntryRows,
  createCareEntryDeleteFence,
  getOrCreateSharedCareSyncWriter,
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
  runCareSyncRequestWithTimeout,
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
  PACK_LEGACY_LOCAL_CLAIM_KEY,
  PACK_OWNER_WIPE_TOMBSTONE,
  prepareMountedPackPersistenceForOwnerWipe,
} from "@/lib/packPersistence";
import { wipeWoofWatcherOwnedDataIfCurrent } from "@/lib/ownedLocalData";
import {
  CARE_ENTRY_SYNC_PROTOCOL,
  CARE_ENTRY_SYNC_REVISION_KEY,
  nextCareEntrySyncRevision,
  readCareEntrySyncRevision,
  type AccessPass,
  type AdventureMemory,
  type CarePassArtifact,
} from "@workspace/care-domain";
import { isClerkEnabledForBuild, useWoofAuth } from "@/lib/auth";
import { notifyDialog } from "@/lib/confirmDialog";
import {
  CARE_DOC_CHECKING_MESSAGE,
  CARE_DOC_NOT_SHARED_MESSAGE,
  CARE_DOC_READ_ONLY_MESSAGE,
  CARE_DOC_RESTORED_MESSAGE,
  canApplyCareDocUpdate,
  degradeCareStateWriteAccess,
  deriveCareStateWriteAccess,
  isCareStateWriteForbidden,
  selectCareStatePermissionFallback,
  type CareDocSyncNotice,
  type CareStateWriteAccess,
} from "@/lib/careStateWriteAccess";
import {
  createAcceptedCareDocFence,
  createCareDocDurabilityCoordinator,
  type CareDocDurabilityCoordinator,
} from "@/lib/careDocDurability";
import {
  AVATAR_LEGACY_LOCAL_CLAIM_KEY,
  type AvatarPersistenceScope,
} from "@/lib/avatarPersistence";
import type { LocalDataEraseResult } from "@/lib/privacy-erase-outcome";
import {
  buildPrincipalStorageKey,
  cacheBelongsToPrincipal,
  householdCacheIsCompatible,
  normalizeStorageUserId,
} from "@/lib/careStateStorage";
import { mergeCareDocThreeWay } from "@/lib/careDocConflictMerge";
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
const HOUSEHOLD_SCOPE_HEADER = "x-woofwatcher-household-id";
const HOUSEHOLD_SCOPE_CHANGED_MESSAGE =
  "Household scope changed. Refresh before retrying.";

function householdScopedRequest(
  householdId: string | null,
  signal?: AbortSignal,
): RequestInit {
  return {
    ...(signal ? { signal } : {}),
    ...(householdId
      ? { headers: { [HOUSEHOLD_SCOPE_HEADER]: householdId } }
      : {}),
  };
}

function isCareStateEnvelope(value: unknown): value is CareStateEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CareStateEnvelope>;
  return (
    typeof candidate.version === "number" &&
    Number.isFinite(candidate.version) &&
    typeof candidate.updatedAt === "string" &&
    !!candidate.doc &&
    typeof candidate.doc === "object" &&
    !Array.isArray(candidate.doc)
  );
}

type DurableCareStorageMutation =
  | { kind: "set"; key: string; value: string }
  | { kind: "remove"; key: string }
  | {
      kind: "wipe";
      preserveLedgerPrefix: string;
      isCurrent: () => boolean;
    };

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
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
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

function mergeDoc(partial: Partial<CareDoc> | null | undefined): CareDoc {
  const merged = { ...getDefaultDoc(), ...(partial ?? {}) };
  const launchSupportProfile =
    merged.launchSupportProfile ?? getDefaultDoc().launchSupportProfile;
  return {
    ...merged,
    activePetId:
      typeof merged.activePetId === "string" && merged.activePetId.trim()
        ? merged.activePetId
        : "primary",
    pets: Array.isArray(merged.pets) ? merged.pets : [],
    accessPasses: Array.isArray(merged.accessPasses) ? merged.accessPasses : [],
    adventureMemories: Array.isArray(merged.adventureMemories)
      ? merged.adventureMemories
      : [],
    reportArtifacts: Array.isArray(merged.reportArtifacts)
      ? merged.reportArtifacts
      : [],
    householdSetup: {
      mode:
        merged.householdSetup?.mode === "join" ||
        merged.householdSetup?.mode === "local"
          ? merged.householdSetup.mode
          : "create",
      householdName:
        typeof merged.householdSetup?.householdName === "string"
          ? merged.householdSetup.householdName
          : "",
      inviteCode:
        typeof merged.householdSetup?.inviteCode === "string"
          ? merged.householdSetup.inviteCode
          : "",
      providerStatus:
        merged.householdSetup?.providerStatus === "pending-provider"
          ? "pending-provider"
          : "local-only",
      updatedAt:
        typeof merged.householdSetup?.updatedAt === "string"
          ? merged.householdSetup.updatedAt
          : undefined,
    },
    launchSupportProfile: {
      supportEmail:
        typeof launchSupportProfile.supportEmail === "string"
          ? launchSupportProfile.supportEmail
          : "",
      privacyPolicyUrl:
        typeof launchSupportProfile.privacyPolicyUrl === "string"
          ? launchSupportProfile.privacyPolicyUrl
          : "",
      termsUrl:
        typeof launchSupportProfile.termsUrl === "string"
          ? launchSupportProfile.termsUrl
          : "",
      refundPolicyApproved: Boolean(launchSupportProfile.refundPolicyApproved),
      veterinaryBoundaryApproved: Boolean(
        launchSupportProfile.veterinaryBoundaryApproved,
      ),
      accountDeletionEscalationApproved: Boolean(
        launchSupportProfile.accountDeletionEscalationApproved,
      ),
      incidentResponseApproved: Boolean(
        launchSupportProfile.incidentResponseApproved,
      ),
      supportLegalReadinessEvidence: normalizeSupportLegalReadinessEvidence(
        launchSupportProfile.supportLegalReadinessEvidence,
      ),
      ownerReviewedAt:
        typeof launchSupportProfile.ownerReviewedAt === "string"
          ? launchSupportProfile.ownerReviewedAt
          : undefined,
      providerStatus:
        launchSupportProfile.providerStatus === "owner-reviewed" ||
        launchSupportProfile.providerStatus === "provider-approved"
          ? launchSupportProfile.providerStatus
          : "local-draft",
    },
    launchProviderProfile: normalizeLaunchProviderProfile(
      merged.launchProviderProfile,
    ),
    reminderNotificationPreferences: normalizeReminderNotificationPreferences(
      merged.reminderNotificationPreferences,
    ),
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
      [CARE_ENTRY_SYNC_REVISION_KEY]: nextCareEntrySyncRevision(entry.details),
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
  const { details: _details, ...topLevelPatch } = mutablePatch;
  return {
    ...topLevelPatch,
    ...(Object.keys(detailPatch).length > 0 ? { details: detailPatch } : {}),
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
      [CARE_ENTRY_SYNC_REVISION_KEY]: nextCareEntrySyncRevision(
        serverEntry.details,
      ),
    },
  };
}

function toCreateInput(
  e: Omit<Entry, "id">,
  clientKey?: string,
): CareEntryInput {
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

export type CareHydrationStatus = "loading" | "ready" | "failed";

interface CareContextValue {
  state: CareState;
  addEntry: (entry: Omit<Entry, "id">) => string | null;
  deleteEntry: (id: string) => Promise<boolean>;
  updateEntry: (id: string, patch: Partial<Omit<Entry, "id">>) => void;
  /** Returns false when a signed-in membership cannot edit the shared doc. */
  updateCareDoc: (
    updater: (doc: CareDoc) => CareDoc,
    options?: { blockedMessage?: string },
  ) => boolean;
  /**
   * Applies the same local/provider update as updateCareDoc, but resolves true
   * only after that exact accepted snapshot reaches this principal's current
   * household storage boundary.
   */
  updateCareDocDurably: (
    updater: (doc: CareDoc) => CareDoc,
    options?: { blockedMessage?: string },
  ) => Promise<boolean>;
  refresh: () => void;
  /**
   * Store-compliance data deletion: resets the live care document and
   * removes every data-bearing WoofWatcher key on this device (care state,
   * avatar art, QA sessions). Only an opaque, non-renderable remote-deletion
   * ledger may remain until provider cleanup is confirmed.
   */
  eraseAllLocalData: () => Promise<LocalDataEraseResult>;
  syncOutbox: CareSyncOutbox;
  isLoaded: boolean;
  hydrationStatus: CareHydrationStatus;
  retryHydration: () => void;
  careScopeRevision: number;
  avatarStorageScope: AvatarPersistenceScope | null;
  isSyncing: boolean;
  careStateWriteAccess: CareStateWriteAccess;
  careDocSyncNotice: CareDocSyncNotice | null;
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

/**
 * Keying the stateful provider by the exact auth principal makes an account
 * switch an immediate unmount/remount boundary. Account A's refs, optimistic
 * mutations, and rendered care never survive into account B's first frame.
 */
export function CareProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useWoofAuth();
  const authenticatedStorageUserId =
    isClerkEnabledForBuild && !isLoaded
      ? undefined
      : isClerkEnabledForBuild && isSignedIn
        ? (normalizeStorageUserId(userId) ?? undefined)
        : null;
  const sessionKey =
    authenticatedStorageUserId === undefined
      ? "authenticated-unverified"
      : authenticatedStorageUserId
        ? `account:${authenticatedStorageUserId}`
        : "local";
  const storageWriter =
    getOrCreateSharedCareSyncWriter<DurableCareStorageMutation>(
      AsyncStorage,
      async (mutation) => {
        if (mutation.kind === "set") {
          await AsyncStorage.setItem(mutation.key, mutation.value);
          return;
        }
        if (mutation.kind === "remove") {
          await AsyncStorage.removeItem(mutation.key);
          return;
        }
        // Resolve and remove inside the serialized wipe. The initiating
        // Care session is re-checked after the queue and key scan, so an old
        // account cannot erase data created by the newly active principal.
        await wipeWoofWatcherOwnedDataIfCurrent({
          storage: AsyncStorage,
          deletionLedgerKeyPrefix: mutation.preserveLedgerPrefix,
          preservedExactKeys: [AVATAR_LEGACY_LOCAL_CLAIM_KEY],
          terminalTombstones: [
            {
              key: PACK_LEGACY_LOCAL_CLAIM_KEY,
              value: PACK_OWNER_WIPE_TOMBSTONE,
            },
          ],
          documentDirectory:
            Platform.OS === "web" ? null : FileSystem.documentDirectory,
          fileSystem: FileSystem,
          isCurrent: mutation.isCurrent,
        });
      },
    );

  return (
    <CareProviderSession
      key={sessionKey}
      storageUserId={authenticatedStorageUserId}
      storageWriter={storageWriter}
    >
      {children}
    </CareProviderSession>
  );
}

function isHouseholdScopeChangedError(error: unknown): boolean {
  const candidate =
    error instanceof CareEntryConflictRetryError ? error.originalError : error;
  return (
    isConflict(candidate) &&
    !!candidate.data &&
    typeof candidate.data === "object" &&
    (candidate.data as { error?: unknown }).error ===
      HOUSEHOLD_SCOPE_CHANGED_MESSAGE
  );
}

function CareProviderSession({
  children,
  storageUserId,
  storageWriter,
}: {
  children: React.ReactNode;
  storageUserId: string | null | undefined;
  storageWriter: SerializedCareSyncWriter<DurableCareStorageMutation>;
}) {
  const {
    isSignedIn,
    isLoaded: clerkLoaded,
    userId: authenticatedUserId,
  } = useWoofAuth();
  const queryClient = useQueryClient();
  const stateStorageKey = buildPrincipalStorageKey(
    STORAGE_KEY,
    storageUserId ?? null,
  );
  const discardedEntryStorageKey = buildPrincipalStorageKey(
    DISCARDED_SERVER_ENTRY_IDS_KEY,
    storageUserId ?? null,
  );

  const [doc, setDoc] = useState<CareDoc>(getDefaultDoc);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [serverVersion, setServerVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const [careScopeRevision, setCareScopeRevision] = useState(0);
  const [householdScopeChanging, setHouseholdScopeChanging] = useState(
    storageUserId !== null,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [careStateWriteAccess, setCareStateWriteAccess] =
    useState<CareStateWriteAccess>(
      isClerkEnabledForBuild ? "signed-out" : "local-only",
    );
  const [careDocSyncNotice, setCareDocSyncNotice] =
    useState<CareDocSyncNotice | null>(null);
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
  const authenticatedUserIdRef = useRef<string | null>(null);
  const careStateWriteAccessRef = useRef<CareStateWriteAccess>(
    isClerkEnabledForBuild ? "signed-out" : "local-only",
  );
  const syncingRef = useRef(false);
  const hydratedRef = useRef(false);
  const sessionActiveRef = useRef(true);
  const persistencePausedRef = useRef(false);
  const storageHouseholdIdRef = useRef<string | null>(null);
  const discardedLedgerHouseholdIdRef = useRef<string | null>(null);
  const householdScopeVerifiedRef = useRef(storageUserId === null);
  const householdScopeChangingRef = useRef(storageUserId !== null);
  const pendingHouseholdArchiveRef = useRef<{
    stateHouseholdId: string | null;
    ledgerHouseholdId: string | null;
    doc: CareDoc;
    entries: Entry[];
    serverVersion: number;
    lastServerCareState: { doc: CareDoc; version: number } | null;
    discardedEntryIds: string[];
  } | null>(null);
  const syncRequestedRef = useRef(false);
  const householdScopeRetryTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const invalidateHouseholdScopeRef = useRef<() => void>(() => {});
  const syncFromServerRef = useRef<() => Promise<void>>(async () => {});
  // Maps optimistic temp ids to their server ids, and queues patches that
  // arrive before a create resolves (post-log quick-note race).
  const realIdByTemp = useRef<Map<string, string>>(new Map());
  const pendingPatch = useRef<Map<string, Partial<Omit<Entry, "id">>>>(
    new Map(),
  );
  const cancelledTempEntries = useRef<Set<string>>(new Set());
  const creatingTempEntries = useRef<Set<string>>(new Set());
  // A cancelled create is hidden until its newly-created server row is
  // successfully removed. This prevents a transient DELETE failure from
  // reviving a care moment on the next refresh in the same session.
  const discardedServerEntryIdsRef = useRef<Set<string>>(new Set());
  const recentlyDiscardedServerEntryIdsRef = useRef<Set<string>>(new Set());
  const entryDeleteFence = useMemo(() => createCareEntryDeleteFence(), []);
  const entryUpdateQueueRef =
    useRef<SerializedCareEntryMutationQueue<Entry> | null>(null);
  // Bumped by eraseAllLocalData so in-flight sync results can't resurrect
  // data the owner just deleted from this device.
  const eraseGenerationRef = useRef(0);
  const householdSessionGenerationRef = useRef(0);
  const householdScopeInvalidationGenerationRef = useRef(0);
  const careDocWriteGenerationRef = useRef(0);
  const careDocMutationRevisionRef = useRef(0);
  const careDocWritesInFlightRef = useRef(0);
  const entryDeletesInFlightRef = useRef(0);
  const entryDeleteGenerationRef = useRef(0);
  const careDocOptimisticBaselineRef = useRef<CareDoc | null>(null);
  const careDocRecoveryInFlightRef = useRef(false);
  const careDocRecoveryGenerationRef = useRef(0);
  const careDocPermissionNoticeAtRef = useRef(0);
  const eraseInFlightRef = useRef<Promise<LocalDataEraseResult> | null>(null);
  const lastServerCareStateRef = useRef<{
    doc: CareDoc;
    version: number;
  } | null>(null);
  const stateWriter = storageWriter;
  const discardedServerEntryWriter = storageWriter;
  const careDocDurabilityRef = useRef<CareDocDurabilityCoordinator | null>(
    null,
  );
  if (!careDocDurabilityRef.current) {
    careDocDurabilityRef.current = createCareDocDurabilityCoordinator({
      currentEpoch: () => storageWriter.currentEpoch(),
      enqueue: (mutation, expectedEpoch) =>
        storageWriter.enqueue(mutation, expectedEpoch),
    });
  }
  const careDocDurability = careDocDurabilityRef.current;

  const markServerEntryDiscarded = useCallback(
    async (entryId: string) => {
      if (!sessionActiveRef.current) return;
      const next = addDiscardedServerEntryId(
        [...discardedServerEntryIdsRef.current],
        entryId,
      );
      discardedServerEntryIdsRef.current = new Set(next);
      recentlyDiscardedServerEntryIdsRef.current.add(entryId);
      try {
        const writerEpoch = discardedServerEntryWriter.currentEpoch();
        const result = await discardedServerEntryWriter.enqueue(
          {
            kind: "set",
            key: discardedEntryStorageKey,
            value: JSON.stringify({
              ownerUserId: storageUserId ?? null,
              householdId: discardedLedgerHouseholdIdRef.current,
              entryIds: next,
            }),
          },
          writerEpoch,
          "critical",
        );
        if (result !== "applied") {
          throw new Error("Cleanup ledger write was superseded.");
        }
      } catch {
        setStorageWarning("save-failed");
        throw new Error("Could not persist cancelled care-entry cleanup.");
      }
    },
    [discardedEntryStorageKey, discardedServerEntryWriter, storageUserId],
  );

  const clearDiscardedServerEntry = useCallback(
    async (entryId: string) => {
      if (!sessionActiveRef.current) return false;
      const cleared = await clearDiscardedServerEntryDurably({
        entryId,
        readEntryIds: () => [...discardedServerEntryIdsRef.current],
        applyEntryIds: (entryIds) => {
          discardedServerEntryIdsRef.current = new Set(entryIds);
        },
        persistEntryIds: async (entryIds) => {
          const writerEpoch = discardedServerEntryWriter.currentEpoch();
          const result = await discardedServerEntryWriter.enqueue(
            entryIds.length > 0
              ? {
                  kind: "set",
                  key: discardedEntryStorageKey,
                  value: JSON.stringify({
                    ownerUserId: storageUserId ?? null,
                    householdId: discardedLedgerHouseholdIdRef.current,
                    entryIds,
                  }),
                }
              : { kind: "remove", key: discardedEntryStorageKey },
            writerEpoch,
            "critical",
          );
          if (result !== "applied") {
            throw new Error("Cleanup ledger write was superseded.");
          }
        },
      });
      if (!cleared) {
        recentlyDiscardedServerEntryIdsRef.current.add(entryId);
        setStorageWarning("save-failed");
      }
      return cleared;
    },
    [discardedEntryStorageKey, discardedServerEntryWriter, storageUserId],
  );

  if (!entryUpdateQueueRef.current) {
    entryUpdateQueueRef.current = createSerializedCareEntryMutationQueue<
      Entry,
      ApiCareEntry
    >({
      mutate: async (entryId, entry, signal) => {
        try {
          return await updateCareEntry(
            entryId,
            toUpdateInput(entry),
            householdScopedRequest(storageHouseholdIdRef.current, signal),
          );
        } catch (error) {
          return retryCareEntryMutationAfterConflict({
            error,
            input: entry,
            isConflict,
            fetchCurrent: async () => {
              const conflictEntry = getCareEntryConflictEntry(error, entryId);
              if (conflictEntry) return conflictEntry;
              const rows = await listCareEntries(
                undefined,
                householdScopedRequest(storageHouseholdIdRef.current, signal),
              );
              const currentServerEntry = rows.find((row) => row.id === entryId);
              return currentServerEntry ? toEntry(currentServerEntry) : null;
            },
            rebase: rebasePendingCareEntryAfterConflict,
            mutate: (rebasedEntry) =>
              updateCareEntry(
                entryId,
                toUpdateInput(rebasedEntry),
                householdScopedRequest(storageHouseholdIdRef.current, signal),
              ),
          });
        }
      },
      onSuccess: (entryId, localEntry, updated) => {
        if (!sessionActiveRef.current) return;
        const synced = {
          ...adoptServerEntry(localEntry, toEntry(updated)),
          pendingSyncPatch: undefined,
        };
        entriesRef.current = entriesRef.current.map((entry) =>
          entry.id === entryId ? synced : entry,
        );
        setEntries((previous) =>
          previous.map((entry) => (entry.id === entryId ? synced : entry)),
        );
        queryClient.invalidateQueries({
          queryKey: getListCareEntriesQueryKey(),
        });
      },
      onFailure: (entryId, localEntry, error) => {
        if (!sessionActiveRef.current) return;
        if (isHouseholdScopeChangedError(error)) {
          // Keep the failed local draft in memory so the verified
          // household-transition path can archive it, but immediately mask
          // the stale household and stop every further mutation.
          invalidateHouseholdScopeRef.current();
        }
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
          previous.map((entry) => (entry.id === entryId ? failedEntry : entry)),
        );
      },
    });
  }
  const entryUpdateQueue = entryUpdateQueueRef.current;
  useLayoutEffect(() => {
    // StrictMode replays effect setup after its simulated cleanup; explicitly
    // reacquire the lease so the live session does not remain fenced off.
    sessionActiveRef.current = true;
    return () => {
      // The keyed parent remounts this entire session on principal changes.
      // Fence every late callback and abort/coalesce mutation work before a
      // newly mounted account can use the shared API token bridge.
      sessionActiveRef.current = false;
      eraseGenerationRef.current += 1;
      careDocWriteGenerationRef.current += 1;
      syncRequestedRef.current = false;
      entryDeletesInFlightRef.current = 0;
      entryDeleteFence.clear();
      if (householdScopeRetryTimerRef.current) {
        clearTimeout(householdScopeRetryTimerRef.current);
        householdScopeRetryTimerRef.current = null;
      }
      entryUpdateQueue.cancelAll();
    };
  }, [entryDeleteFence, entryUpdateQueue]);
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
  const normalizedAuthenticatedUserId =
    typeof authenticatedUserId === "string" ? authenticatedUserId : null;
  const previousAuthenticatedUserId = authenticatedUserIdRef.current;
  signedInRef.current = !!isSignedIn && normalizedAuthenticatedUserId !== null;
  authenticatedUserIdRef.current = normalizedAuthenticatedUserId;
  if (!isSignedIn) {
    careStateWriteAccessRef.current = isClerkEnabledForBuild
      ? "signed-out"
      : "local-only";
  } else if (
    normalizedAuthenticatedUserId === null ||
    previousAuthenticatedUserId !== normalizedAuthenticatedUserId
  ) {
    // Never carry account A's cached allow into account B's first frame.
    careStateWriteAccessRef.current = "checking";
  }

  const applyCareStateWriteAccess = useCallback(
    (next: CareStateWriteAccess) => {
      careStateWriteAccessRef.current = next;
      setCareStateWriteAccess(next);
    },
    [],
  );

  const applyAuthoritativeCareState = useCallback(
    (envelope: CareStateEnvelope) => {
      const authoritativeDoc = mergeDoc(envelope.doc as Partial<CareDoc>);
      lastServerCareStateRef.current = {
        doc: authoritativeDoc,
        version: envelope.version,
      };
      docRef.current = authoritativeDoc;
      versionRef.current = envelope.version;
      setDoc(authoritativeDoc);
      setServerVersion(envelope.version);
    },
    [],
  );

  const presentCareDocBlockedNotice = useCallback(
    (message: string, kind: CareDocSyncNotice["kind"] = "read-only") => {
      setCareDocSyncNotice({ kind, message, assertive: true });
      const now = Date.now();
      if (now - careDocPermissionNoticeAtRef.current < 1500) return;
      careDocPermissionNoticeAtRef.current = now;
      notifyDialog("Shared change not saved", message);
    },
    [],
  );

  const markCareDocNotShared = useCallback(() => {
    const nextAccess = degradeCareStateWriteAccess(
      careStateWriteAccessRef.current,
    );
    applyCareStateWriteAccess(nextAccess);
    setCareDocSyncNotice(
      nextAccess === "restricted"
        ? {
            kind: "read-only",
            message: CARE_DOC_READ_ONLY_MESSAGE,
            assertive: false,
          }
        : {
            kind: "not-shared",
            message: CARE_DOC_NOT_SHARED_MESSAGE,
            assertive: false,
          },
    );
  }, [applyCareStateWriteAccess]);

  const scheduleHouseholdScopeRetry = useCallback(() => {
    if (householdScopeRetryTimerRef.current) return;
    householdScopeRetryTimerRef.current = setTimeout(() => {
      householdScopeRetryTimerRef.current = null;
      if (
        sessionActiveRef.current &&
        hydratedRef.current &&
        signedInRef.current
      ) {
        void syncFromServerRef.current();
      }
    }, 2_000);
  }, []);

  const invalidateHouseholdScope = useCallback(() => {
    if (!sessionActiveRef.current || !signedInRef.current) return;
    householdScopeInvalidationGenerationRef.current += 1;
    householdSessionGenerationRef.current += 1;
    setCareScopeRevision((current) => current + 1);
    careDocWriteGenerationRef.current += 1;
    careDocRecoveryGenerationRef.current += 1;
    careDocRecoveryInFlightRef.current = false;
    entryUpdateQueue.cancelAll();
    householdScopeVerifiedRef.current = false;
    householdScopeChangingRef.current = true;
    persistencePausedRef.current = true;
    setHouseholdScopeChanging(true);
    applyCareStateWriteAccess("checking");
    setCareDocSyncNotice({
      kind: "checking",
      message: CARE_DOC_CHECKING_MESSAGE,
      assertive: true,
    });
    if (syncingRef.current) {
      // A scope failure inside the active sync must not request an immediate
      // trailing microtask. Persistent /me/request disagreement is retried at
      // a bounded cadence so it cannot become a hot network loop.
      syncRequestedRef.current = false;
      scheduleHouseholdScopeRetry();
      return;
    }
    syncRequestedRef.current = true;
    if (
      !syncingRef.current &&
      hydratedRef.current &&
      careDocWritesInFlightRef.current === 0 &&
      entryDeletesInFlightRef.current === 0
    ) {
      void Promise.resolve().then(() => syncFromServerRef.current());
    }
  }, [
    applyCareStateWriteAccess,
    entryUpdateQueue,
    scheduleHouseholdScopeRetry,
  ]);
  invalidateHouseholdScopeRef.current = invalidateHouseholdScope;

  const handleCareStateWriteForbidden = useCallback(
    async (
      error: unknown,
      optimisticBaseline: CareDoc,
      knownEnvelope?: CareStateEnvelope,
    ): Promise<boolean> => {
      if (!isCareStateWriteForbidden(error)) return false;
      if (!sessionActiveRef.current) return true;

      applyCareStateWriteAccess("restricted");
      careDocWriteGenerationRef.current += 1;
      if (careDocRecoveryInFlightRef.current) return true;
      careDocRecoveryInFlightRef.current = true;
      const recoveryGenerationAtStart =
        careDocRecoveryGenerationRef.current + 1;
      careDocRecoveryGenerationRef.current = recoveryGenerationAtStart;

      const eraseGenerationAtStart = eraseGenerationRef.current;
      const householdScopeInvalidationAtStart =
        householdScopeInvalidationGenerationRef.current;
      const authenticatedUserAtStart = authenticatedUserIdRef.current;
      const confirmed = lastServerCareStateRef.current;
      if (knownEnvelope) {
        applyAuthoritativeCareState(knownEnvelope);
      } else if (confirmed) {
        applyAuthoritativeCareState({
          doc: confirmed.doc as unknown as CareStateEnvelope["doc"],
          version: confirmed.version,
          updatedAt: confirmed.doc.updatedAt,
        });
      } else {
        const fallback = selectCareStatePermissionFallback(
          null,
          optimisticBaseline,
        );
        docRef.current = fallback;
        setDoc(fallback);
      }
      presentCareDocBlockedNotice(CARE_DOC_RESTORED_MESSAGE, "restored");

      try {
        // The pre-PUT envelope is only an immediate visual fallback. A 403
        // can race another writer, so always fetch the latest household
        // winner before declaring recovery complete.
        const me = await runCareSyncRequestWithTimeout((signal) =>
          getMe({ signal }),
        );
        const responseUserId = normalizeStorageUserId(me.user?.id);
        const responseHouseholdId = normalizeStorageUserId(me.household?.id);
        if (
          responseUserId !== authenticatedUserAtStart ||
          !responseHouseholdId
        ) {
          throw new Error("Care recovery identity could not be verified.");
        }
        if (
          storageHouseholdIdRef.current &&
          storageHouseholdIdRef.current !== responseHouseholdId
        ) {
          // Membership changed underneath the rejected write. Seal the old
          // household and let the normal /me-first transition archive it;
          // never apply the new household's document into old entries.
          invalidateHouseholdScope();
          return true;
        }
        const envelope = await runCareSyncRequestWithTimeout((signal) =>
          getCareState(
            householdScopedRequest(storageHouseholdIdRef.current, signal),
          ),
        );
        if (
          !sessionActiveRef.current ||
          eraseGenerationRef.current !== eraseGenerationAtStart ||
          householdScopeInvalidationGenerationRef.current !==
            householdScopeInvalidationAtStart ||
          !signedInRef.current ||
          authenticatedUserIdRef.current !== authenticatedUserAtStart
        ) {
          return true;
        }
        applyAuthoritativeCareState(envelope);
        setCareDocSyncNotice({
          kind: "restored",
          message: CARE_DOC_RESTORED_MESSAGE,
          assertive: true,
        });
      } catch (error) {
        if (
          sessionActiveRef.current &&
          eraseGenerationRef.current === eraseGenerationAtStart &&
          householdScopeInvalidationGenerationRef.current ===
            householdScopeInvalidationAtStart &&
          signedInRef.current &&
          authenticatedUserIdRef.current === authenticatedUserAtStart
        ) {
          if (isHouseholdScopeChangedError(error)) {
            invalidateHouseholdScope();
          } else {
            setCareDocSyncNotice({
              kind: "read-only",
              message: `${CARE_DOC_READ_ONLY_MESSAGE} Reconnect and refresh to restore the latest household version.`,
              assertive: true,
            });
          }
        }
      } finally {
        // Owner erase deliberately releases this lock so a fresh generation
        // can recover. A late pre-erase request must not unlock a newer
        // recovery that now owns the same ref.
        if (
          sessionActiveRef.current &&
          eraseGenerationRef.current === eraseGenerationAtStart &&
          authenticatedUserIdRef.current === authenticatedUserAtStart &&
          careDocRecoveryGenerationRef.current === recoveryGenerationAtStart
        ) {
          careDocRecoveryInFlightRef.current = false;
        }
      }
      return true;
    },
    [
      applyAuthoritativeCareState,
      applyCareStateWriteAccess,
      invalidateHouseholdScope,
      presentCareDocBlockedNotice,
    ],
  );

  useEffect(() => {
    if (!clerkLoaded) return;
    const nextAccess: CareStateWriteAccess = !isClerkEnabledForBuild
      ? "local-only"
      : !isSignedIn
        ? "signed-out"
        : "checking";
    applyCareStateWriteAccess(nextAccess);
    if (nextAccess === "local-only" || nextAccess === "signed-out") {
      setCareDocSyncNotice(null);
    }
  }, [
    applyCareStateWriteAccess,
    clerkLoaded,
    isSignedIn,
    normalizedAuthenticatedUserId,
  ]);

  // Hydrate instantly from the offline cache so the UI never flashes empty.
  // Failure handling is data-safety-critical: `hydrated` gates the persist
  // effect below, so it must only flip true after a read that actually
  // completed - otherwise the persist effect overwrites intact stored data
  // with in-memory defaults.
  useEffect(() => {
    if (storageUserId === undefined) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const eraseGenerationAtHydrationStart = eraseGenerationRef.current;
    const isCurrentSession = () =>
      !cancelled &&
      sessionActiveRef.current &&
      eraseGenerationRef.current === eraseGenerationAtHydrationStart;
    let hydrationWriterEpoch = storageWriter.currentEpoch();
    const preserveRecoveryCopy = (key: string, value: string) => {
      void storageWriter
        .enqueue({ kind: "set", key, value }, hydrationWriterEpoch)
        .catch(() => {});
    };

    // Returns whether the store is pristine (no cache, or a cache holding
    // zero entries and a never-edited doc) - the only state the legacy web
    // import below is allowed to write into.
    const applyRaw = (raw: string | null): boolean => {
      if (!raw) return true;
      try {
        const parsed = JSON.parse(raw);
        if (!cacheBelongsToPrincipal(parsed?.ownerUserId, storageUserId)) {
          // Never display a cache whose embedded owner disagrees with the
          // principal-specific key. Keep it as support evidence only.
          preserveRecoveryCopy(
            `${stateStorageKey}.principal-mismatch.recovery`,
            raw,
          );
          return false;
        }
        storageHouseholdIdRef.current = normalizeStorageUserId(
          parsed?.householdId,
        );
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
          cachedEntries = filterDiscardedServerEntries(
            recoverInterruptedCareEntryMutations(
              parsed.entries.filter(
                (entry: unknown): entry is Entry =>
                  !!entry && typeof (entry as Entry).id === "string",
              ),
            ),
            [...discardedServerEntryIdsRef.current],
          );
          entriesRef.current = cachedEntries;
          setEntries(cachedEntries);
        }
        if (typeof parsed?.serverVersion === "number") {
          versionRef.current = parsed.serverVersion;
          setServerVersion(parsed.serverVersion);
        }
        if (
          parsed?.lastServerCareState?.doc &&
          typeof parsed.lastServerCareState.version === "number"
        ) {
          lastServerCareStateRef.current = {
            doc: mergeDoc(parsed.lastServerCareState.doc),
            version: parsed.lastServerCareState.version,
          };
        }
        const docUpdatedAt =
          typeof parsed?.doc?.updatedAt === "string"
            ? parsed.doc.updatedAt
            : "";
        return (
          cachedEntries.length === 0 &&
          (!docUpdatedAt || docUpdatedAt === new Date(0).toISOString())
        );
      } catch {
        // Corrupt cache: preserve the evidence under a recovery key BEFORE
        // the persist effect overwrites the primary key with defaults, and
        // tell the owner instead of silently resetting.
        preserveRecoveryCopy(`${stateStorageKey}.recovery`, raw);
        setStorageWarning("reset");
        return false;
      }
    };
    const applyDiscardedRaw = (raw: string | null) => {
      try {
        const parsed = raw ? JSON.parse(raw) : null;
        const legacyEntryIds = Array.isArray(parsed) ? parsed : null;
        const embeddedOwner = legacyEntryIds ? null : parsed?.ownerUserId;
        if (raw && !cacheBelongsToPrincipal(embeddedOwner, storageUserId)) {
          preserveRecoveryCopy(
            `${discardedEntryStorageKey}.principal-mismatch.recovery`,
            raw,
          );
          return;
        }
        discardedLedgerHouseholdIdRef.current = legacyEntryIds
          ? null
          : normalizeStorageUserId(parsed?.householdId);
        const storedEntryIds = legacyEntryIds ?? parsed?.entryIds ?? [];
        const cachedDiscardedServerEntryIds = normalizeDiscardedServerEntryIds([
          ...storedEntryIds,
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
          preserveRecoveryCopy(`${discardedEntryStorageKey}.recovery`, raw);
        }
        // Preserve any cancellation recorded in this live session even when
        // the older on-disk ledger is corrupt.
        setStorageWarning("reset");
      }
    };
    // One-time adoption of the legacy web PWA's data (see lib/legacyImport).
    // Runs only into a pristine store; the legacy key is left in place as
    // its own backup (owner clear removes data-bearing keys but preserves the
    // deletion-safety ledger).
    const maybeImportLegacyState = async () => {
      if (storageUserId !== null) return;
      try {
        const [flag, legacyRaw] = await Promise.all([
          AsyncStorage.getItem(LEGACY_IMPORT_FLAG_KEY),
          AsyncStorage.getItem(LEGACY_STATE_KEY),
        ]);
        if (!isCurrentSession() || flag || !legacyRaw) return;
        const stamp = (payload: object) =>
          storageWriter
            .enqueue(
              {
                kind: "set",
                key: LEGACY_IMPORT_FLAG_KEY,
                value: JSON.stringify({
                  at: new Date().toISOString(),
                  ...payload,
                }),
              },
              hydrationWriterEpoch,
            )
            .catch(() => {});
        const result = convertLegacyState(parseLegacyState(legacyRaw));
        if (!isCurrentSession()) return;
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
          const importedEntries = [...entriesRef.current, ...result.entries];
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
        AsyncStorage.getItem(stateStorageKey),
        AsyncStorage.getItem(discardedEntryStorageKey),
      ]);
    const hydrate = async (attempt: number) => {
      try {
        // A principal may remount before its previous session's queued
        // snapshot reaches AsyncStorage (B -> A -> B). Read only after that
        // shared writer is idle or the older snapshot can land after this
        // hydration and regress the cache we subsequently persist.
        await storageWriter.drain();
        if (!isCurrentSession()) return;
        hydrationWriterEpoch = storageWriter.currentEpoch();
        const [raw, discardedRaw] = await readCacheAndDeletionLedger();
        if (!isCurrentSession()) return;
        // Both reads finish before provider sync is enabled. Otherwise a
        // refresh can briefly revive a row whose deletion ledger is still
        // waiting on storage.
        applyDiscardedRaw(discardedRaw);
        if (applyRaw(raw)) await maybeImportLegacyState();
        if (!isCurrentSession()) return;
        hydratedRef.current = true;
        setHydrated(true);
        setStorageWarning((current) =>
          current === "read-failed" ? null : current,
        );
      } catch {
        if (!isCurrentSession()) return;
        // The read itself failed (transient storage error). Retry once;
        // if it still fails, stay un-hydrated so persistence is paused for
        // the session - in-memory care still works, but we never clobber
        // the stored data we couldn't read.
        if (attempt === 0) {
          retryTimer = setTimeout(() => void hydrate(1), 1500);
        } else {
          setStorageWarning("read-failed");
        }
      }
    };
    void hydrate(0);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    discardedEntryStorageKey,
    hydrationAttempt,
    stateStorageKey,
    storageUserId,
    storageWriter,
  ]);

  const retryHydration = useCallback(() => {
    if (
      !sessionActiveRef.current ||
      hydratedRef.current ||
      storageUserId === undefined
    ) {
      return;
    }
    setStorageWarning((current) =>
      current === "read-failed" ? null : current,
    );
    setHydrationAttempt((current) => current + 1);
  }, [storageUserId]);

  // Persist the offline cache whenever synced state changes. A failing
  // device store is a data risk in a local-first app, so surface it instead
  // of swallowing it - and clear the warning when writes recover.
  useEffect(() => {
    if (
      !hydrated ||
      !hydratedRef.current ||
      persistencePausedRef.current ||
      householdScopeChangingRef.current ||
      !sessionActiveRef.current ||
      storageUserId === undefined
    ) {
      return;
    }
    const automaticSnapshot = {
      storageKey: stateStorageKey,
      ownerUserId: storageUserId,
      householdId: storageHouseholdIdRef.current,
      doc,
      entries,
      serverVersion,
      lastServerCareState: lastServerCareStateRef.current,
    };
    if (careDocDurability.consumeAutomaticPersistence(automaticSnapshot)) {
      return;
    }
    const writerEpoch = stateWriter.currentEpoch();
    stateWriter
      .enqueue(
        {
          kind: "set",
          key: stateStorageKey,
          value: JSON.stringify({
            ownerUserId: automaticSnapshot.ownerUserId,
            householdId: automaticSnapshot.householdId,
            doc: automaticSnapshot.doc,
            entries: automaticSnapshot.entries,
            serverVersion: automaticSnapshot.serverVersion,
            lastServerCareState: automaticSnapshot.lastServerCareState,
          }),
        },
        writerEpoch,
      )
      .then((result) => {
        if (result !== "applied") return;
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
    householdScopeChanging,
    careDocDurability,
    stateWriter,
    stateStorageKey,
    storageUserId,
  ]);

  const pushDoc = useCallback(
    async (
      next: CareDoc,
      optimisticBaseline: CareDoc,
      writeGeneration: number,
    ) => {
      // Guard every post-await state write against owner wipe, sign-out,
      // account switches, and a newer document edit or permission recovery.
      const eraseGenerationAtStart = eraseGenerationRef.current;
      const householdScopeInvalidationAtStart =
        householdScopeInvalidationGenerationRef.current;
      const authenticatedUserAtStart = authenticatedUserIdRef.current;
      const confirmedBaseAtStart = lastServerCareStateRef.current?.doc ?? null;
      const resultIsCurrent = () =>
        sessionActiveRef.current &&
        eraseGenerationRef.current === eraseGenerationAtStart &&
        householdScopeInvalidationGenerationRef.current ===
          householdScopeInvalidationAtStart &&
        signedInRef.current &&
        authenticatedUserIdRef.current === authenticatedUserAtStart &&
        careDocWriteGenerationRef.current === writeGeneration;
      const restartHouseholdVerification = () =>
        invalidateHouseholdScopeRef.current();
      const preserveConflictAndAdoptRemote = async (
        base: CareDoc | null,
        localDraft: CareDoc,
        remoteEnvelope: CareStateEnvelope,
        conflictPaths: string[],
      ) => {
        const remoteDoc = mergeDoc(remoteEnvelope.doc as Partial<CareDoc>);
        const writerEpoch = stateWriter.currentEpoch();
        let draftPreserved = false;
        try {
          const result = await stateWriter.enqueue(
            {
              kind: "set",
              key: `${stateStorageKey}.care-doc-conflict.${Date.now()}`,
              value: JSON.stringify({
                ownerUserId: storageUserId ?? null,
                householdId: storageHouseholdIdRef.current,
                base,
                local: localDraft,
                remote: remoteDoc,
                conflictPaths,
              }),
            },
            writerEpoch,
          );
          draftPreserved = result === "applied";
        } catch {
          setStorageWarning("save-failed");
        }
        if (!resultIsCurrent()) return;
        // Server truth is always adopted on a same-field conflict. Keeping an
        // unrebased local document would let the next refresh overwrite the
        // winning value, especially if recovery storage is unavailable.
        applyAuthoritativeCareState(remoteEnvelope);
        applyCareStateWriteAccess("allowed");
        presentCareDocBlockedNotice(
          draftPreserved
            ? "Another caregiver changed the same field. Their current version is shown, and your unsent draft was kept in this device's recovery storage."
            : "Another caregiver changed the same field. Their current version is shown, but this device could not preserve your unsent draft.",
          "not-shared",
        );
      };

      try {
        const res = await runCareSyncRequestWithTimeout((signal) =>
          putCareState(
            {
              version: versionRef.current,
              doc: next as unknown as CareStateEnvelope["doc"],
            },
            householdScopedRequest(storageHouseholdIdRef.current, signal),
          ),
        );
        if (!resultIsCurrent()) return;
        applyAuthoritativeCareState(res);
        applyCareStateWriteAccess("allowed");
        setCareDocSyncNotice(null);
      } catch (err) {
        if (!resultIsCurrent()) return;
        if (await handleCareStateWriteForbidden(err, optimisticBaseline)) {
          return;
        }
        if (!isConflict(err)) {
          markCareDocNotShared();
          return;
        }

        // Another device wrote first. Merge only changes that are independent
        // from the last confirmed server base; whole-document local overlay
        // would silently clobber a caregiver's concurrent nested edits.
        const envelope = err.data;
        if (!isCareStateEnvelope(envelope)) {
          // A household-scope guard also uses 409, but deliberately returns
          // no document envelope. Re-run /me instead of treating its error
          // body as a concurrent care document.
          restartHouseholdVerification();
          return;
        }
        const remoteDoc = mergeDoc(envelope.doc as Partial<CareDoc>);
        const localDraft = docRef.current;
        const mergeResult = confirmedBaseAtStart
          ? mergeCareDocThreeWay({
              base: confirmedBaseAtStart,
              local: localDraft,
              remote: remoteDoc,
              updatedAt: new Date().toISOString(),
            })
          : { status: "conflict" as const, conflictPaths: ["/"] };
        if (mergeResult.status === "conflict") {
          await preserveConflictAndAdoptRemote(
            confirmedBaseAtStart,
            localDraft,
            envelope,
            mergeResult.conflictPaths,
          );
          return;
        }
        lastServerCareStateRef.current = {
          doc: remoteDoc,
          version: envelope.version,
        };
        const merged = mergeResult.doc;
        versionRef.current = envelope.version;
        setServerVersion(envelope.version);
        docRef.current = merged;
        setDoc(merged);
        try {
          const res = await runCareSyncRequestWithTimeout((signal) =>
            putCareState(
              {
                version: envelope.version,
                doc: merged as unknown as CareStateEnvelope["doc"],
              },
              householdScopedRequest(storageHouseholdIdRef.current, signal),
            ),
          );
          if (!resultIsCurrent()) return;
          applyAuthoritativeCareState(res);
          applyCareStateWriteAccess("allowed");
          setCareDocSyncNotice(null);
        } catch (retryError) {
          if (!resultIsCurrent()) return;
          if (
            await handleCareStateWriteForbidden(retryError, optimisticBaseline)
          ) {
            return;
          }
          if (isConflict(retryError)) {
            const retryEnvelope = retryError.data;
            if (isCareStateEnvelope(retryEnvelope)) {
              const retryRemoteDoc = mergeDoc(
                retryEnvelope.doc as Partial<CareDoc>,
              );
              const retryLocalDraft = docRef.current;
              const retryMerge = mergeCareDocThreeWay({
                base: remoteDoc,
                local: retryLocalDraft,
                remote: retryRemoteDoc,
                updatedAt: new Date().toISOString(),
              });
              if (retryMerge.status === "conflict") {
                await preserveConflictAndAdoptRemote(
                  remoteDoc,
                  retryLocalDraft,
                  retryEnvelope,
                  retryMerge.conflictPaths,
                );
                return;
              } else {
                lastServerCareStateRef.current = {
                  doc: retryRemoteDoc,
                  version: retryEnvelope.version,
                };
                versionRef.current = retryEnvelope.version;
                setServerVersion(retryEnvelope.version);
                docRef.current = retryMerge.doc;
                setDoc(retryMerge.doc);
              }
            } else {
              restartHouseholdVerification();
              return;
            }
          }
          markCareDocNotShared();
        }
      }
    },
    [
      applyAuthoritativeCareState,
      applyCareStateWriteAccess,
      handleCareStateWriteForbidden,
      markCareDocNotShared,
      presentCareDocBlockedNotice,
      stateStorageKey,
      stateWriter,
      storageUserId,
    ],
  );

  const persistEntryCreate = useCallback(
    (tempId: string, entry: Omit<Entry, "id">) => {
      if (
        !sessionActiveRef.current ||
        !signedInRef.current ||
        !householdScopeVerifiedRef.current
      ) {
        return;
      }
      const eraseGenerationAtStart = eraseGenerationRef.current;
      const authenticatedUserAtStart = authenticatedUserIdRef.current;
      const householdGenerationAtStart = householdSessionGenerationRef.current;
      const sessionIsCurrent = () =>
        sessionActiveRef.current &&
        signedInRef.current &&
        authenticatedUserIdRef.current === authenticatedUserAtStart &&
        householdSessionGenerationRef.current === householdGenerationAtStart;
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
      runCareSyncRequestWithTimeout((signal) =>
        createCareEntry(
          toCreateInput(entry, tempId),
          householdScopedRequest(storageHouseholdIdRef.current, signal),
        ),
      )
        .then(async (created) => {
          if (!sessionIsCurrent()) return;
          const serverEntry = toEntry(created);
          const deleteAcknowledgedServerEntry = async (entryId: string) => {
            if (!sessionIsCurrent()) {
              throw new Error("Care session changed before cleanup.");
            }
            try {
              await runCareSyncRequestWithTimeout((signal) =>
                deleteCareEntry(
                  entryId,
                  householdScopedRequest(storageHouseholdIdRef.current, signal),
                ),
              );
            } catch (error) {
              // The acknowledgement helper intentionally converts delete
              // failures into durable cleanup intent. Observe a membership
              // fence here before that helper swallows the transport error.
              if (isHouseholdScopeChangedError(error)) {
                invalidateHouseholdScopeRef.current();
              }
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
            if (!sessionIsCurrent()) return;
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
          if (!sessionIsCurrent()) return;

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
              if (!sessionIsCurrent()) return;
            }
            acknowledgement =
              await reconcileCreatedCareEntryAcknowledgement<Entry>({
                localEntry,
                serverEntry,
                createWasRetried,
                tempWasCancelled: cancelledTempEntries.current.has(tempId),
                eraseGenerationAtStart,
                currentEraseGeneration: eraseGenerationRef.current,
                deleteServerEntry: deleteAcknowledgedServerEntry,
              });
            if (!sessionIsCurrent()) return;
          }

          if (acknowledgement.status === "discarded") {
            if (!sessionIsCurrent()) return;
            if (acknowledgement.deleteSucceeded) {
              await clearDiscardedServerEntry(acknowledgement.serverEntryId);
            } else {
              await markServerEntryDiscarded(acknowledgement.serverEntryId);
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
          if (!sessionIsCurrent()) return;
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
              if (current.id === tempId || current.id === serverEntry.id) {
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
          entriesRef.current = replaceAcknowledgedEntry(entriesRef.current);
          setEntries((previous) => replaceAcknowledgedEntry(previous));
          queryClient.invalidateQueries({
            queryKey: getListCareEntriesQueryKey(),
          });
          if (needsUpdate) {
            entryUpdateQueue.enqueue(real.id, merged);
          }
        })
        .catch((error) => {
          if (
            !sessionIsCurrent() ||
            cancelledTempEntries.current.has(tempId) ||
            eraseGenerationRef.current !== eraseGenerationAtStart
          ) {
            return;
          }
          if (isHouseholdScopeChangedError(error)) {
            invalidateHouseholdScopeRef.current();
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
      if (!signedInRef.current || !householdScopeVerifiedRef.current) {
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
      !sessionActiveRef.current
    ) {
      return;
    }
    if (
      syncingRef.current ||
      careDocWritesInFlightRef.current > 0 ||
      entryDeletesInFlightRef.current > 0
    ) {
      syncRequestedRef.current = true;
      return;
    }
    syncRequestedRef.current = false;
    // Capture the erase generation so results from a sync that was in
    // flight when the owner wiped this device are discarded instead of
    // resurrecting the deleted data.
    const eraseGenerationAtStart = eraseGenerationRef.current;
    const householdScopeInvalidationAtStart =
      householdScopeInvalidationGenerationRef.current;
    const entryDeleteGenerationAtStart = entryDeleteGenerationRef.current;
    const authenticatedUserAtStart = authenticatedUserIdRef.current;
    const syncIsCurrent = () =>
      sessionActiveRef.current &&
      eraseGenerationRef.current === eraseGenerationAtStart &&
      householdScopeInvalidationGenerationRef.current ===
        householdScopeInvalidationAtStart &&
      entryDeleteGenerationRef.current === entryDeleteGenerationAtStart &&
      signedInRef.current &&
      authenticatedUserIdRef.current === authenticatedUserAtStart;
    let useFreshHouseholdStateOnly = false;
    // Entry provider work is fail-closed until this exact authenticated
    // principal has a fresh, verified household from /me in this sync run.
    let householdScopeReady = false;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      // Document authorization has its own failure boundary. A denied or
      // unavailable document sync must not prevent narrower care-entry
      // refresh/retry work from continuing below.
      try {
        if (careStateWriteAccessRef.current !== "restricted") {
          applyCareStateWriteAccess("checking");
        }
        householdScopeVerifiedRef.current = false;
        const me = await runCareSyncRequestWithTimeout((signal) =>
          getMe({ signal }),
        );
        if (!syncIsCurrent()) return;
        const responseUserId = normalizeStorageUserId(me.user?.id);
        if (
          !authenticatedUserAtStart ||
          responseUserId !== authenticatedUserAtStart
        ) {
          throw new Error("Authenticated principal identity changed.");
        }
        const householdId = normalizeStorageUserId(me.household?.id);
        if (!householdId) {
          throw new Error("Authenticated household identity is unavailable.");
        }
        const previousStateHouseholdId = storageHouseholdIdRef.current;
        const previousLedgerHouseholdId = discardedLedgerHouseholdIdRef.current;
        const scopeMismatch =
          !householdCacheIsCompatible(previousStateHouseholdId, householdId) ||
          !householdCacheIsCompatible(previousLedgerHouseholdId, householdId);

        const pendingHousehold = pendingHouseholdArchiveRef.current;
        if (!scopeMismatch && pendingHousehold) {
          const pendingStateHouseholdId = normalizeStorageUserId(
            pendingHousehold.stateHouseholdId,
          );
          const pendingLedgerHouseholdId = normalizeStorageUserId(
            pendingHousehold.ledgerHouseholdId,
          );
          if (
            !householdCacheIsCompatible(pendingStateHouseholdId, householdId) ||
            !householdCacheIsCompatible(pendingLedgerHouseholdId, householdId)
          ) {
            // An unresolved snapshot must never be interpreted as the live
            // cache of a different verified household.
            throw new Error(
              "Pending household cache identity could not be verified.",
            );
          }

          householdScopeChangingRef.current = true;
          persistencePausedRef.current = true;
          setHouseholdScopeChanging(true);

          // A prior A -> B archive attempt can fail after sealing A, then
          // /me may resolve back to A. Persist the full pending A snapshot to
          // its active keys before restoring it; otherwise the blank sealed
          // state could replace the only copy on process exit.
          const restoredPendingEntries = filterDiscardedServerEntries(
            recoverInterruptedCareEntryMutations(pendingHousehold.entries),
            pendingHousehold.discardedEntryIds,
          );
          const writerEpoch = storageWriter.currentEpoch();
          try {
            const results = await Promise.all([
              storageWriter.enqueue(
                {
                  kind: "set",
                  key: stateStorageKey,
                  value: JSON.stringify({
                    ownerUserId: storageUserId ?? null,
                    householdId,
                    doc: pendingHousehold.doc,
                    entries: restoredPendingEntries,
                    serverVersion: pendingHousehold.serverVersion,
                    lastServerCareState: pendingHousehold.lastServerCareState,
                  }),
                },
                writerEpoch,
              ),
              storageWriter.enqueue(
                {
                  kind: "set",
                  key: discardedEntryStorageKey,
                  value: JSON.stringify({
                    ownerUserId: storageUserId ?? null,
                    householdId,
                    entryIds: pendingHousehold.discardedEntryIds,
                  }),
                },
                writerEpoch,
              ),
            ]);
            if (results.some((result) => result !== "applied")) {
              throw new Error("Pending household cache was superseded.");
            }
          } catch {
            householdScopeReady = false;
            setStorageWarning("save-failed");
            throw new Error("Could not restore the pending household cache.");
          }
          if (!syncIsCurrent()) return;

          pendingHouseholdArchiveRef.current = null;
          docRef.current = pendingHousehold.doc;
          entriesRef.current = restoredPendingEntries;
          versionRef.current = pendingHousehold.serverVersion;
          lastServerCareStateRef.current = pendingHousehold.lastServerCareState;
          discardedServerEntryIdsRef.current = new Set(
            pendingHousehold.discardedEntryIds,
          );
          setDoc(pendingHousehold.doc);
          setEntries(restoredPendingEntries);
          setServerVersion(pendingHousehold.serverVersion);
        }

        if (scopeMismatch) {
          // Capture once, then sever the former household synchronously before
          // any storage await. If archival fails, the sealed snapshot remains
          // in memory for a later retry but is never renderable or uploadable.
          if (!pendingHouseholdArchiveRef.current) {
            pendingHouseholdArchiveRef.current = {
              stateHouseholdId: previousStateHouseholdId,
              ledgerHouseholdId: previousLedgerHouseholdId,
              doc: docRef.current,
              entries: entriesRef.current,
              serverVersion: versionRef.current,
              lastServerCareState: lastServerCareStateRef.current,
              discardedEntryIds: [...discardedServerEntryIdsRef.current],
            };
          }
          const previousHousehold = pendingHouseholdArchiveRef.current;
          if (!previousHousehold) {
            throw new Error("Previous household cache was unavailable.");
          }
          householdScopeChangingRef.current = true;
          persistencePausedRef.current = true;
          setHouseholdScopeChanging(true);
          householdSessionGenerationRef.current += 1;
          setCareScopeRevision((current) => current + 1);
          careDocWriteGenerationRef.current += 1;
          entryUpdateQueue.cancelAll();
          careDocWritesInFlightRef.current = 0;
          careDocOptimisticBaselineRef.current = null;
          careDocRecoveryInFlightRef.current = false;
          careDocRecoveryGenerationRef.current += 1;
          lastServerCareStateRef.current = null;
          realIdByTemp.current.clear();
          pendingPatch.current.clear();
          cancelledTempEntries.current.clear();
          creatingTempEntries.current.clear();
          discardedServerEntryIdsRef.current.clear();
          recentlyDiscardedServerEntryIdsRef.current.clear();
          const defaultDoc = getDefaultDoc();
          docRef.current = defaultDoc;
          entriesRef.current = [];
          versionRef.current = 0;
          setDoc(defaultDoc);
          setEntries([]);
          setServerVersion(0);

          const writerEpoch = storageWriter.currentEpoch();
          try {
            await Promise.all([
              storageWriter.enqueue(
                {
                  kind: "set",
                  key: `${stateStorageKey}.household-archive.${encodeURIComponent(previousHousehold.stateHouseholdId ?? "unknown")}`,
                  value: JSON.stringify({
                    ownerUserId: storageUserId ?? null,
                    householdId: previousHousehold.stateHouseholdId,
                    doc: previousHousehold.doc,
                    entries: previousHousehold.entries,
                    serverVersion: previousHousehold.serverVersion,
                    lastServerCareState: previousHousehold.lastServerCareState,
                  }),
                },
                writerEpoch,
              ),
              storageWriter.enqueue(
                {
                  kind: "set",
                  key: `${discardedEntryStorageKey}.household-archive.${encodeURIComponent(previousHousehold.ledgerHouseholdId ?? "unknown")}`,
                  value: JSON.stringify({
                    ownerUserId: storageUserId ?? null,
                    householdId: previousHousehold.ledgerHouseholdId,
                    entryIds: previousHousehold.discardedEntryIds,
                  }),
                },
                writerEpoch,
              ),
            ]);
          } catch {
            householdScopeReady = false;
            setStorageWarning("save-failed");
            throw new Error("Could not preserve the previous household cache.");
          }
          if (!syncIsCurrent()) return;

          // Restore only an archive whose embedded owner and household both
          // exactly match the freshly verified target. This keeps that
          // household's offline outbox available when the owner returns.
          const targetArchiveSuffix = encodeURIComponent(householdId);
          const [targetStateRaw, targetLedgerRaw] = await Promise.all([
            AsyncStorage.getItem(
              `${stateStorageKey}.household-archive.${targetArchiveSuffix}`,
            ),
            AsyncStorage.getItem(
              `${discardedEntryStorageKey}.household-archive.${targetArchiveSuffix}`,
            ),
          ]);
          if (!syncIsCurrent()) return;
          let targetDiscardedIds: string[] = [];
          try {
            const targetLedger = targetLedgerRaw
              ? JSON.parse(targetLedgerRaw)
              : null;
            if (
              targetLedger &&
              cacheBelongsToPrincipal(
                targetLedger.ownerUserId,
                storageUserId ?? null,
              ) &&
              normalizeStorageUserId(targetLedger.householdId) === householdId
            ) {
              targetDiscardedIds = normalizeDiscardedServerEntryIds(
                targetLedger.entryIds ?? [],
              );
            }
          } catch {
            setStorageWarning("reset");
          }

          let restoredTargetState = false;
          let targetDoc = defaultDoc;
          let targetEntries: Entry[] = [];
          let targetVersion = 0;
          let targetLastServer: { doc: CareDoc; version: number } | null = null;
          try {
            const targetState = targetStateRaw
              ? JSON.parse(targetStateRaw)
              : null;
            if (
              targetState?.doc &&
              cacheBelongsToPrincipal(
                targetState.ownerUserId,
                storageUserId ?? null,
              ) &&
              normalizeStorageUserId(targetState.householdId) === householdId
            ) {
              targetDoc = mergeDoc(targetState.doc);
              targetEntries = filterDiscardedServerEntries(
                recoverInterruptedCareEntryMutations(
                  Array.isArray(targetState.entries)
                    ? targetState.entries.filter(
                        (entry: unknown): entry is Entry =>
                          !!entry && typeof (entry as Entry).id === "string",
                      )
                    : [],
                ),
                targetDiscardedIds,
              );
              targetVersion =
                typeof targetState.serverVersion === "number"
                  ? targetState.serverVersion
                  : 0;
              if (
                targetState.lastServerCareState?.doc &&
                typeof targetState.lastServerCareState.version === "number"
              ) {
                targetLastServer = {
                  doc: mergeDoc(targetState.lastServerCareState.doc),
                  version: targetState.lastServerCareState.version,
                };
              }
              restoredTargetState = true;
            }
          } catch {
            setStorageWarning("reset");
          }

          useFreshHouseholdStateOnly = !restoredTargetState;
          pendingHouseholdArchiveRef.current = null;
          docRef.current = targetDoc;
          entriesRef.current = targetEntries;
          versionRef.current = targetVersion;
          lastServerCareStateRef.current = targetLastServer;
          discardedServerEntryIdsRef.current = new Set(targetDiscardedIds);
          storageHouseholdIdRef.current = householdId;
          discardedLedgerHouseholdIdRef.current = householdId;
          setDoc(targetDoc);
          setEntries(targetEntries);
          setServerVersion(targetVersion);
        }
        if (!scopeMismatch) {
          storageHouseholdIdRef.current = householdId;
          discardedLedgerHouseholdIdRef.current = householdId;
        }
        householdScopeVerifiedRef.current = true;
        householdScopeReady = true;
        if (householdScopeRetryTimerRef.current) {
          clearTimeout(householdScopeRetryTimerRef.current);
          householdScopeRetryTimerRef.current = null;
        }
        const access = deriveCareStateWriteAccess(me, authenticatedUserAtStart);
        // Keep a fresh allow in `checking` until its care-state refresh/PUT
        // completes, preventing a user edit from racing this reconciliation.
        if (access !== "allowed") applyCareStateWriteAccess(access);

        const envelope = await runCareSyncRequestWithTimeout((signal) =>
          getCareState(
            householdScopedRequest(storageHouseholdIdRef.current, signal),
          ),
        );
        if (!syncIsCurrent()) return;
        if (useFreshHouseholdStateOnly) {
          storageHouseholdIdRef.current = householdId;
          discardedLedgerHouseholdIdRef.current = householdId;
        }
        const writeAccess =
          access === "allowed"
            ? "allowed"
            : access === "restricted"
              ? "restricted"
              : "unverified";
        const plan = reconcileCareDocFromServer<CareDoc>({
          localDoc: docRef.current,
          localVersion: versionRef.current,
          serverDoc: envelope.doc as Partial<CareDoc>,
          serverVersion: envelope.version,
          serverUpdatedAt: envelope.updatedAt,
          // A known household switch is always server-wins. The archived
          // former cache is recoverable but can never seed this household.
          writeAccess: useFreshHouseholdStateOnly ? "restricted" : writeAccess,
        });

        if (plan.shouldPushLocal) {
          // Seed the rollback point from the GET, then use the same 409
          // one-retry and 403 fresh-recovery path as interactive edits.
          const serverDoc = mergeDoc(envelope.doc as Partial<CareDoc>);
          const localDocToPush = mergeDoc(plan.doc as Partial<CareDoc>);
          lastServerCareStateRef.current = {
            doc: serverDoc,
            version: envelope.version,
          };
          versionRef.current = envelope.version;
          setServerVersion(envelope.version);
          const writeGeneration = careDocWriteGenerationRef.current + 1;
          careDocWriteGenerationRef.current = writeGeneration;
          await pushDoc(localDocToPush, serverDoc, writeGeneration);
        } else if (plan.status === "keep-local-unverified") {
          // Retain a newer local draft without ever uploading it under an
          // unverified identity/capability. The server envelope remains the
          // safe rollback point if a later authoritative 403 arrives.
          lastServerCareStateRef.current = {
            doc: mergeDoc(envelope.doc as Partial<CareDoc>),
            version: envelope.version,
          };
          versionRef.current = envelope.version;
          setServerVersion(envelope.version);
          setCareDocSyncNotice({
            kind: "checking",
            message: CARE_DOC_CHECKING_MESSAGE,
            assertive: false,
          });
        } else {
          applyAuthoritativeCareState(envelope);
          if (access === "allowed") {
            applyCareStateWriteAccess("allowed");
          }
          setCareDocSyncNotice(
            access === "restricted"
              ? {
                  kind: "read-only",
                  message: CARE_DOC_READ_ONLY_MESSAGE,
                  assertive: false,
                }
              : null,
          );
        }
      } catch (error) {
        if (syncIsCurrent() && isHouseholdScopeChangedError(error)) {
          householdScopeReady = false;
          invalidateHouseholdScopeRef.current();
        } else if (syncIsCurrent()) {
          const nextAccess = degradeCareStateWriteAccess(
            careStateWriteAccessRef.current,
          );
          applyCareStateWriteAccess(nextAccess);
          setCareDocSyncNotice(
            nextAccess === "restricted"
              ? {
                  kind: "read-only",
                  message: CARE_DOC_READ_ONLY_MESSAGE,
                  assertive: false,
                }
              : {
                  kind: "checking",
                  message: CARE_DOC_CHECKING_MESSAGE,
                  assertive: false,
                },
          );
        }
      }

      if (!householdScopeReady) {
        // Authenticated caches stay masked until an exact /me response is
        // available. Retry with a bounded delay instead of leaving an offline
        // launch permanently frozen or spinning a tight request loop.
        if (syncIsCurrent()) {
          syncRequestedRef.current = false;
          scheduleHouseholdScopeRetry();
        }
        return;
      }
      if (!syncIsCurrent()) return;

      if (useFreshHouseholdStateOnly) {
        // The former entries and tombstones are durable in the archive now;
        // expose only the new household while its authoritative list loads.
        entriesRef.current = [];
        setEntries([]);
        const writerEpoch = storageWriter.currentEpoch();
        await storageWriter
          .enqueue(
            {
              kind: "set",
              key: discardedEntryStorageKey,
              value: JSON.stringify({
                ownerUserId: storageUserId ?? null,
                householdId: storageHouseholdIdRef.current,
                entryIds: [...discardedServerEntryIdsRef.current],
              }),
            },
            writerEpoch,
          )
          .catch(() => setStorageWarning("save-failed"));
        if (!syncIsCurrent()) return;
      }

      const entryRefreshPlan = buildCareEntryRefreshPlan({
        // The current API `since` filter is occurrence-based, not a server
        // update cursor, so full refresh remains the safe household sync path.
        hasUpdatedAtCursor: false,
        hasDeleteTombstones: false,
      });
      const rows = await runCareSyncRequestWithTimeout((signal) =>
        listCareEntries(
          entryRefreshPlan.params,
          householdScopedRequest(storageHouseholdIdRef.current, signal),
        ),
      );
      if (!syncIsCurrent()) return;
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
        if (!syncIsCurrent()) return;
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
              if (!syncIsCurrent()) {
                throw new Error("Care session changed before cleanup.");
              }
              try {
                await runCareSyncRequestWithTimeout((signal) =>
                  deleteCareEntry(
                    entryId,
                    householdScopedRequest(
                      storageHouseholdIdRef.current,
                      signal,
                    ),
                  ),
                );
              } catch (error) {
                if (isHouseholdScopeChangedError(error)) {
                  householdScopeReady = false;
                  invalidateHouseholdScopeRef.current();
                }
                if (!isNotFound(error)) throw error;
              }
            },
            clearDiscarded: async (entryId) => {
              if (!(await clearDiscardedServerEntry(entryId))) {
                throw new Error("Could not clear the cleanup tombstone.");
              }
            },
            shouldContinue: () => syncIsCurrent() && householdScopeReady,
          });
          if (!householdScopeReady) return;
          continue;
        }
        if (!rowsById.has(discardedId)) {
          await clearDiscardedServerEntry(discardedId);
          if (!syncIsCurrent()) return;
          continue;
        }
        try {
          if (!syncIsCurrent()) return;
          try {
            await runCareSyncRequestWithTimeout((signal) =>
              deleteCareEntry(
                discardedId,
                householdScopedRequest(storageHouseholdIdRef.current, signal),
              ),
            );
          } catch (error) {
            if (!isNotFound(error)) throw error;
          }
          if (!syncIsCurrent()) return;
          await clearDiscardedServerEntry(discardedId);
        } catch (error) {
          if (isHouseholdScopeChangedError(error)) {
            householdScopeReady = false;
            invalidateHouseholdScopeRef.current();
            return;
          }
          // Keep suppressing the cancelled create and retry next refresh.
        }
      }
      if (!syncIsCurrent()) return;
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
        useFreshHouseholdStateOnly ? [] : entriesRef.current,
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
      const retryableUpdates = mergedEntries.filter((entry) =>
        shouldRetryUpdate(entry),
      );
      retryableCreates.forEach((entry) => {
        persistEntryCreate(entry.id, entry);
      });
      retryableUpdates.forEach((entry) => {
        persistEntryUpdate(entry.id, entry);
      });
      // A household transition stays visually and mutationally sealed until
      // both the authoritative document and entry list have committed.
      persistencePausedRef.current = false;
      householdScopeChangingRef.current = false;
      setHouseholdScopeChanging(false);
    } catch (error) {
      // Entry sync already carries per-entry retry state. Keep the cached
      // list; document access/status was handled independently above.
      // Once /me established the exact target household, it is safe to show
      // that target's restored archive (or blank local fallback) even if a
      // provider read failed. Only archive/identity failure remains sealed.
      if (syncIsCurrent() && isHouseholdScopeChangedError(error)) {
        householdScopeReady = false;
        invalidateHouseholdScopeRef.current();
      } else if (syncIsCurrent() && householdScopeReady) {
        persistencePausedRef.current = false;
        householdScopeChangingRef.current = false;
        setHouseholdScopeChanging(false);
      }
    } finally {
      syncingRef.current = false;
      const runTrailingSync =
        syncRequestedRef.current &&
        sessionActiveRef.current &&
        hydratedRef.current &&
        signedInRef.current;
      syncRequestedRef.current = false;
      if (runTrailingSync) {
        void Promise.resolve().then(() => syncFromServerRef.current());
      } else if (sessionActiveRef.current) {
        setIsSyncing(false);
      }
    }
  }, [
    clearDiscardedServerEntry,
    applyAuthoritativeCareState,
    applyCareStateWriteAccess,
    markServerEntryDiscarded,
    markCareDocNotShared,
    persistEntryCreate,
    persistEntryUpdate,
    pushDoc,
    scheduleHouseholdScopeRetry,
    stateStorageKey,
    discardedEntryStorageKey,
    storageUserId,
    storageWriter,
  ]);

  syncFromServerRef.current = syncFromServer;

  useEffect(() => {
    if (!hydrated || !clerkLoaded || !isSignedIn) return;
    void syncFromServer();
  }, [authenticatedUserId, clerkLoaded, hydrated, isSignedIn, syncFromServer]);

  const addEntry = useCallback(
    (entry: Omit<Entry, "id">) => {
      if (
        !hydratedRef.current ||
        householdScopeChangingRef.current ||
        storageUserId === undefined
      ) {
        presentCareDocBlockedNotice(
          "Household care is still loading. Wait for the current care timeline before logging a new event.",
          "checking",
        );
        return null;
      }
      const tempId = `temp_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const canSyncEntry =
        signedInRef.current &&
        householdScopeVerifiedRef.current &&
        !householdScopeChangingRef.current;
      const localEntry: Entry = {
        id: tempId,
        ...entry,
        syncStatus: canSyncEntry ? "pending" : "local",
      };
      entriesRef.current = [localEntry, ...entriesRef.current];
      setEntries((prev) => [localEntry, ...prev]);
      if (!canSyncEntry) return tempId;
      persistEntryCreate(tempId, entry);
      return tempId;
    },
    [persistEntryCreate, presentCareDocBlockedNotice, storageUserId],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (
        !sessionActiveRef.current ||
        !hydratedRef.current ||
        householdScopeChangingRef.current ||
        storageUserId === undefined
      ) {
        presentCareDocBlockedNotice(
          "Household care is still loading. Wait for the current care timeline before deleting an event.",
          "checking",
        );
        return false;
      }
      const authenticatedUserAtStart = authenticatedUserIdRef.current;
      const householdGenerationAtStart = householdSessionGenerationRef.current;
      const sessionIsCurrent = () =>
        sessionActiveRef.current &&
        authenticatedUserIdRef.current === authenticatedUserAtStart &&
        householdSessionGenerationRef.current === householdGenerationAtStart;
      const eraseGenerationAtStart = eraseGenerationRef.current;
      const deleteOwnerIsCurrent = () =>
        sessionActiveRef.current &&
        authenticatedUserIdRef.current === authenticatedUserAtStart &&
        eraseGenerationRef.current === eraseGenerationAtStart;
      const realId = realIdByTemp.current.get(id) ?? id;
      const removed = entriesRef.current.find(
        (entry) => entry.id === realId || entry.id === id,
      );
      const cancelledClientKey =
        typeof removed?.details?.clientKey === "string" &&
        removed.details.clientKey.startsWith("temp_")
          ? removed.details.clientKey
          : undefined;
      const deleteFenceLease = entryDeleteFence.tryAcquire([
        id,
        realId,
        ...(cancelledClientKey ? [cancelledClientKey] : []),
      ]);
      if (!deleteFenceLease) return false;
      entryUpdateQueue.cancel(realId);
      if (id !== realId) entryUpdateQueue.cancel(id);
      if (cancelledClientKey) entryUpdateQueue.cancel(cancelledClientKey);
      entryDeleteGenerationRef.current += 1;
      entryDeletesInFlightRef.current += 1;
      if (syncingRef.current) syncRequestedRef.current = true;
      try {
        // A quick undo can arrive after the optimistic create already swapped
        // its temp id for the server id; resolve through the mapping so the
        // right row is removed locally AND on the server.
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
        } else {
          // Every acknowledged delete gets a durable server-id tombstone before
          // the row is hidden. It suppresses a concurrent stale list response
          // and lets refresh finish the delete after a transient failure.
          deletionLedgerIds.push(realId);
          if (cancelledClientKey) {
            // A refresh may already have migrated the temp row onto its server
            // id before the original CREATE callback resolves. Cancel by both
            // identities so that late callback cannot revive the entry.
            deletionLedgerIds.push(cancelledClientKey);
            cancelledTempEntries.current.add(cancelledClientKey);
            pendingPatch.current.delete(cancelledClientKey);
          }
        }
        try {
          // Commit cancellation intent before hiding the row. If the create
          // response was lost, a future refresh will suppress/delete the server
          // row by id or by details.clientKey.
          for (const discardedId of deletionLedgerIds) {
            await markServerEntryDiscarded(discardedId);
            if (!sessionIsCurrent()) return false;
          }
        } catch {
          // A partially written ledger is safer than clearing deletion intent
          // after identity may have changed. The row is still visible because
          // optimistic removal has not started; refresh can retry cleanup.
          return false;
        }
        if (!sessionIsCurrent()) return false;
        entryUpdateQueue.cancel(realId);
        // Computed outside the updater (see updateEntry): a deferred updater
        // left `removed` undefined, silently losing the failure-restore.
        entriesRef.current = entriesRef.current.filter(
          (e) => e.id !== realId && e.id !== id,
        );
        setEntries((prev) =>
          prev.filter((e) => e.id !== realId && e.id !== id),
        );
        if (
          !signedInRef.current ||
          !householdScopeVerifiedRef.current ||
          householdScopeChangingRef.current ||
          realId.startsWith("temp_")
        ) {
          return true;
        }
        try {
          if (!sessionIsCurrent()) return false;
          try {
            await runCareSyncRequestWithTimeout((signal) =>
              deleteCareEntry(
                realId,
                householdScopedRequest(storageHouseholdIdRef.current, signal),
              ),
            );
          } catch (error) {
            if (!isNotFound(error)) throw error;
          }
          for (const discardedId of deletionLedgerIds) {
            if (!sessionIsCurrent()) return false;
            if (!discardedId.startsWith("temp_")) {
              await clearDiscardedServerEntry(discardedId);
            }
          }
          queryClient.invalidateQueries({
            queryKey: getListCareEntriesQueryKey(),
          });
          // A list request that started before DELETE may have committed its
          // stale row while the provider call was pending. Remove it again;
          // the recent tombstone also filters any response that lands later.
          entriesRef.current = entriesRef.current.filter(
            (entry) => entry.id !== realId && entry.id !== id,
          );
          setEntries((previous) =>
            previous.filter((entry) => entry.id !== realId && entry.id !== id),
          );
          return true;
        } catch (error) {
          if (isHouseholdScopeChangedError(error)) {
            // Restore the optimistic removal synchronously before invalidation
            // can start the /me transition in a microtask. The old household
            // snapshot can then archive the complete local draft without ever
            // rendering it under the newly verified household.
            if (removed && deleteOwnerIsCurrent()) {
              const restored = removed;
              entriesRef.current = restoreEntryAfterDeleteFailure(
                entriesRef.current,
                restored,
              );
              setEntries((previous) =>
                restoreEntryAfterDeleteFailure(previous, restored),
              );
            }
            invalidateHouseholdScopeRef.current();
            let rollbackConfirmed = true;
            for (const discardedId of deletionLedgerIds) {
              if (!deleteOwnerIsCurrent()) return false;
              if (!(await clearDiscardedServerEntry(discardedId))) {
                rollbackConfirmed = false;
                break;
              }
              if (!deleteOwnerIsCurrent()) return false;
              recentlyDiscardedServerEntryIdsRef.current.delete(discardedId);
            }
            if (!deleteOwnerIsCurrent()) return false;
            if (!rollbackConfirmed) {
              entriesRef.current = entriesRef.current.filter(
                (entry) => entry.id !== realId && entry.id !== id,
              );
              setEntries((previous) =>
                previous.filter(
                  (entry) => entry.id !== realId && entry.id !== id,
                ),
              );
              return true;
            }
            if (cancelledTempId) {
              cancelledTempEntries.current.delete(cancelledTempId);
            }
            return false;
          }
          // Never restore across an owner wipe: a slow delete that fails after
          // "Local care data cleared" must not resurrect the entry into the freshly
          // wiped store.
          if (
            removed &&
            sessionIsCurrent() &&
            eraseGenerationRef.current === eraseGenerationAtStart
          ) {
            // Restore before the first cleanup await. While the in-flight-delete
            // counter keeps household sync deferred, owner erase can still run;
            // seeing the complete row is safer than a transient empty cache.
            const restored = removed;
            entriesRef.current = restoreEntryAfterDeleteFailure(
              entriesRef.current,
              restored,
            );
            setEntries((previous) =>
              restoreEntryAfterDeleteFailure(previous, restored),
            );
            for (const discardedId of deletionLedgerIds) {
              if (
                !sessionIsCurrent() ||
                eraseGenerationRef.current !== eraseGenerationAtStart
              ) {
                return false;
              }
              const cleared = await clearDiscardedServerEntry(discardedId);
              if (
                !sessionIsCurrent() ||
                eraseGenerationRef.current !== eraseGenerationAtStart
              ) {
                return false;
              }
              if (!cleared) {
                entriesRef.current = entriesRef.current.filter(
                  (entry) => entry.id !== realId && entry.id !== id,
                );
                setEntries((previous) =>
                  previous.filter(
                    (entry) => entry.id !== realId && entry.id !== id,
                  ),
                );
                return true;
              }
              recentlyDiscardedServerEntryIdsRef.current.delete(discardedId);
            }
            if (
              !sessionIsCurrent() ||
              eraseGenerationRef.current !== eraseGenerationAtStart
            ) {
              return false;
            }
            if (cancelledTempId) {
              cancelledTempEntries.current.delete(cancelledTempId);
            }
          }
          return false;
        }
      } finally {
        deleteFenceLease.release();
        // Erase resets this counter before allowing a new generation to
        // mutate. A late pre-erase DELETE must not decrement newer work.
        if (
          sessionActiveRef.current &&
          eraseGenerationRef.current === eraseGenerationAtStart &&
          authenticatedUserIdRef.current === authenticatedUserAtStart
        ) {
          entryDeletesInFlightRef.current = Math.max(
            0,
            entryDeletesInFlightRef.current - 1,
          );
          if (
            entryDeletesInFlightRef.current === 0 &&
            syncRequestedRef.current &&
            !syncingRef.current &&
            hydratedRef.current &&
            signedInRef.current
          ) {
            syncRequestedRef.current = false;
            void Promise.resolve().then(() => syncFromServerRef.current());
          }
        }
      }
    },
    [
      clearDiscardedServerEntry,
      entryDeleteFence,
      entryUpdateQueue,
      markServerEntryDiscarded,
      presentCareDocBlockedNotice,
      queryClient,
      storageUserId,
    ],
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<Omit<Entry, "id">>) => {
      if (
        !hydratedRef.current ||
        householdScopeChangingRef.current ||
        storageUserId === undefined
      ) {
        presentCareDocBlockedNotice(
          "Household care is still loading. Wait for the current care timeline before editing an event.",
          "checking",
        );
        return;
      }
      const realId = realIdByTemp.current.get(id) ?? id;
      if (
        entryDeleteFence.isDeleting(id) ||
        entryDeleteFence.isDeleting(realId)
      ) {
        presentCareDocBlockedNotice(
          "This care event is still being deleted. Wait for that delete to finish before editing it.",
          "checking",
        );
        return;
      }
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
        signedInRef.current &&
          householdScopeVerifiedRef.current &&
          !householdScopeChangingRef.current,
      );
      if (syncDisposition === "review-required") {
        const preserved: Entry = {
          ...prepareCareEntryForOfflineEdit<Entry>(current, mutablePatch),
          syncError:
            "Older saved change preserved on this device. Contact support before household sync.",
        };
        entryUpdateQueue.cancel(realId);
        entriesRef.current = entriesRef.current.map((entry) =>
          entry.id === realId ? preserved : entry,
        );
        setEntries((previous) =>
          previous.map((entry) => (entry.id === realId ? preserved : entry)),
        );
        return;
      }
      const pendingPatchDelta = toPendingCareEntrySyncPatch(
        current,
        mutablePatch,
      );
      const pendingSyncPatch = mergeCareEntryPendingSyncPatch<Entry>(
        current.pendingSyncPatch,
        pendingPatchDelta,
      );
      const merged: Entry =
        syncDisposition === "queue"
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
    [
      entryDeleteFence,
      entryUpdateQueue,
      presentCareDocBlockedNotice,
      storageUserId,
    ],
  );

  const updateCareDoc = useCallback(
    (
      updater: (doc: CareDoc) => CareDoc,
      options?: { blockedMessage?: string },
    ) => {
      const access = careStateWriteAccessRef.current;
      if (
        householdScopeChangingRef.current ||
        !hydratedRef.current ||
        (signedInRef.current && !canApplyCareDocUpdate(access))
      ) {
        presentCareDocBlockedNotice(
          options?.blockedMessage ??
            (householdScopeChangingRef.current || !hydratedRef.current
              ? "Household care is still loading. Wait for the access check before making shared changes."
              : access === "restricted"
                ? CARE_DOC_READ_ONLY_MESSAGE
                : CARE_DOC_CHECKING_MESSAGE),
          access === "restricted" ? "read-only" : "checking",
        );
        return false;
      }
      // Compute OUTSIDE the setState updater: calling pushDoc from inside it
      // was a render-phase side effect (duplicate PUTs under StrictMode /
      // replayed concurrent renders). docRef is updated eagerly so two
      // synchronous back-to-back updates compose instead of the second one
      // reading a stale base.
      const previous = docRef.current;
      const next: CareDoc = {
        ...updater(previous),
        updatedAt: new Date().toISOString(),
      };
      careDocMutationRevisionRef.current += 1;
      docRef.current = next;
      setDoc(next);
      if (signedInRef.current && access === "allowed") {
        const eraseGenerationAtWriteStart = eraseGenerationRef.current;
        if (careDocWritesInFlightRef.current === 0) {
          careDocOptimisticBaselineRef.current = previous;
        }
        careDocWritesInFlightRef.current += 1;
        const writeGeneration = careDocWriteGenerationRef.current + 1;
        careDocWriteGenerationRef.current = writeGeneration;
        void pushDoc(
          next,
          careDocOptimisticBaselineRef.current ?? previous,
          writeGeneration,
        ).finally(() => {
          // A pre-erase promise must not decrement or clear the counters for
          // a new post-erase write that happens to share this provider ref.
          if (
            !sessionActiveRef.current ||
            eraseGenerationRef.current !== eraseGenerationAtWriteStart
          ) {
            return;
          }
          careDocWritesInFlightRef.current = Math.max(
            0,
            careDocWritesInFlightRef.current - 1,
          );
          if (careDocWritesInFlightRef.current === 0) {
            careDocOptimisticBaselineRef.current = null;
            if (
              syncRequestedRef.current &&
              !syncingRef.current &&
              sessionActiveRef.current &&
              hydratedRef.current &&
              signedInRef.current
            ) {
              syncRequestedRef.current = false;
              void Promise.resolve().then(() => syncFromServerRef.current());
            }
          }
        });
      }
      return true;
    },
    [presentCareDocBlockedNotice, pushDoc],
  );

  const updateCareDocDurably = useCallback(
    async (
      updater: (doc: CareDoc) => CareDoc,
      options?: { blockedMessage?: string },
    ): Promise<boolean> => {
      const accepted = updateCareDoc(updater, options);
      if (!accepted || storageUserId === undefined) return false;

      // Capture every identity and lifecycle field in the same synchronous
      // turn as the accepted update. The serialized snapshot never borrows a
      // later household id, entry list, or provider baseline.
      const authenticatedUserAtStart = authenticatedUserIdRef.current;
      const signedInAtStart = signedInRef.current;
      const householdIdAtStart = storageHouseholdIdRef.current;
      const householdGenerationAtStart = householdSessionGenerationRef.current;
      const scopeInvalidationAtStart =
        householdScopeInvalidationGenerationRef.current;
      const eraseGenerationAtStart = eraseGenerationRef.current;
      const mutationRevisionAtStart = careDocMutationRevisionRef.current;
      const snapshot = {
        storageKey: stateStorageKey,
        ownerUserId: storageUserId,
        householdId: householdIdAtStart,
        doc: docRef.current,
        entries: entriesRef.current,
        serverVersion: versionRef.current,
        lastServerCareState: lastServerCareStateRef.current,
      };
      const acceptedDocIsCurrent = createAcceptedCareDocFence(snapshot.doc);

      const sessionBoundaryIsCurrent = () =>
        sessionActiveRef.current &&
        hydratedRef.current &&
        !persistencePausedRef.current &&
        !householdScopeChangingRef.current &&
        eraseGenerationRef.current === eraseGenerationAtStart &&
        householdSessionGenerationRef.current === householdGenerationAtStart &&
        householdScopeInvalidationGenerationRef.current ===
          scopeInvalidationAtStart &&
        signedInRef.current === signedInAtStart &&
        authenticatedUserIdRef.current === authenticatedUserAtStart &&
        storageHouseholdIdRef.current === householdIdAtStart;
      const saveIsCurrent = () =>
        sessionBoundaryIsCurrent() &&
        careDocMutationRevisionRef.current === mutationRevisionAtStart &&
        acceptedDocIsCurrent(docRef.current);

      const outcome = await careDocDurability.persist(snapshot, saveIsCurrent);
      if (outcome.status === "storage-failed") {
        if (sessionBoundaryIsCurrent()) setStorageWarning("save-failed");
        return false;
      }
      if (outcome.status !== "applied") return false;
      setStorageWarning((current) =>
        current === "save-failed" ? null : current,
      );
      return true;
    },
    [careDocDurability, stateStorageKey, storageUserId, updateCareDoc],
  );

  const state = useMemo<CareState>(() => {
    // Never render the previous household while a newly verified scope is
    // being archived and loaded. Consumers also receive isLoaded=false,
    // but this data-level mask protects screens that retain old subtrees.
    const visibleDoc = householdScopeChanging ? getDefaultDoc() : doc;
    const visibleEntries = householdScopeChanging ? [] : entries;
    return {
      version: householdScopeChanging ? 0 : serverVersion,
      createdAt: visibleDoc.createdAt,
      updatedAt: visibleDoc.updatedAt,
      activePetId: visibleDoc.activePetId,
      profile: visibleDoc.profile,
      pets: visibleDoc.pets,
      caregivers: visibleDoc.caregivers,
      householdSetup: visibleDoc.householdSetup,
      launchSupportProfile: visibleDoc.launchSupportProfile,
      launchProviderProfile: visibleDoc.launchProviderProfile,
      reminderNotificationPreferences:
        visibleDoc.reminderNotificationPreferences,
      dietProfile: visibleDoc.dietProfile,
      routines: visibleDoc.routines,
      goals: visibleDoc.goals,
      records: visibleDoc.records,
      accessPasses: visibleDoc.accessPasses,
      adventureMemories: visibleDoc.adventureMemories,
      reportArtifacts: visibleDoc.reportArtifacts,
      calendarEvents: visibleDoc.calendarEvents,
      entries: visibleEntries,
    };
  }, [doc, entries, householdScopeChanging, serverVersion]);

  const syncOutbox = useMemo(
    () => deriveCareSyncOutbox(householdScopeChanging ? [] : entries),
    [entries, householdScopeChanging],
  );

  const eraseAllLocalData = useCallback(() => {
    // Coalesce two confirmation taps onto the same durable outcome. A second
    // caller must not report completion while the first wipe is still queued.
    if (eraseInFlightRef.current) return eraseInFlightRef.current;

    const operation = (async (): Promise<LocalDataEraseResult> => {
      const authenticatedUserAtStart = authenticatedUserIdRef.current;
      const eraseGenerationAtStart = eraseGenerationRef.current + 1;
      eraseGenerationRef.current = eraseGenerationAtStart;
      const eraseIsCurrent = () =>
        sessionActiveRef.current &&
        authenticatedUserIdRef.current === authenticatedUserAtStart &&
        eraseGenerationRef.current === eraseGenerationAtStart;

      // Seal render, mutation, sync, and persistence producers before the
      // first await. This prevents a slow platform write or provider callback
      // from re-creating private state behind the wipe.
      persistencePausedRef.current = true;
      hydratedRef.current = false;
      householdScopeVerifiedRef.current = false;
      householdScopeChangingRef.current = true;
      pendingHouseholdArchiveRef.current = null;
      syncRequestedRef.current = false;
      if (householdScopeRetryTimerRef.current) {
        clearTimeout(householdScopeRetryTimerRef.current);
        householdScopeRetryTimerRef.current = null;
      }
      setHydrated(false);
      setHouseholdScopeChanging(true);
      householdSessionGenerationRef.current += 1;
      setCareScopeRevision((current) => current + 1);
      careDocWriteGenerationRef.current += 1;
      careDocWritesInFlightRef.current = 0;
      entryDeletesInFlightRef.current = 0;
      entryDeleteFence.clear();
      careDocOptimisticBaselineRef.current = null;
      careDocRecoveryInFlightRef.current = false;
      careDocRecoveryGenerationRef.current += 1;
      lastServerCareStateRef.current = null;
      setCareDocSyncNotice(null);

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

      // Keep only opaque remote-cleanup intent. These critical writes are
      // retained by `supersede`; ordinary snapshots/recovery copies are not.
      for (const tempId of tempIdsNeedingRemoteCleanup) {
        try {
          await markServerEntryDiscarded(tempId);
        } catch {
          // Continue the local privacy action, but retain a visible warning.
          setStorageWarning("save-failed");
        }
        if (!eraseIsCurrent()) return "superseded";
      }

      entryUpdateQueue.cancelAll();
      entriesRef.current = [];
      const defaultDoc = getDefaultDoc();
      docRef.current = defaultDoc;
      versionRef.current = 0;
      storageHouseholdIdRef.current = null;
      setDoc(defaultDoc);
      setEntries([]);
      setServerVersion(0);
      realIdByTemp.current.clear();
      pendingPatch.current.clear();

      // Re-check immediately before the destructive shared-writer transition;
      // a stale account-A callback must never supersede account B's writes.
      if (!eraseIsCurrent()) return "superseded";
      try {
        await prepareMountedPackPersistenceForOwnerWipe();
        if (!eraseIsCurrent()) return "superseded";
        await storageWriter.supersede({
          kind: "wipe",
          preserveLedgerPrefix: DISCARDED_SERVER_ENTRY_IDS_KEY,
          isCurrent: eraseIsCurrent,
        });
      } catch (error) {
        setStorageWarning("save-failed");
        throw error;
      }
      if (!eraseIsCurrent()) return "superseded";
      return "erased";
    })();

    eraseInFlightRef.current = operation;
    void operation
      .finally(() => {
        if (eraseInFlightRef.current === operation) {
          eraseInFlightRef.current = null;
        }
        if (sessionActiveRef.current) {
          // Local-only sessions can reopen immediately. An authenticated
          // session must stay masked until the fresh /me + care refresh below
          // republishes its exact owner-household-dog Avatar scope. Otherwise
          // the usual same-household response can leave Avatar stuck at null.
          const householdReverificationRequired = signedInRef.current;
          persistencePausedRef.current = householdReverificationRequired;
          householdScopeChangingRef.current = householdReverificationRequired;
          setHouseholdScopeChanging(householdReverificationRequired);
          hydratedRef.current = true;
          setHydrated(true);
        }
      })
      .catch(() => {});
    return operation;
  }, [
    entryDeleteFence,
    entryUpdateQueue,
    markServerEntryDiscarded,
    storageWriter,
  ]);

  const hydrationStatus: CareHydrationStatus =
    !hydrated && storageWarning === "read-failed"
      ? "failed"
      : hydrated && !householdScopeChanging
        ? "ready"
        : "loading";

  const avatarStorageScope = useMemo<AvatarPersistenceScope | null>(() => {
    if (!hydrated || householdScopeChanging || storageUserId === undefined) {
      return null;
    }
    const activePetId = normalizeStorageUserId(state.activePetId);
    if (!activePetId) return null;
    if (storageUserId === null) {
      return isClerkEnabledForBuild
        ? null
        : { ownerUserId: null, householdId: null, activePetId };
    }
    const householdId = storageHouseholdIdRef.current;
    if (!householdScopeVerifiedRef.current || !householdId) return null;
    return { ownerUserId: storageUserId, householdId, activePetId };
  }, [
    careScopeRevision,
    householdScopeChanging,
    hydrated,
    state.activePetId,
    storageUserId,
  ]);

  const value = useMemo<CareContextValue>(
    () => ({
      state,
      addEntry,
      deleteEntry,
      updateEntry,
      updateCareDoc,
      updateCareDocDurably,
      refresh: () => void syncFromServer(),
      eraseAllLocalData,
      syncOutbox,
      isLoaded: hydrated && !householdScopeChanging,
      hydrationStatus,
      retryHydration,
      careScopeRevision,
      avatarStorageScope,
      isSyncing,
      careStateWriteAccess,
      careDocSyncNotice,
      storageWarning,
      legacyImport,
    }),
    [
      state,
      addEntry,
      deleteEntry,
      updateEntry,
      updateCareDoc,
      updateCareDocDurably,
      syncFromServer,
      eraseAllLocalData,
      syncOutbox,
      hydrated,
      householdScopeChanging,
      hydrationStatus,
      retryHydration,
      careScopeRevision,
      avatarStorageScope,
      isSyncing,
      careStateWriteAccess,
      careDocSyncNotice,
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
