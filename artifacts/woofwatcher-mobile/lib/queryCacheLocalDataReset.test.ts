import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

import { createLocalDataResetCoordinator } from "./localDataResetCoordinator.ts";
import {
  createLocalDataResetRuntime,
  REQUIRED_LOCAL_DATA_PARTICIPANT_IDS,
} from "./localDataResetRuntime.ts";
import {
  createQueryCacheLocalDataResetController,
  QueryCacheIdentityChangedError,
  type QueryCacheResetIdentityState,
} from "./queryCacheLocalDataReset.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function controllerHarness(initial?: Partial<QueryCacheResetIdentityState>) {
  let identity: QueryCacheResetIdentityState = {
    isLoaded: true,
    userId: "user-1",
    sessionId: "session-1",
    ...initial,
  };
  let cancelCalls = 0;
  let clearCalls = 0;
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => identity,
    cancelQueries: async () => {
      cancelCalls += 1;
    },
    clearQueryAndMutationCaches: () => {
      clearCalls += 1;
    },
  });
  return {
    controller,
    setIdentity(next: QueryCacheResetIdentityState) {
      identity = next;
    },
    get cancelCalls() {
      return cancelCalls;
    },
    get clearCalls() {
      return clearCalls;
    },
  };
}

test("captures a frozen loaded identity and normalizes undefined IDs to null", () => {
  const identity = {
    isLoaded: true,
    userId: undefined,
    sessionId: undefined,
  };
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => identity as unknown as QueryCacheResetIdentityState,
    cancelQueries: async () => {},
    clearQueryAndMutationCaches: () => {},
  });

  const captured = controller.captureIdentity();
  assert.deepEqual(captured, { userId: null, sessionId: null });
  assert.equal(Object.isFrozen(captured), true);
  identity.userId = "later";
  assert.deepEqual(captured, { userId: null, sessionId: null });
});

test("prepare awaits cancellation without deleting and commit clears exactly once afterward", async () => {
  const cancellation = deferred<void>();
  let clearCalls = 0;
  let cancelCalls = 0;
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => ({ isLoaded: true, userId: "user-1", sessionId: "session-1" }),
    cancelQueries: () => {
      cancelCalls += 1;
      return cancellation.promise;
    },
    clearQueryAndMutationCaches: () => {
      clearCalls += 1;
    },
  });

  let prepared = false;
  const preparing = controller.participant.prepare().then(() => {
    prepared = true;
  });
  await Promise.resolve();
  assert.equal(cancelCalls, 1);
  assert.equal(prepared, false);
  assert.equal(clearCalls, 0);

  cancellation.resolve();
  await preparing;
  assert.equal(clearCalls, 0);
  await controller.participant.commit();
  assert.equal(clearCalls, 1);
});

test("identity change during cancellation rejects preparation and permits a fresh retry", async () => {
  let identity = { isLoaded: true, userId: "user-1", sessionId: "session-1" };
  const cancellation = deferred<void>();
  let cancelCalls = 0;
  let clearCalls = 0;
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => identity,
    cancelQueries: () => {
      cancelCalls += 1;
      return cancelCalls === 1 ? cancellation.promise : Promise.resolve();
    },
    clearQueryAndMutationCaches: () => {
      clearCalls += 1;
    },
  });

  const first = controller.participant.prepare();
  identity = { isLoaded: true, userId: "user-1", sessionId: "session-2" };
  cancellation.resolve();
  await assert.rejects(first, QueryCacheIdentityChangedError);
  await assert.rejects(controller.participant.commit(), /not prepared/i);
  assert.equal(clearCalls, 0);

  await controller.participant.prepare();
  await controller.participant.commit();
  assert.equal(cancelCalls, 2);
  assert.equal(clearCalls, 1);
});

test("identity change after prepare rejects only query-cache commit and never clears the replacement identity", async () => {
  const harness = controllerHarness();
  const peerGate = deferred<void>();
  const coordinator = createLocalDataResetCoordinator();
  coordinator.register({ id: "query-cache", ...harness.controller.participant });
  coordinator.register({
    id: "zz-peer",
    prepare: () => peerGate.promise,
    commit: async () => {},
  });

  const reset = coordinator.run();
  await Promise.resolve();
  harness.setIdentity({ isLoaded: true, userId: "user-2", sessionId: "session-2" });
  peerGate.resolve();

  assert.deepEqual(await reset, {
    status: "partial-failure",
    committedParticipantIds: ["zz-peer"],
    failedParticipantIds: ["query-cache"],
  });
  assert.equal(harness.clearCalls, 0);
});

test("unloaded auth and cancellation failures reject nondestructively and retry", async () => {
  const unloaded = controllerHarness({ isLoaded: false });
  assert.equal(unloaded.controller.captureIdentity(), null);
  await assert.rejects(unloaded.controller.participant.prepare(), /loaded auth identity/i);
  assert.equal(unloaded.cancelCalls, 0);
  assert.equal(unloaded.clearCalls, 0);

  let attempt = 0;
  const cancellationFailure = createQueryCacheLocalDataResetController({
    getIdentity: () => ({ isLoaded: true, userId: null, sessionId: null }),
    cancelQueries: () => {
      attempt += 1;
      if (attempt === 1) throw new Error("cancel sync failure");
      if (attempt === 2) return Promise.reject(new Error("cancel async failure"));
      return Promise.resolve();
    },
    clearQueryAndMutationCaches: () => {},
  });
  await assert.rejects(cancellationFailure.participant.prepare(), /cancel sync failure/);
  await assert.rejects(cancellationFailure.participant.prepare(), /cancel async failure/);
  await cancellationFailure.participant.prepare();
  await cancellationFailure.participant.commit();
});

test("concurrent and cancellation-reentrant preparation starts one cancellation only", async () => {
  const cancellation = deferred<void>();
  const reentrantCalls: Promise<void>[] = [];
  let cancelCalls = 0;
  let controller!: ReturnType<typeof createQueryCacheLocalDataResetController>;
  controller = createQueryCacheLocalDataResetController({
    getIdentity: () => ({ isLoaded: true, userId: "user-1", sessionId: "session-1" }),
    cancelQueries: () => {
      cancelCalls += 1;
      reentrantCalls.push(controller.participant.prepare());
      reentrantCalls.push(controller.participant.commit());
      return cancellation.promise;
    },
    clearQueryAndMutationCaches: () => {},
  });

  const first = controller.participant.prepare();
  const concurrent = controller.participant.prepare();
  await assert.rejects(concurrent, /in progress/i);
  await assert.rejects(reentrantCalls[0]!, /in progress/i);
  await assert.rejects(reentrantCalls[1]!, /in progress/i);
  assert.equal(cancelCalls, 1);

  cancellation.resolve();
  await first;
  await controller.participant.commit();
});

test("commit misuse, concurrent calls, clear failure, and true reentry start no extra clears", async () => {
  let clearCalls = 0;
  const reentrantCommits: Promise<void>[] = [];
  const reentrantPrepares: Promise<void>[] = [];
  let controller!: ReturnType<typeof createQueryCacheLocalDataResetController>;
  controller = createQueryCacheLocalDataResetController({
    getIdentity: () => ({ isLoaded: true, userId: "user-1", sessionId: "session-1" }),
    cancelQueries: async () => {},
    clearQueryAndMutationCaches: () => {
      clearCalls += 1;
      reentrantCommits.push(controller.participant.commit());
      reentrantPrepares.push(controller.participant.prepare());
      if (clearCalls === 1) throw new Error("clear failed");
    },
  });

  await assert.rejects(controller.participant.commit(), /not prepared/i);
  await controller.participant.prepare();
  const failed = controller.participant.commit();
  const concurrent = controller.participant.commit();
  await assert.rejects(failed, /clear failed/);
  await assert.rejects(concurrent, /not prepared|in progress/i);
  await assert.rejects(reentrantCommits[0]!, /in progress/i);
  await assert.rejects(reentrantPrepares[0]!, /in progress/i);
  assert.equal(clearCalls, 1);

  await controller.participant.prepare();
  await controller.participant.commit();
  await assert.rejects(reentrantCommits[1]!, /in progress/i);
  await assert.rejects(reentrantPrepares[1]!, /in progress/i);
  await assert.rejects(controller.participant.commit(), /not prepared/i);
  assert.equal(clearCalls, 2);
});

test("a peer preparation failure retains real cached data and invokes no query-cache commit", async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["me"], { displayName: "Apollo" });
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => ({ isLoaded: true, userId: "user-1", sessionId: "session-1" }),
    cancelQueries: () => queryClient.cancelQueries(undefined, { revert: true, silent: true }),
    clearQueryAndMutationCaches: () => queryClient.clear(),
  });
  const coordinator = createLocalDataResetCoordinator();
  coordinator.register({ id: "query-cache", ...controller.participant });
  coordinator.register({
    id: "peer",
    prepare: async () => {
      throw new Error("peer failed");
    },
    commit: async () => {},
  });

  assert.deepEqual(await coordinator.run(), {
    status: "partial-failure",
    committedParticipantIds: [],
    failedParticipantIds: ["peer"],
  });
  assert.deepEqual(queryClient.getQueryData(["me"]), { displayName: "Apollo" });
});

test("real QueryClient cancellation aborts and settles old work before prepare completes", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let sawAbort = false;
  let settled = false;
  const fetching = queryClient.fetchQuery({
    queryKey: ["deferred-generated-style"],
    queryFn: ({ signal }) =>
      new Promise<string>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          sawAbort = true;
          reject(new Error("transport aborted"));
        });
      }),
  }).catch(() => {
    settled = true;
  });
  await Promise.resolve();
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => ({ isLoaded: true, userId: null, sessionId: null }),
    cancelQueries: () => queryClient.cancelQueries(undefined, { revert: true, silent: true }),
    clearQueryAndMutationCaches: () => queryClient.clear(),
  });

  await controller.participant.prepare();
  assert.equal(sawAbort, true);
  assert.equal(settled, true);
  await fetching;
});

test("commit destroys a gap query and empties both real TanStack caches", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["old"], "old data");
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => ({ isLoaded: true, userId: null, sessionId: null }),
    cancelQueries: () => queryClient.cancelQueries(undefined, { revert: true, silent: true }),
    clearQueryAndMutationCaches: () => queryClient.clear(),
  });

  await controller.participant.prepare();
  let gapQueryAborted = false;
  const gapQuery = queryClient.fetchQuery({
    queryKey: ["gap"],
    queryFn: ({ signal }) => new Promise<string>((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        gapQueryAborted = true;
        reject(new Error("gap aborted"));
      });
    }),
  }).catch(() => {});
  queryClient.getMutationCache().build(queryClient, { mutationKey: ["pending-record"] });

  await controller.participant.commit();
  await gapQuery;
  assert.equal(gapQueryAborted, true);
  assert.equal(queryClient.getQueryCache().getAll().length, 0);
  assert.equal(queryClient.getMutationCache().getAll().length, 0);
});

test("TanStack clear empties both caches but a mounted observer can retain and recreate its projection", async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["me"], { displayName: "Apollo" });
  let fetchCalls = 0;
  const queryFn = async () => {
    fetchCalls += 1;
    return { displayName: "Fresh" };
  };
  const observer = new QueryObserver(queryClient, {
    queryKey: ["me"],
    queryFn,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const unsubscribe = observer.subscribe(() => {});

  assert.deepEqual(observer.getCurrentResult().data, { displayName: "Apollo" });
  queryClient.getMutationCache().build(queryClient, { mutationKey: ["provider-write"] });
  queryClient.clear();

  assert.equal(queryClient.getQueryCache().getAll().length, 0);
  assert.equal(queryClient.getMutationCache().getAll().length, 0);
  assert.deepEqual(observer.getCurrentResult().data, { displayName: "Apollo" });

  // Binding B4 condition: all personal query consumers (including Privacy and
  // Log) must be made non-renderable before the complete-deletion verdict.
  // A later render/options update can otherwise recreate and refetch the query.
  observer.setOptions({ queryKey: ["me"], queryFn, staleTime: 0 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fetchCalls, 1);
  assert.equal(queryClient.getQueryCache().getAll().length, 1);
  assert.deepEqual(observer.getCurrentResult().data, { displayName: "Fresh" });

  unsubscribe();
  queryClient.clear();
});

test("tracked provider work holds root preparation open and stale or late mutation effects stay closed", async () => {
  const runtime = createLocalDataResetRuntime({
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  });
  let clearCalls = 0;
  const queryController = createQueryCacheLocalDataResetController({
    getIdentity: () => ({ isLoaded: true, userId: null, sessionId: null }),
    cancelQueries: async () => {},
    clearQueryAndMutationCaches: () => {
      clearCalls += 1;
    },
  });
  for (const id of REQUIRED_LOCAL_DATA_PARTICIPANT_IDS) {
    runtime.attachRequiredParticipant(
      id,
      id === "query-cache"
        ? queryController.participant
        : { prepare: async () => {}, commit: async () => {} },
    );
  }

  const transport = deferred<void>();
  let mutationStarts = 0;
  let visibleSettlements = 0;
  const accepted = runtime.trackedWork.run(async (scope) => {
    mutationStarts += 1;
    await transport.promise;
    if (scope.isCurrent()) visibleSettlements += 1;
  });
  const reset = runtime.operations.runReset();
  await Promise.resolve();

  let resetSettled = false;
  void reset.then(() => {
    resetSettled = true;
  });
  await Promise.resolve();
  assert.equal(resetSettled, false);
  assert.equal(clearCalls, 0);
  await assert.rejects(
    runtime.trackedWork.run(async () => {
      mutationStarts += 1;
    }),
    /local data reset.*progress/i,
  );
  assert.equal(mutationStarts, 1);

  transport.resolve();
  assert.deepEqual(await accepted, { status: "complete", value: undefined });
  assert.equal((await reset).status, "complete");
  assert.equal(visibleSettlements, 0);
  assert.equal(clearCalls, 1);
});

test("finalizer performs cancel-check-clear-check and a later call closes a recreated cache", async () => {
  const events: string[] = [];
  const harnessIdentity = { isLoaded: true, userId: "user-1", sessionId: "session-1" };
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => harnessIdentity,
    cancelQueries: async () => {
      events.push("cancel");
    },
    clearQueryAndMutationCaches: () => {
      events.push("clear");
    },
  });
  const expected = controller.captureIdentity();
  assert.ok(expected);

  await controller.participant.prepare();
  await controller.participant.commit();
  await controller.finalizeForIdentity(expected);
  assert.deepEqual(events, ["cancel", "clear", "cancel", "clear"]);
});

test("finalizer identity changes reject before destructive work and remain retryable", async () => {
  let identity = { isLoaded: true, userId: "user-1", sessionId: "session-1" };
  const cancellation = deferred<void>();
  let cancelCalls = 0;
  let clearCalls = 0;
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => identity,
    cancelQueries: () => {
      cancelCalls += 1;
      return cancelCalls === 1 ? cancellation.promise : Promise.resolve();
    },
    clearQueryAndMutationCaches: () => {
      clearCalls += 1;
    },
  });
  const expected = controller.captureIdentity();
  assert.ok(expected);

  identity = { isLoaded: true, userId: "user-2", sessionId: "session-2" };
  await assert.rejects(controller.finalizeForIdentity(expected), QueryCacheIdentityChangedError);
  assert.equal(cancelCalls, 0);
  assert.equal(clearCalls, 0);

  identity = { isLoaded: true, userId: "user-1", sessionId: "session-1" };
  const finalizing = controller.finalizeForIdentity(expected);
  identity = { isLoaded: true, userId: "user-1", sessionId: "session-2" };
  cancellation.resolve();
  await assert.rejects(finalizing, QueryCacheIdentityChangedError);
  assert.equal(clearCalls, 0);

  identity = { isLoaded: true, userId: "user-1", sessionId: "session-1" };
  await controller.finalizeForIdentity(expected);
  assert.equal(clearCalls, 1);
});

test("finalizer reports a post-clear identity change and a synchronous clear failure", async () => {
  let identity = { isLoaded: true, userId: "user-1", sessionId: "session-1" };
  let clearCalls = 0;
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => identity,
    cancelQueries: async () => {},
    clearQueryAndMutationCaches: () => {
      clearCalls += 1;
      if (clearCalls === 1) {
        identity = { isLoaded: true, userId: "user-1", sessionId: "session-2" };
      } else if (clearCalls === 2) {
        throw new Error("final clear failed");
      }
    },
  });
  const expected = controller.captureIdentity();
  assert.ok(expected);

  await assert.rejects(controller.finalizeForIdentity(expected), QueryCacheIdentityChangedError);
  identity = { isLoaded: true, userId: "user-1", sessionId: "session-1" };
  await assert.rejects(controller.finalizeForIdentity(expected), /final clear failed/);
  assert.equal(clearCalls, 2);
});
