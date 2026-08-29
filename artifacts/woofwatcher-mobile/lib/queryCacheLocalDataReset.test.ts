import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

import { createLocalDataResetCoordinator } from "./localDataResetCoordinator.ts";
import * as queryCacheAuthModule from "./queryCacheLocalDataReset.ts";
import {
  createLocalDataResetRuntime,
  REQUIRED_LOCAL_DATA_PARTICIPANT_IDS,
} from "./localDataResetRuntime.ts";
import {
  createPersonalQueryObserverShield,
  createQueryCacheLocalDataResetController as createRawQueryCacheLocalDataResetController,
  QueryCacheIdentityChangedError,
  type QueryCacheLocalDataResetAdapters,
  type QueryCacheResetIdentityState,
} from "./queryCacheLocalDataReset.ts";

function createQueryCacheLocalDataResetController(
  adapters: Omit<
    QueryCacheLocalDataResetAdapters,
    "waitUntilPersonalQueryConsumersUnmounted"
  > &
    Partial<
      Pick<
        QueryCacheLocalDataResetAdapters,
        "waitUntilPersonalQueryConsumersUnmounted"
      >
    >,
) {
  return createRawQueryCacheLocalDataResetController({
    waitUntilPersonalQueryConsumersUnmounted: async () => {},
    ...adapters,
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function careIdentityScopeKey(
  userId: string,
  sessionId: string,
  householdId: string,
): string {
  return JSON.stringify([userId, sessionId, householdId]);
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

test("ordinary auth transitions stay blocked until observers, queries, and mutations are closed", async () => {
  type AuthTransitionController = {
    observeIdentity(identity: QueryCacheResetIdentityState): {
      revision: number;
      status: "loading" | "blocked" | "failed" | "admitted";
      identity: {
        userId: string | null;
        sessionId: string | null;
        dataScopeKey: string | null;
      } | null;
    };
    observeDataScopeKey(dataScopeKey: string | null): {
      revision: number;
      status: "loading" | "blocked" | "failed" | "admitted";
      identity: {
        userId: string | null;
        sessionId: string | null;
        dataScopeKey: string | null;
      } | null;
    };
    confirmPersonalObserversHidden(revision: number): void;
    runCurrentTransition(): Promise<void>;
    getSnapshot(): {
      revision: number;
      status: "loading" | "blocked" | "failed" | "admitted";
      identity: {
        userId: string | null;
        sessionId: string | null;
        dataScopeKey: string | null;
      } | null;
    };
  };
  type CreateAuthTransitionController = (adapters: {
    cancelQueries(): Promise<void>;
    drainMutations(): Promise<void>;
    clearQueryAndMutationCaches(): void;
  }) => AuthTransitionController;
  const createController = (
    queryCacheAuthModule as typeof queryCacheAuthModule & {
      createQueryCacheAuthTransitionController?: CreateAuthTransitionController;
    }
  ).createQueryCacheAuthTransitionController;

  assert.equal(
    typeof createController,
    "function",
    "the query-cache owner needs an ordinary auth-transition controller",
  );
  if (!createController) return;

  const mutationDrain = deferred<void>();
  const events: string[] = [];
  let cacheOwner: string | null = "stale-bootstrap-owner";
  const controller = createController({
    async cancelQueries() {
      events.push("cancel-queries");
    },
    async drainMutations() {
      events.push("drain-mutations:start");
      await mutationDrain.promise;
      events.push("drain-mutations:end");
    },
    clearQueryAndMutationCaches() {
      events.push("clear-cache");
      cacheOwner = null;
    },
  });

  controller.observeIdentity({
    isLoaded: true,
    userId: "user-a",
    sessionId: "session-a",
  });
  const userAScope = careIdentityScopeKey("user-a", "session-a", "household-a");
  const bootstrap = controller.observeDataScopeKey(userAScope);
  assert.equal(bootstrap.status, "blocked");

  let settled = false;
  const cleaning = controller.runCurrentTransition().then(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  assert.deepEqual(events, [], "cleanup cannot start before observer teardown");

  controller.confirmPersonalObserversHidden(bootstrap.revision);
  while (!events.includes("drain-mutations:start")) await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(cacheOwner, "stale-bootstrap-owner");
  mutationDrain.resolve();
  await cleaning;

  assert.deepEqual(events, [
    "cancel-queries",
    "drain-mutations:start",
    "drain-mutations:end",
    "cancel-queries",
    "clear-cache",
  ]);
  assert.equal(cacheOwner, null);
  assert.deepEqual(controller.getSnapshot(), {
    revision: bootstrap.revision,
    status: "admitted",
    identity: {
      userId: "user-a",
      sessionId: "session-a",
      dataScopeKey: userAScope,
    },
    error: null,
  });
});

test("a household-pending scope stays closed after cleanup until the exact replacement scope is cleared", async () => {
  const events: string[] = [];
  const controller =
    queryCacheAuthModule.createQueryCacheAuthTransitionController({
      async cancelQueries() {
        events.push("cancel");
      },
      async drainMutations() {
        events.push("drain");
      },
      clearQueryAndMutationCaches() {
        events.push("clear");
      },
    });

  controller.observeIdentity({
    isLoaded: true,
    userId: "user-a",
    sessionId: "session-a",
  });
  const householdAScope = careIdentityScopeKey(
    "user-a",
    "session-a",
    "household-a",
  );
  const householdBScope = careIdentityScopeKey(
    "user-a",
    "session-a",
    "household-b",
  );
  let transition = controller.observeDataScopeKey(householdAScope);
  controller.confirmPersonalObserversHidden(transition.revision);
  await controller.runCurrentTransition();
  assert.equal(controller.getSnapshot().status, "admitted");

  transition = controller.observeDataScopeKey(null);
  assert.equal(transition.status, "blocked");
  controller.confirmPersonalObserversHidden(transition.revision);
  await controller.runCurrentTransition();
  assert.deepEqual(controller.getSnapshot(), {
    revision: transition.revision,
    status: "loading",
    identity: {
      userId: "user-a",
      sessionId: "session-a",
      dataScopeKey: null,
    },
    error: null,
  });

  transition = controller.observeDataScopeKey(householdBScope);
  assert.equal(transition.status, "blocked");
  controller.confirmPersonalObserversHidden(transition.revision);
  await controller.runCurrentTransition();
  assert.deepEqual(controller.getSnapshot(), {
    revision: transition.revision,
    status: "admitted",
    identity: {
      userId: "user-a",
      sessionId: "session-a",
      dataScopeKey: householdBScope,
    },
    error: null,
  });
  assert.deepEqual(events, [
    "cancel",
    "drain",
    "cancel",
    "clear",
    "cancel",
    "drain",
    "cancel",
    "clear",
    "cancel",
    "drain",
    "cancel",
    "clear",
  ]);
});

test("imperative household preparation blocks synchronously and completes A teardown before transport admission", async () => {
  const events: string[] = [];
  let drainGate: Promise<void> = Promise.resolve();
  let drainCall = 0;
  const controller =
    queryCacheAuthModule.createQueryCacheAuthTransitionController({
      async cancelQueries() {
        events.push("cancel");
      },
      async drainMutations() {
        drainCall += 1;
        events.push("drain:start");
        await drainGate;
        events.push("drain:end");
      },
      clearQueryAndMutationCaches() {
        events.push("clear");
      },
    });
  const householdAScope = careIdentityScopeKey(
    "user-a",
    "session-a",
    "household-a",
  );
  controller.observeIdentity({
    isLoaded: true,
    userId: "user-a",
    sessionId: "session-a",
  });
  let transition = controller.observeDataScopeKey(householdAScope);
  controller.confirmPersonalObserversHidden(transition.revision);
  await controller.runCurrentTransition();
  events.length = 0;

  const transitionDrain = deferred<void>();
  drainGate = transitionDrain.promise;
  let prepared = false;
  const preparing = controller
    .prepareHouseholdTransition(householdAScope)
    .then(() => {
      prepared = true;
      events.push("transport-admitted");
    });
  assert.equal(
    controller.getSnapshot().status,
    "blocked",
    "the call must close admission before returning its promise",
  );
  assert.equal(prepared, false);
  transition = controller.getSnapshot();
  controller.confirmPersonalObserversHidden(transition.revision);
  while (!events.includes("drain:start")) await Promise.resolve();
  assert.equal(prepared, false);
  transitionDrain.resolve();
  await preparing;
  assert.equal(drainCall, 2);
  assert.deepEqual(events, [
    "cancel",
    "drain:start",
    "drain:end",
    "cancel",
    "clear",
    "transport-admitted",
  ]);
  assert.equal(controller.getSnapshot().status, "loading");
  assert.equal(controller.getSnapshot().identity?.dataScopeKey, null);
});

test("household preparation rejects stale source authority without disturbing admitted A", async () => {
  const controller =
    queryCacheAuthModule.createQueryCacheAuthTransitionController({
      async cancelQueries() {},
      async drainMutations() {},
      clearQueryAndMutationCaches() {},
    });
  const householdAScope = careIdentityScopeKey(
    "user-a",
    "session-a",
    "household-a",
  );
  controller.observeIdentity({
    isLoaded: true,
    userId: "user-a",
    sessionId: "session-a",
  });
  const transition = controller.observeDataScopeKey(householdAScope);
  controller.confirmPersonalObserversHidden(transition.revision);
  await controller.runCurrentTransition();

  await assert.rejects(
    controller.prepareHouseholdTransition(
      careIdentityScopeKey("user-a", "session-a", "household-stale"),
    ),
    /source household scope/i,
  );
  assert.equal(controller.getSnapshot().status, "admitted");
  assert.equal(
    controller.getSnapshot().identity?.dataScopeKey,
    householdAScope,
  );
});

test("ordinary auth cache cleanup failures remain shielded until an explicit successful retry", async () => {
  let cancelCalls = 0;
  const controller =
    queryCacheAuthModule.createQueryCacheAuthTransitionController({
      async cancelQueries() {
        cancelCalls += 1;
        if (cancelCalls === 1) throw new Error("transport cancellation failed");
      },
      async drainMutations() {},
      clearQueryAndMutationCaches() {},
    });

  controller.observeIdentity({
    isLoaded: true,
    userId: null,
    sessionId: null,
  });
  const first = controller.getSnapshot();
  controller.confirmPersonalObserversHidden(first.revision);
  await assert.rejects(
    controller.runCurrentTransition(),
    /transport cancellation failed/,
  );
  assert.equal(controller.getSnapshot().status, "failed");

  let retried = false;
  const retry = controller.retryCurrentTransition().then(() => {
    retried = true;
  });
  await Promise.resolve();
  assert.equal(retried, false);
  assert.equal(controller.getSnapshot().status, "blocked");
  controller.confirmPersonalObserversHidden(controller.getSnapshot().revision);
  await retry;
  assert.equal(controller.getSnapshot().status, "admitted");
  assert.equal(cancelCalls, 3);
});

test("a superseded cleanup rejection cannot strand the replacement identity behind a spinner", async () => {
  const firstCancellation = deferred<void>();
  const events: string[] = [];
  let cancelCalls = 0;
  const controller =
    queryCacheAuthModule.createQueryCacheAuthTransitionController({
      async cancelQueries() {
        cancelCalls += 1;
        events.push(`cancel-${cancelCalls}`);
        if (cancelCalls === 1) await firstCancellation.promise;
      },
      async drainMutations() {
        events.push("drain");
      },
      clearQueryAndMutationCaches() {
        events.push("clear");
      },
    });

  controller.observeIdentity({
    isLoaded: true,
    userId: "user-a",
    sessionId: "session-a",
  });
  let transition = controller.observeDataScopeKey(
    careIdentityScopeKey("user-a", "session-a", "household-a"),
  );
  controller.confirmPersonalObserversHidden(transition.revision);
  const cleaning = controller.runCurrentTransition();
  while (!events.includes("cancel-1")) await Promise.resolve();

  controller.observeIdentity({
    isLoaded: true,
    userId: "user-b",
    sessionId: "session-b",
  });
  transition = controller.observeDataScopeKey(
    careIdentityScopeKey("user-b", "session-b", "household-b"),
  );
  controller.confirmPersonalObserversHidden(transition.revision);
  firstCancellation.reject(new Error("old user cancellation failed"));

  await cleaning;
  assert.deepEqual(controller.getSnapshot(), {
    revision: transition.revision,
    status: "admitted",
    identity: {
      userId: "user-b",
      sessionId: "session-b",
      dataScopeKey: careIdentityScopeKey("user-b", "session-b", "household-b"),
    },
    error: null,
  });
  assert.deepEqual(events, [
    "cancel-1",
    "cancel-2",
    "drain",
    "cancel-3",
    "clear",
  ]);
});

test("a transition requested while prior cleanup settles cannot stay blocked", async () => {
  const events: string[] = [];
  const controller =
    queryCacheAuthModule.createQueryCacheAuthTransitionController({
      async cancelQueries() {
        events.push("cancel");
      },
      async drainMutations() {
        events.push("drain");
      },
      clearQueryAndMutationCaches() {
        events.push("clear");
      },
    });
  const userCScope = careIdentityScopeKey("user-c", "session-c", "household-c");
  const userDScope = careIdentityScopeKey("user-d", "session-d", "household-d");
  let userDCleanup: Promise<void> | null = null;
  let queuedUserD = false;

  const unsubscribe = controller.subscribe(() => {
    const current = controller.getSnapshot();
    if (
      queuedUserD ||
      current.status !== "admitted" ||
      current.identity?.userId !== "user-c"
    ) {
      return;
    }
    queuedUserD = true;
    queueMicrotask(() => {
      controller.observeIdentity({
        isLoaded: true,
        userId: "user-d",
        sessionId: "session-d",
      });
      const userDTransition = controller.observeDataScopeKey(userDScope);
      controller.confirmPersonalObserversHidden(userDTransition.revision);
      userDCleanup = controller.runCurrentTransition();
    });
  });

  controller.observeIdentity({
    isLoaded: true,
    userId: "user-c",
    sessionId: "session-c",
  });
  const userCTransition = controller.observeDataScopeKey(userCScope);
  controller.confirmPersonalObserversHidden(userCTransition.revision);
  await controller.runCurrentTransition();
  await Promise.resolve();

  assert.ok(userDCleanup, "the replacement transition was requested");
  await userDCleanup;
  unsubscribe();

  assert.deepEqual(controller.getSnapshot(), {
    revision: 4,
    status: "admitted",
    identity: {
      userId: "user-d",
      sessionId: "session-d",
      dataScopeKey: userDScope,
    },
    error: null,
  });
  assert.deepEqual(events, [
    "cancel",
    "drain",
    "cancel",
    "clear",
    "cancel",
    "drain",
    "cancel",
    "clear",
  ]);
});

test("a replacement requested while prior cleanup rejection settles is admitted", async () => {
  const events: string[] = [];
  let cancelCalls = 0;
  const controller =
    queryCacheAuthModule.createQueryCacheAuthTransitionController({
      async cancelQueries() {
        cancelCalls += 1;
        events.push(`cancel-${cancelCalls}`);
        if (cancelCalls === 1) {
          throw new Error("user C cancellation failed");
        }
      },
      async drainMutations() {
        events.push("drain");
      },
      clearQueryAndMutationCaches() {
        events.push("clear");
      },
    });
  const userCScope = careIdentityScopeKey("user-c", "session-c", "household-c");
  const userDScope = careIdentityScopeKey("user-d", "session-d", "household-d");
  let userDCleanup: Promise<void> | null = null;
  let queuedUserD = false;

  const unsubscribe = controller.subscribe(() => {
    const current = controller.getSnapshot();
    if (
      queuedUserD ||
      current.status !== "failed" ||
      current.identity?.userId !== "user-c"
    ) {
      return;
    }
    queuedUserD = true;
    queueMicrotask(() => {
      controller.observeIdentity({
        isLoaded: true,
        userId: "user-d",
        sessionId: "session-d",
      });
      const userDTransition = controller.observeDataScopeKey(userDScope);
      controller.confirmPersonalObserversHidden(userDTransition.revision);
      userDCleanup = controller.runCurrentTransition();
    });
  });

  controller.observeIdentity({
    isLoaded: true,
    userId: "user-c",
    sessionId: "session-c",
  });
  const userCTransition = controller.observeDataScopeKey(userCScope);
  controller.confirmPersonalObserversHidden(userCTransition.revision);
  await assert.rejects(
    controller.runCurrentTransition(),
    /user C cancellation failed/,
  );
  await Promise.resolve();

  assert.ok(userDCleanup, "the replacement transition was requested");
  await userDCleanup;
  unsubscribe();

  assert.deepEqual(controller.getSnapshot(), {
    revision: 4,
    status: "admitted",
    identity: {
      userId: "user-d",
      sessionId: "session-d",
      dataScopeKey: userDScope,
    },
    error: null,
  });
  assert.deepEqual(events, [
    "cancel-1",
    "cancel-2",
    "drain",
    "cancel-3",
    "clear",
  ]);
});

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

test("personal query observer shield is one-host, fail-closed, and cycle-safe", async () => {
  const shield = createPersonalQueryObserverShield();
  await assert.rejects(shield.requestAndWait(), /no attached host/i);

  const detach = shield.attachHost();
  assert.throws(() => shield.attachHost(), /already has a host/i);
  let firstSettled = false;
  const first = shield.requestAndWait().then(() => {
    firstSettled = true;
  });
  await Promise.resolve();
  assert.equal(firstSettled, false);
  assert.equal(shield.isRequested(), true);
  shield.confirmPersonalObserversHidden();
  await first;

  await shield.requestAndWait();
  shield.release();
  assert.equal(shield.isRequested(), false);
  let secondSettled = false;
  const second = shield.requestAndWait().then(() => {
    secondSettled = true;
  });
  await Promise.resolve();
  assert.equal(secondSettled, false);
  shield.confirmPersonalObserversHidden();
  await second;
  detach();
});

test("personal query observer shield rejects pending work when its host detaches", async () => {
  const shield = createPersonalQueryObserverShield();
  const detach = shield.attachHost();
  const waiting = shield.requestAndWait();
  detach();
  await assert.rejects(waiting, /host detached/i);
});

test("prepare awaits cancellation without deleting and commit clears exactly once afterward", async () => {
  const cancellation = deferred<void>();
  let clearCalls = 0;
  let cancelCalls = 0;
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => ({
      isLoaded: true,
      userId: "user-1",
      sessionId: "session-1",
    }),
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
  while (cancelCalls === 0) await Promise.resolve();
  identity = { isLoaded: true, userId: "user-1", sessionId: "session-2" };
  cancellation.resolve();
  await assert.rejects(first, QueryCacheIdentityChangedError);
  await assert.rejects(controller.participant.commit(), /not prepared/i);
  assert.equal(clearCalls, 0);

  await controller.participant.prepare();
  await controller.participant.commit();
  assert.equal(cancelCalls, 3);
  assert.equal(clearCalls, 1);
});

test("identity change after prepare rejects only query-cache commit and never clears the replacement identity", async () => {
  const harness = controllerHarness();
  const peerGate = deferred<void>();
  const coordinator = createLocalDataResetCoordinator();
  coordinator.register({
    id: "query-cache",
    ...harness.controller.participant,
  });
  coordinator.register({
    id: "zz-peer",
    prepare: () => peerGate.promise,
    commit: async () => {},
  });

  const reset = coordinator.run();
  while (harness.cancelCalls === 0) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  harness.setIdentity({
    isLoaded: true,
    userId: "user-2",
    sessionId: "session-2",
  });
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
  await assert.rejects(
    unloaded.controller.participant.prepare(),
    /loaded auth identity/i,
  );
  assert.equal(unloaded.cancelCalls, 0);
  assert.equal(unloaded.clearCalls, 0);

  let attempt = 0;
  const cancellationFailure = createQueryCacheLocalDataResetController({
    getIdentity: () => ({ isLoaded: true, userId: null, sessionId: null }),
    cancelQueries: () => {
      attempt += 1;
      if (attempt === 1) throw new Error("cancel sync failure");
      if (attempt === 2)
        return Promise.reject(new Error("cancel async failure"));
      return Promise.resolve();
    },
    clearQueryAndMutationCaches: () => {},
  });
  await assert.rejects(
    cancellationFailure.participant.prepare(),
    /cancel sync failure/,
  );
  await assert.rejects(
    cancellationFailure.participant.prepare(),
    /cancel async failure/,
  );
  await cancellationFailure.participant.prepare();
  await cancellationFailure.participant.commit();
});

test("concurrent and cancellation-reentrant preparation starts one cancellation only", async () => {
  const cancellation = deferred<void>();
  const reentrantCalls: Promise<void>[] = [];
  let cancelCalls = 0;
  let controller!: ReturnType<typeof createQueryCacheLocalDataResetController>;
  controller = createQueryCacheLocalDataResetController({
    getIdentity: () => ({
      isLoaded: true,
      userId: "user-1",
      sessionId: "session-1",
    }),
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
  await assert.rejects(reentrantCalls[2]!, /in progress/i);
  await assert.rejects(reentrantCalls[3]!, /in progress/i);
});

test("commit misuse, concurrent calls, clear failure, and true reentry start no extra clears", async () => {
  let clearCalls = 0;
  const reentrantCommits: Promise<void>[] = [];
  const reentrantPrepares: Promise<void>[] = [];
  let controller!: ReturnType<typeof createQueryCacheLocalDataResetController>;
  controller = createQueryCacheLocalDataResetController({
    getIdentity: () => ({
      isLoaded: true,
      userId: "user-1",
      sessionId: "session-1",
    }),
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
    getIdentity: () => ({
      isLoaded: true,
      userId: "user-1",
      sessionId: "session-1",
    }),
    cancelQueries: () =>
      queryClient.cancelQueries(undefined, { revert: true, silent: true }),
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let sawAbort = false;
  let settled = false;
  const fetching = queryClient
    .fetchQuery({
      queryKey: ["deferred-generated-style"],
      queryFn: ({ signal }) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            sawAbort = true;
            reject(new Error("transport aborted"));
          });
        }),
    })
    .catch(() => {
      settled = true;
    });
  await Promise.resolve();
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => ({ isLoaded: true, userId: null, sessionId: null }),
    cancelQueries: () =>
      queryClient.cancelQueries(undefined, { revert: true, silent: true }),
    clearQueryAndMutationCaches: () => queryClient.clear(),
  });

  await controller.participant.prepare();
  assert.equal(sawAbort, true);
  assert.equal(settled, true);
  await fetching;
});

test("commit destroys a gap query and empties both real TanStack caches", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(["old"], "old data");
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => ({ isLoaded: true, userId: null, sessionId: null }),
    cancelQueries: () =>
      queryClient.cancelQueries(undefined, { revert: true, silent: true }),
    clearQueryAndMutationCaches: () => queryClient.clear(),
  });

  await controller.participant.prepare();
  let gapQueryAborted = false;
  const gapQuery = queryClient
    .fetchQuery({
      queryKey: ["gap"],
      queryFn: ({ signal }) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            gapQueryAborted = true;
            reject(new Error("gap aborted"));
          });
        }),
    })
    .catch(() => {});
  queryClient
    .getMutationCache()
    .build(queryClient, { mutationKey: ["pending-record"] });

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
  queryClient
    .getMutationCache()
    .build(queryClient, { mutationKey: ["provider-write"] });
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

test("the production query shield unmounts a real observer before the final identity-aware close", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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
  const unsubscribeObserver = observer.subscribe(() => {});
  const shield = createPersonalQueryObserverShield();
  const detachHost = shield.attachHost();
  const unsubscribeShield = shield.subscribe(() => {
    if (!shield.isRequested()) return;
    unsubscribeObserver();
    shield.confirmPersonalObserversHidden();
  });
  const events: string[] = [];
  const controller = createQueryCacheLocalDataResetController({
    getIdentity: () => ({
      isLoaded: true,
      userId: "user-1",
      sessionId: "session-1",
    }),
    waitUntilPersonalQueryConsumersUnmounted: shield.requestAndWait,
    cancelQueries: async () => {
      events.push("cancel");
    },
    clearQueryAndMutationCaches: () => {
      events.push("clear");
      queryClient.clear();
    },
  });

  await controller.participant.prepare();
  assert.equal(observer.hasListeners(), false);
  await controller.participant.commit();
  assert.deepEqual(events, ["cancel", "cancel", "clear"]);
  assert.equal(queryClient.getQueryCache().getAll().length, 0);

  const laterObserver = new QueryObserver(queryClient, {
    queryKey: ["me"],
    queryFn,
    enabled: false,
  });
  assert.equal(laterObserver.getCurrentResult().data, undefined);
  assert.equal(fetchCalls, 0);
  unsubscribeShield();
  shield.release();
  detachHost();
});

test("final close identity or clear failure remains a retryable query-cache partial failure", async () => {
  const runtime = createLocalDataResetRuntime({
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  });
  const shield = createPersonalQueryObserverShield();
  const detachHost = shield.attachHost();
  const unsubscribeShield = shield.subscribe(() => {
    if (shield.isRequested()) shield.confirmPersonalObserversHidden();
  });
  let clearCalls = 0;
  const queryController = createQueryCacheLocalDataResetController({
    getIdentity: () => ({
      isLoaded: true,
      userId: "user-1",
      sessionId: "session-1",
    }),
    waitUntilPersonalQueryConsumersUnmounted: shield.requestAndWait,
    cancelQueries: async () => {},
    clearQueryAndMutationCaches: () => {
      clearCalls += 1;
      if (clearCalls === 1) throw new Error("final clear failed");
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

  assert.deepEqual(await runtime.operations.runReset(), {
    status: "partial-failure",
    committedParticipantIds: [
      "avatar",
      "care",
      "device-preferences",
      "files",
      "walk-capture",
      "web-runtime",
      "work-drain",
      "auth-credentials",
    ],
    failedParticipantIds: ["query-cache"],
  });
  shield.release();
  assert.equal((await runtime.operations.runReset()).status, "complete");
  unsubscribeShield();
  detachHost();
});

test("a final cancellation rejection remains an exact query-cache partial failure", async () => {
  const runtime = createLocalDataResetRuntime({
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  });
  const shield = createPersonalQueryObserverShield();
  const detachHost = shield.attachHost();
  const unsubscribeShield = shield.subscribe(() => {
    if (shield.isRequested()) shield.confirmPersonalObserversHidden();
  });
  let cancellationCalls = 0;
  const queryController = createQueryCacheLocalDataResetController({
    getIdentity: () => ({
      isLoaded: true,
      userId: "user-1",
      sessionId: "session-1",
    }),
    waitUntilPersonalQueryConsumersUnmounted: shield.requestAndWait,
    cancelQueries: async () => {
      cancellationCalls += 1;
      if (cancellationCalls === 2) {
        throw new Error("final cancellation failed");
      }
    },
    clearQueryAndMutationCaches: () => {},
  });
  for (const id of REQUIRED_LOCAL_DATA_PARTICIPANT_IDS) {
    runtime.attachRequiredParticipant(
      id,
      id === "query-cache"
        ? queryController.participant
        : { prepare: async () => {}, commit: async () => {} },
    );
  }

  assert.deepEqual(await runtime.operations.runReset(), {
    status: "partial-failure",
    committedParticipantIds: [
      "avatar",
      "care",
      "device-preferences",
      "files",
      "walk-capture",
      "web-runtime",
      "work-drain",
      "auth-credentials",
    ],
    failedParticipantIds: ["query-cache"],
  });
  assert.deepEqual(runtime.operations.getState(), {
    status: "failed",
    operation: "delete",
    failedParticipantIds: ["query-cache"],
  });
  shield.release();
  assert.equal((await runtime.operations.runReset()).status, "complete");
  unsubscribeShield();
  detachHost();
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
  const harnessIdentity = {
    isLoaded: true,
    userId: "user-1",
    sessionId: "session-1",
  };
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
  assert.deepEqual(events, ["cancel", "cancel", "clear", "cancel", "clear"]);
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
  await assert.rejects(
    controller.finalizeForIdentity(expected),
    QueryCacheIdentityChangedError,
  );
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

  await assert.rejects(
    controller.finalizeForIdentity(expected),
    QueryCacheIdentityChangedError,
  );
  identity = { isLoaded: true, userId: "user-1", sessionId: "session-1" };
  await assert.rejects(
    controller.finalizeForIdentity(expected),
    /final clear failed/,
  );
  assert.equal(clearCalls, 2);
});
