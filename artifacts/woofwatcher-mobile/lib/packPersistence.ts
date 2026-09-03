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

export interface PackKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
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
      message: "Changes are paused because saved Pack data could not be read safely.",
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

function createSerializedWriter<T>(write: (value: T) => Promise<void>) {
  let tail: Promise<void> = Promise.resolve();

  return (value: T): Promise<void> => {
    const result = tail.then(() => write(value));
    tail = result.catch(() => undefined);
    return result;
  };
}

export function createPackPersistence(
  storage: PackKeyValueStorage,
  now: () => string = () => new Date().toISOString(),
) {
  let hydrated = false;
  let corruptSnapshot: {
    supplies: string | null;
    travelBag: string | null;
  } | null = null;

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
      try {
        const [rawSupplies, rawTravelBag] = await Promise.all([
          storage.getItem(PACK_SUPPLIES_KEY),
          storage.getItem(TRAVEL_BAG_KEY),
        ]);
        const supplies = tryParseStoredSupplies(rawSupplies);
        const travelBag = tryParseStoredTravelBag(rawTravelBag);
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

      try {
        const existingBackup = await storage.getItem(PACK_CORRUPT_BACKUP_KEY);
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

        const supplies = DEFAULT_SUPPLIES.map((item) => ({ ...item }));
        const travelBag = defaultTravelBag();
        await storage.setItem(PACK_SUPPLIES_KEY, serializeSupplies(supplies));
        await storage.setItem(TRAVEL_BAG_KEY, serializeTravelBag(travelBag));
        corruptSnapshot = null;
        hydrated = true;
        return { status: "ready", supplies, travelBag };
      } catch {
        return { status: "read-failed" };
      }
    },

    saveSupplies(items: readonly SupplyItem[]): Promise<void> {
      if (!hydrated) {
        return Promise.reject(
          new Error("Persistence is paused until Pack loads successfully."),
        );
      }
      return writeSupplies(items.map((item) => ({ ...item })));
    },

    saveTravelBag(session: TravelBagSession): Promise<void> {
      if (!hydrated) {
        return Promise.reject(
          new Error("Persistence is paused until Pack loads successfully."),
        );
      }
      return writeTravelBag({ ...session });
    },
  };
}
