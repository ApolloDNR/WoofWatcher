import {
  DEVICE_PREFERENCE_RESET_KEYS,
  type DevicePreferenceResetKey,
} from "./devicePreferences.ts";
import type { LocalDataResetParticipant } from "./localDataResetCoordinator.ts";

export interface DevicePreferencesLocalDataResetController {
  participant: Omit<LocalDataResetParticipant, "id">;
}

export interface DevicePreferencesLocalDataResetControllerOptions {
  removeItem(key: DevicePreferenceResetKey): Promise<void>;
}

export class DevicePreferencesLocalDataResetCommitError extends Error {
  readonly failedKeys: readonly DevicePreferenceResetKey[];

  constructor(failedKeys: readonly DevicePreferenceResetKey[]) {
    super(
      `Could not remove device preference keys: ${failedKeys.join(", ")}.`,
    );
    this.name = "DevicePreferencesLocalDataResetCommitError";
    this.failedKeys = Object.freeze([...failedKeys]);
  }
}

function invokeAsync<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return Promise.resolve(operation());
  } catch (error) {
    return Promise.reject(error);
  }
}

export function createDevicePreferencesLocalDataResetController(
  options: DevicePreferencesLocalDataResetControllerOptions,
): DevicePreferencesLocalDataResetController {
  let prepared = false;
  let commitInFlight = false;

  const participant: Omit<LocalDataResetParticipant, "id"> = {
    prepare() {
      if (commitInFlight) {
        return Promise.reject(
          new Error("Device preference local data reset is in progress."),
        );
      }
      prepared = true;
      return Promise.resolve();
    },
    async commit() {
      if (commitInFlight) {
        throw new Error("Device preference local data reset is in progress.");
      }
      if (!prepared) {
        throw new Error("Device preference local data reset was not prepared.");
      }

      prepared = false;
      commitInFlight = true;
      try {
        const results = await Promise.allSettled(
          DEVICE_PREFERENCE_RESET_KEYS.map((key) =>
            invokeAsync(() => options.removeItem(key)),
          ),
        );
        const failedKeys = DEVICE_PREFERENCE_RESET_KEYS.filter(
          (_key, index) => results[index]?.status === "rejected",
        );

        if (failedKeys.length > 0) {
          throw new DevicePreferencesLocalDataResetCommitError(failedKeys);
        }
      } finally {
        commitInFlight = false;
      }
    },
  };

  return {
    participant: Object.freeze(participant),
  };
}
