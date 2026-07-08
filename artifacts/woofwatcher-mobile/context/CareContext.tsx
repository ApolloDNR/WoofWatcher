import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
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
  buildCareEntryRefreshPlan,
  deriveCareSyncOutbox,
  mergeServerAndLocalEntries,
  reconcileCareDocFromServer,
  shouldRetryCreate,
  shouldRetryUpdate,
  type CareSyncOutbox,
  type EntrySyncStatus,
} from "@/lib/careSync";
import type { AccessPass, AdventureMemory, CarePassArtifact } from "@workspace/care-domain";
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
import type { AuthSetupProofManifestInput } from "@/lib/authProviderProof";
import type { CareEntryProviderSyncProofEvidence } from "@/lib/careEntryProviderSyncProof";
import type { AiProviderProofEvidence } from "@/lib/aiProviderProof";
import type { PaymentsProviderProofManifestInput } from "@/lib/paymentsProviderProof";
import type { AccountDeletionProofEvidence } from "@/lib/accountDeletionProof";
import type { PushNotificationsProofEvidence } from "@/lib/pushNotificationsProof";
import type { StoreAccountsProofEvidence } from "@/lib/storeAccountsProof";
import type { SupportLegalReadinessProofEvidence } from "@/lib/supportRunbook";

const STORAGE_KEY = "woofwatcher.v2.state";

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

export interface Entry {
  id: string;
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
  syncStatus?: EntrySyncStatus;
  syncError?: string;
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
    updatedAt: now,
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

function toCreateInput(e: Omit<Entry, "id">): CareEntryInput {
  const details: { [key: string]: unknown } = { ...(e.details ?? {}) };
  if (e.title) details.title = e.title;
  if (e.durationMinutes != null) details.durationMinutes = e.durationMinutes;
  if (e.amount != null) details.amount = e.amount;
  if (e.dogInteractions != null) details.dogInteractions = e.dogInteractions;
  if (e.food != null) details.food = e.food;
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
  const details: { [key: string]: unknown } = { ...(e.details ?? {}) };
  if (e.title) details.title = e.title;
  if (e.durationMinutes != null) details.durationMinutes = e.durationMinutes;
  if (e.amount != null) details.amount = e.amount;
  if (e.dogInteractions != null) details.dogInteractions = e.dogInteractions;
  if (e.food != null) details.food = e.food;
  return {
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

interface CareContextValue {
  state: CareState;
  addEntry: (entry: Omit<Entry, "id">) => string;
  deleteEntry: (id: string) => Promise<boolean>;
  updateEntry: (id: string, patch: Partial<Omit<Entry, "id">>) => void;
  updateCareDoc: (updater: (doc: CareDoc) => CareDoc) => void;
  refresh: () => void;
  syncOutbox: CareSyncOutbox;
  isLoaded: boolean;
  isSyncing: boolean;
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

  // Refs mirror state so async callbacks read fresh values without re-binding.
  const docRef = useRef(doc);
  const entriesRef = useRef(entries);
  const versionRef = useRef(serverVersion);
  const signedInRef = useRef(false);
  const syncingRef = useRef(false);
  // Maps optimistic temp ids to their server ids, and queues patches that
  // arrive before a create resolves (post-log quick-note race).
  const realIdByTemp = useRef<Map<string, string>>(new Map());
  const pendingPatch = useRef<Map<string, Partial<Omit<Entry, "id">>>>(new Map());
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
    signedInRef.current = !!isSignedIn;
  }, [isSignedIn]);

  // Hydrate instantly from the offline cache so the UI never flashes empty.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.doc) setDoc(mergeDoc(parsed.doc));
            if (Array.isArray(parsed?.entries)) setEntries(parsed.entries);
            if (typeof parsed?.serverVersion === "number") {
              setServerVersion(parsed.serverVersion);
            }
          } catch {
            // Ignore corrupt cache; fall back to defaults.
          }
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  // Persist the offline cache whenever synced state changes.
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ doc, entries, serverVersion }),
    ).catch(() => {});
  }, [doc, entries, serverVersion, hydrated]);

  const pushDoc = useCallback(async (next: CareDoc) => {
    try {
      const res = await putCareState({
        version: versionRef.current,
        doc: next as unknown as CareStateEnvelope["doc"],
      });
      setServerVersion(res.version);
    } catch (err) {
      if (!isConflict(err)) return;
      // Another device wrote first. Adopt their doc + version, replay our
      // change on top (last-writer-wins per field), and retry once.
      const envelope = err.data as CareStateEnvelope | null;
      if (!envelope) return;
      const merged: CareDoc = {
        ...mergeDoc(envelope.doc as Partial<CareDoc>),
        ...next,
        updatedAt: new Date().toISOString(),
      };
      setServerVersion(envelope.version);
      setDoc(merged);
      try {
        const res = await putCareState({
          version: envelope.version,
          doc: merged as unknown as CareStateEnvelope["doc"],
        });
        setServerVersion(res.version);
      } catch {
        // Give up; the next full refresh reconciles.
      }
    }
  }, []);

  const persistEntryCreate = useCallback(
    (tempId: string, entry: Omit<Entry, "id">) => {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === tempId
            ? { ...e, syncStatus: "pending", syncError: undefined }
            : e,
        ),
      );
      createCareEntry(toCreateInput(entry))
        .then((created) => {
          const real = toEntry(created);
          realIdByTemp.current.set(tempId, real.id);
          // Apply any patch that landed while the create was in flight.
          const queued = pendingPatch.current.get(tempId);
          pendingPatch.current.delete(tempId);
          const merged = queued ? { ...real, ...queued } : real;
          setEntries((prev) => prev.map((e) => (e.id === tempId ? merged : e)));
          queryClient.invalidateQueries({
            queryKey: getListCareEntriesQueryKey(),
          });
          if (queued) {
            updateCareEntry(real.id, toUpdateInput(merged)).catch(() => {
              setEntries((prev) =>
                prev.map((e) =>
                  e.id === real.id
                    ? {
                        ...e,
                        syncStatus: "failed",
                        syncError: "Saved locally. Refresh to retry sync.",
                      }
                    : e,
                ),
              );
            });
          }
        })
        .catch(() => {
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
        });
    },
    [queryClient],
  );

  const persistEntryUpdate = useCallback(
    (id: string, entry: Entry) => {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, syncStatus: "pending", syncError: undefined }
            : e,
        ),
      );
      updateCareEntry(id, toUpdateInput(entry))
        .then((updated) => {
          const synced = toEntry(updated);
          setEntries((prev) => prev.map((e) => (e.id === id ? synced : e)));
          queryClient.invalidateQueries({
            queryKey: getListCareEntriesQueryKey(),
          });
        })
        .catch(() => {
          setEntries((prev) =>
            prev.map((e) =>
              e.id === id
                ? {
                    ...e,
                    syncStatus: "failed",
                    syncError: "Saved locally. Refresh to retry sync.",
                  }
                : e,
            ),
          );
        });
    },
    [queryClient],
  );

  const syncFromServer = useCallback(async () => {
    if (!signedInRef.current || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const envelope = await getCareState();
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
      const serverEntries = rows.map(toEntry);
      const retryableCreates = entriesRef.current.filter(
        (entry) => shouldRetryCreate(entry) && entry.syncStatus !== "pending",
      );
      const retryableUpdates = entriesRef.current.filter(
        (entry) => shouldRetryUpdate(entry),
      );
      setEntries((prev) => mergeServerAndLocalEntries(prev, serverEntries));
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
  }, [persistEntryCreate, persistEntryUpdate]);

  useEffect(() => {
    if (!clerkLoaded || !isSignedIn) return;
    void syncFromServer();
  }, [clerkLoaded, isSignedIn, syncFromServer]);

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
      setEntries((prev) => [localEntry, ...prev]);
      if (!signedInRef.current) return tempId;
      persistEntryCreate(tempId, entry);
      return tempId;
    },
    [persistEntryCreate],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      let removed: Entry | undefined;
      setEntries((prev) => {
        removed = prev.find((e) => e.id === id);
        return prev.filter((e) => e.id !== id);
      });
      if (!signedInRef.current || id.startsWith("temp_")) return true;
      try {
        await deleteCareEntry(id);
        queryClient.invalidateQueries({
          queryKey: getListCareEntriesQueryKey(),
        });
        return true;
      } catch {
        if (removed) {
          const restored = removed;
          setEntries((prev) => [restored, ...prev]);
        }
        return false;
      }
    },
    [queryClient],
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<Omit<Entry, "id">>) => {
      const realId = realIdByTemp.current.get(id) ?? id;
      let merged: Entry | undefined;
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== realId) return e;
          merged = {
            ...e,
            ...patch,
            syncStatus: signedInRef.current
              ? "pending"
              : realId.startsWith("temp_")
                ? e.syncStatus
                : "local",
            syncError: signedInRef.current
              ? undefined
              : realId.startsWith("temp_")
                ? e.syncError
                : "Saved offline. Sign in or refresh to sync.",
          };
          return merged;
        }),
      );
      if (!signedInRef.current || !merged) return;
      // Create still in flight; remember the patch and apply it on resolve.
      if (realId.startsWith("temp_")) {
        pendingPatch.current.set(realId, {
          ...(pendingPatch.current.get(realId) ?? {}),
          ...patch,
        });
        return;
      }
      updateCareEntry(realId, toUpdateInput(merged))
        .then((updated) => {
          const synced = toEntry(updated);
          setEntries((prev) =>
            prev.map((e) => (e.id === realId ? synced : e)),
          );
          queryClient.invalidateQueries({
            queryKey: getListCareEntriesQueryKey(),
          });
        })
        .catch(() => {
          setEntries((prev) =>
            prev.map((e) =>
              e.id === realId
                ? {
                    ...e,
                    syncStatus: "failed",
                    syncError: "Saved locally. Refresh to retry sync.",
                  }
                : e,
            ),
          );
        });
    },
    [queryClient],
  );

  const updateCareDoc = useCallback(
    (updater: (doc: CareDoc) => CareDoc) => {
      setDoc((prev) => {
        const next: CareDoc = {
          ...updater(prev),
          updatedAt: new Date().toISOString(),
        };
        if (signedInRef.current) void pushDoc(next);
        return next;
      });
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

  const value = useMemo<CareContextValue>(
    () => ({
      state,
      addEntry,
      deleteEntry,
      updateEntry,
      updateCareDoc,
      refresh: () => void syncFromServer(),
      syncOutbox,
      isLoaded: hydrated,
      isSyncing,
    }),
    [
      state,
      addEntry,
      deleteEntry,
      updateEntry,
      updateCareDoc,
      syncFromServer,
      syncOutbox,
      hydrated,
      isSyncing,
    ],
  );

  return <CareContext.Provider value={value}>{children}</CareContext.Provider>;
}

export function useCare() {
  const ctx = useContext(CareContext);
  if (!ctx) throw new Error("useCare must be used within CareProvider");
  return ctx;
}
