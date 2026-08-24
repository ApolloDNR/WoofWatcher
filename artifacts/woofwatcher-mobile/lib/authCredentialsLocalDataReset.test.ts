import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  CLERK_SECURE_TOKEN_CACHE_KEYS,
  clearKnownClerkWebStorage,
  createAuthCredentialsLocalDataResetController,
  type ClerkWebStorageLike,
} from "./authCredentialsLocalDataReset.ts";

const authResetProviderSource = await readFile(
  new URL(
    "../context/AuthCredentialsLocalDataResetContext.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("auth provider wires native SecureStore and browser-specific credential cleanup", () => {
  assert.match(authResetProviderSource, /from "expo-secure-store"/);
  assert.match(
    authResetProviderSource,
    /deleteItemAsync\(key,\s*clerkSecureStoreOptions\)/,
  );
  assert.match(
    authResetProviderSource,
    /keychainAccessible:\s*SecureStore\.AFTER_FIRST_UNLOCK/,
  );
  assert.match(authResetProviderSource, /clearKnownClerkWebStorage/);
  assert.match(
    authResetProviderSource,
    /providerSignOutAvailable:\s*isClerkEnabledForBuild/,
  );
  assert.match(
    authResetProviderSource,
    /clearKnownClerkWebStorage\(\s*window\.localStorage,\s*window\.sessionStorage,?\s*\)/,
  );
  assert.doesNotMatch(
    authResetProviderSource,
    /if \(Platform\.OS === "web"\) return/,
  );
  assert.doesNotMatch(authResetProviderSource, /tokenCache|clearToken\?/);
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createMemoryWebStorage(
  initial: Record<string, string>,
): ClerkWebStorageLike & { entries(): Record<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    entries() {
      return Object.fromEntries(values);
    },
  };
}

test("web auth cleanup removes known Clerk storage entries without deleting lookalikes or app data", () => {
  const localStorage = createMemoryWebStorage({
    __clerk_client_jwt: "legacy-client-token",
    __clerk_environment: "cached-environment",
    __clerk_cache_client_abc12: "cached-client",
    __clerk_cache_session_jwt_abc12: "cached-session-token",
    clerk_telemetry_throttler: "telemetry",
    "browser-tabs-lock-key-clerk.lock.refreshSessionToken": "lock",
    __clerk_custom_app_note: "not an SDK storage key",
    clerk_notes: "not an SDK storage key",
    "browser-tabs-lock-key-other-library": "not Clerk's lock",
    "woofwatcher.profile": "app data",
  });
  const sessionStorage = createMemoryWebStorage({
    __clerk_local_auth_pk_test_example_identifier: "person@example.com",
    __clerk_local_auth_pk_test_example_password: "secret",
    __clerk_cache_environment_abc12: "cached-environment",
    "woofwatcher.draft": "app data",
  });

  clearKnownClerkWebStorage(localStorage, sessionStorage);

  assert.deepEqual(localStorage.entries(), {
    __clerk_custom_app_note: "not an SDK storage key",
    clerk_notes: "not an SDK storage key",
    "browser-tabs-lock-key-other-library": "not Clerk's lock",
    "woofwatcher.profile": "app data",
  });
  assert.deepEqual(sessionStorage.entries(), {
    "woofwatcher.draft": "app data",
  });
});

test("web auth cleanup fails when a known Clerk entry cannot be removed", () => {
  const localStorage: ClerkWebStorageLike = {
    length: 1,
    key: () => "__clerk_client_jwt",
    removeItem() {
      throw new Error("browser storage denied deletion");
    },
  };
  const sessionStorage = createMemoryWebStorage({});

  assert.throws(
    () => clearKnownClerkWebStorage(localStorage, sessionStorage),
    /Clerk browser storage/i,
  );
});

test("auth credential reset waits for sign-out before deleting every known Clerk token", async () => {
  const signOut = deferred();
  const events: string[] = [];
  const controller = createAuthCredentialsLocalDataResetController({
    getAuthState: () => ({
      isLoaded: true,
      isSignedIn: true,
      async signOut() {
        events.push("sign-out:start");
        await signOut.promise;
        events.push("sign-out:end");
      },
    }),
    async clearToken(key) {
      events.push(`clear:${key}`);
    },
  });

  await controller.participant.prepare();
  const commit = controller.participant.commit();
  await Promise.resolve();
  assert.deepEqual(events, ["sign-out:start"]);
  signOut.resolve();
  await commit;

  assert.deepEqual(CLERK_SECURE_TOKEN_CACHE_KEYS, ["__clerk_client_jwt"]);
  assert.deepEqual(events, [
    "sign-out:start",
    "sign-out:end",
    "clear:__clerk_client_jwt",
  ]);
});

test("auth credential reset clears upgrade residue even when no Clerk session is mounted", async () => {
  const cleared: string[] = [];
  const controller = createAuthCredentialsLocalDataResetController({
    getAuthState: () => ({
      isLoaded: true,
      isSignedIn: false,
      async signOut() {
        throw new Error("signed-out reset must not call signOut");
      },
    }),
    async clearToken(key) {
      cleared.push(key);
    },
  });

  await controller.participant.prepare();
  await controller.participant.commit();

  assert.deepEqual(cleared, ["__clerk_client_jwt"]);
});

test("web auth reset awaits mounted sign-out and current-tab cleanup but reports other-tab storage as unproved", async () => {
  const events: string[] = [];
  const controller = createAuthCredentialsLocalDataResetController({
    getAuthState: () => ({
      isLoaded: true,
      isSignedIn: false,
      async signOut() {
        events.push("provider:sign-out");
      },
    }),
    async clearToken() {
      throw new Error("web reset must not call native SecureStore cleanup");
    },
    web: {
      providerSignOutAvailable: true,
      async clearJsReadableStorage() {
        events.push("web-storage:clear");
      },
    },
  });

  await controller.participant.prepare();
  await assert.rejects(controller.participant.commit(), (error) => {
    assert.ok(error instanceof AggregateError);
    return error.errors.some(
      (cause) =>
        cause instanceof Error &&
        /other browser tabs.*could not be proved/i.test(cause.message),
    );
  });

  assert.deepEqual(events, ["provider:sign-out", "web-storage:clear"]);
});

test("web auth reset clears known storage but reports partial when provider sign-out cannot be proved", async () => {
  const events: string[] = [];
  const controller = createAuthCredentialsLocalDataResetController({
    getAuthState: () => ({
      isLoaded: true,
      isSignedIn: false,
      async signOut() {
        throw new Error("an unmounted provider must not be called");
      },
    }),
    async clearToken() {
      throw new Error("web reset must not call native SecureStore cleanup");
    },
    web: {
      providerSignOutAvailable: false,
      async clearJsReadableStorage() {
        events.push("web-storage:clear");
      },
    },
  });

  await controller.participant.prepare();
  await assert.rejects(controller.participant.commit(), (error) => {
    assert.ok(error instanceof AggregateError);
    return error.errors.some(
      (cause) =>
        cause instanceof Error &&
        /browser credential deletion could not be proved/i.test(cause.message),
    );
  });
  assert.deepEqual(events, ["web-storage:clear"]);
});

test("auth credential reset fails closed when auth is loading or secure deletion fails", async () => {
  const loading = createAuthCredentialsLocalDataResetController({
    getAuthState: () => ({
      isLoaded: false,
      isSignedIn: false,
      async signOut() {},
    }),
    async clearToken() {},
  });
  await assert.rejects(loading.participant.prepare(), /not ready/i);

  const failing = createAuthCredentialsLocalDataResetController({
    getAuthState: () => ({
      isLoaded: true,
      isSignedIn: false,
      async signOut() {},
    }),
    async clearToken() {
      throw new Error("SecureStore deletion failed");
    },
  });
  await failing.participant.prepare();
  await assert.rejects(failing.participant.commit(), /auth credential/i);
});
