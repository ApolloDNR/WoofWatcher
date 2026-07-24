import { test } from "node:test";
import assert from "node:assert/strict";

import {
  commitCareEntriesIfCurrent,
  runCareEntrySideEffectIfCurrent,
} from "./careEntryMutation.ts";
import {
  assertCareDeviceWipeOperationWritten,
  createCareDirectoryWipeAdapter,
  finalizeCareDeviceWipeReceipt,
  resolveCareDeviceWipeAttempt,
  runCareDeviceWipe,
} from "./careDeviceWipe.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("a late create failure cannot clear a current lifecycle temp create reusing the id", () => {
  let currentGeneration = 2;
  const creatingTempIds = new Set(["temp-reused"]);
  const oldFailureToken = { generation: 1 };

  const mutated = runCareEntrySideEffectIfCurrent({
    lifecycleToken: oldFailureToken,
    isCurrent: (token) => token.generation === currentGeneration,
    run: () => creatingTempIds.delete("temp-reused"),
  });

  assert.equal(mutated, false);
  assert.deepEqual([...creatingTempIds], ["temp-reused"]);

  const currentToken = { generation: currentGeneration };
  assert.equal(
    runCareEntrySideEffectIfCurrent({
      lifecycleToken: currentToken,
      isCurrent: (token) => token.generation === currentGeneration,
      run: () => creatingTempIds.delete("temp-reused"),
    }),
    true,
  );
  assert.deepEqual([...creatingTempIds], []);
});

test("returns one deleted receipt step for every successful wipe target", async () => {
  const calls: string[] = [];

  const receipt = await runCareDeviceWipe({
    "async-storage": async () => {
      calls.push("async-storage");
    },
    reports: async () => {
      calls.push("reports");
    },
    attachments: async () => {
      calls.push("attachments");
    },
    "query-cache": () => {
      calls.push("query-cache");
    },
  });

  assert.deepEqual(calls, [
    "async-storage",
    "reports",
    "attachments",
    "query-cache",
  ]);
  assert.deepEqual(receipt, {
    mode: "device-only",
    complete: true,
    steps: [
      { target: "async-storage", status: "deleted" },
      { target: "reports", status: "deleted" },
      { target: "attachments", status: "deleted" },
      { target: "query-cache", status: "deleted" },
    ],
  });
});

test("marks an AsyncStorage failure incomplete without hiding other target results", async () => {
  const receipt = await runCareDeviceWipe({
    "async-storage": async () => {
      throw new Error("storage permission denied");
    },
    reports: async () => undefined,
    attachments: async () => undefined,
    "query-cache": () => undefined,
  });

  assert.equal(receipt.complete, false);
  assert.deepEqual(receipt.steps, [
    {
      target: "async-storage",
      status: "failed",
      message: "storage permission denied",
    },
    { target: "reports", status: "deleted" },
    { target: "attachments", status: "deleted" },
    { target: "query-cache", status: "deleted" },
  ]);
});

test("marks one failed directory incomplete and preserves its exact target", async () => {
  const receipt = await runCareDeviceWipe({
    "async-storage": async () => undefined,
    reports: async () => {
      throw new Error("reports directory unavailable");
    },
    attachments: async () => undefined,
    "query-cache": () => undefined,
  });

  assert.equal(receipt.complete, false);
  assert.deepEqual(receipt.steps, [
    { target: "async-storage", status: "deleted" },
    {
      target: "reports",
      status: "failed",
      message: "reports directory unavailable",
    },
    { target: "attachments", status: "deleted" },
    { target: "query-cache", status: "deleted" },
  ]);
});

test("records native directories as not-applicable on web", async () => {
  const receipt = await runCareDeviceWipe({
    "async-storage": async () => undefined,
    reports: createCareDirectoryWipeAdapter({
      platform: "web",
      documentDirectory: null,
      target: "reports",
      relativePath: "WoofWatcherReports/",
      deleteDirectory: async () => undefined,
    }),
    attachments: createCareDirectoryWipeAdapter({
      platform: "web",
      documentDirectory: null,
      target: "attachments",
      relativePath: "woofwatcher-attachments/",
      deleteDirectory: async () => undefined,
    }),
    "query-cache": () => undefined,
  });

  assert.equal(receipt.complete, true);
  assert.deepEqual(receipt.steps, [
    { target: "async-storage", status: "deleted" },
    { target: "reports", status: "not-applicable" },
    { target: "attachments", status: "not-applicable" },
    { target: "query-cache", status: "deleted" },
  ]);
});

test("marks both native directories failed when the document directory is unavailable", async () => {
  const receipt = await runCareDeviceWipe({
    "async-storage": async () => undefined,
    reports: createCareDirectoryWipeAdapter({
      platform: "ios",
      documentDirectory: null,
      target: "reports",
      relativePath: "WoofWatcherReports/",
      deleteDirectory: async () => undefined,
    }),
    attachments: createCareDirectoryWipeAdapter({
      platform: "ios",
      documentDirectory: null,
      target: "attachments",
      relativePath: "woofwatcher-attachments/",
      deleteDirectory: async () => undefined,
    }),
    "query-cache": () => undefined,
  });

  assert.equal(receipt.complete, false);
  assert.deepEqual(receipt.steps, [
    { target: "async-storage", status: "deleted" },
    {
      target: "reports",
      status: "failed",
      message: "Native reports directory is unavailable.",
    },
    {
      target: "attachments",
      status: "failed",
      message: "Native attachments directory is unavailable.",
    },
    { target: "query-cache", status: "deleted" },
  ]);
});

test("a mid-wipe identity change makes the receipt incomplete and never signs out the new user", async () => {
  const reportsGate = deferred<void>();
  let lifecycleCurrent = true;
  const receiptPromise = runCareDeviceWipe({
    "async-storage": async () => undefined,
    reports: async () => reportsGate.promise,
    attachments: async () => undefined,
    "query-cache": () => undefined,
  });
  lifecycleCurrent = false;
  reportsGate.resolve();
  const finalized = finalizeCareDeviceWipeReceipt(
    await receiptPromise,
    lifecycleCurrent,
  );
  let signOutCalls = 0;

  const verdict = await resolveCareDeviceWipeAttempt({
    receipt: finalized,
    additionalFailures: [],
    requiresSignOut: true,
    initiatingUserId: "user-a",
    getCurrentUserId: () => "user-b",
    signOut: async () => {
      signOutCalls += 1;
    },
  });

  assert.equal(finalized.complete, false);
  assert.deepEqual(finalized.steps[3], {
    target: "query-cache",
    status: "failed",
    message: "Care identity changed during the device wipe.",
  });
  assert.equal(verdict.complete, false);
  assert.equal(signOutCalls, 0);
});

test("a stale lifecycle operation becomes a failed required receipt step", async () => {
  const receipt = await runCareDeviceWipe({
    "async-storage": async () => {
      assertCareDeviceWipeOperationWritten("stale");
    },
    reports: async () => undefined,
    attachments: async () => undefined,
    "query-cache": () => undefined,
  });

  assert.equal(receipt.complete, false);
  assert.deepEqual(receipt.steps[0], {
    target: "async-storage",
    status: "failed",
    message: "Device wipe stale",
  });
});

test("an auth identity switch after a complete receipt cannot sign out the new user", async () => {
  const receipt = await runCareDeviceWipe({
    "async-storage": async () => undefined,
    reports: async () => undefined,
    attachments: async () => undefined,
    "query-cache": () => undefined,
  });
  let signOutCalls = 0;

  const verdict = await resolveCareDeviceWipeAttempt({
    receipt,
    additionalFailures: [],
    requiresSignOut: true,
    initiatingUserId: "user-a",
    getCurrentUserId: () => "user-b",
    signOut: async () => {
      signOutCalls += 1;
    },
  });

  assert.deepEqual(verdict, {
    complete: false,
    failures: ["auth-identity-changed"],
    clearedAccountCare: false,
  });
  assert.equal(signOutCalls, 0);
});

test("a partial failure stays incomplete until a complete retry succeeds", async () => {
  let storageAttempt = 0;
  let signOutCalls = 0;
  const runAttempt = () =>
    runCareDeviceWipe({
      "async-storage": async () => {
        storageAttempt += 1;
        if (storageAttempt === 1) throw new Error("storage busy");
      },
      reports: async () => undefined,
      attachments: async () => undefined,
      "query-cache": () => undefined,
    });
  const resolveAttempt = async () =>
    resolveCareDeviceWipeAttempt({
      receipt: await runAttempt(),
      additionalFailures: [],
      requiresSignOut: true,
      initiatingUserId: "user-a",
      getCurrentUserId: () => "user-a",
      signOut: async () => {
        signOutCalls += 1;
      },
    });

  const first = await resolveAttempt();
  const retry = await resolveAttempt();

  assert.deepEqual(first, {
    complete: false,
    failures: ["async-storage"],
    clearedAccountCare: false,
  });
  assert.deepEqual(retry, {
    complete: true,
    failures: [],
    clearedAccountCare: true,
  });
  assert.equal(signOutCalls, 1);
});

test("signed-in create keeps then replaces its optimistic temp row", async () => {
  type TestEntry = {
    id: string;
    title: string;
    syncStatus: "pending" | "synced";
  };
  let currentGeneration = { identityGeneration: 1, eraseGeneration: 2 };
  const lifecycleToken = { ...currentGeneration };
  const entriesRef: { current: TestEntry[] } = { current: [] };
  let renderedEntries: TestEntry[] = [];
  const commit = (update: (entries: TestEntry[]) => TestEntry[]) =>
    commitCareEntriesIfCurrent({
      lifecycleToken,
      isCurrent: (candidate) =>
        candidate.identityGeneration === currentGeneration.identityGeneration &&
        candidate.eraseGeneration === currentGeneration.eraseGeneration,
      entriesRef,
      setEntries: (entries) => {
        renderedEntries = entries;
      },
      update,
    });
  const optimistic: TestEntry = {
    id: "temp-1",
    title: "Breakfast",
    syncStatus: "pending",
  };
  const createRequest = deferred<TestEntry>();

  assert.equal(
    commit((current) => [optimistic, ...current]),
    true,
  );
  assert.equal(entriesRef.current[0]?.id, "temp-1");
  assert.equal(
    commit((current) =>
      current.map((entry) =>
        entry.id === "temp-1"
          ? { ...entry, syncStatus: "pending" }
          : entry,
      ),
    ),
    true,
  );
  const creation = createRequest.promise.then((created) =>
    commit((current) =>
      current.map((entry) =>
        entry.id === "temp-1"
          ? created
          : entry,
      ),
    ),
  );

  assert.deepEqual(entriesRef.current, [optimistic]);
  createRequest.resolve({
    id: "server-1",
    title: "Breakfast",
    syncStatus: "synced",
  });
  assert.equal(await creation, true);

  assert.deepEqual(entriesRef.current, [
    { id: "server-1", title: "Breakfast", syncStatus: "synced" },
  ]);
  assert.deepEqual(renderedEntries, entriesRef.current);
});

test("create success and failure callbacks cannot repopulate entries after an erase generation change", async () => {
  type TestEntry = {
    id: string;
    syncStatus: "pending" | "synced" | "failed";
  };
  let currentGeneration = { identityGeneration: 4, eraseGeneration: 8 };
  const lifecycleToken = { ...currentGeneration };
  const entriesRef: { current: TestEntry[] } = {
    current: [{ id: "temp-1", syncStatus: "pending" }],
  };
  let renderedEntries = entriesRef.current;
  let tempIdMapWrites = 0;
  const commit = (update: (entries: TestEntry[]) => TestEntry[]) =>
    commitCareEntriesIfCurrent({
      lifecycleToken,
      isCurrent: (candidate) =>
        candidate.identityGeneration === currentGeneration.identityGeneration &&
        candidate.eraseGeneration === currentGeneration.eraseGeneration,
      entriesRef,
      setEntries: (entries) => {
        renderedEntries = entries;
      },
      update,
    });
  const successRequest = deferred<TestEntry>();
  const failureRequest = deferred<void>();
  const success = successRequest.promise.then((created) => {
    const committed = commit((current) =>
      current.map((entry) => (entry.id === "temp-1" ? created : entry)),
    );
    if (committed) tempIdMapWrites += 1;
    return committed;
  });
  const failure = failureRequest.promise.catch(() =>
    commit((current) =>
      current.map((entry) =>
        entry.id === "temp-1"
          ? { ...entry, syncStatus: "failed" }
          : entry,
      ),
    ),
  );

  currentGeneration = {
    ...currentGeneration,
    eraseGeneration: currentGeneration.eraseGeneration + 1,
  };
  entriesRef.current = [];
  renderedEntries = [];
  successRequest.resolve({ id: "server-1", syncStatus: "synced" });
  failureRequest.reject(new Error("create failed"));

  assert.deepEqual(await Promise.all([success, failure]), [false, false]);
  assert.deepEqual(entriesRef.current, []);
  assert.deepEqual(renderedEntries, []);
  assert.equal(tempIdMapWrites, 0);
});

test("update success and failure callbacks cannot repopulate entries after an identity generation change", async () => {
  type TestEntry = {
    id: string;
    title: string;
    syncStatus: "pending" | "synced" | "failed";
  };
  let currentGeneration = { identityGeneration: 3, eraseGeneration: 5 };
  const lifecycleToken = { ...currentGeneration };
  const entriesRef: { current: TestEntry[] } = {
    current: [{ id: "entry-1", title: "Old", syncStatus: "pending" }],
  };
  let renderedEntries = entriesRef.current;
  const commit = (update: (entries: TestEntry[]) => TestEntry[]) =>
    commitCareEntriesIfCurrent({
      lifecycleToken,
      isCurrent: (candidate) =>
        candidate.identityGeneration === currentGeneration.identityGeneration &&
        candidate.eraseGeneration === currentGeneration.eraseGeneration,
      entriesRef,
      setEntries: (entries) => {
        renderedEntries = entries;
      },
      update,
    });
  const successRequest = deferred<TestEntry>();
  const failureRequest = deferred<void>();
  const success = successRequest.promise.then((updated) =>
    commit((current) =>
      current.map((entry) => (entry.id === updated.id ? updated : entry)),
    ),
  );
  const failure = failureRequest.promise.catch(() =>
    commit((current) =>
      current.map((entry) =>
        entry.id === "entry-1"
          ? { ...entry, syncStatus: "failed" }
          : entry,
      ),
    ),
  );

  currentGeneration = {
    ...currentGeneration,
    identityGeneration: currentGeneration.identityGeneration + 1,
  };
  entriesRef.current = [];
  renderedEntries = [];
  successRequest.resolve({
    id: "entry-1",
    title: "Server result",
    syncStatus: "synced",
  });
  failureRequest.reject(new Error("update failed"));

  assert.deepEqual(await Promise.all([success, failure]), [false, false]);
  assert.deepEqual(entriesRef.current, []);
  assert.deepEqual(renderedEntries, []);
});
