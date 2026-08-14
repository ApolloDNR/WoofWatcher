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

export interface DevicePreferenceHydrationRetryScheduler {
  request(run: () => void): void;
  reset(): void;
  activate(): void;
  deactivate(): void;
}

const DEVICE_PREFERENCE_HYDRATION_RETRY_DELAYS_MS = Object.freeze([
  250,
  500,
  1000,
  2000,
  4000,
  8000,
  16000,
  30000,
] as const);

export function createDevicePreferenceHydrationRetryScheduler(options: {
  schedule?: (run: () => void, delayMs: number) => unknown;
  cancel?: (handle: unknown) => void;
} = {}): DevicePreferenceHydrationRetryScheduler {
  const schedule =
    options.schedule ??
    ((run: () => void, delayMs: number) => setTimeout(run, delayMs));
  const cancel =
    options.cancel ??
    ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let active = true;
  let generation = 0;
  let retryIndex = 0;
  let nextRequestId = 0;
  let pendingRequestId: number | null = null;
  let pendingHandle: unknown;

  const cancelPending = () => {
    if (pendingRequestId === null) return;
    const handle = pendingHandle;
    pendingRequestId = null;
    pendingHandle = undefined;
    cancel(handle);
  };

  const restart = () => {
    generation += 1;
    cancelPending();
    retryIndex = 0;
  };

  return {
    request(run) {
      if (!active || pendingRequestId !== null) return;
      const requestGeneration = generation;
      const requestId = ++nextRequestId;
      const delayMs =
        DEVICE_PREFERENCE_HYDRATION_RETRY_DELAYS_MS[
          Math.min(
            retryIndex,
            DEVICE_PREFERENCE_HYDRATION_RETRY_DELAYS_MS.length - 1,
          )
        ];
      retryIndex += 1;
      pendingRequestId = requestId;
      pendingHandle = undefined;
      const handle = schedule(() => {
        if (
          !active ||
          generation !== requestGeneration ||
          pendingRequestId !== requestId
        ) {
          return;
        }
        pendingRequestId = null;
        pendingHandle = undefined;
        run();
      }, delayMs);
      if (pendingRequestId === requestId) pendingHandle = handle;
    },
    reset() {
      restart();
    },
    activate() {
      if (active) return;
      active = true;
      restart();
    },
    deactivate() {
      if (!active) return;
      active = false;
      restart();
    },
  };
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
