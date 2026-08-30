import { useSyncExternalStore } from "react";

const values = new Map<string, string>();

export default {
  async getItem(key: string): Promise<string | null> {
    return values.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    values.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    values.delete(key);
  },
  async getAllKeys(): Promise<string[]> {
    return [...values.keys()];
  },
  async multiRemove(keys: string[]): Promise<void> {
    for (const key of keys) values.delete(key);
  },
};

export interface RendererAuthIdentity {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  sessionId: string | null;
}

let rendererAuthIdentity: RendererAuthIdentity = Object.freeze({
  isLoaded: true,
  isSignedIn: true,
  userId: "renderer-user",
  sessionId: "renderer-session",
});
const authListeners = new Set<() => void>();
const careListeners = new Set<() => void>();
let rendererCareIdentityScopeKey: string | null = JSON.stringify([
  "renderer-user",
  "renderer-session",
  "renderer-household",
]);
export interface RendererIdentityScopeStatus {
  state: "local" | "pending" | "resolved" | "error";
  message: string | null;
  retryable: boolean;
}
export interface RendererInitialSyncStatus {
  state: "pending" | "error" | "settled";
  isSettled: boolean;
  message: string | null;
  retryable: boolean;
}
let rendererIdentityScopeStatus: RendererIdentityScopeStatus = Object.freeze({
  state: "resolved",
  message: null,
  retryable: false,
});
let rendererInitialSyncStatus: RendererInitialSyncStatus = Object.freeze({
  state: "settled",
  isSettled: true,
  message: null,
  retryable: false,
});
let rendererIdentityScopeRetryCalls = 0;
let rendererIdentityScopeRetryHandler: (() => void) | null = null;
let rendererInitialSyncRetryCalls = 0;
let rendererInitialSyncRetryHandler: (() => void) | null = null;
let rendererStorageWarning: "read-failed" | "newer-version" | null = null;
let rendererLocalHydrationRetryCalls = 0;
let rendererLocalHydrationRetryHandler: (() => void) | null = null;

export function setRendererAuthIdentity(identity: RendererAuthIdentity): void {
  rendererAuthIdentity = Object.freeze({ ...identity });
  for (const listener of authListeners) listener();
}

export function resetRendererAuthIdentity(): void {
  rendererIdentityScopeRetryCalls = 0;
  rendererIdentityScopeRetryHandler = null;
  rendererInitialSyncRetryCalls = 0;
  rendererInitialSyncRetryHandler = null;
  rendererStorageWarning = null;
  rendererLocalHydrationRetryCalls = 0;
  rendererLocalHydrationRetryHandler = null;
  setRendererInitialSyncStatus({
    state: "settled",
    isSettled: true,
    message: null,
    retryable: false,
  });
  setRendererIdentityScopeStatus({
    state: "resolved",
    message: null,
    retryable: false,
  });
  setRendererCareIdentityScopeKey(
    JSON.stringify(["renderer-user", "renderer-session", "renderer-household"]),
  );
  setRendererAuthIdentity({
    isLoaded: true,
    isSignedIn: true,
    userId: "renderer-user",
    sessionId: "renderer-session",
  });
}

export function setRendererCareIdentityScopeKey(
  identityScopeKey: string | null,
): void {
  rendererCareIdentityScopeKey = identityScopeKey;
  for (const listener of careListeners) listener();
}

export function getRendererCareIdentityScopeKey(): string | null {
  return rendererCareIdentityScopeKey;
}

export function setRendererIdentityScopeStatus(
  status: RendererIdentityScopeStatus,
): void {
  rendererIdentityScopeStatus = Object.freeze({ ...status });
  for (const listener of careListeners) listener();
}

export function setRendererIdentityScopeRetryHandler(
  handler: (() => void) | null,
): void {
  rendererIdentityScopeRetryHandler = handler;
}

export function getRendererIdentityScopeRetryCalls(): number {
  return rendererIdentityScopeRetryCalls;
}

export function setRendererInitialSyncStatus(
  status: RendererInitialSyncStatus,
): void {
  rendererInitialSyncStatus = Object.freeze({ ...status });
  for (const listener of careListeners) listener();
}

export function setRendererInitialSyncRetryHandler(
  handler: (() => void) | null,
): void {
  rendererInitialSyncRetryHandler = handler;
}

export function getRendererInitialSyncRetryCalls(): number {
  return rendererInitialSyncRetryCalls;
}

export function setRendererStorageWarning(
  warning: "read-failed" | "newer-version" | null,
): void {
  rendererStorageWarning = warning;
  for (const listener of careListeners) listener();
}

export function setRendererLocalHydrationRetryHandler(
  handler: (() => void) | null,
): void {
  rendererLocalHydrationRetryHandler = handler;
}

export function getRendererLocalHydrationRetryCalls(): number {
  return rendererLocalHydrationRetryCalls;
}

export function getRendererAuthIdentity(): RendererAuthIdentity {
  return rendererAuthIdentity;
}

export function useWoofAuth(): RendererAuthIdentity {
  return useSyncExternalStore(
    (listener) => {
      authListeners.add(listener);
      return () => authListeners.delete(listener);
    },
    getRendererAuthIdentity,
    getRendererAuthIdentity,
  );
}

export function useCare(): {
  identityScopeKey: string | null;
  identityScopeStatus: RendererIdentityScopeStatus;
  initialSyncStatus: RendererInitialSyncStatus;
  storageWarning: "read-failed" | "newer-version" | null;
  retryIdentityScope(): void;
  retryInitialSync(): void;
  retryLocalHydration(): void;
} {
  const identityScopeKey = useSyncExternalStore(
    (listener) => {
      careListeners.add(listener);
      return () => careListeners.delete(listener);
    },
    () => rendererCareIdentityScopeKey,
    () => rendererCareIdentityScopeKey,
  );
  const identityScopeStatus = useSyncExternalStore(
    (listener) => {
      careListeners.add(listener);
      return () => careListeners.delete(listener);
    },
    () => rendererIdentityScopeStatus,
    () => rendererIdentityScopeStatus,
  );
  const initialSyncStatus = useSyncExternalStore(
    (listener) => {
      careListeners.add(listener);
      return () => careListeners.delete(listener);
    },
    () => rendererInitialSyncStatus,
    () => rendererInitialSyncStatus,
  );
  const storageWarning = useSyncExternalStore(
    (listener) => {
      careListeners.add(listener);
      return () => careListeners.delete(listener);
    },
    () => rendererStorageWarning,
    () => rendererStorageWarning,
  );
  return {
    identityScopeKey,
    identityScopeStatus,
    initialSyncStatus,
    storageWarning,
    retryIdentityScope() {
      rendererIdentityScopeRetryCalls += 1;
      rendererIdentityScopeRetryHandler?.();
    },
    retryInitialSync() {
      rendererInitialSyncRetryCalls += 1;
      rendererInitialSyncRetryHandler?.();
    },
    retryLocalHydration() {
      rendererLocalHydrationRetryCalls += 1;
      rendererLocalHydrationRetryHandler?.();
    },
  };
}
