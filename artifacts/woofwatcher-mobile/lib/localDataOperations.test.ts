import assert from "node:assert/strict";
import { test } from "node:test";

import { createGenerationPermitAuthority } from "./generationPermit.ts";
import { createLocalDataOperations } from "./localDataOperations.ts";
import { createLocalDataResetCoordinator } from "./localDataResetCoordinator.ts";
import { createRemovableLocalDataStorage } from "./removableLocalDataStorage.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("captures one immutable export synchronously and coalesces concurrent callers", async () => {
  const authority = createGenerationPermitAuthority();
  const coordinator = createLocalDataResetCoordinator();
  const operations = createLocalDataOperations({
    resetCoordinator: coordinator,
    generationAuthority: authority,
  });
  const exportGate = deferred<void>();
  let source = { dogName: "Phoenix", entries: 7 };
  let captures = 0;
  let performed: Readonly<typeof source> | undefined;

  const first = operations.runExport(
    () => {
      captures += 1;
      return Object.freeze({ ...source });
    },
    async (snapshot) => {
      await exportGate.promise;
      performed = snapshot;
    },
  );
  const second = operations.runExport(
    () => {
      captures += 1;
      return Object.freeze({ dogName: "Wrong export", entries: 0 });
    },
    async () => {},
  );

  assert.equal(captures, 1);
  assert.strictEqual(second, first);
  source = { dogName: "Changed after capture", entries: 99 };

  exportGate.resolve();
  await first;

  assert.deepEqual(performed, { dogName: "Phoenix", entries: 7 });
  assert.deepEqual(operations.getState(), {
    status: "complete",
    operation: "export",
  });
});

test("export re-entry from capture and perform receives the exact outer promise", async () => {
  const authority = createGenerationPermitAuthority();
  const coordinator = createLocalDataResetCoordinator();
  const operations = createLocalDataOperations({
    resetCoordinator: coordinator,
    generationAuthority: authority,
  });
  let fromCapture: Promise<void> | undefined;
  let fromPerform: Promise<void> | undefined;
  let captureCalls = 0;

  const outer = operations.runExport(
    () => {
      captureCalls += 1;
      fromCapture = operations.runExport(
        () => "must not capture",
        async () => {},
      );
      return "captured";
    },
    async () => {
      fromPerform = operations.runExport(
        () => "must not capture",
        async () => {},
      );
    },
  );

  assert.equal(captureCalls, 1);
  assert.strictEqual(fromCapture, outer);
  assert.strictEqual(fromPerform, outer);
  await outer;
});

test("a reset requested during export waits for that export before invalidating", async () => {
  const authority = createGenerationPermitAuthority();
  const coordinator = createLocalDataResetCoordinator();
  const events: string[] = [];
  coordinator.register({
    id: "care",
    prepare: async () => {
      events.push("prepare");
    },
    commit: async () => {
      events.push("commit");
    },
  });
  const operations = createLocalDataOperations({
    resetCoordinator: coordinator,
    generationAuthority: authority,
  });
  const exportGate = deferred<void>();
  const beforeReset = authority.capture();
  const exporting = operations.runExport(
    () => "captured export",
    async () => {
      events.push("export:start");
      await exportGate.promise;
      events.push("export:finish");
    },
  );
  await Promise.resolve();

  const firstReset = operations.runReset();
  const secondReset = operations.runReset();

  assert.strictEqual(secondReset, firstReset);
  assert.equal(operations.isResetting(), true);
  assert.equal(operations.isWriteAdmissionOpen(), false);
  assert.equal(authority.isValid(beforeReset), true);
  assert.deepEqual(events, ["export:start"]);

  exportGate.resolve();
  await exporting;
  const result = await firstReset;

  assert.equal(authority.isValid(beforeReset), false);
  assert.deepEqual(events, ["export:start", "export:finish", "prepare", "commit"]);
  assert.equal(result.status, "complete");
});

test("an export caller coalesces with the active export after reset is queued", async () => {
  const operations = createLocalDataOperations({
    resetCoordinator: createLocalDataResetCoordinator(),
    generationAuthority: createGenerationPermitAuthority(),
  });
  const exportGate = deferred<void>();
  let captures = 0;
  const first = operations.runExport(
    () => {
      captures += 1;
      return "captured";
    },
    async () => exportGate.promise,
  );
  const reset = operations.runReset();

  const concurrent = operations.runExport(
    () => {
      captures += 1;
      return "must not capture";
    },
    async () => {},
  );

  assert.strictEqual(concurrent, first);
  assert.equal(captures, 1);

  exportGate.resolve();
  await Promise.all([first, reset]);
});

test("reset closes admission before preparation and invalidates only after preparation succeeds", async () => {
  const authority = createGenerationPermitAuthority();
  const coordinator = createLocalDataResetCoordinator();
  const preparation = deferred<void>();
  const oldPermit = authority.capture();
  let observedPermitValidity: boolean | undefined;
  coordinator.register({
    id: "care",
    prepare: () => {
      observedPermitValidity = authority.isValid(oldPermit);
      return preparation.promise;
    },
    commit: async () => {},
  });
  const operations = createLocalDataOperations({
    resetCoordinator: coordinator,
    generationAuthority: authority,
  });

  const reset = operations.runReset();

  assert.equal(operations.isWriteAdmissionOpen(), false);
  assert.equal(observedPermitValidity, true);
  assert.equal(authority.isValid(oldPermit), true);

  let captures = 0;
  await assert.rejects(
    operations.runExport(
      () => {
        captures += 1;
        return "must not capture";
      },
      async () => {},
    ),
    /local data reset.*progress/i,
  );
  assert.equal(captures, 0);

  preparation.resolve();
  await reset;
  assert.equal(authority.isValid(oldPermit), false);
});

test("a preparation failure completes accepted storage work without invalidating permits", async () => {
  const authority = createGenerationPermitAuthority();
  const coordinator = createLocalDataResetCoordinator();
  let admissionOpen = true;
  const physicalWrite = deferred<void>();
  const physicalWrites: string[] = [];
  const storage = createRemovableLocalDataStorage({
    storage: {
      getItem: async () => null,
      setItem: async (_key, value) => {
        physicalWrites.push(value);
        await physicalWrite.promise;
      },
      removeItem: async () => {},
    },
    capturePermit: authority.capture,
    isPermitValid: authority.isValid,
    isAdmissionOpen: () => admissionOpen,
  });
  const oldPermit = authority.capture();
  let commitCalls = 0;
  coordinator.register({
    id: "storage",
    prepare: () => storage.drain(),
    commit: async () => {
      commitCalls += 1;
    },
  });
  coordinator.register({
    id: "will-fail",
    prepare: async () => {
      throw new Error("participant preparation failed");
    },
    commit: async () => {
      commitCalls += 1;
    },
  });
  const operations = createLocalDataOperations({
    resetCoordinator: coordinator,
    generationAuthority: authority,
  });
  admissionOpen = operations.isWriteAdmissionOpen();
  operations.subscribe(() => {
    admissionOpen = operations.isWriteAdmissionOpen();
  });
  const accepted = storage.setItem("care", "accepted");
  await Promise.resolve();

  const reset = operations.runReset();
  assert.equal(operations.isWriteAdmissionOpen(), false);
  assert.equal(authority.isValid(oldPermit), true);

  physicalWrite.resolve();
  const [writeResult, resetResult] = await Promise.all([accepted, reset]);

  assert.equal(writeResult, undefined);
  assert.deepEqual(physicalWrites, ["accepted"]);
  assert.equal(resetResult.status, "partial-failure");
  assert.equal(commitCalls, 0);
  assert.equal(authority.isValid(oldPermit), true);
  assert.equal(operations.isWriteAdmissionOpen(), true);
});

test("successful reset invalidates after drain and before the first commit", async () => {
  const authority = createGenerationPermitAuthority();
  const coordinator = createLocalDataResetCoordinator();
  const oldPermit = authority.capture();
  const preparation = deferred<void>();
  const events: string[] = [];
  coordinator.register({
    id: "care",
    prepare: async () => {
      events.push(`prepare:valid=${authority.isValid(oldPermit)}`);
      await preparation.promise;
      events.push(`prepared:valid=${authority.isValid(oldPermit)}`);
    },
    commit: async () => {
      events.push(`commit:valid=${authority.isValid(oldPermit)}`);
    },
  });
  const operations = createLocalDataOperations({
    resetCoordinator: coordinator,
    generationAuthority: authority,
  });

  const reset = operations.runReset();
  assert.deepEqual(events, ["prepare:valid=true"]);
  preparation.resolve();
  await reset;

  assert.deepEqual(events, [
    "prepare:valid=true",
    "prepared:valid=true",
    "commit:valid=false",
  ]);
});

test("a partial reset result produces failed state with exact participant ids", async () => {
  const authority = createGenerationPermitAuthority();
  const coordinator = createLocalDataResetCoordinator();
  coordinator.register({
    id: "avatar",
    prepare: async () => {},
    commit: async () => {
      throw new Error("avatar removal failed");
    },
  });
  coordinator.register({
    id: "care",
    prepare: async () => {},
    commit: async () => {},
  });
  const operations = createLocalDataOperations({
    resetCoordinator: coordinator,
    generationAuthority: authority,
  });

  const result = await operations.runReset();

  assert.deepEqual(result, {
    status: "partial-failure",
    committedParticipantIds: ["care"],
    failedParticipantIds: ["avatar"],
  });
  assert.deepEqual(operations.getState(), {
    status: "failed",
    operation: "delete",
    failedParticipantIds: ["avatar"],
  });
});

test("a reset queued behind a failed export still proceeds after settlement", async () => {
  const authority = createGenerationPermitAuthority();
  const coordinator = createLocalDataResetCoordinator();
  const events: string[] = [];
  coordinator.register({
    id: "care",
    prepare: async () => {
      events.push("prepare");
    },
    commit: async () => {
      events.push("commit");
    },
  });
  const operations = createLocalDataOperations({
    resetCoordinator: coordinator,
    generationAuthority: authority,
  });
  const exportFailure = new Error("share sheet rejected");
  const exporting = operations.runExport(
    () => "captured",
    async () => {
      throw exportFailure;
    },
  );
  const reset = operations.runReset();

  await assert.rejects(exporting, (error) => error === exportFailure);
  const resetResult = await reset;

  assert.equal(resetResult.status, "complete");
  assert.deepEqual(events, ["prepare", "commit"]);
  assert.deepEqual(operations.getState(), {
    status: "complete",
    operation: "delete",
  });
});

test("display results clear to idle only after active work settles", async () => {
  const authority = createGenerationPermitAuthority();
  const coordinator = createLocalDataResetCoordinator();
  const operations = createLocalDataOperations({
    resetCoordinator: coordinator,
    generationAuthority: authority,
  });
  const exportGate = deferred<void>();
  const exporting = operations.runExport(
    () => "captured",
    async () => exportGate.promise,
  );

  operations.clearResult();
  assert.deepEqual(operations.getState(), { status: "exporting" });

  exportGate.resolve();
  await exporting;
  operations.clearResult();

  assert.deepEqual(operations.getState(), { status: "idle" });
});

test("an export re-entered by a terminal success subscriber receives the exact promise", async () => {
  const operations = createLocalDataOperations({
    resetCoordinator: createLocalDataResetCoordinator(),
    generationAuthority: createGenerationPermitAuthority(),
  });
  let reentered: Promise<void> | undefined;
  let captures = 0;
  operations.subscribe((state) => {
    if (state.status === "complete" && state.operation === "export" && !reentered) {
      reentered = operations.runExport(
        () => {
          captures += 1;
          return "unexpected second capture";
        },
        async () => {},
      );
    }
  });

  const outer = operations.runExport(
    () => {
      captures += 1;
      return "captured";
    },
    async () => {},
  );
  await outer;

  assert.equal(captures, 1);
  assert.strictEqual(reentered, outer);
});

test("a failed export re-entered by its terminal subscriber receives the exact promise", async () => {
  const operations = createLocalDataOperations({
    resetCoordinator: createLocalDataResetCoordinator(),
    generationAuthority: createGenerationPermitAuthority(),
  });
  const failure = new Error("export failed");
  let reentered: Promise<void> | undefined;
  operations.subscribe((state) => {
    if (state.status === "failed" && state.operation === "export" && !reentered) {
      reentered = operations.runExport(
        () => "unexpected second capture",
        async () => {},
      );
    }
  });

  const outer = operations.runExport(
    () => "captured",
    async () => {
      throw failure;
    },
  );
  await assert.rejects(outer, (error) => error === failure);

  assert.strictEqual(reentered, outer);
});

test("a reset re-entered by a terminal success subscriber receives the exact promise", async () => {
  const coordinator = createLocalDataResetCoordinator();
  let commitCalls = 0;
  coordinator.register({
    id: "care",
    prepare: async () => {},
    commit: async () => {
      commitCalls += 1;
    },
  });
  const operations = createLocalDataOperations({
    resetCoordinator: coordinator,
    generationAuthority: createGenerationPermitAuthority(),
  });
  let reentered: Promise<unknown> | undefined;
  operations.subscribe((state) => {
    if (state.status === "complete" && state.operation === "delete" && !reentered) {
      reentered = operations.runReset();
    }
  });

  const outer = operations.runReset();
  await outer;

  assert.equal(commitCalls, 1);
  assert.strictEqual(reentered, outer);
});

test("a partial reset re-entered by its terminal subscriber receives the exact promise", async () => {
  const coordinator = createLocalDataResetCoordinator();
  let commitCalls = 0;
  coordinator.register({
    id: "care",
    prepare: async () => {},
    commit: async () => {
      commitCalls += 1;
      throw new Error("care removal failed");
    },
  });
  const operations = createLocalDataOperations({
    resetCoordinator: coordinator,
    generationAuthority: createGenerationPermitAuthority(),
  });
  let didReenter = false;
  let reentered: Promise<unknown> | undefined;
  operations.subscribe((state) => {
    if (state.status === "failed" && state.operation === "delete" && !didReenter) {
      didReenter = true;
      reentered = operations.runReset();
    }
  });

  const outer = operations.runReset();
  const result = await outer;

  assert.equal(result.status, "partial-failure");
  assert.equal(commitCalls, 1);
  assert.strictEqual(reentered, outer);
});

test("a synchronously rejected coordinator re-entered by its terminal subscriber coalesces", async () => {
  const failure = new Error("coordinator rejected synchronously");
  let coordinatorCalls = 0;
  const operations = createLocalDataOperations({
    resetCoordinator: {
      register: () => () => {},
      run: () => {
        coordinatorCalls += 1;
        throw failure;
      },
    },
    generationAuthority: createGenerationPermitAuthority(),
  });
  let didReenter = false;
  let reentered: Promise<unknown> | undefined;
  operations.subscribe((state) => {
    if (state.status === "failed" && state.operation === "delete" && !didReenter) {
      didReenter = true;
      reentered = operations.runReset();
    }
  });

  const outer = operations.runReset();
  await assert.rejects(outer, (error) => error === failure);

  assert.equal(coordinatorCalls, 1);
  assert.strictEqual(reentered, outer);
});
