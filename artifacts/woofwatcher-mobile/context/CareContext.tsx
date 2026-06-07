import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
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
  isUnsyncedEntry,
  mergeServerAndLocalEntries,
  type EntrySyncStatus,
} from "@/lib/careSync";

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
  weight: WeightInfo;
  vetBoundary: string;
}

export interface Caregiver {
  name: string;
  role: string;
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
  profile: Profile;
  caregivers: Caregiver[];
  dietProfile: DietProfile;
  routines: Routine[];
  goals: Goal[];
  records: Record[];
  calendarEvents: CalendarEvent[];
}

export interface CareState extends CareDoc {
  version: number;
  entries: Entry[];
}

function getDefaultDoc(): CareDoc {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    updatedAt: now,
    profile: {
      name: "My Dog",
      publicLabel: "My Dog",
      breed: "",
      background: "",
      careFocus: "",
      weight: {
        current: 0,
        goal: "",
        unit: "lb",
      },
      vetBoundary:
        "WoofWatcher tracks patterns for caregiver and veterinarian review. It is not a veterinary diagnosis.",
    },
    caregivers: [],
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
    calendarEvents: [],
  };
}

function mergeDoc(partial: Partial<CareDoc> | null | undefined): CareDoc {
  return { ...getDefaultDoc(), ...(partial ?? {}) };
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
  deleteEntry: (id: string) => void;
  updateEntry: (id: string, patch: Partial<Omit<Entry, "id">>) => void;
  updateCareDoc: (updater: (doc: CareDoc) => CareDoc) => void;
  refresh: () => void;
  isLoaded: boolean;
  isSyncing: boolean;
}

const CareContext = createContext<CareContextValue | null>(null);

export function CareProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();
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

  const syncFromServer = useCallback(async () => {
    if (!signedInRef.current || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const envelope = await getCareState();
      const serverDoc = envelope.doc as Partial<CareDoc>;
      const isEmpty = !serverDoc || Object.keys(serverDoc).length === 0;
      if (isEmpty) {
        // Fresh household: seed it with whatever the device currently has.
        const seed = docRef.current;
        const res = await putCareState({
          version: envelope.version,
          doc: seed as unknown as CareStateEnvelope["doc"],
        });
        setDoc(mergeDoc(res.doc as Partial<CareDoc>));
        setServerVersion(res.version);
      } else {
        setDoc(mergeDoc(serverDoc));
        setServerVersion(envelope.version);
      }

      const rows = await listCareEntries();
      const serverEntries = rows.map(toEntry);
      const retryable = entriesRef.current.filter(
        (entry) => isUnsyncedEntry(entry) && entry.syncStatus !== "pending",
      );
      setEntries((prev) => mergeServerAndLocalEntries(prev, serverEntries));
      retryable.forEach((entry) => {
        persistEntryCreate(entry.id, entry);
      });
    } catch {
      // Offline or transient failure: keep showing the cached state.
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [persistEntryCreate]);

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
    (id: string) => {
      let removed: Entry | undefined;
      setEntries((prev) => {
        removed = prev.find((e) => e.id === id);
        return prev.filter((e) => e.id !== id);
      });
      if (!signedInRef.current || id.startsWith("temp_")) return;
      deleteCareEntry(id)
        .then(() => {
          queryClient.invalidateQueries({
            queryKey: getListCareEntriesQueryKey(),
          });
        })
        .catch(() => {
          if (removed) {
            const restored = removed;
            setEntries((prev) => [restored, ...prev]);
          }
        });
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
          merged = { ...e, ...patch };
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
      updateCareEntry(realId, toUpdateInput(merged)).catch(() => {});
    },
    [],
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
      profile: doc.profile,
      caregivers: doc.caregivers,
      dietProfile: doc.dietProfile,
      routines: doc.routines,
      goals: doc.goals,
      records: doc.records,
      calendarEvents: doc.calendarEvents,
      entries,
    }),
    [doc, entries, serverVersion],
  );

  const value = useMemo<CareContextValue>(
    () => ({
      state,
      addEntry,
      deleteEntry,
      updateEntry,
      updateCareDoc,
      refresh: () => void syncFromServer(),
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
