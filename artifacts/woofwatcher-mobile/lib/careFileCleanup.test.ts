import assert from "node:assert/strict";
import { test } from "node:test";

import { runCareFileCleanupAfterDurableSnapshot } from "./careFileCleanup.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("physical cleanup waits for the exact local care snapshot receipt", async () => {
  const receipt = deferred<boolean>();
  const events: string[] = [];
  const operation = runCareFileCleanupAfterDurableSnapshot({
    persistSnapshot: async () => {
      events.push("snapshot:start");
      const committed = await receipt.promise;
      events.push("snapshot:end");
      return committed;
    },
    cleanup: async () => {
      events.push("file:delete");
      return "deleted";
    },
  });

  await Promise.resolve();
  assert.deepEqual(events, ["snapshot:start"]);
  receipt.resolve(true);

  assert.deepEqual(await operation, {
    status: "cleanup-ran",
    cleanup: "deleted",
  });
  assert.deepEqual(events, ["snapshot:start", "snapshot:end", "file:delete"]);
});

test("a failed or revoked snapshot receipt retains the physical file", async () => {
  let cleanupCalls = 0;
  const result = await runCareFileCleanupAfterDurableSnapshot({
    persistSnapshot: async () => false,
    cleanup: async () => {
      cleanupCalls += 1;
    },
  });

  assert.deepEqual(result, { status: "snapshot-not-confirmed" });
  assert.equal(cleanupCalls, 0);
});
