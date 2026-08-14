import assert from "node:assert/strict";
import { test } from "node:test";

import { createCarePersistenceWriter } from "./carePersistenceWriter.ts";
import {
  CARE_AUXILIARY_LOCAL_DATA_KEYS,
  CARE_PRESERVED_LOCAL_DATA_KEY,
  CARE_PRIMARY_LOCAL_DATA_KEY,
  createCareHydrationAttemptAuthority,
  createCareLocalDataResetController,
  getCarePristineSnapshotPersistenceDecision,
  hasInterruptedCareEntryMutationsToRecover,
  isSameCarePersistenceIdentity,
} from "./careLocalDataReset.ts";
import { createCareWriteProtection } from "./careWriteProtection.ts";
import { createLocalDataResetCoordinator } from "./localDataResetCoordinator.ts";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createHooks(
  overrides: Partial<{
    canPrepare(): boolean;
    drainPrimarySnapshots(): Promise<void>;
    drainCleanupLedger(): Promise<void>;
    beginCommit(): void;
    endCommit(result: { committed: boolean }): void;
    invalidateAndDrainPrimarySnapshots(): Promise<void>;
    persistCleanupIntent(): Promise<void>;
    removeItem(key: string): Promise<void>;
    finalizeSuccessfulCommit(): void;
  }> = {},
) {
  return {
    canPrepare: () => true,
    drainPrimarySnapshots: async () => {},
    drainCleanupLedger: async () => {},
    beginCommit: () => {},
    endCommit: (_result: { committed: boolean }) => {},
    invalidateAndDrainPrimarySnapshots: async () => {},
    persistCleanupIntent: async () => {},
    removeItem: async (_key: string) => {},
    finalizeSuccessfulCommit: () => {},
    ...overrides,
  };
}

test("Care prepare drains physically accepted snapshots and a peer prepare failure preserves Care", async () => {
  const firstStarted = deferred();
  const releaseFirst = deferred();
  const physicalWrites: string[] = [];
  const destructiveCalls: string[] = [];
  const writer = createCarePersistenceWriter<string>(async (value) => {
    physicalWrites.push(`start:${value}`);
    if (value === "active") {
      firstStarted.resolve();
      await releaseFirst.promise;
    }
    physicalWrites.push(`finish:${value}`);
  });
  const controller = createCareLocalDataResetController(
    createHooks({
      drainPrimarySnapshots: writer.drain,
      beginCommit: () => destructiveCalls.push("begin"),
      invalidateAndDrainPrimarySnapshots: writer.invalidateAndDrain,
      removeItem: async (key) => {
        destructiveCalls.push(`remove:${key}`);
      },
      finalizeSuccessfulCommit: () => destructiveCalls.push("finalize"),
    }),
  );
  const coordinator = createLocalDataResetCoordinator();
  coordinator.register({ id: "care", ...controller.participant });
  coordinator.register({
    id: "peer",
    prepare: async () => {
      throw new Error("peer unavailable");
    },
    commit: async () => {
      destructiveCalls.push("peer-commit");
    },
  });

  const active = writer.enqueue("active");
  await firstStarted.promise;
  const queued = writer.enqueue("queued");
  const reset = coordinator.run();

  releaseFirst.resolve();
  const [result] = await Promise.all([reset, active, queued]);

  assert.deepEqual(physicalWrites, [
    "start:active",
    "finish:active",
    "start:queued",
    "finish:queued",
  ]);
  assert.deepEqual(result, {
    status: "partial-failure",
    committedParticipantIds: [],
    failedParticipantIds: ["peer"],
  });
  assert.deepEqual(destructiveCalls, []);
});

test("Care prepare does not invalidate future-schema protection or mutate caller evidence", async () => {
  const protection = createCareWriteProtection();
  protection.protect();
  const protectedGeneration = protection.capture();
  const evidence = { raw: "future-care-document" };
  const originalEvidence = evidence.raw;
  const calls: string[] = [];
  const controller = createCareLocalDataResetController(
    createHooks({
      drainPrimarySnapshots: async () => {
        calls.push("drain-primary");
      },
      drainCleanupLedger: async () => {
        calls.push("drain-ledger");
      },
      beginCommit: () => {
        calls.push("begin");
        protection.invalidate();
        evidence.raw = "changed";
      },
      removeItem: async (key) => {
        calls.push(`remove:${key}`);
      },
      finalizeSuccessfulCommit: () => {
        calls.push("finalize");
      },
    }),
  );

  await controller.participant.prepare();

  assert.deepEqual(calls, ["drain-primary", "drain-ledger"]);
  assert.equal(protection.isBlocked(), true);
  assert.equal(protection.capture(), protectedGeneration);
  assert.equal(protection.canContinue(protectedGeneration), false);
  assert.equal(evidence.raw, originalEvidence);
});

test("Care commit crosses the local barrier, persists cleanup intent, removes exact keys, then finalizes", async () => {
  const calls: string[] = [];
  const controller = createCareLocalDataResetController(
    createHooks({
      beginCommit: () => calls.push("begin"),
      invalidateAndDrainPrimarySnapshots: async () => {
        calls.push("invalidate-primary");
      },
      drainCleanupLedger: async () => {
        calls.push("drain-ledger");
      },
      persistCleanupIntent: async () => {
        calls.push("persist-cleanup");
      },
      removeItem: async (key) => {
        calls.push(`remove:${key}`);
      },
      finalizeSuccessfulCommit: () => calls.push("finalize"),
      endCommit: ({ committed }) => calls.push(`end:${committed}`),
    }),
  );

  await controller.participant.prepare();
  calls.length = 0;
  await controller.participant.commit();

  assert.deepEqual(calls, [
    "begin",
    "invalidate-primary",
    "drain-ledger",
    "persist-cleanup",
    ...CARE_AUXILIARY_LOCAL_DATA_KEYS.map((key) => `remove:${key}`),
    `remove:${CARE_PRIMARY_LOCAL_DATA_KEY}`,
    "finalize",
    "end:true",
  ]);
  assert.equal(calls.includes(`remove:${CARE_PRESERVED_LOCAL_DATA_KEY}`), false);
});

test("one auxiliary removal failure still attempts every auxiliary and skips primary and finalization", async () => {
  const removed: string[] = [];
  let finalized = false;
  const failedKey = CARE_AUXILIARY_LOCAL_DATA_KEYS[1];
  const controller = createCareLocalDataResetController(
    createHooks({
      removeItem: async (key) => {
        removed.push(key);
        if (key === failedKey) throw new Error("recovery key unavailable");
      },
      finalizeSuccessfulCommit: () => {
        finalized = true;
      },
    }),
  );

  await controller.participant.prepare();
  await assert.rejects(
    controller.participant.commit(),
    /Could not remove every auxiliary Care key/,
  );

  assert.deepEqual(removed, [...CARE_AUXILIARY_LOCAL_DATA_KEYS]);
  assert.equal(removed.includes(CARE_PRIMARY_LOCAL_DATA_KEY), false);
  assert.equal(finalized, false);
});

test("primary removal failure preserves live Care state by skipping finalization", async () => {
  const removed: string[] = [];
  let finalized = false;
  let commitEnded = false;
  const controller = createCareLocalDataResetController(
    createHooks({
      removeItem: async (key) => {
        removed.push(key);
        if (key === CARE_PRIMARY_LOCAL_DATA_KEY) {
          throw new Error("primary key unavailable");
        }
      },
      finalizeSuccessfulCommit: () => {
        finalized = true;
      },
      endCommit: ({ committed }) => {
        assert.equal(committed, false);
        commitEnded = true;
      },
    }),
  );

  await controller.participant.prepare();
  await assert.rejects(controller.participant.commit(), /primary key unavailable/);

  assert.deepEqual(removed, [
    ...CARE_AUXILIARY_LOCAL_DATA_KEYS,
    CARE_PRIMARY_LOCAL_DATA_KEY,
  ]);
  assert.equal(finalized, false);
  assert.equal(commitEnded, true);
});

test("Care commit requires the current preparation and a settled controller can run again", async () => {
  let finalized = 0;
  const controller = createCareLocalDataResetController(
    createHooks({
      finalizeSuccessfulCommit: () => {
        finalized += 1;
      },
    }),
  );

  await assert.rejects(
    controller.participant.commit(),
    /Care local data reset was not prepared/,
  );

  await controller.participant.prepare();
  await controller.participant.commit();
  await assert.rejects(
    controller.participant.commit(),
    /Care local data reset was not prepared/,
  );
  await controller.participant.prepare();
  await controller.participant.commit();
  assert.equal(finalized, 2);
});

test("Care prepare fails closed until primary and cleanup-ledger hydration is complete", async () => {
  let hydrated = false;
  const calls: string[] = [];
  const controller = createCareLocalDataResetController(
    createHooks({
      canPrepare: () => hydrated,
      drainPrimarySnapshots: async () => {
        calls.push("drain-primary");
      },
      drainCleanupLedger: async () => {
        calls.push("drain-ledger");
      },
    }),
  );

  await assert.rejects(
    controller.participant.prepare(),
    /Care local data is not ready for reset/,
  );
  assert.deepEqual(calls, []);

  hydrated = true;
  await controller.participant.prepare();
  assert.deepEqual(calls, ["drain-primary", "drain-ledger"]);
});

test("a later prepare replaces stale prepared state without depending on React settlement timing", async () => {
  let finalized = 0;
  const controller = createCareLocalDataResetController(
    createHooks({
      finalizeSuccessfulCommit: () => {
        finalized += 1;
      },
    }),
  );

  await controller.participant.prepare();
  await controller.participant.prepare();
  await controller.participant.commit();
  await assert.rejects(
    controller.participant.commit(),
    /Care local data reset was not prepared/,
  );
  assert.equal(finalized, 1);
});

test("commit finalization reports false exactly once when beginCommit throws synchronously", async () => {
  const settlements: boolean[] = [];
  const controller = createCareLocalDataResetController(
    createHooks({
      beginCommit: () => {
        throw new Error("could not close local Care gate");
      },
      endCommit: ({ committed }) => {
        settlements.push(committed);
      },
    }),
  );

  await controller.participant.prepare();
  await assert.rejects(
    controller.participant.commit(),
    /could not close local Care gate/,
  );
  assert.deepEqual(settlements, [false]);
});

test("an unexpected finalizer throw reports committed because primary storage is already removed", async () => {
  const removed: string[] = [];
  const settlements: boolean[] = [];
  const controller = createCareLocalDataResetController(
    createHooks({
      removeItem: async (key) => {
        removed.push(key);
      },
      finalizeSuccessfulCommit: () => {
        throw new Error("unexpected finalizer failure");
      },
      endCommit: ({ committed }) => {
        settlements.push(committed);
      },
    }),
  );

  await controller.participant.prepare();
  await assert.rejects(
    controller.participant.commit(),
    /unexpected finalizer failure/,
  );
  assert.equal(removed.at(-1), CARE_PRIMARY_LOCAL_DATA_KEY);
  assert.deepEqual(settlements, [true]);
});

test("a rejected prepare clears an earlier successful preparation", async () => {
  let preparation = 0;
  const controller = createCareLocalDataResetController(
    createHooks({
      drainPrimarySnapshots: async () => {
        preparation += 1;
        if (preparation === 2) throw new Error("drain failed");
      },
    }),
  );

  await controller.participant.prepare();
  await assert.rejects(controller.participant.prepare(), /drain failed/);
  await assert.rejects(
    controller.participant.commit(),
    /Care local data reset was not prepared/,
  );
});

test("an auxiliary partial deletion is monotonic and a retry safely re-attempts the exact manifest", async () => {
  const attempts: string[] = [];
  let failOnce = true;
  const controller = createCareLocalDataResetController(
    createHooks({
      removeItem: async (key) => {
        attempts.push(key);
        if (key === CARE_AUXILIARY_LOCAL_DATA_KEYS[1] && failOnce) {
          failOnce = false;
          throw new Error("one auxiliary failed");
        }
      },
    }),
  );

  await controller.participant.prepare();
  await assert.rejects(controller.participant.commit());
  await controller.participant.prepare();
  await controller.participant.commit();

  assert.deepEqual(attempts, [
    ...CARE_AUXILIARY_LOCAL_DATA_KEYS,
    ...CARE_AUXILIARY_LOCAL_DATA_KEYS,
    CARE_PRIMARY_LOCAL_DATA_KEY,
  ]);
});

test("endCommit runs once with false for every pre-primary failure boundary", async () => {
  let cleanupDrainCalls = 0;
  const cases = [
    {
      name: "invalidate drain",
      hooks: {
        invalidateAndDrainPrimarySnapshots: async () => {
          throw new Error("invalidate drain failed");
        },
      },
    },
    {
      name: "cleanup ledger drain",
      hooks: {
        drainCleanupLedger: async () => {
          cleanupDrainCalls += 1;
          if (cleanupDrainCalls === 2) {
            throw new Error("cleanup drain failed");
          }
        },
      },
    },
    {
      name: "cleanup intent",
      hooks: {
        persistCleanupIntent: async () => {
          throw new Error("cleanup intent failed");
        },
      },
    },
  ] as const;

  for (const failureCase of cases) {
    const settlements: boolean[] = [];
    const controller = createCareLocalDataResetController(
      createHooks({
        ...failureCase.hooks,
        endCommit: ({ committed }) => settlements.push(committed),
      }),
    );
    await controller.participant.prepare();
    await assert.rejects(
      controller.participant.commit(),
      new RegExp(`${failureCase.name.split(" ")[0]}.*failed`),
    );
    assert.deepEqual(
      settlements,
      [false],
      `${failureCase.name} must settle exactly once`,
    );
  }
});

test("a superseded or cancelled hydration attempt cannot apply a delayed primary read", async () => {
  const authority = createCareHydrationAttemptAuthority();
  const delayedRead = deferred<string>();
  const applied: string[] = [];
  const oldAttempt = authority.begin(true);
  assert.ok(oldAttempt);
  const oldContinuation = delayedRead.promise.then((raw) => {
    if (oldAttempt.isCurrent()) applied.push(raw);
  });

  const replacement = authority.begin(true);
  assert.ok(replacement);
  delayedRead.resolve("pre-reset-primary");
  await oldContinuation;

  assert.deepEqual(applied, []);
  assert.equal(oldAttempt.isCurrent(), false);
  assert.equal(replacement.isCurrent(), true);
  replacement.cancel();
  assert.equal(replacement.isCurrent(), false);
});

test("a provider mounted while reset admission is closed cannot start hydration", () => {
  const authority = createCareHydrationAttemptAuthority();

  assert.equal(authority.begin(false), null);
  const afterSettlement = authority.begin(true);
  assert.ok(afterSettlement);
  assert.equal(afterSettlement.isCurrent(), true);
});

test("pristine suppression applies only to the exact installed state identities and revision", () => {
  const pristineDoc = { name: "default" };
  const pristineEntries: string[] = [];
  const pristine = {
    doc: pristineDoc,
    entries: pristineEntries,
    serverVersion: 0,
  };

  assert.equal(isSameCarePersistenceIdentity(pristine, pristine), true);
  assert.equal(
    isSameCarePersistenceIdentity(
      { ...pristine, doc: { name: "updated" } },
      pristine,
    ),
    false,
  );
  assert.equal(
    isSameCarePersistenceIdentity(
      { ...pristine, entries: ["real-mutation"] },
      pristine,
    ),
    false,
  );
  assert.equal(
    isSameCarePersistenceIdentity(
      { ...pristine, serverVersion: 1 },
      pristine,
    ),
    false,
  );
});

test("a real mutation before the settled epoch bypasses pristine suppression immediately", () => {
  const pristineDoc = { name: "default" };
  const pristineEntries: string[] = [];
  const pristine = {
    doc: pristineDoc,
    entries: pristineEntries,
    serverVersion: 0,
  };

  assert.equal(
    getCarePristineSnapshotPersistenceDecision({
      current: pristine,
      pristine,
      operationSettledEpoch: 4,
      resetStartedAtEpoch: 4,
    }),
    "wait",
  );
  assert.equal(
    getCarePristineSnapshotPersistenceDecision({
      current: { ...pristine, doc: { name: "mutated" } },
      pristine,
      operationSettledEpoch: 4,
      resetStartedAtEpoch: 4,
    }),
    "persist",
  );
  assert.equal(
    getCarePristineSnapshotPersistenceDecision({
      current: pristine,
      pristine,
      operationSettledEpoch: 5,
      resetStartedAtEpoch: 4,
    }),
    "suppress",
  );
});

test("a failed reset after success preserves pristine entry identity when nothing is pending", () => {
  const pristineDoc = { name: "default" };
  const pristineEntries: Array<{ syncStatus: string }> = [];
  const pristine = {
    doc: pristineDoc,
    entries: pristineEntries,
    serverVersion: 0,
  };

  const entriesAfterFailedReset =
    hasInterruptedCareEntryMutationsToRecover(pristineEntries)
      ? pristineEntries.map((entry) => ({ ...entry }))
      : pristineEntries;

  assert.equal(entriesAfterFailedReset, pristineEntries);
  assert.equal(
    getCarePristineSnapshotPersistenceDecision({
      current: { ...pristine, entries: entriesAfterFailedReset },
      pristine,
      operationSettledEpoch: 8,
      resetStartedAtEpoch: 7,
    }),
    "suppress",
  );
  assert.equal(
    hasInterruptedCareEntryMutationsToRecover([
      { syncStatus: "synced" },
      { syncStatus: "pending" },
    ]),
    true,
  );
});
