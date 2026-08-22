import type { LocalDataResetParticipant } from "./localDataResetCoordinator.ts";

export interface WebRuntimeCacheStorage {
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}

export interface WebRuntimeLocalDataResetEnvironment {
  platform: string;
  cacheStorage: WebRuntimeCacheStorage | null;
  requestServiceWorkerClear(): Promise<void>;
}

export interface WebRuntimeLocalDataResetController {
  readonly participant: Omit<LocalDataResetParticipant, "id">;
}

function isResettableWoofWatcherCache(name: string): boolean {
  return (
    name.startsWith("woofwatcher-runtime-") ||
    name.startsWith("woofwatcher-data-")
  );
}

export function createWebRuntimeLocalDataResetController(
  environment: WebRuntimeLocalDataResetEnvironment,
): WebRuntimeLocalDataResetController {
  const clear = async (): Promise<void> => {
    if (environment.platform !== "web") return;

    const failures: unknown[] = [];
    if (environment.cacheStorage) {
      let keys: string[] = [];
      try {
        keys = await environment.cacheStorage.keys();
      } catch (error) {
        failures.push(error);
      }
      const results = await Promise.allSettled(
        keys.filter(isResettableWoofWatcherCache).map(async (name) => {
          const deleted = await environment.cacheStorage!.delete(name);
          if (!deleted) throw new Error(`Cache '${name}' was not deleted.`);
        }),
      );
      for (const result of results) {
        if (result.status === "rejected") failures.push(result.reason);
      }
    }

    try {
      await environment.requestServiceWorkerClear();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        "The web runtime could not clear all WoofWatcher data caches.",
      );
    }
  };

  return Object.freeze({
    participant: Object.freeze({
      async prepare() {},
      commit: clear,
    }),
  });
}
