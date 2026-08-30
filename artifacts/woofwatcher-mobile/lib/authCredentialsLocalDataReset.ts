import type { LocalDataResetParticipant } from "./localDataResetCoordinator.ts";

// Clerk Expo v3 stores its client JWT under this SDK-owned SecureStore key.
// Keep the manifest explicit so a future SDK upgrade must update the reset
// contract and its regression tests rather than silently leaving credentials.
export const CLERK_SECURE_TOKEN_CACHE_KEYS = Object.freeze([
  "__clerk_client_jwt",
] as const);

export interface ClerkWebStorageLike {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

const CLERK_WEB_STORAGE_EXACT_KEYS = new Set([
  // Legacy Expo/custom token-cache residue.
  "__clerk_client_jwt",
  // ClerkJS 6.x cached environment and telemetry state.
  "__clerk_environment",
  "clerk_telemetry_throttler",
  // ClerkJS's localStorage fallback for its cross-tab refresh lock.
  "browser-tabs-lock-key-clerk.lock.refreshSessionToken",
]);

const CLERK_WEB_STORAGE_KEY_PREFIXES = Object.freeze([
  // Optional @clerk/expo resource caches include a publishable-key suffix.
  "__clerk_cache_environment_",
  "__clerk_cache_client_",
  "__clerk_cache_session_jwt_",
  // Optional local-credentials keys include the publishable key and field name.
  "__clerk_local_auth_",
]);

function isKnownClerkWebStorageKey(key: string): boolean {
  return (
    CLERK_WEB_STORAGE_EXACT_KEYS.has(key) ||
    CLERK_WEB_STORAGE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

function findKnownClerkWebStorageKeys(storage: ClerkWebStorageLike): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null && isKnownClerkWebStorageKey(key)) keys.push(key);
  }
  return keys;
}

export function clearKnownClerkWebStorage(
  localStorage: ClerkWebStorageLike,
  sessionStorage: ClerkWebStorageLike,
): void {
  const failures: unknown[] = [];
  for (const storage of [localStorage, sessionStorage]) {
    let keys: string[] = [];
    try {
      keys = findKnownClerkWebStorageKeys(storage);
    } catch (error) {
      failures.push(error);
      continue;
    }

    for (const key of keys) {
      try {
        storage.removeItem(key);
      } catch (error) {
        failures.push(error);
      }
    }

    try {
      const retainedKeys = findKnownClerkWebStorageKeys(storage);
      if (retainedKeys.length > 0) {
        failures.push(
          new Error(
            `Clerk browser storage retained ${retainedKeys.length} known entry or entries.`,
          ),
        );
      }
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      "Could not remove every known Clerk browser storage entry.",
    );
  }
}

export interface AuthCredentialsResetState {
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut(): Promise<void>;
}

export interface AuthCredentialsLocalDataResetOptions {
  getAuthState(): AuthCredentialsResetState;
  clearToken(
    key: (typeof CLERK_SECURE_TOKEN_CACHE_KEYS)[number],
  ): Promise<void>;
  web?: {
    providerSignOutAvailable: boolean;
    clearJsReadableStorage(): Promise<void>;
  };
}

export interface AuthCredentialsLocalDataResetController {
  participant: Omit<LocalDataResetParticipant, "id">;
}

export function createAuthCredentialsLocalDataResetController(
  options: AuthCredentialsLocalDataResetOptions,
): AuthCredentialsLocalDataResetController {
  let prepared = false;
  let commitInFlight = false;

  return Object.freeze({
    participant: Object.freeze({
      async prepare() {
        if (commitInFlight) {
          throw new Error("Auth credential reset is already in progress.");
        }
        if (!options.getAuthState().isLoaded) {
          throw new Error("Auth credential storage is not ready for reset.");
        }
        prepared = true;
      },
      async commit() {
        if (commitInFlight) {
          throw new Error("Auth credential reset is already in progress.");
        }
        if (!prepared) {
          throw new Error("Auth credential reset was not prepared.");
        }
        prepared = false;
        commitInFlight = true;
        const failures: unknown[] = [];
        try {
          const auth = options.getAuthState();
          if (!auth.isLoaded) {
            failures.push(
              new Error("Auth credential storage became unavailable."),
            );
          } else if (options.web?.providerSignOutAvailable || auth.isSignedIn) {
            try {
              await auth.signOut();
            } catch (error) {
              failures.push(error);
            }
          }

          if (options.web) {
            if (!options.web.providerSignOutAvailable) {
              failures.push(
                new Error(
                  "Complete browser credential deletion could not be proved because the Clerk provider is not mounted.",
                ),
              );
            }
            failures.push(
              new Error(
                "Complete browser credential deletion from other browser tabs could not be proved because session storage is tab-scoped.",
              ),
            );
            try {
              await options.web.clearJsReadableStorage();
            } catch (error) {
              failures.push(error);
            }
          } else {
            const clearResults = await Promise.allSettled(
              CLERK_SECURE_TOKEN_CACHE_KEYS.map((key) =>
                options.clearToken(key),
              ),
            );
            for (const result of clearResults) {
              if (result.status === "rejected") failures.push(result.reason);
            }
          }
          if (failures.length > 0) {
            throw new AggregateError(
              failures,
              "Could not remove every local auth credential.",
            );
          }
        } finally {
          commitInFlight = false;
        }
      },
    }),
  });
}
