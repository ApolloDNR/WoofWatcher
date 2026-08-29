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
import { preparePrivacyCareExportWithDeviceInventory } from "./privacyCareDataExport.ts";
import type { LocalDataIntent } from "./localDataIntent.ts";

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
  for (let turn = 0; turn < 50 && delivered.length === 0; turn += 1) {
    await Promise.resolve();
  }

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

test("Privacy export awaits physical inventory under export/reset exclusion before sharing", async () => {
  const runtime = runtimeHarness();
  const inventory = deferred<{ status: "complete"; fileCount: number }>();
  const shared: Array<{ title: string; message: string }> = [];
  const exportOperation = runPrivacyCareDataExport({
    runExport: runtime.operations.runExport,
    capture: () =>
      Object.freeze({
        title: "WoofWatcher care export - Phoenix",
        serializedBundle:
          '{"storage":{"deviceFileInventory":{"status":"not-inspected","fileCount":null}}}',
        inventoryIntent: Object.freeze({ marker: "current" }),
      }),
    prepare: async (captured) => {
      assert.equal(Object.isFrozen(captured), true);
      const result = await inventory.promise;
      return {
        title: captured.title,
        message: captured.serializedBundle.replace(
          '{"status":"not-inspected","fileCount":null}',
          `{"status":"${result.status}","fileCount":${result.fileCount}}`,
        ),
      };
    },
    share: async (payload) => {
      shared.push(payload);
      return "shared";
    },
  });
  let resetSettled = false;
  const reset = runtime.operations.runReset().then((result) => {
    resetSettled = true;
    return result;
  });
  await Promise.resolve();
  assert.equal(resetSettled, false);
  assert.deepEqual(shared, []);

  inventory.resolve({ status: "complete", fileCount: 9 });
  await exportOperation;
  assert.equal((await reset).status, "complete");
  assert.deepEqual(shared, [
    {
      title: "WoofWatcher care export - Phoenix",
      message:
        '{"storage":{"deviceFileInventory":{"status":"complete","fileCount":9}}}',
    },
  ]);
});

test("Privacy export inventory failure shares nothing and never reports export complete", async () => {
  const runtime = runtimeHarness();
  let shares = 0;

  await assert.rejects(
    runPrivacyCareDataExport({
      runExport: runtime.operations.runExport,
      capture: () => ({ snapshot: "care" }),
      prepare: async () => {
        throw new Error("physical inventory unavailable");
      },
      share: async () => {
        shares += 1;
        return "shared";
      },
    }),
    /inventory unavailable/i,
  );
  assert.equal(shares, 0);
  assert.deepEqual(runtime.operations.getState(), {
    status: "failed",
    operation: "export",
    failedParticipantIds: [],
  });
});

test("consumer Privacy preparation serializes complete or unsupported inventory without paths", async () => {
  const inventoryIntent = Object.freeze({}) as LocalDataIntent;
  const captured = Object.freeze({
    title: "WoofWatcher care export - Phoenix",
    serializedBundle:
      '{"app":"WoofWatcher","storage":{"deviceFileInventory":{"status":"not-inspected","fileCount":null}}}',
    inventoryIntent,
  });

  const native = await preparePrivacyCareExportWithDeviceInventory(
    captured,
    async (intent) => {
      assert.equal(intent, inventoryIntent);
      return { status: "complete", fileCount: 12 };
    },
  );
  assert.equal(native.title, captured.title);
  assert.deepEqual(JSON.parse(native.message).storage.deviceFileInventory, {
    status: "complete",
    fileCount: 12,
  });
  assert.doesNotMatch(
    native.message,
    /file:\/\/\/secret|ImagePicker\/photo|phoenix-portrait/i,
  );

  const web = await preparePrivacyCareExportWithDeviceInventory(
    captured,
    async () => ({ status: "unsupported-platform" }),
  );
  assert.deepEqual(JSON.parse(web.message).storage.deviceFileInventory, {
    status: "unsupported-platform",
    fileCount: null,
  });

  await assert.rejects(
    preparePrivacyCareExportWithDeviceInventory(captured, async () => ({
      status: "revoked",
    })),
    /reset.*progress/i,
  );
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

test("Privacy never marks a dismissed native share as a completed export", async () => {
  const runtime = runtimeHarness();
  await assert.rejects(
    runPrivacyCareDataExport({
      runExport: runtime.operations.runExport,
      capture: () => ({ title: "care", message: "serialized" }),
      share: async () => "dismissed",
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "PrivacyExportDismissedError");
      assert.match(error.message, /dismissed/i);
      return true;
    },
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

test("Privacy reset view uses truthful complete wording for retained anti-resurrection metadata", () => {
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

  const complete = getPrivacyLocalDataResetView({
    status: "complete",
    operation: "delete",
  });
  assert.equal(complete.status, "complete");
  assert.equal(complete.title, "Local care content deleted");
  assert.match(complete.detail, /opaque reset and sync-cleanup markers/i);
  assert.match(complete.detail, /stale tabs/i);
  assert.match(complete.detail, /no care details/i);
  assert.match(complete.detail, /contain no care details/i);
  assert.equal(JSON.stringify(complete).includes("All data deleted"), false);
  assert.deepEqual(
    getPrivacyLocalDataResetView({
      status: "complete",
      operation: "export",
    }),
    { status: "hidden" },
  );
});
