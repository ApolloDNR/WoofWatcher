import assert from "node:assert/strict";
import { test } from "node:test";

import { createLocalDataResetRuntime } from "./localDataResetRuntime.ts";
import { createWebRuntimeLocalDataResetController } from "./webRuntimeLocalDataReset.ts";

function createStorageAdapter() {
  return {
    async getItem() {
      return null;
    },
    async setItem() {},
    async removeItem() {},
  };
}

function attachPeers(
  runtime: ReturnType<typeof createLocalDataResetRuntime>,
  webRuntimeParticipant: { prepare(): Promise<void>; commit(): Promise<void> },
) {
  for (const id of [
    "avatar",
    "care",
    "device-preferences",
    "files",
    "query-cache",
    "walk-capture",
  ] as const) {
    runtime.attachRequiredParticipant(id, {
      prepare: async () => {},
      commit: async () => {},
    });
  }
  runtime.attachRequiredParticipant("web-runtime", webRuntimeParticipant);
}

test("web-runtime cache failure is partial and a reconstructed runtime retries it", async () => {
  const deleted: string[] = [];
  let rejectDataCacheOnce = true;
  const environment = {
    platform: "web",
    cacheStorage: {
      async keys() {
        return [
          "woofwatcher-shell-current",
          "woofwatcher-runtime-current",
          "woofwatcher-data-v1",
          "unrelated-cache",
        ];
      },
      async delete(name: string) {
        deleted.push(name);
        if (name === "woofwatcher-data-v1" && rejectDataCacheOnce) {
          rejectDataCacheOnce = false;
          throw new Error("cache storage denied deletion");
        }
        return true;
      },
    },
    async requestServiceWorkerClear() {},
  };

  const first = createLocalDataResetRuntime(createStorageAdapter());
  attachPeers(
    first,
    createWebRuntimeLocalDataResetController(environment).participant,
  );
  assert.deepEqual(await first.operations.runReset(), {
    status: "partial-failure",
    committedParticipantIds: [
      "avatar",
      "care",
      "device-preferences",
      "files",
      "query-cache",
      "walk-capture",
      "work-drain",
    ],
    failedParticipantIds: ["web-runtime"],
  });

  const reconstructed = createLocalDataResetRuntime(createStorageAdapter());
  attachPeers(
    reconstructed,
    createWebRuntimeLocalDataResetController(environment).participant,
  );
  assert.equal((await reconstructed.operations.runReset()).status, "complete");
  assert.deepEqual(deleted, [
    "woofwatcher-runtime-current",
    "woofwatcher-data-v1",
    "woofwatcher-runtime-current",
    "woofwatcher-data-v1",
  ]);
});

test("web-runtime treats a service-worker negative acknowledgement as reset failure", async () => {
  const controller = createWebRuntimeLocalDataResetController({
    platform: "web",
    cacheStorage: {
      async keys() {
        return [];
      },
      async delete() {
        return true;
      },
    },
    async requestServiceWorkerClear() {
      throw new Error("service worker failed to acknowledge cache clearing");
    },
  });
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  attachPeers(runtime, controller.participant);

  const result = await runtime.operations.runReset();
  assert.equal(result.status, "partial-failure");
  assert.deepEqual(result.failedParticipantIds, ["web-runtime"]);
});
