import assert from "node:assert/strict";
import { test } from "node:test";

import { createAuthCredentialsLocalDataResetController } from "./authCredentialsLocalDataReset.ts";
import { createQueryCacheLocalDataResetController } from "./queryCacheLocalDataReset.ts";
import {
  createLocalDataResetRuntime,
  REQUIRED_LOCAL_DATA_PARTICIPANT_IDS,
} from "./localDataResetRuntime.ts";

test("signed-in reset clears personal caches before credentials sign out", async () => {
  const events: string[] = [];
  let identity = {
    isLoaded: true,
    isSignedIn: true,
    userId: "user-1" as string | null,
    sessionId: "session-1" as string | null,
  };
  const runtime = createLocalDataResetRuntime({
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  });
  const query = createQueryCacheLocalDataResetController({
    getIdentity: () => identity,
    waitUntilPersonalQueryConsumersUnmounted: async () => {
      events.push("query:shielded");
    },
    cancelQueries: async () => {
      events.push("query:cancel");
    },
    clearQueryAndMutationCaches: () => {
      events.push("query:clear");
    },
  });
  const auth = createAuthCredentialsLocalDataResetController({
    getAuthState: () => ({
      isLoaded: identity.isLoaded,
      isSignedIn: identity.isSignedIn,
      async signOut() {
        events.push("auth:sign-out");
        identity = {
          ...identity,
          isSignedIn: false,
          userId: null,
          sessionId: null,
        };
      },
    }),
    async clearToken() {
      events.push("auth:credential-delete");
    },
  });

  for (const id of REQUIRED_LOCAL_DATA_PARTICIPANT_IDS) {
    runtime.attachRequiredParticipant(
      id,
      id === "query-cache"
        ? query.participant
        : id === "auth-credentials"
          ? auth.participant
          : { prepare: async () => {}, commit: async () => {} },
    );
  }

  const result = await runtime.operations.runReset();

  assert.equal(result.status, "complete");
  assert.ok(events.indexOf("query:clear") < events.indexOf("auth:sign-out"));
  assert.deepEqual(result.committedParticipantIds.at(-1), "auth-credentials");
});
