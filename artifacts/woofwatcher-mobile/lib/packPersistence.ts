import {
  parseSupplies,
  serializeSupplies,
  type SupplyItem,
} from "./packSupplies.ts";
import {
  parseTravelBag,
  serializeTravelBag,
  type TravelBagSession,
} from "./travelBag.ts";

export const PACK_SUPPLIES_KEY = "woofwatcher.packSupplies.v1";
export const TRAVEL_BAG_KEY = "woofwatcher.travelBag.v1";

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
  | { status: "read-failed" };

export type PackStorageWarning = "read-failed" | "save-failed";

export type PackStorageWarningPresentation = {
  title: string;
  message: string;
  retryLabel: string;
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

export function createPackPersistence(storage: PackKeyValueStorage) {
  let hydrated = false;

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
        hydrated = true;
        return {
          status: "ready",
          supplies: parseSupplies(rawSupplies),
          travelBag: parseTravelBag(rawTravelBag),
        };
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
