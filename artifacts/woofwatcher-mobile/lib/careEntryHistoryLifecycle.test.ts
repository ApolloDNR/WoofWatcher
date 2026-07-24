import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CareEntryHistoryGenerationChangedError,
  isCareEntryDeleteConfirmedAbsent,
  mergeServerAndLocalEntries,
  planPendingCareEntryDeleteCleanup,
  runCompleteCareEntryHistoryRefresh,
  type CareEntryHistoryPageRequest,
} from "./careSync.ts";

type TestEntry = {
  id: string;
  occurredAt: string;
  revision: number;
  syncStatus?: "local" | "pending" | "synced" | "failed" | "conflict";
  syncError?: string;
};

const occurredAt = "2026-07-23T12:00:00.000Z";
const householdId = "11111111-1111-4111-8111-111111111111";
const otherHouseholdId =
  "22222222-2222-4222-8222-222222222222";
const id = (suffix: number) =>
  `00000000-0000-4000-8000-${suffix.toString(16).padStart(12, "0")}`;
const row = (suffix: number, revision = 1): TestEntry => ({
  id: id(suffix),
  occurredAt,
  revision,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function lifecycleHarness(input: {
  fetchPage: (request: CareEntryHistoryPageRequest) => Promise<unknown>;
  readMutationGeneration?: () => number;
  readPendingDeleteIds?: () => ReadonlySet<string>;
  readEntries?: () => readonly TestEntry[];
  isLifecycleCurrent?: (token: string) => boolean;
  captureLifecycle?: () => string;
  maxAttempts?: number;
  mergeEntries?: (
    latest: readonly TestEntry[],
    server: readonly TestEntry[],
  ) => TestEntry[];
  onCommit?: (input: {
    completeServerEntries: readonly TestEntry[];
    pendingDeleteIds: ReadonlySet<string>;
  }) => void;
}) {
  let visible: readonly TestEntry[] = [row(99)];
  let commits = 0;
  return {
    get visible() {
      return visible;
    },
    get commits() {
      return commits;
    },
    run: () =>
      runCompleteCareEntryHistoryRefresh<TestEntry, string>({
        householdId,
        fetchPage: async (request) => {
          const result = await input.fetchPage(request);
          return result &&
            typeof result === "object" &&
            !Array.isArray(result) &&
            !("householdId" in result)
            ? { ...result, householdId }
            : result;
        },
        pageSize: 2,
        maxAttempts: input.maxAttempts ?? 2,
        captureLifecycle: input.captureLifecycle ?? (() => "scope_h1"),
        isLifecycleCurrent:
          input.isLifecycleCurrent ?? ((token) => token === "scope_h1"),
        readMutationGeneration: input.readMutationGeneration ?? (() => 0),
        readPendingDeleteIds:
          input.readPendingDeleteIds ?? (() => new Set<string>()),
        readEntries: input.readEntries ?? (() => visible),
        mergeEntries:
          input.mergeEntries ??
          ((latest, server) =>
            mergeServerAndLocalEntries(latest, server)),
        commitEntries: (
          entries,
          _historyGeneration,
          completeServerEntries,
          pendingDeleteIds,
        ) => {
          input.onCommit?.({
            completeServerEntries,
            pendingDeleteIds,
          });
          commits += 1;
          visible = entries;
        },
      }),
  };
}

test("create, update, delete, bind, and every Task 6 settlement discard and retry a paged snapshot", async () => {
  for (const event of [
    "create",
    "update",
    "delete",
    "bind",
    "synced",
    "failed",
    "conflict",
  ]) {
    let mutationGeneration = 0;
    let calls = 0;
    const firstPage = deferred<{
      entries: TestEntry[];
      historyGeneration: number;
    }>();
    const harness = lifecycleHarness({
      readMutationGeneration: () => mutationGeneration,
      fetchPage: async () => {
        calls += 1;
        if (calls === 1) return firstPage.promise;
        return { entries: [row(2, 2)], historyGeneration: 2 };
      },
    });

    const refresh = harness.run();
    mutationGeneration += 1;
    firstPage.resolve({ entries: [row(1)], historyGeneration: 1 });
    assert.equal(await refresh, true, event);
    assert.equal(calls, 2, `${event} did not restart`);
    assert.equal(harness.commits, 1, `${event} committed a partial attempt`);
    assert.equal(harness.visible[0]?.revision, 2);
  }
});

test("a delete already pending before page one is never reintroduced", async () => {
  const deletedId = id(2);
  let calls = 0;
  const harness = lifecycleHarness({
    readPendingDeleteIds: () => new Set([deletedId]),
    fetchPage: async () => ({
      entries: calls++ === 0 ? [row(2), row(1)] : [],
      historyGeneration: 3,
    }),
  });

  assert.equal(await harness.run(), true);
  assert.deepEqual(harness.visible.map((entry) => entry.id), [id(1)]);
});

test("a deleted unbound temp clientKey suppresses its lost-response server twin", async () => {
  const deletedTempKey = "temp_deleted_before_bind";
  let calls = 0;
  const harness = lifecycleHarness({
    readPendingDeleteIds: () => new Set([deletedTempKey]),
    fetchPage: async () => ({
      entries:
        calls++ === 0
          ? [
              {
                ...row(2),
                details: { clientKey: deletedTempKey },
              },
              row(1),
            ]
          : [],
      historyGeneration: 3,
    }),
  });

  assert.equal(await harness.run(), true);
  assert.deepEqual(harness.visible.map((entry) => entry.id), [id(1)]);
});

test("cleanup candidates belong only to the successful pagination attempt", async () => {
  const deletedTempKey = "temp_delete_that_failed";
  let mutationGeneration = 0;
  let pendingDeletes: ReadonlySet<string> = new Set([deletedTempKey]);
  let merges = 0;
  let calls = 0;
  const cleanupServerIds: string[] = [];
  const serverTwin = {
    ...row(2),
    details: { clientKey: deletedTempKey },
  };
  const harness = lifecycleHarness({
    readMutationGeneration: () => mutationGeneration,
    readPendingDeleteIds: () => pendingDeletes,
    fetchPage: async () => {
      calls += 1;
      return {
        entries: [serverTwin],
        historyGeneration: calls,
      };
    },
    mergeEntries: (latest, server) => {
      merges += 1;
      if (merges === 1) {
        // The original DELETE failed while attempt one was merging: its local
        // row was restored, its intent was removed, and the mutation fence
        // advanced before that attempt could commit.
        pendingDeletes = new Set();
        mutationGeneration += 1;
      }
      return mergeServerAndLocalEntries(latest, server);
    },
    onCommit: ({ completeServerEntries, pendingDeleteIds }) => {
      cleanupServerIds.push(
        ...planPendingCareEntryDeleteCleanup(
          completeServerEntries,
          pendingDeleteIds,
        ).deleteCandidates.map((candidate) => candidate.serverId),
      );
    },
  });

  assert.equal(await harness.run(), true);
  assert.equal(calls, 2);
  assert.equal(harness.commits, 1);
  assert.deepEqual(cleanupServerIds, []);
  assert.equal(
    harness.visible.some((entry) => entry.id === serverTwin.id),
    true,
    "the restored row must survive the successful retry",
  );
});

test("a complete snapshot prunes absent UUID intents but retains unbound temp intents", () => {
  const absentServerId = id(90);
  const unboundTempKey = "temp_create_still_in_flight";
  const plan = planPendingCareEntryDeleteCleanup(
    [row(1)],
    new Set([absentServerId, unboundTempKey]),
  );

  assert.deepEqual(plan.deleteCandidates, []);
  assert.deepEqual(plan.confirmedAbsentServerIds, [absentServerId]);
});

test("a bound lost-create cleanup retains the temp key as its cleanup alias", () => {
  const serverId = id(7);
  const tempKey = "temp_deleted_before_create_returned";
  const plan = planPendingCareEntryDeleteCleanup(
    [
      {
        ...row(7),
        details: { clientKey: tempKey },
      },
    ],
    new Set([tempKey, serverId]),
  );

  assert.deepEqual(plan.deleteCandidates, [
    { serverId, pendingKey: tempKey },
  ]);
});

test("DELETE 404 is an idempotent confirmed-absent success", () => {
  const boundAbsent = {
    status: 404,
    data: {
      householdId,
      scopeBound: true,
    },
  };
  assert.equal(
    isCareEntryDeleteConfirmedAbsent(boundAbsent, householdId),
    true,
  );
  assert.equal(
    isCareEntryDeleteConfirmedAbsent(
      {
        status: 404,
        data: { householdId, scopeBound: false },
      },
      householdId,
    ),
    false,
  );
  assert.equal(
    isCareEntryDeleteConfirmedAbsent(
      {
        status: 404,
        data: {
          householdId: otherHouseholdId,
          scopeBound: true,
        },
      },
      householdId,
    ),
    false,
  );
  assert.equal(
    isCareEntryDeleteConfirmedAbsent({ status: 409 }, householdId),
    false,
  );
  assert.equal(
    isCareEntryDeleteConfirmedAbsent(new Error("offline"), householdId),
    false,
  );
});

test("a restarted snapshot merges against the latest entries ref, not the pre-page capture", async () => {
  let mutationGeneration = 0;
  let latest: readonly TestEntry[] = [row(9, 1)];
  let calls = 0;
  const firstPage = deferred<{
    entries: TestEntry[];
    historyGeneration: number;
  }>();
  const harness = lifecycleHarness({
    readMutationGeneration: () => mutationGeneration,
    readEntries: () => latest,
    fetchPage: async () => {
      calls += 1;
      if (calls === 1) return firstPage.promise;
      return { entries: [row(9, 4)], historyGeneration: 4 };
    },
  });

  const refresh = harness.run();
  latest = [{ ...row(9, 5), syncStatus: "synced" }];
  mutationGeneration += 1;
  firstPage.resolve({ entries: [row(9, 2)], historyGeneration: 2 });

  assert.equal(await refresh, true);
  assert.equal(calls, 2);
  assert.equal(harness.visible[0]?.revision, 5);
});

test("a stale H1 page is inert while H2 completes independently", async () => {
  let currentScope = "scope_h1";
  const h1Page = deferred<{
    entries: TestEntry[];
    historyGeneration: number;
  }>();
  let visible: readonly TestEntry[] = [row(99)];

  const runForScope = (scope: string, fetchPage: () => Promise<unknown>) =>
    runCompleteCareEntryHistoryRefresh<TestEntry, string>({
      householdId:
        scope === "scope_h1" ? householdId : otherHouseholdId,
      fetchPage: async () => {
        const result = await fetchPage();
        return result &&
          typeof result === "object" &&
          !Array.isArray(result) &&
          !("householdId" in result)
          ? {
              ...result,
              householdId:
                scope === "scope_h1"
                  ? householdId
                  : otherHouseholdId,
            }
          : result;
      },
      pageSize: 2,
      maxAttempts: 2,
      captureLifecycle: () => scope,
      isLifecycleCurrent: (token) => token === currentScope,
      readMutationGeneration: () => 0,
      readPendingDeleteIds: () => new Set(),
      readEntries: () => visible,
      mergeEntries: (_latest, server) => server,
      commitEntries: (entries) => {
        visible = entries;
      },
    });

  const h1 = runForScope("scope_h1", () => h1Page.promise);
  currentScope = "scope_h2";
  const h2 = runForScope("scope_h2", async () => ({
    entries: [row(2)],
    historyGeneration: 2,
  }));
  assert.equal(await h2, true);
  const h2Visible = visible;

  h1Page.resolve({ entries: [row(1)], historyGeneration: 1 });
  assert.equal(await h1, false);
  assert.equal(visible, h2Visible);
  assert.deepEqual(visible.map((entry) => entry.id), [id(2)]);
});

test("page failure and bounded repeated churn preserve the previous array by identity", async () => {
  const pageFailure = lifecycleHarness({
    fetchPage: async (request) => {
      if (!request.beforeId) {
        return {
          entries: [row(2), row(1)],
          historyGeneration: 1,
        };
      }
      throw new Error("second page unavailable");
    },
  });
  const pageFailurePrevious = pageFailure.visible;
  await assert.rejects(pageFailure.run(), /second page unavailable/);
  assert.equal(pageFailure.visible, pageFailurePrevious);
  assert.equal(pageFailure.commits, 0);

  let attempts = 0;
  const churn = lifecycleHarness({
    maxAttempts: 2,
    fetchPage: async () => {
      attempts += 1;
      throw new CareEntryHistoryGenerationChangedError(attempts);
    },
  });
  const churnPrevious = churn.visible;
  await assert.rejects(churn.run(), /changed during pagination/i);
  assert.equal(attempts, 2);
  assert.equal(churn.visible, churnPrevious);
  assert.equal(churn.commits, 0);
});

test("a generated-client 409 is translated into one clean history restart", async () => {
  let calls = 0;
  const harness = lifecycleHarness({
    fetchPage: async () => {
      calls += 1;
      if (calls === 1) {
        throw {
          status: 409,
          data: {
            error:
              "Care history changed during pagination. Restart from the first page.",
            currentGeneration: 12,
          },
        };
      }
      return {
        entries: [row(2, 2)],
        historyGeneration: 12,
      };
    },
  });

  assert.equal(await harness.run(), true);
  assert.equal(calls, 2);
  assert.deepEqual(harness.visible.map((entry) => entry.id), [id(2)]);
});

test("atomic history commit preserves Task 6 conflict and newer revision invariants", async () => {
  const local: TestEntry[] = [
    {
      ...row(2, 5),
      syncStatus: "synced",
    },
    {
      ...row(1, 3),
      syncStatus: "conflict",
      syncError: "Review household change.",
    },
  ];
  const harness = lifecycleHarness({
    readEntries: () => local,
    fetchPage: async (request) => ({
      entries: request.beforeId ? [] : [row(2, 4), row(1, 4)],
      historyGeneration: 8,
    }),
  });

  assert.equal(await harness.run(), true);
  assert.equal(harness.visible.find((entry) => entry.id === id(2))?.revision, 5);
  assert.equal(
    harness.visible.find((entry) => entry.id === id(1))?.syncStatus,
    "conflict",
  );
});

test("atomic history merge sorts equal timestamps by canonical UUID descending", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        ...row(2, 2),
        syncStatus: "conflict",
        syncError: "Review household change.",
      },
    ],
    [row(3), row(1)],
  );

  assert.deepEqual(
    merged.map((entry) => entry.id),
    [id(3), id(2), id(1)],
  );
});
