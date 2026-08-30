import assert from "node:assert/strict";
import test from "node:test";

import { createCareInitialSyncReadiness } from "./careInitialSyncReadiness.ts";
import {
  beginCareInitialSyncLifecycle,
  FUTURE_CARE_SCHEMA_INITIAL_SYNC_MESSAGE,
  runCareInitialSyncLifecycle,
} from "./careInitialSyncLifecycle.ts";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function signedInReadiness(retryDelaysMs: readonly number[] = []) {
  const readiness = createCareInitialSyncReadiness({ retryDelaysMs });
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-a:session-a:household-a",
  });
  return readiness;
}

test("a future-schema GET settles as a non-retryable update-required error", async () => {
  const readiness = signedInReadiness([25, 75]);
  const get = deferred<{ dataVersion: number }>();

  const run = runCareInitialSyncLifecycle({
    readiness,
    isIdentityCurrent: () => true,
    readLocalDoc: () => ({ revision: 0, doc: { name: "cached" } }),
    run: async (attempt) => {
      const serverDoc = await get.promise;
      if (serverDoc.dataVersion > 1) {
        attempt.failForFutureSchema(serverDoc);
        return;
      }
      attempt.succeed();
    },
  });

  get.resolve({ dataVersion: 2 });
  const result = await run;

  assert.equal(result.started, true);
  assert.equal(result.settlement?.kind, "failure");
  assert.equal(result.settlement?.retryDelayMs, null);
  assert.deepEqual(readiness.getStatus(true), {
    state: "error",
    isSettled: false,
    retryable: false,
    message: FUTURE_CARE_SCHEMA_INITIAL_SYNC_MESSAGE,
  });
  assert.equal(readiness.requestRetry(), false);
});

test("a future-schema PUT/conflict response cannot strand the attempt pending", async () => {
  const readiness = signedInReadiness([25, 75]);
  const put = deferred<never>();

  const run = runCareInitialSyncLifecycle({
    readiness,
    isIdentityCurrent: () => true,
    readLocalDoc: () => ({ revision: 0, doc: { name: "local" } }),
    run: async (attempt) => {
      try {
        await put.promise;
      } catch (error) {
        const conflict = error as {
          status?: number;
          data?: { dataVersion?: number };
        };
        if (conflict.status === 409 && (conflict.data?.dataVersion ?? 0) > 1) {
          attempt.failForFutureSchema(conflict.data);
          return;
        }
        throw error;
      }
      attempt.succeed();
    },
  });

  put.reject({ status: 409, data: { dataVersion: 4 } });
  const result = await run;

  assert.equal(result.settlement?.kind, "failure");
  assert.equal(readiness.getStatus(true).state, "error");
  assert.equal(readiness.getStatus(true).retryable, false);
  assert.equal(
    readiness.getStatus(true).message,
    FUTURE_CARE_SCHEMA_INITIAL_SYNC_MESSAGE,
  );
});

test("unresolved same-auth early exits consume bounded retries and become actionable", async () => {
  const readiness = signedInReadiness([10]);
  const input = {
    readiness,
    isIdentityCurrent: () => true,
    readLocalDoc: () => ({ revision: 0, doc: { name: "cached" } }),
    run: async () => {
      // Mirrors a same-auth reset/write-admission/stale-operation guard that
      // returns before the normal success/failure branch.
      return "early";
    },
  } as const;

  const first = await runCareInitialSyncLifecycle(input);
  assert.equal(first.settlement?.kind, "failure");
  assert.equal(first.settlement?.retryDelayMs, 10);
  assert.equal(readiness.getStatus(true).state, "pending");

  const second = await runCareInitialSyncLifecycle(input);
  assert.equal(second.settlement?.kind, "failure");
  assert.equal(second.settlement?.retryDelayMs, null);
  assert.deepEqual(readiness.getStatus(true), {
    state: "error",
    isSettled: false,
    retryable: true,
    message:
      "WoofWatcher could not confirm the current household records. Try again.",
  });
});

for (const waitingStage of ["GET", "storage", "PUT"] as const) {
  test(`a local doc edit while ${waitingStage} awaits is never overwritten`, async () => {
    const readiness = signedInReadiness();
    const wait = deferred<void>();
    let revision = 0;
    let doc = { name: "cached", note: "before" };

    const run = runCareInitialSyncLifecycle({
      readiness,
      isIdentityCurrent: () => true,
      readLocalDoc: () => ({ revision, doc }),
      run: async (attempt) => {
        if (waitingStage === "GET") await wait.promise;
        const serverDoc = { name: "server", note: "remote" };
        if (waitingStage === "storage") await wait.promise;
        if (waitingStage === "PUT") await wait.promise;

        const selection = attempt.commitDoc(serverDoc, (selected) => {
          doc = selected.doc;
        });
        assert.ok(selection);
        attempt.succeed();
        return selection;
      },
    });

    // This is the real race: the owner edits the live doc after the request
    // captured its base, but before the final synchronous commit boundary.
    doc = { name: "owner", note: `edited-during-${waitingStage}` };
    revision += 1;
    wait.resolve();

    const result = await run;
    assert.equal(result.settlement?.kind, "success");
    assert.deepEqual(doc, {
      name: "owner",
      note: `edited-during-${waitingStage}`,
    });
    assert.equal(result.value?.preservedConcurrentLocalEdit, true);
    assert.equal(result.value?.capturedRevision, 0);
    assert.equal(result.value?.currentRevision, 1);
  });
}

test("the server doc is adopted when the local revision is unchanged", async () => {
  const readiness = signedInReadiness();
  let doc = { name: "cached" };

  const result = await runCareInitialSyncLifecycle({
    readiness,
    isIdentityCurrent: () => true,
    readLocalDoc: () => ({ revision: 7, doc }),
    run: async (attempt) => {
      const selection = attempt.commitDoc({ name: "server" }, (selected) => {
        doc = selected.doc;
      });
      assert.ok(selection);
      attempt.succeed();
      return selection;
    },
  });

  assert.equal(result.settlement?.kind, "success");
  assert.deepEqual(doc, { name: "server" });
  assert.equal(result.value?.preservedConcurrentLocalEdit, false);
});

test("the direct integration begin call returns null after readiness is settled", () => {
  const readiness = signedInReadiness();
  let snapshotReads = 0;
  const first = beginCareInitialSyncLifecycle({
    readiness,
    isIdentityCurrent: () => true,
    readLocalDoc: () => {
      snapshotReads += 1;
      return { revision: 0, doc: { name: "cached" } };
    },
  });
  assert.ok(first);
  assert.equal(first.succeed().kind, "success");

  assert.equal(
    beginCareInitialSyncLifecycle({
      readiness,
      isIdentityCurrent: () => true,
      readLocalDoc: () => {
        throw new Error("settled sync must not read a snapshot");
      },
    }),
    null,
  );
  assert.equal(snapshotReads, 1);
});

test("an identity-stale early exit cannot fail or settle the replacement identity", async () => {
  const readiness = signedInReadiness();
  const get = deferred<void>();
  let identityCurrent = true;

  const run = runCareInitialSyncLifecycle({
    readiness,
    isIdentityCurrent: () => identityCurrent,
    readLocalDoc: () => ({ revision: 0, doc: { name: "A" } }),
    run: async () => {
      await get.promise;
    },
  });

  identityCurrent = false;
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-b:session-b:household-b",
  });
  get.resolve();
  const stale = await run;

  assert.equal(stale.settlement?.kind, "stale");
  assert.equal(readiness.getStatus(true).state, "pending");
  assert.ok(readiness.captureSyncAttempt());
});

test("same-identity reset revocation cannot be mislabeled as successful sync", async () => {
  const readiness = signedInReadiness();
  const gate = deferred<void>();
  let canApply = true;

  const run = runCareInitialSyncLifecycle({
    readiness,
    isIdentityCurrent: () => true,
    canApply: () => canApply,
    readLocalDoc: () => ({ revision: 0, doc: { name: "cached" } }),
    run: async (attempt) => {
      await gate.promise;
      // Even an integration that reaches its nominal success line must not
      // settle success after the same identity's reset revoked application.
      attempt.succeed();
    },
  });

  canApply = false;
  gate.resolve();
  const result = await run;

  assert.equal(result.settlement?.kind, "failure");
  assert.equal(readiness.getStatus(true).state, "error");
});

test("a throwing local snapshot cannot strand the readiness attempt token", () => {
  const readiness = signedInReadiness([10]);

  assert.throws(
    () =>
      beginCareInitialSyncLifecycle({
        readiness,
        isIdentityCurrent: () => true,
        readLocalDoc: () => {
          throw new Error("local snapshot unavailable");
        },
      }),
    /local snapshot unavailable/,
  );

  assert.ok(
    readiness.captureSyncAttempt(),
    "snapshot failure must happen before reserving the attempt token",
  );
});

test("an A-to-B-to-A bounce cannot commit through an identity-key-only predicate", () => {
  const readiness = signedInReadiness();
  let currentIdentity = "A";
  let doc = { name: "A cached" };
  const attempt = beginCareInitialSyncLifecycle({
    readiness,
    isIdentityCurrent: () => currentIdentity === "A",
    readLocalDoc: () => ({ revision: 0, doc }),
  });
  assert.ok(attempt);

  currentIdentity = "B";
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-b:session-b:household-b",
  });
  currentIdentity = "A";
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-a:session-a:household-a",
  });

  assert.equal(
    attempt.commitDoc({ name: "stale A server" }, (selected) => {
      doc = selected.doc;
    }),
    null,
  );
  assert.deepEqual(doc, { name: "A cached" });
  assert.equal(attempt.succeed().kind, "stale");
  assert.equal(readiness.getStatus(true).state, "pending");
});

test("the async wrapper never returns a contradictory success plus error", async () => {
  const readiness = signedInReadiness();
  const result = await runCareInitialSyncLifecycle({
    readiness,
    isIdentityCurrent: () => true,
    readLocalDoc: () => ({ revision: 0, doc: { name: "cached" } }),
    run: async (attempt) => {
      attempt.succeed();
      throw new Error("programmer error after success");
    },
  });

  assert.equal(result.settlement?.kind, "success");
  assert.equal(result.error, undefined);
});
