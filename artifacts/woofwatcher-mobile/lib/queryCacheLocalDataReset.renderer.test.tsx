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
import {
  LocalDataResetProvider,
  useLocalDataReset,
  type LocalDataResetContextValue,
} from "@/context/LocalDataResetContext";
import { QueryCacheLocalDataResetProvider } from "@/context/QueryCacheLocalDataResetContext";
import { REQUIRED_LOCAL_DATA_PARTICIPANT_IDS } from "./localDataResetRuntime.ts";
import { document, type MiniElement } from "./test-support/reactDomLifecycleHost.test.ts";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function combine(cleanups: Array<() => void>): () => void {
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

test("shipping reset waits for the real AppFrame query observer and stays shielded through partial retry and complete", async () => {
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

  function PersonalAppFrame(): React.JSX.Element {
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
    return <div aria-label="personal-app-frame">personal</div>;
  }

  function Harness(): React.JSX.Element {
    return (
      <LocalDataResetProvider>
        <QueryCacheLocalDataResetProvider>
          <RequiredOwners />
          <LocalDataResetAppShield>
            <PersonalAppFrame />
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
      cleanupObservedAtFirstCancel = events.includes(
        "personal-layout-cleanup",
      );
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

    assert.ok(resetApi);
    assert.equal(personalMounts, 1);
    assert.equal(
      queryClient
        .getQueryCache()
        .find({ queryKey: ["personal", "phoenix"] })
        ?.getObserversCount(),
      1,
      "the mounted AppFrame owns one real QueryObserver",
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
    assert.equal(find(container, "personal-app-frame"), null);
    assert.equal(find(container, "All data deleted"), null);
    assert.equal(observersAtClear, -1, "no owner commits after a prepare failure");

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
    assert.equal(find(container, "personal-app-frame"), null);
    assert.equal(find(container, "All data deleted"), null);

    const retry = find(container, "Retry deleting all local data");
    assert.ok(retry);
    await act(async () => {
      retry.click();
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
    await waitForRendered(
      () => find(container, "All data deleted"),
      "the fresh coordinated retry to reach its complete verdict",
    );

    assert.equal(filesPrepareCalls, 2, "Retry starts a fresh coordinated reset");
    assert.equal(observersAtClear, 0);
    assert.equal(cleanupObservedAtClear, true);
    assert.ok(
      events.indexOf("personal-layout-cleanup") <
        events.indexOf("query-cache-clear"),
      "the React layout cleanup/ack happens before query-cache commit clears",
    );
    assert.ok(find(container, "All data deleted"));
    assert.equal(find(container, "Local data deletion needs attention"), null);
    assert.equal(find(container, "personal-app-frame"), null);
    assert.equal(personalMounts, 1);

    const continueButton = find(
      container,
      "Continue after local data deletion",
    );
    assert.ok(continueButton);
    await act(async () => {
      continueButton.click();
    });

    assert.ok(find(container, "personal-app-frame"));
    assert.equal(find(container, "All data deleted"), null);
    assert.equal(personalMounts, 2);
    assert.equal(
      queryClient
        .getQueryCache()
        .find({ queryKey: ["personal", "phoenix"] })
        ?.getObserversCount(),
      1,
      "Continue clearResult/release is the only AppFrame remount path",
    );
  } finally {
    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    document.body.removeChild(container);
  }
});

function find(container: MiniElement, accessibilityLabel: string): MiniElement | null {
  return container.querySelector(`[aria-label="${accessibilityLabel}"]`);
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
