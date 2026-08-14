import type { LocalDataResetParticipant } from "./localDataResetCoordinator.ts";

export interface AuthIdentitySnapshot {
  readonly userId: string | null;
  readonly sessionId: string | null;
}

export interface QueryCacheResetIdentityState {
  readonly isLoaded: boolean;
  readonly userId: string | null;
  readonly sessionId: string | null;
}

export interface QueryCacheLocalDataResetAdapters {
  getIdentity(): QueryCacheResetIdentityState;
  cancelQueries(): Promise<void>;
  clearQueryAndMutationCaches(): void;
}

export interface QueryCacheLocalDataResetController {
  participant: Omit<LocalDataResetParticipant, "id">;
  captureIdentity(): AuthIdentitySnapshot | null;
  finalizeForIdentity(expected: AuthIdentitySnapshot): Promise<void>;
}

export class QueryCacheIdentityChangedError extends Error {
  constructor() {
    super("The current auth identity changed during local data reset.");
    this.name = "QueryCacheIdentityChangedError";
  }
}

type ControllerPhase =
  | "idle"
  | "preparing"
  | "prepared"
  | "committing"
  | "finalizing";

function normalizeIdentity(
  identity: Pick<QueryCacheResetIdentityState, "userId" | "sessionId">,
): AuthIdentitySnapshot {
  return Object.freeze({
    userId: identity.userId ?? null,
    sessionId: identity.sessionId ?? null,
  });
}

function identitiesMatch(
  current: AuthIdentitySnapshot | null,
  expected: AuthIdentitySnapshot,
): boolean {
  return (
    current !== null &&
    current.userId === expected.userId &&
    current.sessionId === expected.sessionId
  );
}

function invokeAsync(operation: () => Promise<void>): Promise<void> {
  try {
    return Promise.resolve(operation());
  } catch (error) {
    return Promise.reject(error);
  }
}

export function createQueryCacheLocalDataResetController(
  adapters: QueryCacheLocalDataResetAdapters,
): QueryCacheLocalDataResetController {
  let phase: ControllerPhase = "idle";
  let preparedIdentity: AuthIdentitySnapshot | null = null;

  const captureIdentity = (): AuthIdentitySnapshot | null => {
    const identity = adapters.getIdentity();
    if (!identity.isLoaded) return null;
    return normalizeIdentity(identity);
  };

  const requireIdentity = (expected: AuthIdentitySnapshot): void => {
    if (!identitiesMatch(captureIdentity(), expected)) {
      throw new QueryCacheIdentityChangedError();
    }
  };

  const participant: Omit<LocalDataResetParticipant, "id"> = {
    prepare() {
      if (phase === "preparing" || phase === "committing" || phase === "finalizing") {
        return Promise.reject(new Error("Query cache local data reset is in progress."));
      }

      preparedIdentity = null;
      phase = "preparing";
      const expected = captureIdentity();
      if (!expected) {
        phase = "idle";
        return Promise.reject(
          new Error("Query cache local data reset requires a loaded auth identity."),
        );
      }

      return invokeAsync(adapters.cancelQueries).then(
        () => {
          requireIdentity(expected);
          preparedIdentity = expected;
          phase = "prepared";
        },
        (error) => {
          phase = "idle";
          throw error;
        },
      ).catch((error) => {
        if (phase === "preparing") phase = "idle";
        throw error;
      });
    },
    commit() {
      if (phase === "preparing" || phase === "committing" || phase === "finalizing") {
        return Promise.reject(new Error("Query cache local data reset is in progress."));
      }
      if (phase !== "prepared" || !preparedIdentity) {
        return Promise.reject(
          new Error("Query cache local data reset was not prepared."),
        );
      }

      const expected = preparedIdentity;
      preparedIdentity = null;
      phase = "committing";
      try {
        requireIdentity(expected);
        adapters.clearQueryAndMutationCaches();
        return Promise.resolve();
      } catch (error) {
        return Promise.reject(error);
      } finally {
        phase = "idle";
      }
    },
  };

  const controller: QueryCacheLocalDataResetController = {
    participant: Object.freeze(participant),
    captureIdentity,
    async finalizeForIdentity(expected) {
      if (phase !== "idle") {
        throw new Error("Query cache local data reset is in progress.");
      }
      const normalizedExpected = normalizeIdentity(expected);
      phase = "finalizing";
      try {
        requireIdentity(normalizedExpected);
        await invokeAsync(adapters.cancelQueries);
        requireIdentity(normalizedExpected);
        adapters.clearQueryAndMutationCaches();
        requireIdentity(normalizedExpected);
      } finally {
        phase = "idle";
      }
    },
  };

  return Object.freeze(controller);
}
