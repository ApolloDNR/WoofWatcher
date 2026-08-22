import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createLocalDataResetRuntime,
  REQUIRED_LOCAL_DATA_PARTICIPANT_IDS,
} from "./localDataResetRuntime.ts";
import {
  buildPrivacyResetFailurePresentation,
  getPrivacyLocalDataResetView,
  runPrivacyCareDataExport,
  runPrivacyLocalDataReset,
} from "./privacyLocalDataActions.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function runtimeHarness(
  overrides: Partial<
    Record<
      (typeof REQUIRED_LOCAL_DATA_PARTICIPANT_IDS)[number],
      { prepare(): Promise<void>; commit(): Promise<void> }
    >
  > = {},
) {
  const runtime = createLocalDataResetRuntime({
    async getItem() {
      return null;
    },
    async setItem() {},
    async removeItem() {},
  });
  for (const id of REQUIRED_LOCAL_DATA_PARTICIPANT_IDS) {
    runtime.attachRequiredParticipant(
      id,
      overrides[id] ?? {
        prepare: async () => {},
        commit: async () => {},
      },
    );
  }
  return runtime;
}

test("Privacy export freezes serialized title/message and reset waits for the shipping share action", async () => {
  const runtime = runtimeHarness();
  const sharing = deferred<void>();
  const care = { dogName: "Phoenix", logs: ["meal"] };
  const delivered: Array<Readonly<{ title: string; message: string }>> = [];
  const exporting = runPrivacyCareDataExport({
    runExport: runtime.operations.runExport,
    capture: () => ({
      title: `WoofWatcher care export - ${care.dogName}`,
      message: JSON.stringify(care),
    }),
    share: async (payload) => {
      delivered.push(payload);
      await sharing.promise;
      return "shared";
    },
  });
  care.dogName = "Changed";
  care.logs.push("walk");
  let resetSettled = false;
  const reset = runtime.operations.runReset().then((result) => {
    resetSettled = true;
    return result;
  });
  await Promise.resolve();

  assert.equal(resetSettled, false);
  assert.equal(Object.isFrozen(delivered[0]), true);
  assert.deepEqual(delivered[0], {
    title: "WoofWatcher care export - Phoenix",
    message: '{"dogName":"Phoenix","logs":["meal"]}',
  });
  sharing.resolve();
  await exporting;
  assert.equal((await reset).status, "complete");
});

test("Privacy export begun after reset captures and performs nothing", async () => {
  const preparation = deferred<void>();
  const runtime = runtimeHarness({
    avatar: {
      prepare: () => preparation.promise,
      commit: async () => {},
    },
  });
  const reset = runtime.operations.runReset();
  let captures = 0;
  let shares = 0;

  await assert.rejects(
    runPrivacyCareDataExport({
      runExport: runtime.operations.runExport,
      capture: () => {
        captures += 1;
        return { title: "late", message: "late" };
      },
      share: async () => {
        shares += 1;
        return "shared";
      },
    }),
    /reset.*progress/i,
  );
  assert.equal(captures, 0);
  assert.equal(shares, 0);
  preparation.resolve();
  await reset;
});

test("Privacy treats shareTextPayload's resolved failed outcome as a failed export", async () => {
  const runtime = runtimeHarness();
  await assert.rejects(
    runPrivacyCareDataExport({
      runExport: runtime.operations.runExport,
      capture: () => ({ title: "care", message: "serialized" }),
      share: async () => "failed",
    }),
    /could not be shared/i,
  );
  assert.deepEqual(runtime.operations.getState(), {
    status: "failed",
    operation: "export",
    failedParticipantIds: [],
  });
});

test("Privacy deletion exposes exact partial categories and retry calls a fresh root reset", async () => {
  let calls = 0;
  const runReset = async () => {
    calls += 1;
    return calls === 1
      ? {
          status: "partial-failure" as const,
          committedParticipantIds: ["care"],
          failedParticipantIds: ["files", "web-runtime"],
        }
      : {
          status: "complete" as const,
          committedParticipantIds: ["care", "files", "web-runtime"],
          failedParticipantIds: [],
        };
  };

  const first = await runPrivacyLocalDataReset(runReset);
  assert.deepEqual(first, {
    status: "failed",
    failedParticipantIds: ["files", "web-runtime"],
  });
  assert.deepEqual(
    buildPrivacyResetFailurePresentation(first.failedParticipantIds),
    [
      { id: "files", label: "Files on this device" },
      { id: "web-runtime", label: "Browser/runtime cache" },
    ],
  );
  assert.deepEqual(await runPrivacyLocalDataReset(runReset), {
    status: "complete",
    failedParticipantIds: [],
  });
  assert.equal(calls, 2);
});

test("Privacy deletion rejection is failure and never complete", async () => {
  assert.deepEqual(
    await runPrivacyLocalDataReset(async () => {
      throw new Error("coordinator unavailable");
    }),
    { status: "failed", failedParticipantIds: [] },
  );
  assert.deepEqual(buildPrivacyResetFailurePresentation([]), [
    { id: "reset", label: "Deletion coordinator" },
  ]);
});

test("Privacy reset view reserves All data deleted for a complete delete verdict", () => {
  const partial = getPrivacyLocalDataResetView({
    status: "failed",
    operation: "delete",
    failedParticipantIds: ["files", "query-cache"],
  });
  assert.deepEqual(partial, {
    status: "failed",
    title: "Some data could not be deleted",
    failures: [
      { id: "files", label: "Files on this device" },
      { id: "query-cache", label: "In-app account cache" },
    ],
  });
  assert.equal(JSON.stringify(partial).includes("All data deleted"), false);

  assert.deepEqual(
    getPrivacyLocalDataResetView({
      status: "complete",
      operation: "delete",
    }),
    { status: "complete", title: "All data deleted" },
  );
  assert.deepEqual(
    getPrivacyLocalDataResetView({
      status: "complete",
      operation: "export",
    }),
    { status: "hidden" },
  );
});
