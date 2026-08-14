import {
  LocalDataResetInProgressError,
  type RemovableLocalDataStorage,
} from "./removableLocalDataStorage.ts";
import type { TrackedLocalDataWork } from "./trackedLocalDataWork.ts";

export const HOME_WELCOME_DISMISSED_KEY =
  "woofwatcher.homeWelcomeDismissed.v1";
export const MOBILE_QA_SESSION_STORAGE_KEY =
  "woofwatcher.mobileReleaseQaSession.v1";
export const PACK_SUPPLIES_KEY = "woofwatcher.packSupplies.v1";
export const TRAVEL_BAG_KEY = "woofwatcher.travelBag.v1";

export const DEVICE_PREFERENCE_KEYS = Object.freeze([
  HOME_WELCOME_DISMISSED_KEY,
  MOBILE_QA_SESSION_STORAGE_KEY,
  PACK_SUPPLIES_KEY,
  TRAVEL_BAG_KEY,
] as const);

export const LEGACY_PWA_THEME_KEY = "woofwatcher.v1.theme";

export const DEVICE_PREFERENCE_RESET_KEYS = Object.freeze([
  ...DEVICE_PREFERENCE_KEYS,
  LEGACY_PWA_THEME_KEY,
] as const);

export type DevicePreferenceKey = (typeof DEVICE_PREFERENCE_KEYS)[number];
export type DevicePreferenceResetKey =
  (typeof DEVICE_PREFERENCE_RESET_KEYS)[number];

export interface DevicePreferenceHydrationOptions {
  isCancelled(): boolean;
  apply(raw: string | null): void;
}

export type DevicePreferenceHydrationResult = "applied" | "cancelled";

export interface DevicePreferencesStore {
  hydrate(
    key: DevicePreferenceKey,
    options: DevicePreferenceHydrationOptions,
  ): Promise<DevicePreferenceHydrationResult>;
  save(key: DevicePreferenceKey, raw: string): Promise<void>;
}

export interface DevicePreferencesStoreOptions {
  runTrackedHydration?: TrackedLocalDataWork["run"];
}

function assertDevicePreferenceKey(key: string): asserts key is DevicePreferenceKey {
  if (!(DEVICE_PREFERENCE_KEYS as readonly string[]).includes(key)) {
    throw new Error(`Unknown device preference key: ${key}`);
  }
}

export function createDevicePreferencesStore(
  storage: Pick<RemovableLocalDataStorage, "drain" | "getItem" | "setItem">,
  storeOptions: DevicePreferencesStoreOptions = {},
): DevicePreferencesStore {
  const revisions = new Map<DevicePreferenceKey, number>(
    DEVICE_PREFERENCE_KEYS.map((key) => [key, 0]),
  );

  const hydrateWhileCurrent = async (
    key: DevicePreferenceKey,
    hydrationOptions: DevicePreferenceHydrationOptions,
    isRootCurrent: () => boolean,
  ): Promise<DevicePreferenceHydrationResult> => {
    while (true) {
      const capturedRevision = revisions.get(key) ?? 0;
      let raw: string | null;
      try {
        await storage.drain();
        raw = await storage.getItem(key);
      } catch (error) {
        if (hydrationOptions.isCancelled() || !isRootCurrent()) {
          return "cancelled";
        }
        if ((revisions.get(key) ?? 0) !== capturedRevision) continue;
        throw error;
      }

      if (hydrationOptions.isCancelled() || !isRootCurrent()) {
        return "cancelled";
      }
      if ((revisions.get(key) ?? 0) !== capturedRevision) continue;

      hydrationOptions.apply(raw);
      return "applied";
    }
  };

  return {
    async hydrate(key, hydrationOptions) {
      assertDevicePreferenceKey(key);

      if (!storeOptions.runTrackedHydration) {
        return hydrateWhileCurrent(key, hydrationOptions, () => true);
      }

      try {
        const result = await storeOptions.runTrackedHydration((scope) =>
          hydrateWhileCurrent(key, hydrationOptions, scope.isCurrent),
        );
        return result.status === "revoked" ? "cancelled" : result.value;
      } catch (error) {
        if (error instanceof LocalDataResetInProgressError) return "cancelled";
        throw error;
      }
    },
    async save(key, raw) {
      assertDevicePreferenceKey(key);
      revisions.set(key, (revisions.get(key) ?? 0) + 1);
      await storage.setItem(key, raw);
    },
  };
}
