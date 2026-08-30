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

export type QueryCacheAuthTransitionStatus =
  | "loading"
  | "blocked"
  | "failed"
  | "admitted";

export interface QueryCacheAuthTransitionIdentitySnapshot extends AuthIdentitySnapshot {
  readonly dataScopeKey: string | null;
}

export interface QueryCacheAuthTransitionSnapshot {
  readonly revision: number;
  readonly status: QueryCacheAuthTransitionStatus;
  readonly identity: QueryCacheAuthTransitionIdentitySnapshot | null;
  readonly error: unknown | null;
}

export interface QueryCacheAuthTransitionAdapters {
  cancelQueries(): Promise<void>;
  drainMutations(): Promise<void>;
  clearQueryAndMutationCaches(): void;
}

export interface QueryCacheAuthTransitionController {
  /**
   * Called during the auth-owning provider's render. A changed loaded identity
   * is synchronously blocked so personal descendants cannot commit once under
   * a replacement identity while cleanup is still waiting for an effect.
   */
  observeIdentity(
    identity: QueryCacheResetIdentityState,
  ): QueryCacheAuthTransitionSnapshot;
  observeDataScopeKey(
    dataScopeKey: string | null,
  ): QueryCacheAuthTransitionSnapshot;
  getSnapshot(): QueryCacheAuthTransitionSnapshot;
  subscribe(listener: () => void): () => void;
  confirmPersonalObserversHidden(revision: number): void;
  runCurrentTransition(): Promise<void>;
  retryCurrentTransition(): Promise<void>;
  /**
   * Imperative same-auth household switch boundary. This changes the
   * snapshot to `blocked` before returning, then resolves only after the
   * mounted personal observer acknowledgement, double cancellation, mutation
   * drain, and cache clear have completed for the exact source scope.
   */
  prepareHouseholdTransition(expectedDataScopeKey: string): Promise<void>;
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

class QueryCacheAuthTransitionSupersededError extends Error {
  constructor() {
    super("The auth identity changed while its query cache was closing.");
    this.name = "QueryCacheAuthTransitionSupersededError";
  }
}

function freezeAuthTransitionSnapshot(
  revision: number,
  status: QueryCacheAuthTransitionStatus,
  identity: QueryCacheAuthTransitionIdentitySnapshot | null,
  error: unknown | null,
): QueryCacheAuthTransitionSnapshot {
  return Object.freeze({ revision, status, identity, error });
}

function normalizeDataScopeKey(dataScopeKey: string | null): string | null {
  const normalized = dataScopeKey?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function freezeAuthTransitionIdentity(
  identity: AuthIdentitySnapshot,
  dataScopeKey: string | null,
): QueryCacheAuthTransitionIdentitySnapshot {
  return Object.freeze({
    ...identity,
    dataScopeKey: normalizeDataScopeKey(dataScopeKey),
  });
}

function authTransitionIdentitiesMatch(
  current: QueryCacheAuthTransitionIdentitySnapshot | null | undefined,
  expected: QueryCacheAuthTransitionIdentitySnapshot,
): boolean {
  return (
    current !== null &&
    current !== undefined &&
    current.userId === expected.userId &&
    current.sessionId === expected.sessionId &&
    current.dataScopeKey === expected.dataScopeKey
  );
}

function authTransitionRequiresDataScope(
  identity: QueryCacheAuthTransitionIdentitySnapshot,
): boolean {
  return identity.userId !== null || identity.sessionId !== null;
}

/**
 * Owns the singleton QueryClient admission boundary across ordinary auth
 * changes. TanStack can retain a removed query's projection in a mounted
 * observer, and its mutations are not generically abortable. The boundary
 * therefore unmounts every personal observer first, waits for the app's
 * admitted provider mutations to settle, cancels queries both before and
 * after that drain, clears both caches, and only then admits the new identity.
 */
export function createQueryCacheAuthTransitionController(
  adapters: QueryCacheAuthTransitionAdapters,
): QueryCacheAuthTransitionController {
  let hasObservedIdentity = false;
  let observedIsLoaded = false;
  let observedIdentity: AuthIdentitySnapshot | null = null;
  let observedDataScopeKey: string | null = null;
  let admittedIdentity: QueryCacheAuthTransitionIdentitySnapshot | undefined;
  let revision = 0;
  let snapshot = freezeAuthTransitionSnapshot(0, "loading", null, null);
  let confirmedHiddenRevision: number | null = null;
  let inFlight: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const hiddenWaiters = new Map<
    number,
    Set<{ resolve(): void; reject(reason: unknown): void }>
  >();

  const notify = () => {
    for (const listener of listeners) listener();
  };
  const updateSnapshot = (
    status: QueryCacheAuthTransitionStatus,
    identity: QueryCacheAuthTransitionIdentitySnapshot | null,
    error: unknown | null,
    shouldNotify: boolean,
  ) => {
    snapshot = freezeAuthTransitionSnapshot(revision, status, identity, error);
    if (shouldNotify) notify();
    return snapshot;
  };
  const rejectHiddenWaitersBefore = (currentRevision: number) => {
    for (const [waitingRevision, waiters] of hiddenWaiters) {
      if (waitingRevision === currentRevision) continue;
      hiddenWaiters.delete(waitingRevision);
      const error = new QueryCacheAuthTransitionSupersededError();
      for (const waiter of waiters) waiter.reject(error);
    }
  };
  const waitUntilPersonalObserversHidden = (
    expectedRevision: number,
  ): Promise<void> => {
    if (confirmedHiddenRevision === expectedRevision) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const waiters = hiddenWaiters.get(expectedRevision) ?? new Set();
      waiters.add({ resolve, reject });
      hiddenWaiters.set(expectedRevision, waiters);
    });
  };
  const requireCurrentTransition = (
    expectedRevision: number,
    expectedIdentity: QueryCacheAuthTransitionIdentitySnapshot,
  ) => {
    if (
      snapshot.revision !== expectedRevision ||
      snapshot.status !== "blocked" ||
      !authTransitionIdentitiesMatch(snapshot.identity, expectedIdentity)
    ) {
      throw new QueryCacheAuthTransitionSupersededError();
    }
  };

  const runTransitionsUntilCurrent = async (): Promise<void> => {
    while (snapshot.status === "blocked") {
      const expectedRevision = snapshot.revision;
      const expectedIdentity = snapshot.identity;
      if (!expectedIdentity) return;

      try {
        await waitUntilPersonalObserversHidden(expectedRevision);
        requireCurrentTransition(expectedRevision, expectedIdentity);
        await invokeAsync(adapters.cancelQueries);
        requireCurrentTransition(expectedRevision, expectedIdentity);
        await invokeAsync(adapters.drainMutations);
        requireCurrentTransition(expectedRevision, expectedIdentity);
        // A settled mutation can invalidate or start one last query. Cancel a
        // second time so no A transport can repopulate after the clear.
        await invokeAsync(adapters.cancelQueries);
        requireCurrentTransition(expectedRevision, expectedIdentity);
        adapters.clearQueryAndMutationCaches();
        requireCurrentTransition(expectedRevision, expectedIdentity);

        if (
          authTransitionRequiresDataScope(expectedIdentity) &&
          expectedIdentity.dataScopeKey === null
        ) {
          updateSnapshot("loading", expectedIdentity, null, true);
        } else {
          admittedIdentity = expectedIdentity;
          updateSnapshot("admitted", expectedIdentity, null, true);
        }
      } catch (error) {
        const transitionIsStillCurrent =
          snapshot.revision === expectedRevision &&
          snapshot.status === "blocked" &&
          authTransitionIdentitiesMatch(snapshot.identity, expectedIdentity);
        if (
          error instanceof QueryCacheAuthTransitionSupersededError ||
          !transitionIsStillCurrent
        ) {
          if (snapshot.status === "blocked") continue;
          return;
        }
        updateSnapshot("failed", expectedIdentity, error, true);
        throw error;
      }
    }
  };

  const runCurrentTransition = (): Promise<void> => {
    if (inFlight) {
      // A replacement can be requested after the loop settles but before the
      // in-flight cleanup reaction runs. Join the old run, then start any
      // replacement that is still blocked.
      const running = inFlight;
      return running.then(
        () =>
          snapshot.status === "blocked" ? runCurrentTransition() : undefined,
        (error) => {
          if (snapshot.status === "blocked") {
            return runCurrentTransition();
          }
          throw error;
        },
      );
    }
    if (snapshot.status !== "blocked") return Promise.resolve();
    const running = runTransitionsUntilCurrent();
    inFlight = running;
    void running.then(
      () => {
        if (inFlight === running) inFlight = null;
      },
      () => {
        if (inFlight === running) inFlight = null;
      },
    );
    return running;
  };

  const controller: QueryCacheAuthTransitionController = {
    observeIdentity(identity) {
      const nextIsLoaded = Boolean(identity.isLoaded);
      const nextIdentity = nextIsLoaded ? normalizeIdentity(identity) : null;
      const isSameObservation =
        hasObservedIdentity &&
        observedIsLoaded === nextIsLoaded &&
        (nextIsLoaded
          ? identitiesMatch(observedIdentity, nextIdentity!)
          : observedIdentity === null);
      if (isSameObservation) return snapshot;

      hasObservedIdentity = true;
      observedIsLoaded = nextIsLoaded;
      observedIdentity = nextIdentity;
      observedDataScopeKey = null;
      revision += 1;
      confirmedHiddenRevision = null;
      rejectHiddenWaitersBefore(revision);

      if (!nextIdentity) {
        return updateSnapshot("loading", null, null, false);
      }
      const nextTransitionIdentity = freezeAuthTransitionIdentity(
        nextIdentity,
        observedDataScopeKey,
      );
      if (
        admittedIdentity !== undefined &&
        authTransitionIdentitiesMatch(admittedIdentity, nextTransitionIdentity)
      ) {
        return updateSnapshot("admitted", nextTransitionIdentity, null, false);
      }
      return updateSnapshot("blocked", nextTransitionIdentity, null, false);
    },
    observeDataScopeKey(dataScopeKey) {
      if (!observedIsLoaded || !observedIdentity) return snapshot;
      const nextDataScopeKey = normalizeDataScopeKey(dataScopeKey);
      if (nextDataScopeKey === observedDataScopeKey) return snapshot;

      observedDataScopeKey = nextDataScopeKey;
      revision += 1;
      confirmedHiddenRevision = null;
      rejectHiddenWaitersBefore(revision);
      const nextTransitionIdentity = freezeAuthTransitionIdentity(
        observedIdentity,
        observedDataScopeKey,
      );
      if (
        admittedIdentity !== undefined &&
        authTransitionIdentitiesMatch(admittedIdentity, nextTransitionIdentity)
      ) {
        return updateSnapshot("admitted", nextTransitionIdentity, null, false);
      }
      return updateSnapshot("blocked", nextTransitionIdentity, null, false);
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    confirmPersonalObserversHidden(expectedRevision) {
      if (
        expectedRevision !== snapshot.revision ||
        snapshot.status !== "blocked"
      ) {
        return;
      }
      confirmedHiddenRevision = expectedRevision;
      const waiters = hiddenWaiters.get(expectedRevision);
      if (!waiters) return;
      hiddenWaiters.delete(expectedRevision);
      for (const waiter of waiters) waiter.resolve();
    },
    runCurrentTransition,
    retryCurrentTransition() {
      if (snapshot.status !== "failed" || !snapshot.identity) {
        return runCurrentTransition();
      }
      confirmedHiddenRevision = null;
      updateSnapshot("blocked", snapshot.identity, null, true);
      return runCurrentTransition();
    },
    prepareHouseholdTransition(expectedDataScopeKey) {
      const expectedScope = normalizeDataScopeKey(expectedDataScopeKey);
      const sourceIdentity = snapshot.identity;
      if (
        !expectedScope ||
        snapshot.status !== "admitted" ||
        !sourceIdentity ||
        sourceIdentity.dataScopeKey !== expectedScope ||
        observedDataScopeKey !== expectedScope ||
        !authTransitionRequiresDataScope(sourceIdentity)
      ) {
        return Promise.reject(
          new Error(
            "The source household scope is no longer admitted for transition.",
          ),
        );
      }

      observedDataScopeKey = null;
      revision += 1;
      confirmedHiddenRevision = null;
      rejectHiddenWaitersBefore(revision);
      const pendingIdentity = freezeAuthTransitionIdentity(
        sourceIdentity,
        null,
      );
      const expectedRevision = revision;
      updateSnapshot("blocked", pendingIdentity, null, true);

      return runCurrentTransition().then(() => {
        if (
          snapshot.revision !== expectedRevision ||
          snapshot.status !== "loading" ||
          !authTransitionIdentitiesMatch(snapshot.identity, pendingIdentity)
        ) {
          throw new QueryCacheAuthTransitionSupersededError();
        }
      });
    },
  };

  return Object.freeze(controller);
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
