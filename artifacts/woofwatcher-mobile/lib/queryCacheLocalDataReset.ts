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
  waitUntilPersonalQueryConsumersUnmounted(): Promise<void>;
  cancelQueries(): Promise<void>;
  clearQueryAndMutationCaches(): void;
}

export interface QueryCacheLocalDataResetController {
  participant: Omit<LocalDataResetParticipant, "id">;
  captureIdentity(): AuthIdentitySnapshot | null;
  finalizeForIdentity(expected: AuthIdentitySnapshot): Promise<void>;
}

export interface PersonalQueryObserverShield {
  attachHost(): () => void;
  requestAndWait(): Promise<void>;
  confirmPersonalObserversHidden(): void;
  release(): void;
  isRequested(): boolean;
  subscribe(listener: () => void): () => void;
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

export function createPersonalQueryObserverShield(): PersonalQueryObserverShield {
  let hostAttached = false;
  let requested = false;
  let shielded = false;
  const listeners = new Set<() => void>();
  const waiters = new Set<{
    resolve(): void;
    reject(reason: unknown): void;
  }>();

  const notify = () => {
    for (const listener of listeners) listener();
  };
  const rejectWaiters = (error: Error) => {
    const pending = [...waiters];
    waiters.clear();
    for (const waiter of pending) waiter.reject(error);
  };

  const shield: PersonalQueryObserverShield = {
    attachHost() {
      if (hostAttached) {
        throw new Error(
          "The personal query observer shield already has a host.",
        );
      }
      hostAttached = true;
      return () => {
        if (!hostAttached) return;
        hostAttached = false;
        requested = false;
        shielded = false;
        rejectWaiters(
          new Error(
            "The personal query observer shield host detached during reset.",
          ),
        );
        notify();
      };
    },
    requestAndWait() {
      if (!hostAttached) {
        return Promise.reject(
          new Error("The personal query observer shield has no attached host."),
        );
      }
      if (shielded) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        waiters.add({ resolve, reject });
        if (!requested) {
          requested = true;
          notify();
        }
      });
    },
    confirmPersonalObserversHidden() {
      if (!hostAttached || !requested || shielded) return;
      shielded = true;
      const pending = [...waiters];
      waiters.clear();
      for (const waiter of pending) waiter.resolve();
    },
    release() {
      if (!requested && !shielded) return;
      requested = false;
      shielded = false;
      rejectWaiters(
        new Error(
          "The personal query observer shield was released during reset.",
        ),
      );
      notify();
    },
    isRequested() {
      return requested;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return Object.freeze(shield);
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

  const closeForIdentity = async (
    expected: AuthIdentitySnapshot,
  ): Promise<void> => {
    requireIdentity(expected);
    await invokeAsync(adapters.cancelQueries);
    requireIdentity(expected);
    adapters.clearQueryAndMutationCaches();
    requireIdentity(expected);
  };

  const participant: Omit<LocalDataResetParticipant, "id"> = {
    prepare() {
      if (
        phase === "preparing" ||
        phase === "committing" ||
        phase === "finalizing"
      ) {
        return Promise.reject(
          new Error("Query cache local data reset is in progress."),
        );
      }

      preparedIdentity = null;
      phase = "preparing";
      const expected = captureIdentity();
      if (!expected) {
        phase = "idle";
        return Promise.reject(
          new Error(
            "Query cache local data reset requires a loaded auth identity.",
          ),
        );
      }

      return invokeAsync(adapters.waitUntilPersonalQueryConsumersUnmounted)
        .then(() => {
          requireIdentity(expected);
          return invokeAsync(adapters.cancelQueries);
        })
        .then(
          () => {
            requireIdentity(expected);
            preparedIdentity = expected;
            phase = "prepared";
          },
          (error) => {
            phase = "idle";
            throw error;
          },
        )
        .catch((error) => {
          if (phase === "preparing") phase = "idle";
          throw error;
        });
    },
    commit() {
      if (
        phase === "preparing" ||
        phase === "committing" ||
        phase === "finalizing"
      ) {
        return Promise.reject(
          new Error("Query cache local data reset is in progress."),
        );
      }
      if (phase !== "prepared" || !preparedIdentity) {
        return Promise.reject(
          new Error("Query cache local data reset was not prepared."),
        );
      }

      const expected = preparedIdentity;
      preparedIdentity = null;
      phase = "committing";
      return closeForIdentity(expected).finally(() => {
        phase = "idle";
      });
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
        await closeForIdentity(normalizedExpected);
      } finally {
        phase = "idle";
      }
    },
  };

  return Object.freeze(controller);
}
