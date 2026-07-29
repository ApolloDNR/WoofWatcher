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
import { normalizeLaunchProviderProfile, type LaunchStorageProviderEvidence } from "@/lib/launchProviderSetup";
import {
  convertLegacyState,
  parseLegacyState,
  LEGACY_IMPORT_FLAG_KEY,
  LEGACY_STATE_KEY,
  type LegacyImportResult,
} from "@/lib/legacyImport";
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

function toCreateInput(e: Omit<Entry, "id">, clientKey?: string): CareEntryInput {
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
  /**
   * Store-compliance data deletion: resets the live care document and
   * removes every WoofWatcher key on this device (care state, avatar art,
   * QA sessions). Local-first means this is the complete deletion.
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
  // Maps optimistic temp ids to their server ids, and queues patches that
  // arrive before a create resolves (post-log quick-note race).
  const realIdByTemp = useRef<Map<string, string>>(new Map());
  const pendingPatch = useRef<Map<string, Partial<Omit<Entry, "id">>>>(new Map());
  // Bumped by eraseAllLocalData so in-flight sync results can't resurrect
  // data the owner just deleted from this device.
  const eraseGenerationRef = useRef(0);
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
        if (parsed?.doc) setDoc(mergeDoc(parsed.doc));
        let cachedEntries: Entry[] = [];
        if (Array.isArray(parsed?.entries)) {
          // Drop malformed rows (an id-less entry crashes outbox derivation
          // on every launch - an unrecoverable boot loop, since the persist
          // effect never gets a chance to repair the cache).
          cachedEntries = parsed.entries.filter(
            (entry: unknown): entry is Entry =>
              !!entry && typeof (entry as Entry).id === "string",
          );
          setEntries(cachedEntries);
        }
        if (typeof parsed?.serverVersion === "number") {
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
          setDoc((prev) => ({
            ...prev,
            ...result.docPatch,
            profile: result.docPatch.profile
              ? {
                  ...prev.profile,
                  ...result.docPatch.profile,
                  weight: { ...prev.profile.weight, ...result.docPatch.profile.weight },
                }
              : prev.profile,
            dietProfile: result.docPatch.dietProfile
              ? { ...prev.dietProfile, ...result.docPatch.dietProfile }
              : prev.dietProfile,
            // A real import is a real edit: the doc must not stay pristine
            // or reconciliation could discard the adopted data.
            updatedAt: importedAt,
          }));
        }
        if (result.entries.length) {
          setEntries((prev) => [...prev, ...result.entries]);
        }
        setLegacyImport(result.summary);
        await stamp({ status: "imported", summary: result.summary });
      } catch {
        // A legacy read must never break boot; the store stays as hydrated.
      }
    };
    AsyncStorage.getItem(STORAGE_KEY)
      .then(async (raw) => {
        if (applyRaw(raw)) await maybeImportLegacyState();
        setHydrated(true);
      })
      .catch(() => {
        // The read itself failed (transient storage error). Retry once;
        // if it still fails, stay un-hydrated so persistence is paused for
        // the session - in-memory care still works, but we never clobber
        // the stored data we couldn't read.
        setTimeout(() => {
          AsyncStorage.getItem(STORAGE_KEY)
            .then(async (raw) => {
              if (applyRaw(raw)) await maybeImportLegacyState();
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
      JSON.stringify({ doc, entries, serverVersion }),
    )
      .then(() => {
        setStorageWarning((current) =>
          current === "save-failed" ? null : current,
        );
      })
      .catch(() => setStorageWarning("save-failed"));
  }, [doc, entries, serverVersion, hydrated]);

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
      setEntries((prev) =>
        prev.map((e) =>
          e.id === tempId
            ? { ...e, syncStatus: "pending", syncError: undefined }
            : e,
        ),
      );
      createCareEntry(toCreateInput(entry, tempId))
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
    // Capture the erase generation so results from a sync that was in
    // flight when the owner wiped this device are discarded instead of
    // resurrecting the deleted data.
    const eraseGenerationAtStart = eraseGenerationRef.current;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const envelope = await getCareState();
      if (eraseGenerationRef.current !== eraseGenerationAtStart) return;
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
        if (eraseGenerationRef.current !== eraseGenerationAtStart) return;
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
      if (eraseGenerationRef.current !== eraseGenerationAtStart) return;
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
      // A quick undo can arrive after the optimistic create already swapped
      // its temp id for the server id; resolve through the mapping so the
      // right row is removed locally AND on the server.
      const realId = realIdByTemp.current.get(id) ?? id;
      const eraseGenerationAtStart = eraseGenerationRef.current;
      // Computed outside the updater (see updateEntry): a deferred updater
      // left `removed` undefined, silently losing the failure-restore.
      const removed = entriesRef.current.find(
        (e) => e.id === realId || e.id === id,
      );
      entriesRef.current = entriesRef.current.filter(
        (e) => e.id !== realId && e.id !== id,
      );
      setEntries((prev) => prev.filter((e) => e.id !== realId && e.id !== id));
      if (!signedInRef.current || realId.startsWith("temp_")) return true;
      try {
        await deleteCareEntry(realId);
        queryClient.invalidateQueries({
          queryKey: getListCareEntriesQueryKey(),
        });
        return true;
      } catch {
        // Never restore across an owner wipe: a slow delete that fails after
        // "All data deleted" must not resurrect the entry into the freshly
        // wiped store.
        if (removed && eraseGenerationRef.current === eraseGenerationAtStart) {
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
      // Compute the merge OUTSIDE the setState updater. The old pattern
      // (assign inside the updater, read synchronously after) silently
      // skipped the server patch whenever React deferred the updater - the
      // entry stayed "pending" forever with nothing in flight. entriesRef is
      // committed-fresh and updated eagerly below so sequential same-tick
      // updates compose.
      const current = entriesRef.current.find((e) => e.id === realId);
      if (!current) return;
      const merged: Entry = {
        ...current,
        ...patch,
        syncStatus: signedInRef.current
          ? "pending"
          : realId.startsWith("temp_")
            ? current.syncStatus
            : "local",
        syncError: signedInRef.current
          ? undefined
          : realId.startsWith("temp_")
            ? current.syncError
            : "Saved offline. Sign in or refresh to sync.",
      };
      entriesRef.current = entriesRef.current.map((e) =>
        e.id === realId ? merged : e,
      );
      setEntries((prev) => prev.map((e) => (e.id === realId ? merged : e)));
      if (!signedInRef.current) return;
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
    // Reset the live document first so the UI reflects the wipe instantly,
    // then remove every WoofWatcher-owned key on the device. The persist
    // effect re-saves only a pristine default household afterward.
    eraseGenerationRef.current += 1;
    setDoc(getDefaultDoc());
    setEntries([]);
    setServerVersion(0);
    realIdByTemp.current.clear();
    pendingPatch.current.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const owned = keys.filter((key) => key.startsWith("woofwatcher"));
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
  }, []);

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
