import {
  DEFAULT_SUPPLIES,
  tryParseStoredSupplies,
  serializeSupplies,
  type SupplyItem,
} from "./packSupplies.ts";
import {
  defaultTravelBag,
  tryParseStoredTravelBag,
  serializeTravelBag,
  type TravelBagSession,
} from "./travelBag.ts";

export const PACK_SUPPLIES_KEY = "woofwatcher.packSupplies.v1";
export const TRAVEL_BAG_KEY = "woofwatcher.travelBag.v1";
export const PACK_CORRUPT_BACKUP_KEY = "woofwatcher.packCorruptBackup.v1";
export const PACK_RECOVERY_JOURNAL_KEY = "woofwatcher.packRecoveryJournal.v1";

export interface PackKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
}

export type PackHydrationResult =
  | {
      status: "ready";
      supplies: SupplyItem[];
      travelBag: TravelBagSession;
    }
  | { status: "read-failed" | "corrupt-data" };

export type PackStorageWarning = "read-failed" | "save-failed" | "corrupt-data";

export type PackStorageWarningPresentation = {
  title: string;
  message: string;
  retryLabel: string;
  recoveryLabel?: string;
};

export function getPackStorageWarningPresentation(
  warning: PackStorageWarning,
): PackStorageWarningPresentation {
  if (warning === "read-failed") {
    return {
      title: "Pack couldn't load safely",
      message: "Changes are paused so your saved Pack data isn't overwritten.",
      retryLabel: "Retry loading Pack",
    };
  }

  if (warning === "corrupt-data") {
    return {
      title: "Pack data needs recovery",
      message:
        "Changes are paused because saved Pack data could not be read safely.",
      retryLabel: "Retry loading Pack",
      recoveryLabel: "Back up and reset Pack",
    };
  }

  return {
    title: "Pack changes aren't saved yet",
    message: "Keep the app open and retry before leaving Pack.",
    retryLabel: "Retry saving Pack",
  };
}

type PackPersistenceOwnerWipeParticipant = {
  prepareForOwnerWipe(): Promise<void>;
};

const mountedPackPersistence = new Set<PackPersistenceOwnerWipeParticipant>();

export function registerPackPersistenceForOwnerWipe(
  participant: PackPersistenceOwnerWipeParticipant,
): () => void {
  mountedPackPersistence.add(participant);
  return () => mountedPackPersistence.delete(participant);
}

export async function prepareMountedPackPersistenceForOwnerWipe(): Promise<void> {
  await Promise.all(
    [...mountedPackPersistence].map((participant) =>
      participant.prepareForOwnerWipe(),
    ),
  );
}

function createSerializedWriter<T>(write: (value: T) => Promise<void>) {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue(value: T): Promise<void> {
      const result = tail.then(() => write(value));
      tail = result.catch(() => undefined);
      return result;
    },
    drain(): Promise<void> {
      return tail;
    },
  };
}

export function createPackPersistence(
  storage: PackKeyValueStorage,
  now: () => string = () => new Date().toISOString(),
) {
  let hydrated = false;
  let lifecycleGeneration = 0;
  let recoveryTail: Promise<void> = Promise.resolve();
  let corruptSnapshot: {
    supplies: string | null;
    travelBag: string | null;
  } | null = null;

  const clearRecoveryJournal = async () => {
    if (storage.removeItem) {
      await storage.removeItem(PACK_RECOVERY_JOURNAL_KEY);
    }
  };

  const replayRecoveryJournal = async (rawJournal: string) => {
    const parsed: unknown = JSON.parse(rawJournal);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as { version?: unknown }).version !== 1 ||
      typeof (parsed as { supplies?: unknown }).supplies !== "string" ||
      typeof (parsed as { travelBag?: unknown }).travelBag !== "string"
    ) {
      throw new Error("Pack recovery journal is invalid.");
    }
    const journal = parsed as {
      version: 1;
      supplies: string;
      travelBag: string;
    };
    if (
      !tryParseStoredSupplies(journal.supplies) ||
      !tryParseStoredTravelBag(journal.travelBag)
    ) {
      throw new Error("Pack recovery journal payload is invalid.");
    }
    await storage.setItem(PACK_SUPPLIES_KEY, journal.supplies);
    await storage.setItem(TRAVEL_BAG_KEY, journal.travelBag);
    await clearRecoveryJournal();
    return journal;
  };

  const assertHydrated = () => {
    if (!hydrated) {
      throw new Error("Persistence is paused until Pack loads successfully.");
    }
  };

  const writeSupplies = createSerializedWriter(
    async (items: readonly SupplyItem[]) => {
      assertHydrated();
      await storage.setItem(PACK_SUPPLIES_KEY, serializeSupplies(items));
    },
  );
  const writeTravelBag = createSerializedWriter(
    async (session: TravelBagSession) => {
      assertHydrated();
      await storage.setItem(TRAVEL_BAG_KEY, serializeTravelBag(session));
    },
  );

  return {
    async hydrate(): Promise<PackHydrationResult> {
      hydrated = false;
      const generationAtStart = lifecycleGeneration;
      try {
        const [rawJournal, rawSupplies, rawTravelBag] = await Promise.all([
          storage.getItem(PACK_RECOVERY_JOURNAL_KEY),
          storage.getItem(PACK_SUPPLIES_KEY),
          storage.getItem(TRAVEL_BAG_KEY),
        ]);
        if (generationAtStart !== lifecycleGeneration) {
          return { status: "read-failed" };
        }
        const replayedJournal =
          rawJournal === null
            ? null
            : await (async () => {
                const replay = replayRecoveryJournal(rawJournal);
                recoveryTail = replay.then(
                  () => undefined,
                  () => undefined,
                );
                const journal = await replay;
                if (generationAtStart !== lifecycleGeneration) {
                  throw new Error(
                    "Pack lifecycle changed during journal replay.",
                  );
                }
                return journal;
              })();
        const supplies = tryParseStoredSupplies(
          replayedJournal?.supplies ?? rawSupplies,
        );
        const travelBag = tryParseStoredTravelBag(
          replayedJournal?.travelBag ?? rawTravelBag,
        );
        if (!supplies || !travelBag) {
          corruptSnapshot = {
            supplies: rawSupplies,
            travelBag: rawTravelBag,
          };
          return { status: "corrupt-data" };
        }
        corruptSnapshot = null;
        hydrated = true;
        return {
          status: "ready",
          supplies,
          travelBag,
        };
      } catch {
        return { status: "read-failed" };
      }
    },

    async recoverCorruptData(): Promise<PackHydrationResult> {
      hydrated = false;
      if (!corruptSnapshot) return { status: "read-failed" };
      const generationAtStart = lifecycleGeneration;
      let result: PackHydrationResult = { status: "read-failed" };
      const operation = (async () => {
        const existingBackup = await storage.getItem(PACK_CORRUPT_BACKUP_KEY);
        if (generationAtStart !== lifecycleGeneration) return;
        if (existingBackup === null) {
          await storage.setItem(
            PACK_CORRUPT_BACKUP_KEY,
            JSON.stringify({
              version: 1,
              capturedAt: now(),
              supplies: corruptSnapshot.supplies,
              travelBag: corruptSnapshot.travelBag,
            }),
          );
        }
        if (generationAtStart !== lifecycleGeneration) return;

        const supplies = DEFAULT_SUPPLIES.map((item) => ({ ...item }));
        const travelBag = defaultTravelBag();
        const serializedSupplies = serializeSupplies(supplies);
        const serializedTravelBag = serializeTravelBag(travelBag);
        await storage.setItem(
          PACK_RECOVERY_JOURNAL_KEY,
          JSON.stringify({
            version: 1,
            supplies: serializedSupplies,
            travelBag: serializedTravelBag,
          }),
        );
        await storage.setItem(PACK_SUPPLIES_KEY, serializedSupplies);
        await storage.setItem(TRAVEL_BAG_KEY, serializedTravelBag);
        await clearRecoveryJournal();
        if (generationAtStart !== lifecycleGeneration) return;
        corruptSnapshot = null;
        hydrated = true;
        result = { status: "ready", supplies, travelBag };
      })();
      recoveryTail = operation.catch(() => undefined);
      await recoveryTail;
      return result;
    },

    saveSupplies(items: readonly SupplyItem[]): Promise<void> {
      if (!hydrated) {
        return Promise.reject(
          new Error("Persistence is paused until Pack loads successfully."),
        );
      }
      return writeSupplies.enqueue(items.map((item) => ({ ...item })));
    },

    saveTravelBag(session: TravelBagSession): Promise<void> {
      if (!hydrated) {
        return Promise.reject(
          new Error("Persistence is paused until Pack loads successfully."),
        );
      }
      return writeTravelBag.enqueue({ ...session });
    },

    async prepareForOwnerWipe(): Promise<void> {
      lifecycleGeneration += 1;
      hydrated = false;
      corruptSnapshot = null;
      await Promise.all([
        recoveryTail,
        writeSupplies.drain(),
        writeTravelBag.drain(),
      ]);
    },
  };
}
