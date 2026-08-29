import { useSyncExternalStore } from "react";

const values = new Map<string, string>();
const CARE_PRIMARY_LOCAL_DATA_KEY = "woofwatcher.v2.state";
let primaryReadFailuresRemaining = 0;
let primaryReadAttempts = 0;

export default {
  async getItem(key: string): Promise<string | null> {
    if (key === CARE_PRIMARY_LOCAL_DATA_KEY) {
      primaryReadAttempts += 1;
      if (primaryReadFailuresRemaining > 0) {
        primaryReadFailuresRemaining -= 1;
        throw new Error("Injected renderer primary Care storage read failure.");
      }
    }
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

export const isClerkEnabledForBuild = true;

let identity: RendererAuthIdentity = Object.freeze({
  isLoaded: true,
  isSignedIn: true,
  userId: "user-a",
  sessionId: "session-a",
});
const listeners = new Set<() => void>();

export function resetCareHouseholdRendererAuthStorage(): void {
  values.clear();
  primaryReadFailuresRemaining = 0;
  primaryReadAttempts = 0;
  setCareHouseholdRendererAuth({
    isLoaded: true,
    isSignedIn: true,
    userId: "user-a",
    sessionId: "session-a",
  });
}

export function setCareHouseholdRendererPrimaryReadFailures(
  count: number,
): void {
  primaryReadFailuresRemaining = Math.max(0, Math.floor(count));
}

export function getCareHouseholdRendererPrimaryReadAttempts(): number {
  return primaryReadAttempts;
}

export function getCareHouseholdRendererStoredValue(
  key: string,
): string | null {
  return values.get(key) ?? null;
}

export function setCareHouseholdRendererStoredValue(
  key: string,
  value: string,
): void {
  values.set(key, value);
}

export function setCareHouseholdRendererAuth(next: RendererAuthIdentity): void {
  identity = Object.freeze({ ...next });
  for (const listener of listeners) listener();
}

function getIdentity(): RendererAuthIdentity {
  return identity;
}

export function useWoofAuth(): RendererAuthIdentity {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getIdentity,
    getIdentity,
  );
}
