import "./test-support/reactDomLifecycleHost.test.ts";

import assert from "node:assert/strict";
import { test } from "node:test";
import React, { act, useEffect, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";

import { LocalDataResetAppShield } from "@/components/LocalDataResetAppShield";
import { QueryCacheAuthIdentityBoundary } from "@/components/QueryCacheAuthIdentityBoundary";
import {
  LocalDataResetProvider,
  useLocalDataReset,
  type LocalDataResetContextValue,
} from "@/context/LocalDataResetContext";
import {
  QueryCacheLocalDataResetProvider,
  useQueryCacheLocalDataReset,
  type QueryCacheLocalDataResetContextValue,
} from "@/context/QueryCacheLocalDataResetContext";
import { REQUIRED_LOCAL_DATA_PARTICIPANT_IDS } from "./localDataResetRuntime.ts";
import {
  createHouseholdOperationController,
  runHouseholdSwitchOperation,
  type HouseholdOperationPermit,
} from "./householdOperation.ts";
import {
  document,
  type MiniElement,
} from "./test-support/reactDomLifecycleHost.test.ts";
import {
  getRendererCareIdentityScopeKey,
  getRendererInitialSyncRetryCalls,
  getRendererIdentityScopeRetryCalls,
  getRendererLocalHydrationRetryCalls,
  getRendererAuthIdentity,
  resetRendererAuthIdentity,
  setRendererCareIdentityScopeKey,
  setRendererInitialSyncRetryHandler,
  setRendererInitialSyncStatus,
  setRendererIdentityScopeRetryHandler,
  setRendererIdentityScopeStatus,
  setRendererLocalHydrationRetryHandler,
  setRendererStorageWarning,
  setRendererAuthIdentity,
  useCare,
  useWoofAuth,
} from "./test-support/localDataRendererAdapters.test.ts";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function careIdentityScopeKey(
  userId: string,
  sessionId: string,
  householdId: string,
): string {
  return JSON.stringify([userId, sessionId, householdId]);
}

function personalScopeLabel(scopeKey: string): string {
  return `personal-scope-${encodeURIComponent(scopeKey)}`;
}

function combine(cleanups: Array<() => void>): () => void {
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

test("real shipping shield and providers wait for a mounted personal query consumer through partial retry and complete", async () => {
  resetRendererAuthIdentity();
  const firstFilesPrepareStarted = deferred();
  const releaseFirstFilesPrepare = deferred();
  const events: string[] = [];
  let resetApi: LocalDataResetContextValue | null = null;
  let filesPrepareCalls = 0;
  let personalMounts = 0;
  let observersAtClear = -1;
  let observersAtFirstCancel = -1;
  let cleanupObservedAtClear = false;
  let cleanupObservedAtFirstCancel = false;

  function RequiredOwners(): null {
    const api = useLocalDataReset();
    resetApi = api;
    useEffect(() => {
      const cleanups = REQUIRED_LOCAL_DATA_PARTICIPANT_IDS.filter(
        (id) => id !== "query-cache",
      ).map((id) =>
        api.attachRequiredParticipant(id, {
          async prepare() {
            if (id !== "files") return;
            filesPrepareCalls += 1;
            if (filesPrepareCalls === 1) {
              firstFilesPrepareStarted.resolve();
              await releaseFirstFilesPrepare.promise;
              throw new Error("first files reset fails");
            }
          },
          async commit() {},
        }),
      );
      return combine(cleanups);
    }, [api.attachRequiredParticipant]);
    return null;
  }

  function PersonalQueryConsumer(): React.JSX.Element {
    useQuery({
      queryKey: ["personal", "phoenix"],
      queryFn: async () => "Phoenix",
      initialData: "Phoenix",
    });
    useLayoutEffect(() => {
      personalMounts += 1;
      events.push("personal-layout-mounted");
      return () => {
        events.push("personal-layout-cleanup");
      };
    }, []);
    return <div aria-label="personal-query-consumer">personal</div>;
  }

  function Harness(): React.JSX.Element {
    return (
      <LocalDataResetProvider>
        <QueryCacheLocalDataResetProvider>
          <RequiredOwners />
          <LocalDataResetAppShield>
            <QueryCacheAuthIdentityBoundary>
              <PersonalQueryConsumer />
            </QueryCacheAuthIdentityBoundary>
          </LocalDataResetAppShield>
        </QueryCacheLocalDataResetProvider>
      </LocalDataResetProvider>
    );
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const originalCancelQueries = queryClient.cancelQueries.bind(queryClient);
  queryClient.cancelQueries = async (...args) => {
    if (observersAtFirstCancel === -1) {
      observersAtFirstCancel =
        queryClient
          .getQueryCache()
          .find({ queryKey: ["personal", "phoenix"] })
          ?.getObserversCount() ?? 0;
      cleanupObservedAtFirstCancel = events.includes("personal-layout-cleanup");
      events.push("query-cache-first-cancel");
    }
    return originalCancelQueries(...args);
  };
  const originalClear = queryClient.clear.bind(queryClient);
  queryClient.clear = () => {
    observersAtClear =
      queryClient
        .getQueryCache()
        .find({ queryKey: ["personal", "phoenix"] })
        ?.getObserversCount() ?? 0;
    cleanupObservedAtClear = events.includes("personal-layout-cleanup");
    events.push("query-cache-clear");
    originalClear();
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    await waitForRendered(
      () => find(container, "personal-query-consumer"),
      "the initial renderer identity to be admitted",
    );
    // Initial singleton-cache admission intentionally performs its own close.
    // Reset the probes so the assertions below describe the deletion cycle.
    events.length = 0;
    observersAtClear = -1;
    observersAtFirstCancel = -1;
    cleanupObservedAtClear = false;
    cleanupObservedAtFirstCancel = false;

    assert.ok(resetApi);
    assert.equal(personalMounts, 1);
    assert.equal(
      queryClient
        .getQueryCache()
        .find({ queryKey: ["personal", "phoenix"] })
        ?.getObserversCount(),
      1,
      "the mounted personal query consumer owns one QueryObserver",
    );

    let firstResetSettled = false;
    let firstReset!: ReturnType<LocalDataResetContextValue["runReset"]>;
    await act(async () => {
      firstReset = resetApi!.runReset();
      void firstReset.then(() => {
        firstResetSettled = true;
        events.push("first-reset-settled");
      });
      await firstFilesPrepareStarted.promise;
    });

    assert.equal(firstResetSettled, false);
    assert.equal(
      queryClient
        .getQueryCache()
        .find({ queryKey: ["personal", "phoenix"] })
        ?.getObserversCount(),
      0,
      "React removed the production useQuery observer before reset could settle",
    );
    assert.ok(events.includes("personal-layout-cleanup"));
    assert.equal(observersAtFirstCancel, 0);
    assert.equal(cleanupObservedAtFirstCancel, true);
    assert.ok(
      events.indexOf("personal-layout-cleanup") <
        events.indexOf("query-cache-first-cancel"),
      "the real shield layout cleanup/ack precedes query-cache preparation",
    );
    assert.ok(
      container.querySelector(
        '[aria-label="Deleting all local WoofWatcher data"]',
      ),
    );
    assert.equal(find(container, "personal-query-consumer"), null);
    assert.equal(find(container, "Local care content deleted"), null);
    assert.equal(
      observersAtClear,
      -1,
      "no owner commits after a prepare failure",
    );

    releaseFirstFilesPrepare.resolve();
    let firstResult!: Awaited<typeof firstReset>;
    await act(async () => {
      firstResult = await firstReset;
    });
    assert.equal(firstResult.status, "partial-failure");
    assert.deepEqual(firstResult.failedParticipantIds, ["files"]);
    assert.ok(
      events.indexOf("personal-layout-cleanup") <
        events.indexOf("first-reset-settled"),
      "the root reset cannot settle before React observer cleanup",
    );
    assert.ok(find(container, "Local data deletion needs attention"));
    assert.ok(find(container, "Files on this device. Failed owner ID: files"));
    assert.equal(find(container, "personal-query-consumer"), null);
    assert.equal(find(container, "Local care content deleted"), null);

    const retry = find(container, "Retry deleting all local data");
    assert.ok(retry);
    await act(async () => {
      retry.click();
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
    await waitForRendered(
      () => find(container, "Local care content deleted"),
      "the fresh coordinated retry to reach its complete verdict",
    );

    assert.equal(
      filesPrepareCalls,
      2,
      "Retry starts a fresh coordinated reset",
    );
    assert.equal(observersAtClear, 0);
    assert.equal(cleanupObservedAtClear, true);
    assert.ok(
      events.indexOf("personal-layout-cleanup") <
        events.indexOf("query-cache-clear"),
      "the React layout cleanup/ack happens before query-cache commit clears",
    );
    assert.ok(find(container, "Local care content deleted"));
    assert.equal(find(container, "Local data deletion needs attention"), null);
    assert.equal(find(container, "personal-query-consumer"), null);
    assert.equal(personalMounts, 1);

    const continueButton = find(
      container,
      "Continue after local data deletion",
    );
    assert.ok(continueButton);
    await act(async () => {
      continueButton.click();
    });

    assert.ok(find(container, "personal-query-consumer"));
    assert.equal(find(container, "Local care content deleted"), null);
    assert.equal(personalMounts, 2);
    assert.equal(
      queryClient
        .getQueryCache()
        .find({ queryKey: ["personal", "phoenix"] })
        ?.getObserversCount(),
      1,
      "Continue clearResult/release is the only personal query consumer remount path",
    );
  } finally {
    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    document.body.removeChild(container);
  }
});

test("resolved signed-in and local admission wait for their current Care readiness", async () => {
  resetRendererAuthIdentity();
  setRendererInitialSyncStatus({
    state: "pending",
    isSettled: false,
    message: null,
    retryable: false,
  });

  function FormerlySharedCachedRow(): React.JSX.Element {
    return (
      <div aria-label="formerly-shared-cached-row">stale private care note</div>
    );
  }

  function Harness(): React.JSX.Element {
    return (
      <LocalDataResetProvider>
        <QueryCacheLocalDataResetProvider>
          <QueryCacheAuthIdentityBoundary>
            <FormerlySharedCachedRow />
          </QueryCacheAuthIdentityBoundary>
        </QueryCacheLocalDataResetProvider>
      </LocalDataResetProvider>
    );
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    await waitForRendered(
      () => findAlert(container, "Refreshing care records…"),
      "the pending initial Care sync shield",
    );
    assert.equal(
      find(container, "formerly-shared-cached-row"),
      null,
      "resolved identity alone cannot mount formerly-shared cached Care data",
    );

    await act(async () => {
      setRendererStorageWarning("newer-version");
    });
    assert.ok(findAlert(container, "WoofWatcher update required"));
    assert.equal(find(container, "Retry care refresh"), null);
    assert.equal(find(container, "formerly-shared-cached-row"), null);
    await act(async () => {
      setRendererStorageWarning(null);
    });

    await act(async () => {
      setRendererInitialSyncStatus({
        state: "error",
        isSettled: false,
        message: "This Care cache needs a newer WoofWatcher version.",
        retryable: false,
      });
    });
    assert.ok(findAlert(container, "Care refresh needs attention"));
    assert.equal(find(container, "Retry care refresh"), null);
    assert.equal(find(container, "formerly-shared-cached-row"), null);

    await act(async () => {
      setRendererInitialSyncStatus({
        state: "error",
        isSettled: false,
        message: "WoofWatcher could not replace cached Care records.",
        retryable: true,
      });
    });
    const careRefreshAlert = findAlert(
      container,
      "Care refresh needs attention",
    );
    assert.ok(careRefreshAlert);
    assert.match(
      careRefreshAlert.getAttribute("aria-label") ?? "",
      /WoofWatcher could not replace cached Care records\./,
    );
    assert.equal(find(container, "formerly-shared-cached-row"), null);
    setRendererInitialSyncRetryHandler(() => {
      setRendererInitialSyncStatus({
        state: "pending",
        isSettled: false,
        message: null,
        retryable: false,
      });
    });
    const retry = find(container, "Retry care refresh");
    assert.ok(retry);
    await act(async () => retry.click());
    assert.equal(getRendererInitialSyncRetryCalls(), 1);
    assert.ok(findAlert(container, "Refreshing care records…"));
    assert.equal(find(container, "formerly-shared-cached-row"), null);

    await act(async () => {
      setRendererInitialSyncStatus({
        state: "settled",
        isSettled: true,
        message: null,
        retryable: false,
      });
    });
    await waitForRendered(
      () => find(container, "formerly-shared-cached-row"),
      "the exact signed-in generation to settle",
    );

    await act(async () => {
      setRendererInitialSyncStatus({
        state: "pending",
        isSettled: false,
        message: null,
        retryable: false,
      });
      setRendererCareIdentityScopeKey(null);
      setRendererIdentityScopeStatus({
        state: "local",
        message: null,
        retryable: false,
      });
      setRendererAuthIdentity({
        isLoaded: true,
        isSignedIn: false,
        userId: null,
        sessionId: null,
      });
    });
    await waitForRendered(
      () => findAlert(container, "Loading local care data…"),
      "local hydration before local-mode admission",
    );
    assert.equal(find(container, "formerly-shared-cached-row"), null);

    await act(async () => {
      setRendererStorageWarning("read-failed");
    });
    assert.ok(findAlert(container, "Local care data needs attention"));
    assert.equal(find(container, "formerly-shared-cached-row"), null);
    setRendererLocalHydrationRetryHandler(() => {
      setRendererStorageWarning(null);
    });
    const retryLocalCare = find(container, "Retry loading local care data");
    assert.ok(retryLocalCare);
    await act(async () => retryLocalCare.click());
    assert.equal(getRendererLocalHydrationRetryCalls(), 1);
    assert.ok(findAlert(container, "Loading local care data…"));
    assert.equal(find(container, "formerly-shared-cached-row"), null);

    await act(async () => {
      setRendererInitialSyncStatus({
        state: "settled",
        isSettled: true,
        message: null,
        retryable: false,
      });
    });
    await waitForRendered(
      () => find(container, "formerly-shared-cached-row"),
      "local mode admission after successful local hydration",
    );
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
    document.body.removeChild(container);
    resetRendererAuthIdentity();
  }
});

test("real auth boundary clears A before direct B and sign-out-to-B admission", async () => {
  setRendererCareIdentityScopeKey(
    careIdentityScopeKey("user-a", "session-a", "household-a"),
  );
  setRendererIdentityScopeStatus({
    state: "resolved",
    message: null,
    retryable: false,
  });
  setRendererAuthIdentity({
    isLoaded: true,
    isSignedIn: true,
    userId: "user-a",
    sessionId: "session-a",
  });

  const events: string[] = [];
  const crossIdentityRenders: string[] = [];
  const crossScopeRenders: string[] = [];
  const providerMutationGate = deferred();
  let resetApi: LocalDataResetContextValue | null = null;
  let failNextCancellation = false;

  function CaptureResetApi(): null {
    resetApi = useLocalDataReset();
    return null;
  }

  function PersonalMeConsumer(): React.JSX.Element {
    const auth = useWoofAuth();
    const care = useCare();
    const me = useQuery({
      queryKey: ["/api/me"],
      queryFn: async () => ({
        owner: getRendererAuthIdentity().userId,
        scope: getRendererCareIdentityScopeKey(),
      }),
      enabled: auth.isSignedIn,
      staleTime: Number.POSITIVE_INFINITY,
    });
    const owner = me.data?.owner ?? null;
    if (owner && owner !== auth.userId) {
      crossIdentityRenders.push(
        `${String(owner)}-under-${String(auth.userId)}`,
      );
    }
    if (owner && !auth.isSignedIn) {
      crossIdentityRenders.push(`${String(owner)}-while-signed-out`);
    }
    if (
      me.data?.scope &&
      care.identityScopeKey &&
      me.data.scope !== care.identityScopeKey
    ) {
      crossScopeRenders.push(`${me.data.scope}-under-${care.identityScopeKey}`);
    }
    useLayoutEffect(() => {
      events.push(`consumer-mounted:${String(auth.userId)}`);
      return () => {
        events.push(`consumer-cleanup:${String(auth.userId)}`);
      };
    }, [auth.userId]);
    return (
      <div aria-label={`personal-owner-${owner ?? "none"}`}>
        <div aria-label={personalScopeLabel(me.data?.scope ?? "none")}>
          {me.data?.scope ?? "none"}
        </div>
      </div>
    );
  }

  function Harness(): React.JSX.Element {
    return (
      <LocalDataResetProvider>
        <QueryCacheLocalDataResetProvider>
          <CaptureResetApi />
          <LocalDataResetAppShield>
            <QueryCacheAuthIdentityBoundary>
              <PersonalMeConsumer />
            </QueryCacheAuthIdentityBoundary>
          </LocalDataResetAppShield>
        </QueryCacheLocalDataResetProvider>
      </LocalDataResetProvider>
    );
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const originalCancelQueries = queryClient.cancelQueries.bind(queryClient);
  queryClient.cancelQueries = async (...args) => {
    events.push(`cancel:${String(getRendererAuthIdentity().userId)}`);
    if (failNextCancellation) {
      failNextCancellation = false;
      events.push("cancel:injected-failure");
      throw new Error("Injected A cancellation failure");
    }
    await originalCancelQueries(...args);
  };
  const originalClear = queryClient.clear.bind(queryClient);
  queryClient.clear = () => {
    const observers =
      queryClient
        .getQueryCache()
        .find({ queryKey: ["/api/me"] })
        ?.getObserversCount() ?? 0;
    events.push(
      `clear:${String(getRendererAuthIdentity().userId)}:observers-${observers}`,
    );
    originalClear();
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    await waitForRendered(
      () => find(container, "personal-owner-user-a"),
      "user A's fresh query after initial cache admission",
    );
    assert.ok(resetApi);

    let slowQueryAborted = false;
    const slowQuery = queryClient
      .fetchQuery({
        queryKey: ["personal", "slow-a"],
        queryFn: ({ signal }) =>
          new Promise<string>((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              slowQueryAborted = true;
              reject(new Error("A query aborted"));
            });
          }),
      })
      .catch(() => {});
    const trackedMutation = resetApi!.runTrackedLocalDataWork(async () => {
      events.push("mutation-a:start");
      await providerMutationGate.promise;
      events.push("mutation-a:settled");
    });

    failNextCancellation = true;
    await act(async () => {
      setRendererCareIdentityScopeKey(null);
      setRendererIdentityScopeStatus({
        state: "pending",
        message: null,
        retryable: false,
      });
      setRendererAuthIdentity({
        isLoaded: true,
        isSignedIn: true,
        userId: "user-b",
        sessionId: "session-b",
      });
    });
    assert.equal(find(container, "personal-owner-user-a"), null);
    assert.equal(find(container, "personal-owner-user-b"), null);
    await waitForRendered(
      () => find(container, "Retry securing account data"),
      "the fail-closed query cleanup error",
    );
    const detailedCacheAlert = find(
      container,
      "Account data protection needs attention. WoofWatcher could not safely prepare the private account cache. Retry before continuing.",
    );
    assert.ok(detailedCacheAlert);
    assert.equal(detailedCacheAlert.getAttribute("role"), "alert");
    assert.equal(
      queryClient
        .getQueryCache()
        .find({ queryKey: ["/api/me"] })
        ?.getObserversCount() ?? 0,
      0,
      "the A observer is gone in the same committed B auth render",
    );
    assert.equal(
      events.some((event) => event.startsWith("clear:user-b")),
      false,
      "a failed cancellation cannot clear or admit B",
    );
    assert.equal(slowQueryAborted, false);

    const retryCacheCleanup = find(container, "Retry securing account data");
    assert.ok(retryCacheCleanup);
    failNextCancellation = true;
    await act(async () => {
      retryCacheCleanup.click();
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
    assert.ok(
      find(
        container,
        "Account data protection needs attention. WoofWatcher could not safely prepare the private account cache. Retry before continuing.",
      ),
      "a second cleanup failure stays in the reachable failed state",
    );
    const retryAfterSecondFailure = find(
      container,
      "Retry securing account data",
    );
    assert.ok(retryAfterSecondFailure);
    assert.equal(
      retryAfterSecondFailure.parentNode === detailedCacheAlert,
      false,
      "the retry action remains a separate reachable control from the alert",
    );
    await act(async () => {
      retryAfterSecondFailure.click();
    });
    assert.equal(find(container, "personal-owner-user-a"), null);
    assert.equal(find(container, "personal-owner-user-b"), null);

    await waitForCondition(
      () => slowQueryAborted,
      "the active A query to receive cancellation",
    );
    assert.equal(
      events.some((event) => event.startsWith("clear:user-b")),
      false,
      "B cannot be admitted while A's tracked provider mutation is active",
    );

    await act(async () => {
      setRendererCareIdentityScopeKey(
        careIdentityScopeKey("user-b", "session-b", "household-b"),
      );
      setRendererIdentityScopeStatus({
        state: "resolved",
        message: null,
        retryable: false,
      });
    });
    assert.equal(find(container, "personal-owner-user-a"), null);
    assert.equal(find(container, "personal-owner-user-b"), null);

    providerMutationGate.resolve();
    await trackedMutation;
    await slowQuery;
    await waitForRendered(
      () => find(container, "personal-owner-user-b"),
      "direct user B admission after A cleanup",
    );
    assert.ok(
      events.includes("clear:user-b:observers-0"),
      "the real A observer is unmounted before the singleton cache clear",
    );

    await act(async () => {
      setRendererCareIdentityScopeKey(null);
      setRendererIdentityScopeStatus({
        state: "local",
        message: null,
        retryable: false,
      });
      setRendererAuthIdentity({
        isLoaded: true,
        isSignedIn: false,
        userId: null,
        sessionId: null,
      });
    });
    await waitForRendered(
      () => find(container, "personal-owner-none"),
      "signed-out admission after B cache cleanup",
    );
    assert.equal(find(container, "personal-owner-user-b"), null);

    await act(async () => {
      setRendererIdentityScopeStatus({
        state: "pending",
        message: null,
        retryable: false,
      });
      setRendererAuthIdentity({
        isLoaded: true,
        isSignedIn: true,
        userId: null,
        sessionId: null,
      });
    });
    assert.equal(
      find(container, "personal-owner-none"),
      null,
      "signed-in bootstrap cannot reuse the admitted signed-out projection",
    );
    assert.ok(findAlert(container, "Checking your account…"));

    await act(async () => {
      setRendererIdentityScopeStatus({
        state: "pending",
        message: null,
        retryable: false,
      });
      setRendererAuthIdentity({
        isLoaded: true,
        isSignedIn: true,
        userId: "user-c",
        sessionId: "session-c",
      });
    });
    assert.equal(find(container, "personal-owner-user-b"), null);
    assert.equal(find(container, "personal-owner-user-c"), null);
    await act(async () => {
      setRendererCareIdentityScopeKey(
        careIdentityScopeKey("user-c", "session-c", "household-c"),
      );
      setRendererIdentityScopeStatus({
        state: "resolved",
        message: null,
        retryable: false,
      });
    });
    await waitForRendered(
      () => find(container, "personal-owner-user-c"),
      "signed-out to user C admission after cache cleanup",
    );

    await act(async () => {
      setRendererCareIdentityScopeKey(null);
      setRendererIdentityScopeStatus({
        state: "pending",
        message: null,
        retryable: false,
      });
    });
    assert.equal(find(container, "personal-owner-user-c"), null);
    await act(async () => {
      setRendererCareIdentityScopeKey(
        careIdentityScopeKey("user-c", "session-c", "household-d"),
      );
      setRendererIdentityScopeStatus({
        state: "resolved",
        message: null,
        retryable: false,
      });
    });
    await waitForRendered(
      () =>
        find(
          container,
          personalScopeLabel(
            careIdentityScopeKey("user-c", "session-c", "household-d"),
          ),
        ),
      "same-user replacement household admission after cache cleanup",
    );

    await act(async () => {
      setRendererCareIdentityScopeKey(null);
      setRendererIdentityScopeStatus({
        state: "error",
        message: "The exact household check failed after bounded retries.",
        retryable: true,
      });
    });
    assert.equal(find(container, "personal-owner-user-c"), null);
    assert.ok(findAlert(container, "Account check needs attention"));
    assert.match(
      container.textContent,
      /The exact household check failed after bounded retries\./,
    );
    setRendererIdentityScopeRetryHandler(() => {
      setRendererIdentityScopeStatus({
        state: "pending",
        message: null,
        retryable: false,
      });
    });
    const retryAccountCheck = find(container, "Retry account check");
    assert.ok(retryAccountCheck);
    await act(async () => {
      retryAccountCheck.click();
    });
    assert.equal(getRendererIdentityScopeRetryCalls(), 1);
    assert.equal(findAlert(container, "Account check needs attention"), null);
    assert.ok(
      findAlert(container, "Checking your account…") ??
        findAlert(container, "Securing account data…"),
    );

    await act(async () => {
      setRendererCareIdentityScopeKey(
        careIdentityScopeKey("user-c", "session-c", "household-e"),
      );
      setRendererIdentityScopeStatus({
        state: "resolved",
        message: null,
        retryable: false,
      });
    });
    await waitForRendered(
      () =>
        find(
          container,
          personalScopeLabel(
            careIdentityScopeKey("user-c", "session-c", "household-e"),
          ),
        ),
      "the manually retried exact household to be admitted",
    );

    await act(async () => {
      setRendererCareIdentityScopeKey(null);
      setRendererIdentityScopeStatus({
        state: "error",
        message: "Stale user C household error.",
        retryable: true,
      });
    });
    const staleRetry = find(container, "Retry account check");
    assert.ok(staleRetry);
    await act(async () => {
      setRendererIdentityScopeStatus({
        state: "pending",
        message: null,
        retryable: false,
      });
      setRendererAuthIdentity({
        isLoaded: true,
        isSignedIn: true,
        userId: "user-d",
        sessionId: "session-d",
      });
    });
    assert.equal(find(container, "Retry account check"), null);
    await act(async () => {
      staleRetry.click();
    });
    assert.equal(
      getRendererIdentityScopeRetryCalls(),
      1,
      "the unmounted user C retry cannot affect user D",
    );
    await act(async () => {
      setRendererCareIdentityScopeKey(
        careIdentityScopeKey("user-d", "session-d", "household:d"),
      );
      setRendererIdentityScopeStatus({
        state: "resolved",
        message: null,
        retryable: false,
      });
    });
    await waitForRendered(
      () => find(container, "personal-owner-user-d"),
      "user D admission after stale user C retry invalidation",
    );
    assert.ok(
      find(
        container,
        personalScopeLabel(
          careIdentityScopeKey("user-d", "session-d", "household:d"),
        ),
      ),
      "the auth boundary treats collision-free scope tuples as opaque keys",
    );

    assert.deepEqual(
      crossIdentityRenders,
      [],
      "no cached owner projection ever rendered under a replacement identity",
    );
    assert.deepEqual(
      crossScopeRenders,
      [],
      "no cached household projection ever rendered under a replacement scope",
    );
  } finally {
    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    document.body.removeChild(container);
    resetRendererAuthIdentity();
  }
});

test("shipping household Switch waits for real A observer cleanup before activation and admits only rediscovered B", async () => {
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
  setRendererCareIdentityScopeKey(householdAScope);
  setRendererIdentityScopeStatus({
    state: "resolved",
    message: null,
    retryable: false,
  });
  setRendererAuthIdentity({
    isLoaded: true,
    isSignedIn: true,
    userId: "user-a",
    sessionId: "session-a",
  });

  const mutationGate = deferred();
  const events: string[] = [];
  let queryApi: QueryCacheLocalDataResetContextValue | null = null;
  let resetApi: LocalDataResetContextValue | null = null;

  function CaptureApis(): null {
    queryApi = useQueryCacheLocalDataReset();
    resetApi = useLocalDataReset();
    return null;
  }

  function PersonalHouseholdConsumer(): React.JSX.Element {
    const care = useCare();
    useQuery({
      queryKey: ["household-personal", care.identityScopeKey],
      queryFn: async () => care.identityScopeKey,
      initialData: care.identityScopeKey,
      staleTime: Number.POSITIVE_INFINITY,
    });
    useLayoutEffect(() => {
      events.push("personal-a-mounted");
      return () => {
        events.push("personal-a-cleanup");
      };
    }, []);
    return <div aria-label="household-personal-consumer">personal</div>;
  }

  function Harness(): React.JSX.Element {
    return (
      <LocalDataResetProvider>
        <QueryCacheLocalDataResetProvider>
          <CaptureApis />
          <QueryCacheAuthIdentityBoundary>
            <PersonalHouseholdConsumer />
          </QueryCacheAuthIdentityBoundary>
        </QueryCacheLocalDataResetProvider>
      </LocalDataResetProvider>
    );
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const originalCancelQueries = queryClient.cancelQueries.bind(queryClient);
  queryClient.cancelQueries = async (...args) => {
    const observers =
      queryClient
        .getQueryCache()
        .find({ queryKey: ["household-personal", householdAScope] })
        ?.getObserversCount() ?? 0;
    events.push(`cancel-a:observers-${observers}`);
    await originalCancelQueries(...args);
  };
  const originalClear = queryClient.clear.bind(queryClient);
  queryClient.clear = () => {
    const observers =
      queryClient
        .getQueryCache()
        .find({ queryKey: ["household-personal", householdAScope] })
        ?.getObserversCount() ?? 0;
    events.push(`clear-a:observers-${observers}`);
    originalClear();
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    await waitForRendered(
      () => find(container, "household-personal-consumer"),
      "household A to be admitted",
    );
    assert.ok(queryApi);
    assert.ok(resetApi);
    events.length = 0;

    const trackedA = resetApi!.runTrackedLocalDataWork(async () => {
      events.push("tracked-a:start");
      await mutationGate.promise;
      events.push("tracked-a:end");
    });
    await waitForCondition(
      () => events.includes("tracked-a:start"),
      "the admitted A mutation to start",
    );

    let activationStarted = false;
    let switching!: ReturnType<typeof runHouseholdSwitchOperation>;
    const householdOperationController = createHouseholdOperationController();
    const permitA: HouseholdOperationPermit = Object.freeze({
      generation: 1,
      dataScope: householdAScope,
      userId: "user-a",
      sessionId: "session-a",
      householdId: "household-a",
      identityKey: householdAScope,
    });
    const careToken = Object.freeze({ transition: "a-to-b" });
    await act(async () => {
      switching = runHouseholdSwitchOperation({
        controller: householdOperationController,
        permit: permitA,
        targetHouseholdId: "household-b",
        beginCareTransition() {
          events.push("care-a-suspended");
          setRendererCareIdentityScopeKey(null);
          setRendererIdentityScopeStatus({
            state: "pending",
            message: null,
            retryable: false,
          });
          return careToken;
        },
        prepareQueryTransition: queryApi!.prepareHouseholdTransition,
        runTrackedTransport: (start) =>
          resetApi!.runTrackedLocalDataWork(async (scope) => {
            assert.equal(scope.isCurrent(), true);
            return start();
          }),
        async activateTransport(targetHouseholdId, expectedSourceHouseholdId) {
          assert.equal(targetHouseholdId, "household-b");
          assert.equal(expectedSourceHouseholdId, "household-a");
          activationStarted = true;
          events.push("switch-transport-admitted");
          // This mixed response must never become rendered authority.
          return { household: { id: "household-c" } };
        },
        resumeCareTransition(token) {
          assert.equal(token, careToken);
          events.push("care-resumed-for-fresh-me");
          return true;
        },
      });
      assert.equal(activationStarted, false);
    });

    assert.equal(find(container, "household-personal-consumer"), null);
    assert.ok(events.includes("personal-a-cleanup"));
    assert.ok(events.includes("cancel-a:observers-0"));
    assert.equal(activationStarted, false);
    assert.equal(
      events.some((event) => event.startsWith("clear-a")),
      false,
      "the cache cannot clear before admitted A work drains",
    );

    mutationGate.resolve();
    await trackedA;
    await act(async () => {
      await switching;
    });
    assert.equal(activationStarted, true);
    const cleanupAt = events.indexOf("personal-a-cleanup");
    const firstCancelAt = events.indexOf("cancel-a:observers-0");
    const drainEndAt = events.indexOf("tracked-a:end");
    const clearAt = events.indexOf("clear-a:observers-0");
    const transportAt = events.indexOf("switch-transport-admitted");
    assert.ok(cleanupAt >= 0 && cleanupAt < firstCancelAt);
    assert.ok(firstCancelAt < drainEndAt);
    assert.ok(drainEndAt < clearAt);
    assert.ok(clearAt < transportAt);
    assert.equal(find(container, "household-personal-consumer"), null);
    assert.ok(
      events.indexOf("care-resumed-for-fresh-me") > transportAt,
      "Care resolution cannot resume before activation settles",
    );
    assert.doesNotMatch(
      JSON.stringify(householdOperationController.getSnapshot()),
      /household-b|household-c/,
    );

    await act(async () => {
      setRendererCareIdentityScopeKey(householdBScope);
      setRendererIdentityScopeStatus({
        state: "resolved",
        message: null,
        retryable: false,
      });
    });
    await waitForRendered(
      () => find(container, "household-personal-consumer"),
      "fresh server-authoritative household B to be admitted",
    );
  } finally {
    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    document.body.removeChild(container);
    resetRendererAuthIdentity();
  }
});

function find(
  container: MiniElement,
  accessibilityLabel: string,
): MiniElement | null {
  return container.querySelector(`[aria-label="${accessibilityLabel}"]`);
}

function findAlert(container: MiniElement, title: string): MiniElement | null {
  const alert = container.querySelector('[role="alert"]');
  return alert?.getAttribute("aria-label")?.includes(title) ? alert : null;
}

async function waitForRendered<T>(
  condition: () => T | null | undefined | false,
  description: string,
): Promise<T> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = condition();
    if (result) return result;
    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

async function waitForCondition(
  condition: () => boolean,
  description: string,
): Promise<void> {
  await waitForRendered(() => (condition() ? true : null), description);
}
