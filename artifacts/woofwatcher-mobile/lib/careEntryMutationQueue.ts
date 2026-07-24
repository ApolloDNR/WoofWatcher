const MAX_POSTGRES_INTEGER = 2_147_483_647;

export interface CareEntryMutationInput<Entry, Token> {
  key: string;
  serverId: string;
  optimistic: Entry;
  expectedRevision: number;
  token: Token;
}

export interface CareEntryMutationEvent<Entry, Token> {
  key: string;
  serverId: string;
  optimistic: Entry;
  token: Token;
}

export interface CareEntryMutationSyncedEvent<
  Entry,
  Token,
> extends CareEntryMutationEvent<Entry, Token> {
  returned: Entry;
}

export interface CareEntryMutationFailedEvent<
  Entry,
  Token,
> extends CareEntryMutationEvent<Entry, Token> {
  expectedRevision: number;
  error: unknown;
}

export interface CareEntryMutationConflictEvent<
  Entry,
  Token,
> extends CareEntryMutationFailedEvent<Entry, Token> {
  current: Entry | null;
}

export interface CareEntryMutationQueueOptions<Entry, Token> {
  mutate: (input: CareEntryMutationInput<Entry, Token>) => Promise<Entry>;
  getRevision: (entry: Entry) => number;
  isCurrent: (token: Token) => boolean;
  getConflictEntry: (error: unknown) => Entry | null;
  onSynced: (event: CareEntryMutationSyncedEvent<Entry, Token>) => void;
  onFailed: (event: CareEntryMutationFailedEvent<Entry, Token>) => void;
  onConflict: (event: CareEntryMutationConflictEvent<Entry, Token>) => void;
}

export interface EnqueueCareEntryMutation<Entry, Token> {
  key: string;
  serverId?: string;
  optimistic: Entry;
  token: Token;
}

export interface BindCareEntryServerIdentity<Token> {
  key: string;
  serverId: string;
  revision: number;
  token: Token;
}

export interface CareEntryMutationQueue<Entry, Token> {
  enqueue: (input: EnqueueCareEntryMutation<Entry, Token>) => void;
  bindServerIdentity: (
    input: BindCareEntryServerIdentity<Token>,
  ) => Entry | undefined;
  hasQueuedMutation: (key: string) => boolean;
  pause: () => symbol;
  waitForInFlight: (
    pauseToken: symbol,
    timeoutMs?: number,
  ) => Promise<"quiescent" | "timeout">;
  resume: (pauseToken: symbol) => void;
  discard: (key: string) => void;
  clear: () => void;
}

interface DesiredMutation<Entry, Token> {
  optimistic: Entry;
  token: Token;
  sequence: number;
}

interface InFlightMutation<Entry, Token> extends DesiredMutation<Entry, Token> {
  requestId: symbol;
  serverId: string;
  expectedRevision: number;
}

interface MutationState<Entry, Token> {
  key: string;
  serverId?: string;
  revision: number;
  desired?: DesiredMutation<Entry, Token>;
  inFlight?: InFlightMutation<Entry, Token>;
}

interface QuiescenceWaiter {
  pauseToken: symbol;
  resolve: (status: "quiescent" | "timeout") => void;
  timeout: ReturnType<typeof setTimeout>;
}

function assertRevision(revision: number): number {
  if (
    !Number.isInteger(revision) ||
    revision < 1 ||
    revision > MAX_POSTGRES_INTEGER
  ) {
    throw new Error(
      `Care-entry revision must be an integer between 1 and ${MAX_POSTGRES_INTEGER}.`,
    );
  }
  return revision;
}

function assertWritableRevision(revision: number): number {
  const validRevision = assertRevision(revision);
  if (validRevision >= MAX_POSTGRES_INTEGER) {
    throw new Error(
      `Care-entry revision ${MAX_POSTGRES_INTEGER} cannot be incremented.`,
    );
  }
  return validRevision;
}

export function createCareEntryMutationQueue<Entry, Token>(
  options: CareEntryMutationQueueOptions<Entry, Token>,
): CareEntryMutationQueue<Entry, Token> {
  const states = new Map<string, MutationState<Entry, Token>>();
  const aliases = new Map<string, string>();
  const pauseTokens = new Set<symbol>();
  const quiescenceWaiters = new Set<QuiescenceWaiter>();
  let epoch = 0;
  let mutationSequence = 0;

  const resolveKey = (key: string): string => {
    let current = key;
    const visited = new Set<string>();
    while (aliases.has(current) && !visited.has(current)) {
      visited.add(current);
      current = aliases.get(current) as string;
    }
    return current;
  };

  const isLiveRequest = (
    requestEpoch: number,
    state: MutationState<Entry, Token>,
    request: InFlightMutation<Entry, Token>,
  ) =>
    requestEpoch === epoch &&
    states.get(state.key) === state &&
    state.inFlight?.requestId === request.requestId &&
    options.isCurrent(request.token);

  const hasInFlightMutation = () =>
    [...states.values()].some((state) => !!state.inFlight);

  const settleQuiescenceWaiters = (force = false) => {
    if (!force && hasInFlightMutation()) return;
    for (const waiter of [...quiescenceWaiters]) {
      if (!force && pauseTokens.has(waiter.pauseToken)) {
        clearTimeout(waiter.timeout);
        quiescenceWaiters.delete(waiter);
        waiter.resolve("quiescent");
        continue;
      }
      clearTimeout(waiter.timeout);
      quiescenceWaiters.delete(waiter);
      waiter.resolve("quiescent");
    }
  };

  const failState = (
    state: MutationState<Entry, Token>,
    request: InFlightMutation<Entry, Token>,
    error: unknown,
  ) => {
    const latest = state.desired ?? request;
    if (!options.isCurrent(latest.token)) {
      states.delete(state.key);
      return;
    }
    const event = {
      key: state.key,
      serverId: request.serverId,
      optimistic: latest.optimistic,
      token: latest.token,
      expectedRevision: request.expectedRevision,
      error,
    };
    const current = options.getConflictEntry(error);
    if (current) {
      options.onConflict({ ...event, current });
    } else {
      options.onFailed(event);
    }
    states.delete(state.key);
  };

  const drain = (state: MutationState<Entry, Token>) => {
    if (
      pauseTokens.size > 0 ||
      state.inFlight ||
      !state.serverId ||
      !state.desired
    ) {
      return;
    }
    if (!options.isCurrent(state.desired.token)) {
      states.delete(state.key);
      return;
    }

    let expectedRevision: number;
    try {
      expectedRevision = assertWritableRevision(state.revision);
    } catch (error) {
      const latest = state.desired;
      options.onFailed({
        key: state.key,
        serverId: state.serverId,
        optimistic: latest.optimistic,
        token: latest.token,
        expectedRevision: state.revision,
        error,
      });
      states.delete(state.key);
      return;
    }

    const desired = state.desired;
    const request: InFlightMutation<Entry, Token> = {
      ...desired,
      requestId: Symbol(state.key),
      serverId: state.serverId,
      expectedRevision,
    };
    state.desired = undefined;
    state.inFlight = request;
    const requestEpoch = epoch;

    void options
      .mutate({
        key: state.key,
        serverId: request.serverId,
        optimistic: request.optimistic,
        expectedRevision: request.expectedRevision,
        token: request.token,
      })
      .then((returned) => {
        if (!isLiveRequest(requestEpoch, state, request)) return;
        let revision: number;
        try {
          revision = assertRevision(options.getRevision(returned));
          if (revision !== request.expectedRevision + 1) {
            throw new Error(
              `Care-entry success revision must advance from ${request.expectedRevision} to ${request.expectedRevision + 1}; received ${revision}.`,
            );
          }
        } catch (error) {
          failState(state, request, error);
          settleQuiescenceWaiters();
          return;
        }

        state.inFlight = undefined;
        state.revision = revision;
        if (state.desired) {
          drain(state);
          settleQuiescenceWaiters();
          return;
        }

        options.onSynced({
          key: state.key,
          serverId: request.serverId,
          optimistic: request.optimistic,
          token: request.token,
          returned,
        });
        states.delete(state.key);
        settleQuiescenceWaiters();
      })
      .catch((error: unknown) => {
        if (!isLiveRequest(requestEpoch, state, request)) return;
        state.inFlight = undefined;
        failState(state, request, error);
        settleQuiescenceWaiters();
      });
  };

  return {
    enqueue({ key, serverId, optimistic, token }) {
      const canonicalKey = resolveKey(key);
      const existing = states.get(canonicalKey);
      const state =
        existing?.inFlight && !options.isCurrent(existing.inFlight.token)
          ? undefined
          : existing;
      const nextState =
        state ??
        ({
          key: canonicalKey,
          revision: assertRevision(options.getRevision(optimistic)),
        } satisfies MutationState<Entry, Token>);

      if (!state) states.set(canonicalKey, nextState);
      if (!state) settleQuiescenceWaiters();
      if (serverId) nextState.serverId = serverId;
      if (!nextState.inFlight) {
        nextState.revision = assertRevision(options.getRevision(optimistic));
      }
      nextState.desired = {
        optimistic,
        token,
        sequence: ++mutationSequence,
      };
      drain(nextState);
    },

    bindServerIdentity({ key, serverId, revision, token }) {
      if (!options.isCurrent(token)) return undefined;
      const validRevision = assertRevision(revision);
      const previousKey = resolveKey(key);
      const canonicalServerId = resolveKey(serverId);
      const sourceState = states.get(previousKey);
      const canonicalState = states.get(canonicalServerId);

      aliases.set(key, canonicalServerId);
      if (previousKey !== canonicalServerId) {
        aliases.set(previousKey, canonicalServerId);
      }
      if (!sourceState) return undefined;

      let state = sourceState;
      if (
        previousKey !== canonicalServerId &&
        canonicalState &&
        canonicalState !== sourceState
      ) {
        const desiredCandidates = [
          canonicalState.desired,
          sourceState.desired,
        ].filter(
          (
            desired,
          ): desired is DesiredMutation<Entry, Token> => !!desired,
        );
        const latestDesired = desiredCandidates.reduce<
          DesiredMutation<Entry, Token> | undefined
        >(
          (latest, desired) =>
            !latest || desired.sequence > latest.sequence
              ? desired
              : latest,
          undefined,
        );
        const survivingRequestSequence =
          canonicalState.inFlight?.sequence ?? -1;
        canonicalState.desired =
          latestDesired &&
          latestDesired.sequence > survivingRequestSequence
            ? latestDesired
            : undefined;
        states.delete(previousKey);
        state = canonicalState;
      } else if (previousKey !== canonicalServerId) {
        states.delete(previousKey);
        state.key = canonicalServerId;
        states.set(canonicalServerId, state);
      }
      state.serverId = serverId;
      if (!state.inFlight) {
        state.revision = validRevision;
      }
      const latest = state.desired?.optimistic;
      drain(state);
      settleQuiescenceWaiters();
      return latest;
    },

    hasQueuedMutation(key) {
      const state = states.get(resolveKey(key));
      return Boolean(state?.desired || state?.inFlight);
    },

    pause() {
      const pauseToken = Symbol("care-entry-mutation-pause");
      pauseTokens.add(pauseToken);
      return pauseToken;
    },

    waitForInFlight(pauseToken, timeoutMs = 5_000) {
      if (
        !pauseTokens.has(pauseToken) ||
        !hasInFlightMutation()
      ) {
        return Promise.resolve("quiescent");
      }
      const boundedTimeoutMs =
        Number.isFinite(timeoutMs) && timeoutMs > 0
          ? timeoutMs
          : 5_000;
      return new Promise<"quiescent" | "timeout">((resolve) => {
        const waiter = {
          pauseToken,
          resolve,
          timeout: setTimeout(() => {
            if (!quiescenceWaiters.delete(waiter)) return;
            resolve("timeout");
          }, boundedTimeoutMs),
        } satisfies QuiescenceWaiter;
        quiescenceWaiters.add(waiter);
      });
    },

    resume(pauseToken) {
      if (!pauseTokens.delete(pauseToken)) return;
      settleQuiescenceWaiters();
      if (pauseTokens.size > 0) return;
      for (const state of [...states.values()]) {
        drain(state);
      }
    },

    discard(key) {
      const canonicalKey = resolveKey(key);
      states.delete(canonicalKey);
      for (const aliasKey of [...aliases.keys()]) {
        if (
          aliasKey === key ||
          aliasKey === canonicalKey ||
          resolveKey(aliasKey) === canonicalKey
        ) {
          aliases.delete(aliasKey);
        }
      }
      settleQuiescenceWaiters();
    },

    clear() {
      epoch += 1;
      states.clear();
      aliases.clear();
      pauseTokens.clear();
      settleQuiescenceWaiters(true);
    },
  };
}
