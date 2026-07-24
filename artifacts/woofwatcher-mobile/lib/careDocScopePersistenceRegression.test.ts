import { test } from "node:test";
import assert from "node:assert/strict";

import { createCareLifecycleCoordinator } from "./careLifecycle.ts";
import { getCareStorageKey } from "./careStorageScope.ts";
import { parseCareDocSyncSnapshot } from "./careSync.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("a delayed prior-household cache write remains scoped and cannot replace the new household baseline", async () => {
  const lifecycle = createCareLifecycleCoordinator();
  const storage = new Map<string, string>();
  const firstScope = {
    kind: "account" as const,
    userId: "user-1",
    householdId: "household-1",
  };
  const secondScope = {
    kind: "account" as const,
    userId: "user-1",
    householdId: "household-2",
  };
  const firstKey = getCareStorageKey(firstScope);
  const secondKey = getCareStorageKey(secondScope);
  assert.notEqual(firstKey, secondKey);

  const firstSnapshot = {
    serverVersion: 7,
    currentDoc: {
      createdAt: "2026-07-01T08:00:00.000Z",
      updatedAt: "2026-07-23T09:00:00.000Z",
      profile: { name: "Household one" },
    },
    acknowledged: {
      version: 7,
      doc: {
        createdAt: "2026-07-01T08:00:00.000Z",
        updatedAt: "2026-07-23T09:00:00.000Z",
        profile: { name: "Household one" },
      },
    },
    conflicts: [],
    documentSyncError: "Household one retry",
  };
  const secondSnapshot = {
    serverVersion: 3,
    currentDoc: {
      createdAt: "2026-07-02T08:00:00.000Z",
      updatedAt: "2026-07-23T10:00:00.000Z",
      profile: { name: "Household two" },
    },
    acknowledged: {
      version: 3,
      doc: {
        createdAt: "2026-07-02T08:00:00.000Z",
        updatedAt: "2026-07-23T10:00:00.000Z",
        profile: { name: "Household two" },
      },
    },
    conflicts: [],
    documentSyncError: null,
  };

  const firstToken = lifecycle.beginIdentityChange();
  assert.equal(lifecycle.completeHydration(firstToken), true);
  const firstWriteStarted = deferred<void>();
  const releaseFirstWrite = deferred<void>();
  const firstWrite = lifecycle.queueStorageWrite(firstToken, async () => {
    firstWriteStarted.resolve();
    await releaseFirstWrite.promise;
    storage.set(firstKey, JSON.stringify(firstSnapshot));
  });
  await firstWriteStarted.promise;

  const secondToken = lifecycle.beginIdentityChange();
  assert.equal(lifecycle.completeHydration(secondToken), true);
  const secondWrite = lifecycle.queueStorageWrite(secondToken, async () => {
    storage.set(secondKey, JSON.stringify(secondSnapshot));
  });

  releaseFirstWrite.resolve();
  assert.equal(await firstWrite, "stale");
  assert.equal(await secondWrite, "written");

  const hydratedSecond = parseCareDocSyncSnapshot({
    parsed: JSON.parse(storage.get(secondKey)!),
    fallbackDoc: {
      createdAt: "2026-07-23T10:01:00.000Z",
      updatedAt: "1970-01-01T00:00:00.000Z",
      profile: { name: "Fresh" },
    } as any,
    normalizeDoc: (value: unknown) => value as any,
    isCompleteCurrentDoc: () => true,
  });
  assert.equal(hydratedSecond.serverVersion, 3);
  assert.equal(hydratedSecond.acknowledged?.version, 3);
  assert.equal(hydratedSecond.currentDoc.profile.name, "Household two");
  assert.equal(hydratedSecond.documentSyncError, null);
  assert.equal(
    JSON.parse(storage.get(firstKey)!).currentDoc.profile.name,
    "Household one",
  );
});
